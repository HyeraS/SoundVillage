'use client'

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import StartPanel from '@/components/StartPanel'
import AnnotationPanel from '@/components/AnnotationPanel'
import soundMetadata from '@/data/sound_metadata.json'
import { getAnnotatedByParticipantZone } from '@/lib/supabase'
import { resetAudio } from '@/lib/audioManager'
import { getStudyAccessGroup, isStudyAccessParticipantId } from '@/lib/studyAccess.mjs'
import { createSoundPlacements, normalizeCompletedIds, selectZoneBlockSounds } from '@/lib/three/prototypeData.mjs'
import { HUB_THIRD_PERSON_CAMERA_CONFIG, getYawForward } from '@/lib/three/cameraConfig.mjs'
import { getVillageRuntimeConfig } from '@/lib/three/modelConfig.mjs'
import { SCENE_IDS, createMockCompletedIds, createReleasedInputState, getVillageAccessState, hasCompletedRequiredSounds, resolveSceneTransition, resolveVillageInteraction, shouldLoadRemoteProgress, updateZoneCompletedIds } from '@/lib/three/sceneFlow.mjs'
import { getHubReturnPose, getHubVillage, getPrototypeScene, HUB_PLAYER_START, resolveHubInteraction } from '@/lib/three/worldConfig.mjs'
import CameraDebugHUD from './CameraDebugHUD'
import MobileControls3D from './MobileControls3D'
import GameHUD3D from './GameHUD3D'
import VillageExitOverlay from './MusicExitOverlay'
import VillageEntryOverlay from './VillageEntryOverlay'
import VillageScene from './VillageScene'
import HubScene from './world/HubScene'
import WebGLFallback from './WebGLFallback'
import styles from './prototype.module.css'

const RESEARCH_ZONES = Object.freeze(['Music', 'Animal'])

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch { return false }
}

function readRuntimeOptions() {
  if (typeof window === 'undefined') return { webglReady: null, debug: false, debugCamera: false, mock: false, mockMusicCompleted: null, mockAnimalCompleted: null, models: false, forceFailure: false, scene: 'music', initialVillage: null }
  const params = new URLSearchParams(window.location.search)
  const mock = params.has('mock')
  return {
    webglReady: !params.has('noWebGL') && supportsWebGL(),
    debug: params.has('debug'),
    debugCamera: params.has('debugCamera'),
    mock,
    mockMusicCompleted: mock ? params.get('mockMusicCompleted') ?? params.get('mockCompleted') : null,
    mockAnimalCompleted: mock ? params.get('mockAnimalCompleted') : null,
    models: params.has('models'),
    forceFailure: params.has('forceModelFailure'),
    scene: getPrototypeScene(params),
    initialVillage: getHubVillage(params.get('village')),
  }
}

function createZoneSounds(effectiveGroup, bypassGroup) {
  return Object.fromEntries(RESEARCH_ZONES.map(zone => [zone, selectZoneBlockSounds(soundMetadata.sounds, zone, 1, effectiveGroup, bypassGroup)]))
}

function createZonePlacements(soundsByZone) {
  return Object.fromEntries(RESEARCH_ZONES.map(zone => [zone, createSoundPlacements(soundsByZone[zone], zone)]))
}

async function loadCompletedIds({ participantId, zone, sounds, mockMode, mockCount }) {
  if (!shouldLoadRemoteProgress(mockMode)) return createMockCompletedIds(sounds.map(sound => sound.sound_id), mockCount ?? 0)
  const databaseIds = await getAnnotatedByParticipantZone(participantId, zone)
  return normalizeCompletedIds(databaseIds, sounds)
}

class CanvasBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('[3D] Canvas unavailable:', error) }
  render() { return this.state.failed ? <WebGLFallback reason="3D 렌더러를 초기화하지 못했습니다." /> : this.props.children }
}

