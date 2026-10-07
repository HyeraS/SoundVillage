'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SPEED, TILE, ZONE_META, useKeys } from '@/components/GameEngine'
import WorldMapScene, { WORLD_MAP_V4_OBJECT_COUNT } from '@/components/world-map/WorldMapScene'
import { WorldCharacter, WorldLandmarkHotspot, WorldPortalHotspot } from '@/components/world-map/WorldMapActors'
import { WorldAttendancePanel, WorldEconomyAttendancePanel, WorldDPad, WorldEnterPrompt, WorldMapHUD, WorldObjective, WorldQuestPanel } from '@/components/world-map/WorldMapUI'
import { useWorldMapAmbience } from '@/components/world-map/useWorldMapAmbience'
import { inferInteractionMethod, trackEvent } from '@/lib/userEvents'
import {
  WORLD_HOME, WORLD_MAP_HEIGHT_TILES, WORLD_MAP_WIDTH_TILES, WORLD_MUSEUM, WORLD_PLAYER, WORLD_PORTALS, WORLD_SPAWN,
  moveWorldPlayer, worldDestinationContainsFoot, worldPlayerFootCenter, worldPlayerTopLeftAtFoot, worldZoneEntrancePosition,
} from '@/lib/worldMapGeometry.mjs'
import { calculateWorldCamera, resolveWorldCharacterVisualScale, WORLD_CAMERA_HUD_HEIGHT } from '@/lib/worldMapCamera.mjs'
import { getWorldNavigationRoute } from '@/lib/worldMapNavigation.mjs'
import { getHomeLandmarkState } from '@/lib/homeHub.mjs'
import { WORLD_MAP_V4_ASSET_MANIFEST, queryWorldMapObjects, queryWorldMapTerrainPanels } from '@/lib/worldMapV4Manifest.mjs'
import { WORLD_MAP_V4_PREVIEW } from '@/lib/worldMapV4Assets.mjs'
import { WORLD_MAP_FLAT_V2_ASSET } from '@/lib/worldMapFlatV2.mjs'
import { WORLD_MAP_RENDER_MODE, WORLD_MAP_RENDER_MODES } from '@/lib/worldMapMode.mjs'
import {
  WORLD_MINIMAP_DESTINATIONS, WORLD_MINIMAP_SIZE, getWorldObjective, withWorldObjectiveArrival, worldToMinimap,
} from '@/lib/worldMapMinimap.mjs'
import { normalizeDuoCharacterLoadout, resolveCharacterEquipmentAssets } from '@/lib/duoCharacterIdentityContract.mjs'

const WORLD_WIDTH = WORLD_MAP_WIDTH_TILES * TILE
const WORLD_HEIGHT = WORLD_MAP_HEIGHT_TILES * TILE
const { width: CHAR_W, height: CHAR_H } = WORLD_PLAYER
const HUD_H = WORLD_CAMERA_HUD_HEIGHT
const worldAssetLoads = new Map()
const DEFAULT_WORLD_QA = Object.freeze({ overview:false, clean:false, collisionDebug:false, referenceOverlay:false, minimapQa:false, layer:'all', start:null, autoWalk:null, homeState:null })

function preloadWorldAsset(assetId, asset) {
  if (worldAssetLoads.has(assetId)) return worldAssetLoads.get(assetId)
  const promise = new Promise(resolve => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = async () => { try { await image.decode?.() } catch {}; resolve({ assetId, ok:true }) }
    image.onerror = () => resolve({ assetId, ok:false })
    image.src = asset.src
  })
  worldAssetLoads.set(assetId, promise)
  return promise
}

function getWorldQaOptions() {
  const internalBrowserQa = process.env.NODE_ENV === 'development'
    || process.env.NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA === 'true'
  if (typeof window === 'undefined' || !internalBrowserQa) {
    return DEFAULT_WORLD_QA
  }
  const query = new URLSearchParams(window.location.search)
  const [tx, ty] = (query.get('worldStart') || '').split(',').map(Number)
  const autoWalk = query.get('worldAutoWalk')
  return {
    overview:query.get('worldOverview') === '1' || query.get('worldClean') === '1', clean:query.get('worldClean') === '1',
    collisionDebug:query.get('worldCollisionDebug') === '1', referenceOverlay:query.get('worldReferenceOverlay') === '1',
    minimapQa:query.get('worldMinimapQa') === '1',
    layer:['terrain', 'objects', 'foreground', 'collision', 'reference'].includes(query.get('worldLayer')) ? query.get('worldLayer') : 'all',
    start:Number.isFinite(tx) && Number.isFinite(ty) ? { tx, ty } : null,
    autoWalk:['Lab', 'Animal', 'Urban', 'Music', 'Human', 'Nature', 'Home', 'Sound Library'].includes(autoWalk) ? autoWalk : null,
    homeState:['default', 'decorating', 'invite-ready', 'visitor'].includes(query.get('worldHomeState')) ? query.get('worldHomeState') : null,
  }
}