export default function SoundVillage3D() {
  const inputRef = useRef({ up: false, down: false, left: false, right: false })
  const transitionLockRef = useRef(false)
  const soundsByZoneRef = useRef({ Music: [], Animal: [] })
  const [runtimeOptions] = useState(readRuntimeOptions)
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [placementsByZone, setPlacementsByZone] = useState({ Music: [], Animal: [] })
  const [completedByZone, setCompletedByZone] = useState({ Music: new Set(), Animal: new Set() })
  const [zoneLoaded, setZoneLoaded] = useState({ Music: false, Animal: false })
  const [zoneErrors, setZoneErrors] = useState({ Music: '', Animal: '' })
  const [nearbySound, setNearbySound] = useState(null)
  const [nearbyHubTarget, setNearbyHubTarget] = useState(null)
  const [activeVillage, setActiveVillage] = useState(null)
  const [activeSound, setActiveSound] = useState(null)
  const [exitOverlayOpen, setExitOverlayOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [sceneId, setSceneId] = useState(runtimeOptions.scene)
  const [sceneRevision, setSceneRevision] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [villageLoading, setVillageLoading] = useState(false)
  const [enteredVillageFromHub, setEnteredVillageFromHub] = useState(null)
  const [hubPose, setHubPose] = useState(() => ({ position: [...HUB_PLAYER_START], yaw: 0 }))
  const [debugColliders, setDebugColliders] = useState(runtimeOptions.debug)
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const mockMode = runtimeOptions.mock
  const hubMode = sceneId === SCENE_IDS.HUB
  const activeVillageConfig = hubMode ? null : getVillageRuntimeConfig(sceneId)
  const activeZone = activeVillageConfig?.dataZone || 'Music'
  const placements = placementsByZone[activeZone] || []
  const completedIds = completedByZone[activeZone] || new Set()

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const begin = useCallback(async (nextParticipantId, nextGroupId) => {
    setLoading(true)
    setLoadError('')
    const studyGroup = getStudyAccessGroup(nextParticipantId)
    const effectiveGroup = studyGroup || nextGroupId
    const bypassGroup = isStudyAccessParticipantId(nextParticipantId) && !studyGroup
    const nextSoundsByZone = createZoneSounds(effectiveGroup, bypassGroup)
    const nextPlacementsByZone = createZonePlacements(nextSoundsByZone)
    try {
      const musicCompleted = await loadCompletedIds({ participantId: nextParticipantId, zone: 'Music', sounds: nextSoundsByZone.Music, mockMode, mockCount: runtimeOptions.mockMusicCompleted })
      let animalCompleted = new Set()
      let animalLoaded = false
      if (mockMode || runtimeOptions.scene === SCENE_IDS.ANIMAL) {
        animalCompleted = await loadCompletedIds({ participantId: nextParticipantId, zone: 'Animal', sounds: nextSoundsByZone.Animal, mockMode, mockCount: runtimeOptions.mockAnimalCompleted })
        animalLoaded = true
      }
      soundsByZoneRef.current = nextSoundsByZone
      setParticipantId(nextParticipantId)
      setGroupId(effectiveGroup)
      setPlacementsByZone(nextPlacementsByZone)
      setCompletedByZone({ Music: musicCompleted, Animal: animalCompleted })
      setZoneLoaded({ Music: true, Animal: animalLoaded })
      setZoneErrors({ Music: '', Animal: '' })
      setNearbySound(null)
      setNearbyHubTarget(null)
      setActiveVillage(runtimeOptions.scene === SCENE_IDS.HUB ? runtimeOptions.initialVillage : null)
      setActiveSound(null)
      setExitOverlayOpen(false)
      setNotice('')
      setSceneId(runtimeOptions.scene)
      setEnteredVillageFromHub(null)
      setHubPose({ position: [...HUB_PLAYER_START], yaw: 0 })
      inputRef.current = createReleasedInputState()
      setStarted(true)
    } catch (error) {
      console.error('[3D] 진행 상태 초기화 실패:', error)
      setLoadError('진행 상태를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시작해 주세요.')
    } finally {
      setLoading(false)
    }
  }, [mockMode, runtimeOptions.initialVillage, runtimeOptions.mockAnimalCompleted, runtimeOptions.mockMusicCompleted, runtimeOptions.scene])

  const transitionScene = useCallback((targetScene) => {
    const result = resolveSceneTransition({ currentScene: sceneId, targetScene, transitioning: transitionLockRef.current, annotationOpen: Boolean(activeSound) })
    if (result.type !== 'transition') return false
    transitionLockRef.current = true
    setTransitioning(true)
    resetAudio()
    inputRef.current = createReleasedInputState()
    setNearbySound(null)
    setNearbyHubTarget(null)
    setActiveVillage(null)
    setExitOverlayOpen(false)
    if (targetScene === SCENE_IDS.HUB) {
      setHubPose(getHubReturnPose(sceneId))
      setEnteredVillageFromHub(null)
    } else {
      setEnteredVillageFromHub(targetScene)
    }
    setSceneId(targetScene)
    setSceneRevision(value => value + 1)
    window.requestAnimationFrame(() => {
      transitionLockRef.current = false
      setTransitioning(false)
    })
    return true
  }, [activeSound, sceneId])

  const enterVillage = useCallback(async () => {
    if (!activeVillage) return false
    const musicReady = isStudyAccessParticipantId(participantId) || hasCompletedRequiredSounds(placementsByZone.Music.map(item => item.id), completedByZone.Music)
    const access = getVillageAccessState(activeVillage.villageId, musicReady)
    if (access.mode !== 'enter') return false
    const zone = access.dataZone
    if (!zoneLoaded[zone]) {
      setVillageLoading(true)
      setZoneErrors(errors => ({ ...errors, [zone]: '' }))
      try {
        const nextIds = await loadCompletedIds({ participantId, zone, sounds: soundsByZoneRef.current[zone], mockMode, mockCount: zone === 'Animal' ? runtimeOptions.mockAnimalCompleted : runtimeOptions.mockMusicCompleted })
        setCompletedByZone(current => ({ ...current, [zone]: nextIds }))
        setZoneLoaded(current => ({ ...current, [zone]: true }))
      } catch (error) {
        console.error(`[3D] ${zone} 진행 상태 조회 실패:`, error)
        setZoneErrors(errors => ({ ...errors, [zone]: `${zone} 진행 상태를 불러오지 못했습니다. 다시 시도해 주세요.` }))
        setVillageLoading(false)
        return false
      }
      setVillageLoading(false)
    }
    return transitionScene(access.sceneId)
  }, [activeVillage, completedByZone.Music, mockMode, participantId, placementsByZone.Music, runtimeOptions.mockAnimalCompleted, runtimeOptions.mockMusicCompleted, transitionScene, zoneLoaded])

  const returnToHub = useCallback(() => transitionScene(SCENE_IDS.HUB), [transitionScene])

  const interact = useCallback(() => {
    if (hubMode && !activeVillage && !transitioning) {
      const action = resolveHubInteraction(nearbyHubTarget)
      if (action.type === 'enter-village') setActiveVillage(action.village)
      return
    }
    if (!hubMode && nearbySound && !activeSound && !exitOverlayOpen && !transitioning) {
      const action = resolveVillageInteraction(nearbySound)
      if (action.type === 'return-hub') setExitOverlayOpen(true)
      if (action.type === 'annotate-sound') setActiveSound(action.sound)
    }
  }, [activeSound, activeVillage, exitOverlayOpen, hubMode, nearbyHubTarget, nearbySound, transitioning])

  useEffect(() => {
    const handleKey = event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (activeVillage || exitOverlayOpen) return
      if ((event.key === 'Enter' || event.key === ' ') && started && !activeSound) {
        event.preventDefault()
        interact()
      } else if (event.key === 'Escape' && started && !activeSound) {
        event.preventDefault()
        if (!hubMode && enteredVillageFromHub === sceneId) setExitOverlayOpen(true)
        else {
          resetAudio()
          inputRef.current = createReleasedInputState()
          setStarted(false)
          setNearbySound(null)
          setNearbyHubTarget(null)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSound, activeVillage, enteredVillageFromHub, exitOverlayOpen, hubMode, interact, sceneId, started])

  const handleComplete = useCallback(() => {
    const soundId = activeSound?.sound_id
    if (soundId) {
      setCompletedByZone(current => {
        const previousZoneIds = current[activeZone] || new Set()
        const next = updateZoneCompletedIds(current, activeZone, soundId, true)
        const requiredIds = placementsByZone[activeZone].map(item => item.id)
        if (!hasCompletedRequiredSounds(requiredIds, previousZoneIds) && hasCompletedRequiredSounds(requiredIds, next[activeZone])) {
          setNotice(activeZone === 'Music' ? '🔓 Music 15개 완료! 나머지 다섯 마을이 모두 열렸습니다.' : '🐾 Animal Block 1 완료! Block 2는 다음 단계에서 구현됩니다.')
        }
        return next
      })
    }
    setActiveSound(null)
  }, [activeSound, activeZone, placementsByZone])

  const musicRequiredIds = useMemo(() => placementsByZone.Music.map(item => item.id), [placementsByZone.Music])
  const villagesUnlocked = isStudyAccessParticipantId(participantId) || hasCompletedRequiredSounds(musicRequiredIds, completedByZone.Music)
  const zoneProgress = Object.fromEntries(RESEARCH_ZONES.map(zone => [zone, { completed: completedByZone[zone].size, total: placementsByZone[zone].length }]))
  const playerStart = hubMode ? hubPose.position : activeVillageConfig.playerStart
  const initialYaw = hubMode ? hubPose.yaw : 0
  const forward = getYawForward(initialYaw)
  const initialCamera = { position: [playerStart[0] - forward.x * HUB_THIRD_PERSON_CAMERA_CONFIG.distance, HUB_THIRD_PERSON_CAMERA_CONFIG.height, playerStart[2] - forward.z * HUB_THIRD_PERSON_CAMERA_CONFIG.distance], fov: HUB_THIRD_PERSON_CAMERA_CONFIG.fov, near: HUB_THIRD_PERSON_CAMERA_CONFIG.near, far: HUB_THIRD_PERSON_CAMERA_CONFIG.far }

  if (runtimeOptions.webglReady === null) return <main className={styles.loading}>그래픽 환경을 확인하고 있어요…</main>
  if (!runtimeOptions.webglReady) return <WebGLFallback />
  if (!started) return <><StartPanel onStart={begin} />{loading && <div className={styles.startLoading}>진행 상태를 불러오는 중…</div>}{loadError && <div className={styles.startError}>{loadError}</div>}</>

  return (
    <main className={styles.root} data-testid="three-prototype" data-scene={sceneId} data-transitioning={String(transitioning)} data-villages-unlocked={String(villagesUnlocked)} data-music-completed={zoneProgress.Music.completed} data-animal-completed={zoneProgress.Animal.completed}>
      <CanvasBoundary>
        <Canvas key={`${sceneId}-${sceneRevision}`} shadows dpr={[1, 1.5]} camera={initialCamera} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
          {hubMode ? (
            <HubScene inputRef={inputRef} onNearbyHubTargetChange={setNearbyHubTarget} paused={Boolean(activeVillage || transitioning)} reducedMotion={reducedMotion} debugColliders={debugColliders} debugCamera={runtimeOptions.debugCamera} startPosition={hubPose.position} initialYaw={hubPose.yaw} villagesUnlocked={villagesUnlocked} />
          ) : (
            <VillageScene sceneId={sceneId} placements={placements} completedIds={completedIds} nearbyId={nearbySound?.id || null} inputRef={inputRef} onNearbySoundChange={setNearbySound} paused={Boolean(activeSound || exitOverlayOpen || transitioning)} reducedMotion={reducedMotion} debugColliders={debugColliders} debugCamera={runtimeOptions.debugCamera} loadModels={runtimeOptions.models} forceModelFailure={runtimeOptions.forceFailure} showHubExit={enteredVillageFromHub === sceneId} />
          )}
        </Canvas>
      </CanvasBoundary>

      <GameHUD3D participantId={participantId} groupId={groupId} zone={activeZone} zoneProgress={zoneProgress} nearbySound={nearbySound} nearbyHubTarget={nearbyHubTarget} sceneMode={sceneId} enteredFromHub={enteredVillageFromHub === sceneId} villagesUnlocked={villagesUnlocked} mockMode={mockMode} debugColliders={debugColliders} onToggleDebug={() => setDebugColliders(value => !value)} />
      <MobileControls3D inputRef={inputRef} movementDisabled={Boolean(activeSound || activeVillage || exitOverlayOpen || transitioning)} interactionDisabled={Boolean(activeSound || activeVillage || exitOverlayOpen || transitioning || (hubMode ? !nearbyHubTarget : !nearbySound))} onInteract={interact} interactionLabel={hubMode && nearbyHubTarget?.kind === 'village-exit' ? getVillageAccessState(nearbyHubTarget.villageId, villagesUnlocked).mode === 'locked' ? '잠금 확인' : '마을 들어가기' : hubMode ? '랜드마크 보기' : nearbySound?.kind?.includes('exit') ? '광장으로 돌아가기' : '소리 듣기'} />
      {runtimeOptions.debugCamera && <CameraDebugHUD mode={hubMode ? 'hub-third-person' : activeVillageConfig.cameraDebugLabel} />}

      {!hubMode && activeSound && <AnnotationPanel sound={activeSound} zone={activeZone} participantId={participantId} sessionId={groupId} mockMode={mockMode} onClose={() => setActiveSound(null)} onComplete={handleComplete} />}
      {hubMode && activeVillage && <VillageEntryOverlay village={activeVillage} completed={zoneProgress[activeVillage.dataZone]?.completed || 0} total={zoneProgress[activeVillage.dataZone]?.total || 0} musicCompleted={zoneProgress.Music.completed} musicTotal={zoneProgress.Music.total} villagesUnlocked={villagesUnlocked} loading={villageLoading} error={zoneErrors[activeVillage.dataZone] || ''} onEnter={enterVillage} onClose={() => setActiveVillage(null)} />}
      {!hubMode && exitOverlayOpen && <VillageExitOverlay zone={activeZone} color={sceneId === SCENE_IDS.ANIMAL ? '#F0A17D' : '#E88C72'} onConfirm={returnToHub} onClose={() => setExitOverlayOpen(false)} />}
      {notice && <div className={styles.unlockNotice} role="status">{notice}</div>}
      {transitioning && <div className={styles.sceneTransition}>마을 길을 이동하고 있어요…</div>}
    </main>
  )
}