export default function WorldMap({ onEnterZone, onEnterMuseum, onEnterHouse, initialZone = null, totalCount, zoneProgress = {}, balance = 0, economyMode = 'legacy', economyRuntimeState = 'legacy', economyBalances = {}, economyAttendance = null, onEconomyAttendanceClaim, onEconomyRetry, dryRun = false, dryRunAttendanceClaimed = false, onDryRunAttendanceClaim, outfitSrc, accessorySrc, characterLoadout, participantId = '', roomShareToken = null, homeHubStatus = {}, duo = null, duoConnectionState = null, lockedZones = [] }) {
  const lockedSet = useMemo(() => new Set(lockedZones), [lockedZones])
  const [worldQa] = useState(getWorldQaOptions)
  useWorldMapAmbience(!worldQa.overview)
  const [viewport, setViewport] = useState(() => ({ width:typeof window === 'undefined' ? 1280 : window.innerWidth, height:typeof window === 'undefined' ? 720 : window.innerHeight }))
  const entrancePosition = worldQa.start ? null : worldZoneEntrancePosition(initialZone, TILE)
  const [pos, setPos] = useState(() => entrancePosition ?? worldPlayerTopLeftAtFoot(worldQa.start?.tx ?? WORLD_SPAWN.tx, worldQa.start?.ty ?? WORLD_SPAWN.ty, TILE))
  const [dir, setDir] = useState(() => entrancePosition ? 'up' : 'down')
  const [moving, setMoving] = useState(false)
  const [nearZone, setNearZone] = useState(null)
  const [nearMuseum, setNearMuseum] = useState(false)
  const [nearHome, setNearHome] = useState(false)
  const [questOpen, setQuestOpen] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [questPanelInstanceId, setQuestPanelInstanceId] = useState(null)
  const [animationTick, setAnimationTick] = useState(0)
  const [mapReady, setMapReady] = useState(false)
  const [autoWalkArrived, setAutoWalkArrived] = useState(false)
  const [loadedAssetCount, setLoadedAssetCount] = useState(0)
  const [failedAssetCount, setFailedAssetCount] = useState(0)
  const [collisionInfo, setCollisionInfo] = useState({ input:'idle', blockedX:false, blockedY:false, reason:'' })
  const [qaPerformance, setQaPerformance] = useState({ mapReadyMs:0, assetTransferBytes:0, assetDecodedBytes:0, assetResourceCount:0, averageFps:0, slowFrames:0, maxFrameMs:0, heapDelta:0 })
  const { keys, press, release } = useKeys({ disabled:questOpen || attendanceOpen, screen:'world' })
  const posRef = useRef(pos)
  const dirRef = useRef(dir)
  const rafRef = useRef(null)
  const proximityRef = useRef('')
  const questOpenRef = useRef(false)
  const attendanceOpenRef = useRef(false)
  const loadedAssetIdsRef = useRef(new Set())
  const mapLoadStartedRef = useRef(0)
  const initialHeapRef = useRef(0)
  const frameStatsRef = useRef({ frames:0, totalMs:0, slowFrames:0, maxFrameMs:0 })
  const autoWalkRef = useRef((() => {
    if (!worldQa.autoWalk) return null
    const route = getWorldNavigationRoute(worldQa.autoWalk)
    return route ? { points:route.points.slice(1), index:0, arrived:false } : null
  })())
  const camera = calculateWorldCamera({ viewportWidth:viewport.width, viewportHeight:viewport.height, hudHeight:HUD_H, overview:worldQa.overview, worldWidth:WORLD_WIDTH, worldHeight:WORLD_HEIGHT })
  const cameraCssScale = camera.contentScale
  const characterMetrics = resolveWorldCharacterVisualScale({ viewportWidth:viewport.width, viewportHeight:viewport.height, hudHeight:HUD_H, logicalCharacterHeight:CHAR_H, overview:worldQa.overview })
  const labelTargetHeight = viewport.width <= 720 || camera.sceneHeight <= 500 ? 9 : 11
  const worldLabelScale = Math.max(1, labelTargetHeight / (11 * cameraCssScale))

  useEffect(() => { questOpenRef.current = questOpen }, [questOpen])
  useEffect(() => { attendanceOpenRef.current = attendanceOpen }, [attendanceOpen])
  useEffect(() => {
    const updateViewport = () => setViewport({ width:window.innerWidth, height:window.innerHeight })
    updateViewport(); window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])
  useEffect(() => {
    let active = true
    mapLoadStartedRef.current = performance.now()
    initialHeapRef.current = performance.memory?.usedJSHeapSize || 0
    const modularIds = [...new Set([...queryWorldMapTerrainPanels(camera, 96).map(panel => panel.assetId), ...queryWorldMapObjects(camera, 96).objects.map(object => object.assetId)])]
    const preloadJobs = WORLD_MAP_RENDER_MODE === WORLD_MAP_RENDER_MODES.FLAT_V2
      ? [preloadWorldAsset(WORLD_MAP_FLAT_V2_ASSET.id, WORLD_MAP_FLAT_V2_ASSET)]
      : [preloadWorldAsset('terrain-preview', WORLD_MAP_V4_PREVIEW), ...modularIds.map(assetId => preloadWorldAsset(assetId, WORLD_MAP_V4_ASSET_MANIFEST[assetId]))]
    Promise.all(preloadJobs).then(results => {
      if (!active) return
      results.forEach(result => { if (result.ok && result.assetId !== 'terrain-preview') loadedAssetIdsRef.current.add(result.assetId) })
      setLoadedAssetCount(loadedAssetIdsRef.current.size); setFailedAssetCount(results.filter(result => !result.ok).length); setMapReady(true)
      const flatMode = WORLD_MAP_RENDER_MODE === WORLD_MAP_RENDER_MODES.FLAT_V2
      const resourceNeedle = flatMode ? '/spring-sound-archive-garden-flat-v2/' : '/sound-archive-garden-v4/runtime/'
      const resources = performance.getEntriesByType('resource').filter(entry => entry.name.includes(resourceNeedle))
      const records = [...loadedAssetIdsRef.current].map(assetId => WORLD_MAP_V4_ASSET_MANIFEST[assetId]).filter(Boolean)
      const decodedBytes = flatMode
        ? WORLD_MAP_FLAT_V2_ASSET.decodedRGBA
        : WORLD_MAP_V4_PREVIEW.decodedRGBA + records.reduce((sum, asset) => sum + asset.decodedRGBA, 0)
      setQaPerformance(current => ({ ...current, mapReadyMs:performance.now() - mapLoadStartedRef.current, assetTransferBytes:resources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0), assetDecodedBytes:decodedBytes, assetResourceCount:resources.length }))
    })
    return () => { active = false }
  // Initial readiness deliberately follows the first camera only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const handleAssetLoad = useCallback(assetId => { if (!loadedAssetIdsRef.current.has(assetId)) { loadedAssetIdsRef.current.add(assetId); setLoadedAssetCount(loadedAssetIdsRef.current.size) } }, [])
  const handleAssetError = useCallback(() => setFailedAssetCount(count => count + 1), [])

  const closeQuestPanel = useCallback((reason, event = null) => {
    if (!questOpenRef.current) return
    questOpenRef.current = false; setQuestOpen(false)
    trackEvent('quest_panel_closed', { target_type:'panel', target_id:'world-quest-panel', close_reason:reason, interaction_method:event ? inferInteractionMethod(event.nativeEvent || event) : 'programmatic' })
  }, [])
  const closeAttendancePanel = useCallback((reason, event = null) => {
    if (!attendanceOpenRef.current) return
    attendanceOpenRef.current = false; setAttendanceOpen(false)
    trackEvent('attendance_panel_closed', { target_type:'panel', target_id:'world-attendance-panel', close_reason:reason, interaction_method:event ? inferInteractionMethod(event.nativeEvent || event) : 'programmatic' })
  }, [])
  const toggleQuestPanel = useCallback(event => {
    if (questOpenRef.current) return closeQuestPanel('close_button', event)
    if (attendanceOpenRef.current) closeAttendancePanel('navigation')
    questOpenRef.current = true; setQuestPanelInstanceId(crypto.randomUUID()); setQuestOpen(true)
    trackEvent('quest_panel_opened', { target_type:'panel', target_id:'world-quest-panel', interaction_method:inferInteractionMethod(event.nativeEvent) })
  }, [closeAttendancePanel, closeQuestPanel])
  const toggleAttendancePanel = useCallback(event => {
    if (attendanceOpenRef.current) return closeAttendancePanel('close_button', event)
    if (questOpenRef.current) closeQuestPanel('navigation')
    attendanceOpenRef.current = true; setAttendanceOpen(true)
    trackEvent('attendance_panel_opened', { target_type:'panel', target_id:'world-attendance-panel', interaction_method:inferInteractionMethod(event.nativeEvent) })
  }, [closeAttendancePanel, closeQuestPanel])
  useEffect(() => () => {
    if (questOpenRef.current) trackEvent('quest_panel_closed', { target_type:'panel', target_id:'world-quest-panel', close_reason:'component_unmounted' })
    if (attendanceOpenRef.current) trackEvent('attendance_panel_closed', { target_type:'panel', target_id:'world-attendance-panel', close_reason:'component_unmounted' })
  }, [])

  const { partnerId = null, partnerPos = null, sendPosition = null } = duo || {}
  const partnerOnMap = Boolean(partnerId && partnerPos && partnerPos.screen === 'worldmap')
  const partnerCharacterLoadout = normalizeDuoCharacterLoadout(duo?.peerCharacterLoadout)
  const partnerEquipment = resolveCharacterEquipmentAssets(partnerCharacterLoadout)
  useEffect(() => { if (!moving && !partnerOnMap) return; const timer = setInterval(() => setAnimationTick(value => value + 1), 100); return () => clearInterval(timer) }, [moving, partnerOnMap])
  useEffect(() => {
    const key = nearZone ? `zone:${nearZone}` : nearMuseum ? 'museum' : nearHome ? 'home' : ''
    if (key === proximityRef.current) return
    proximityRef.current = key
    if (nearZone) trackEvent('collectible_prompt_shown', { zone:nearZone, target_type:'zone_portal', target_id:`zone-${nearZone.toLowerCase()}`, metadata:{ locked:lockedSet.has(nearZone) } })
  }, [nearZone, nearMuseum, nearHome, lockedSet])
  useEffect(() => {
    let lastTime = performance.now()
    const loop = now => {
      const frameMs = now - lastTime; const delta = Math.min(frameMs / 16.67, 3); lastTime = now
      const stats = frameStatsRef.current
      stats.frames += 1; stats.totalMs += frameMs; stats.slowFrames += frameMs > 50 ? 1 : 0; stats.maxFrameMs = Math.max(stats.maxFrameMs, frameMs)
      if (stats.frames >= 120) {
        setQaPerformance(current => ({ ...current, averageFps:stats.totalMs ? 1000 / (stats.totalMs / stats.frames) : 0, slowFrames:stats.slowFrames, maxFrameMs:stats.maxFrameMs, heapDelta:performance.memory?.usedJSHeapSize && initialHeapRef.current ? performance.memory.usedJSHeapSize - initialHeapRef.current : 0 }))
        frameStatsRef.current = { frames:0, totalMs:0, slowFrames:0, maxFrameMs:0 }
      }
      const input = keys.current; const current = posRef.current; const speed = SPEED * delta
      let dx = 0, dy = 0, nextDir = dirRef.current, attempted = false
      const autoWalk = questOpenRef.current || attendanceOpenRef.current ? null : autoWalkRef.current
      if (autoWalk && !autoWalk.arrived) {
        const foot = worldPlayerFootCenter(current.x, current.y)
        let target = autoWalk.points[autoWalk.index]
        let distance = Math.hypot(target.x - foot.x, target.y - foot.y)
        if (distance <= Math.max(1.5, Math.min(3, speed * .25))) {
          if (autoWalk.index < autoWalk.points.length - 1) target = autoWalk.points[++autoWalk.index]
          else { autoWalk.arrived = true; setAutoWalkArrived(true) }
        }
        if (!autoWalk.arrived) {
          const rx = target.x - foot.x, ry = target.y - foot.y
          distance = Math.hypot(rx, ry) || 1; const step = Math.min(speed, distance)
          dx = rx / distance * step; dy = ry / distance * step
          nextDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); attempted = true
        }
      } else {
        if (input.up) { dy -= speed; nextDir = 'up'; attempted = true }
        if (input.down) { dy += speed; nextDir = 'down'; attempted = true }
        if (input.left) { dx -= speed; nextDir = 'left'; attempted = true }
        if (input.right) { dx += speed; nextDir = 'right'; attempted = true }
      }
      const movement = moveWorldPlayer(current, dx, dy)
      if (movement.moved) {
        const next = { x:movement.x, y:movement.y }; posRef.current = next; setPos(next)
        if (nextDir !== dirRef.current) { dirRef.current = nextDir; setDir(nextDir) }
      }
      setMoving(movement.moved)
      if (worldQa.collisionDebug && attempted) setCollisionInfo({ input:[input.up && 'up', input.down && 'down', input.left && 'left', input.right && 'right'].filter(Boolean).join('+') || 'auto', blockedX:movement.blockedX, blockedY:movement.blockedY, reason:movement.blockedReason })
      setNearZone(WORLD_PORTALS.find(portal => worldDestinationContainsFoot(movement, portal, TILE))?.zone ?? null)
      setNearMuseum(worldDestinationContainsFoot(movement, WORLD_MUSEUM, TILE)); setNearHome(worldDestinationContainsFoot(movement, WORLD_HOME, TILE))
      sendPosition(movement.x, movement.y, nextDir, 'worldmap', movement.moved)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [keys, sendPosition, worldQa.collisionDebug])

  const activateNearbyDestination = useCallback(interactionMethod => {
    if (nearZone && lockedSet.has(nearZone)) trackEvent('zone_entry_blocked', { zone:nearZone, target_type:'zone_portal', target_id:`zone-${nearZone.toLowerCase()}`, interaction_method:interactionMethod, outcome:'blocked', metadata:{ locked:true, blocked_reason:'prerequisite_incomplete' } })
    else if (nearZone) onEnterZone(nearZone)
    else if (nearMuseum && onEnterMuseum) onEnterMuseum()
    else if (nearHome && onEnterHouse) onEnterHouse()
  }, [nearZone, nearMuseum, nearHome, lockedSet, onEnterZone, onEnterMuseum, onEnterHouse])
  useEffect(() => {
    const handleKey = e => {
      if (e.key === 'Escape' && !e.repeat) {
        if (questOpenRef.current) { e.preventDefault(); closeQuestPanel('escape', e); return }
        if (attendanceOpenRef.current) { e.preventDefault(); closeAttendancePanel('escape', e); return }
      }
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !questOpenRef.current && !attendanceOpenRef.current) { e.preventDefault(); activateNearbyDestination('keyboard') }
    }
    window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey)
  }, [activateNearbyDestination, closeAttendancePanel, closeQuestPanel])

  const sceneStats = useMemo(() => WORLD_MAP_RENDER_MODE === WORLD_MAP_RENDER_MODES.FLAT_V2 ? { objects:[], chunks:[] } : queryWorldMapObjects(camera), [camera])
  const playerFoot = worldPlayerFootCenter(pos.x, pos.y)
  const baseObjective = useMemo(() => getWorldObjective({ lockedZones, zoneProgress }), [lockedZones, zoneProgress])
  const objective = withWorldObjectiveArrival(baseObjective, playerFoot)
  const objectiveDestination = WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === objective.destinationId)
  const objectiveMeta = objectiveDestination?.zone ? ZONE_META[objectiveDestination.zone] : null
  const objectiveLabel = objectiveDestination?.zone === 'Lab' ? '연구소 마을' : objectiveMeta?.label
  const homeState = worldQa.homeState || getHomeLandmarkState({ ...homeHubStatus, visitorConnected:partnerOnMap })
  const minimapDisplaySize = viewport.width <= 720 ? { width:144, height:108 } : { width:240, height:180 }
  const minimapPlayer = worldToMinimap(playerFoot, WORLD_MINIMAP_SIZE, minimapDisplaySize)
  const characters = []
  if (!worldQa.clean && partnerOnMap) characters.push({ key:'duo-partner', sortY:worldPlayerFootCenter(partnerPos.x, partnerPos.y).y, node:<foreignObject key="duo-partner" data-testid="duo-partner" data-character-sync={duo?.peerCharacterStatus || 'idle'} x={partnerPos.x} y={partnerPos.y} width={CHAR_W} height={CHAR_H} style={{ overflow:'visible' }}><div xmlns="http://www.w3.org/1999/xhtml" style={{ width:CHAR_W, height:CHAR_H, position:'relative' }}><div style={{ position:'absolute', top:-20, left:0, right:0, textAlign:'center', fontSize:12, fontWeight:700, color:'#fff', textShadow:'0 0 3px #000' }}>방문객</div><WorldCharacter dir={partnerPos.facing || 'down'} moving={partnerPos.moving} outfitSrc={partnerEquipment.outfitSrc} accessorySrc={partnerEquipment.accessorySrc} characterLoadout={partnerCharacterLoadout} animationTick={animationTick} renderScale={characterMetrics.visualScale}/></div></foreignObject> })
  if (!worldQa.clean) characters.push({ key:'local-player', sortY:playerFoot.y, node:<foreignObject key="local-player" data-testid="world-player" data-player-x={Math.round(pos.x)} data-player-y={Math.round(pos.y)} x={pos.x} y={pos.y} width={CHAR_W} height={CHAR_H} style={{ overflow:'visible' }}><div xmlns="http://www.w3.org/1999/xhtml" style={{ width:CHAR_W, height:CHAR_H }}><WorldCharacter dir={dir} moving={moving} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout} animationTick={animationTick} renderScale={characterMetrics.visualScale}/></div></foreignObject> })

  return <div data-testid="world-map" data-current-screen="world" data-world-render-mode={WORLD_MAP_RENDER_MODE} data-map-ready={mapReady ? 'true' : 'false'} data-auto-walk={worldQa.autoWalk || ''} data-auto-walk-arrived={autoWalkArrived ? 'true' : 'false'} data-near-destination={nearZone || (nearMuseum ? 'Sound Library' : nearHome ? 'Home' : '')} data-map-ready-ms={qaPerformance.mapReadyMs.toFixed(1)} data-asset-transfer-bytes={qaPerformance.assetTransferBytes} data-asset-decoded-bytes={qaPerformance.assetDecodedBytes} data-asset-resource-count={qaPerformance.assetResourceCount} data-average-fps={qaPerformance.averageFps.toFixed(1)} data-slow-frames={qaPerformance.slowFrames} data-max-frame-ms={qaPerformance.maxFrameMs.toFixed(1)} data-heap-delta={qaPerformance.heapDelta} data-camera-view-w={camera.width.toFixed(2)} data-camera-view-h={camera.height.toFixed(2)} data-camera-css-scale={cameraCssScale.toFixed(6)} data-character-target-height={characterMetrics.targetScreenHeight} data-character-render-scale={characterMetrics.visualScale.toFixed(6)} data-world-label-scale={worldLabelScale.toFixed(6)} data-rendered-object-count={sceneStats.objects.length} data-failed-asset-count={failedAssetCount} style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', userSelect:'none' }}>
    {(duo?.status && duo.status !== 'idle' || duoConnectionState?.status === 'error') && <div data-testid="duo-world-status" role={duoConnectionState?.status === 'error' ? 'alert' : 'status'} style={{ position:'fixed', zIndex:250, top:12, left:'50%', transform:'translateX(-50%)', padding:'8px 14px', border:'2px solid #3A2A14', borderRadius:12, background:'#FFF8E8', color:'#3A2A14', fontWeight:800, fontSize:12 }}>
      {duoConnectionState?.status === 'error' ? `실시간 입장 실패: ${duoConnectionState.code}` : duo.status === 'joined' ? '실시간 동행 연결됨' : duo.status === 'disconnected' ? '연결이 끊겨 다시 연결하는 중…' : duo.status === 'stale' ? '이 탭의 연결 시간이 만료됐어요.' : duo.status === 'closed' ? '실시간 세션이 종료됐어요.' : '실시간 동행 연결 중…'}
    </div>}
    {!worldQa.overview && <WorldMapHUD totalCount={totalCount} zoneProgress={zoneProgress} balance={balance} economyMode={economyMode} economyBalances={economyBalances} homeState={homeState} onOpenHome={onEnterHouse} onOpenQuests={toggleQuestPanel} onOpenAttendance={toggleAttendancePanel}/>}
    {questOpen && <WorldQuestPanel participantId={participantId} economyMode={economyMode} runtimeState={economyRuntimeState} dryRun={dryRun} onClose={closeQuestPanel} instanceId={questPanelInstanceId}/>}
    {attendanceOpen && (dryRun
      ? <WorldAttendancePanel participantId={participantId} runtimeState={economyRuntimeState} dryRun qaClaimed={dryRunAttendanceClaimed} onQaClaim={onDryRunAttendanceClaim} onClose={closeAttendancePanel}/>
      : economyMode === 'cutover'
        ? <WorldEconomyAttendancePanel attendance={economyAttendance} runtimeState={economyRuntimeState} onClaim={onEconomyAttendanceClaim} onRetry={onEconomyRetry} onClose={closeAttendancePanel}/>
        : <WorldAttendancePanel participantId={participantId} runtimeState={economyRuntimeState} onClose={closeAttendancePanel}/>)}
    <div style={{ position:'absolute', top:worldQa.overview ? 0 : HUD_H, left:0, right:0, bottom:0, background:mapReady ? '#567342' : '#465b32', overflow:'hidden' }}>
      <svg width="100%" height="100%" viewBox="0 0 3840 2880" preserveAspectRatio="xMidYMid meet" style={{ display:'block', position:'absolute', inset:0 }}>
        <WorldMapScene renderMode={WORLD_MAP_RENDER_MODE} camera={camera} characters={characters} qa={worldQa} foot={playerFoot} collisionInfo={collisionInfo} onAssetLoad={handleAssetLoad} onAssetError={handleAssetError} interactionLayer={!worldQa.clean && <g data-layer="interaction">{WORLD_PORTALS.map(portal => <WorldPortalHotspot key={portal.zone} portal={portal} hovered={nearZone === portal.zone} progress={zoneProgress[portal.zone] || 0} locked={lockedSet.has(portal.zone)} labelScale={worldLabelScale}/>)}<WorldLandmarkHotspot kind="museum" hovered={nearMuseum} labelScale={worldLabelScale}/><WorldLandmarkHotspot kind="home" hovered={nearHome} state={homeState} labelScale={worldLabelScale}/></g>}/>
      </svg>
    </div>
    {worldQa.collisionDebug && <div data-testid="world-collision-debug-panel" style={{ position:'fixed', zIndex:200, left:12, top:worldQa.overview ? 12 : HUD_H + 12, padding:'10px 12px', borderRadius:8, background:'#101713e8', color:'#fff', font:'12px/1.5 ui-monospace, monospace', pointerEvents:'none', whiteSpace:'pre-line' }}>{`foot: ${playerFoot.x.toFixed(1)}, ${playerFoot.y.toFixed(1)}\ninput: ${collisionInfo.input}\nblocked X: ${collisionInfo.blockedX ? 'yes' : 'no'}\nblocked Y: ${collisionInfo.blockedY ? 'yes' : 'no'}\nreason: ${collisionInfo.reason || 'none'}\nrendered: ${sceneStats.objects.length}\nculled: ${WORLD_MAP_RENDER_MODE === WORLD_MAP_RENDER_MODES.FLAT_V2 ? 0 : WORLD_MAP_V4_OBJECT_COUNT - sceneStats.objects.length}\nchunks: ${sceneStats.chunks.join(' ')}\nassets loaded: ${loadedAssetCount}/${WORLD_MAP_RENDER_MODE === WORLD_MAP_RENDER_MODES.FLAT_V2 ? 1 : Object.keys(WORLD_MAP_V4_ASSET_MANIFEST).length}`}</div>}
    {worldQa.minimapQa && <div data-testid="world-minimap-qa" style={{ position:'fixed', zIndex:140, left:12, top:worldQa.overview ? 12 : HUD_H + 230, padding:'9px 11px', borderRadius:8, background:'#101713e8', color:'#fff', font:'11px/1.5 ui-monospace, monospace', pointerEvents:'none', whiteSpace:'pre-line' }}>{`world: ${playerFoot.x.toFixed(1)}, ${playerFoot.y.toFixed(1)}\nminimap: ${minimapPlayer.x.toFixed(1)}, ${minimapPlayer.y.toFixed(1)}\ntarget: ${objective.destinationId || 'none'}${objective.arrived ? ' (arrived)' : ''}\nmarkers: ${WORLD_MINIMAP_DESTINATIONS.length}\nsize: ${minimapDisplaySize.width}×${minimapDisplaySize.height}\nscale: ${(minimapDisplaySize.width / WORLD_MINIMAP_SIZE.width).toFixed(4)}`}</div>}
    {!worldQa.overview && <><WorldObjective nearZone={nearZone} nearMuseum={nearMuseum} nearHome={nearHome} nearZoneLocked={nearZone && lockedSet.has(nearZone)} objective={objective} objectiveLabel={objectiveLabel}/>{nearZone && <WorldEnterPrompt emoji={ZONE_META[nearZone].emoji} label={ZONE_META[nearZone].label} color={ZONE_META[nearZone].color} locked={lockedSet.has(nearZone)}/>} {!nearZone && nearMuseum && <WorldEnterPrompt emoji="🏛" label="도서관" color="#C8A96E"/>}{!nearZone && !nearMuseum && nearHome && <WorldEnterPrompt emoji="🏠" label="우리 집 · 꾸미기와 초대" color="#91CDB2"/>}<WorldDPad press={press} release={release} confirmLabel={nearHome ? '우리 집' : nearMuseum ? '도서관' : nearZone ? ZONE_META[nearZone].label : '장소'} onConfirm={nearZone || nearMuseum || nearHome ? () => activateNearbyDestination('touch') : null}/></>}
  </div>
}
