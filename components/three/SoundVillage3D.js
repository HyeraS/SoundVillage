'use client'

import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import StartPanel from '@/components/StartPanel'
import AnnotationPanel from '@/components/AnnotationPanel'
import soundMetadata from '@/data/sound_metadata.json'
import { getAnnotatedByParticipantZone } from '@/lib/supabase'
import { getStudyAccessGroup, isStudyAccessParticipantId } from '@/lib/studyAccess.mjs'
import { createSoundPlacements, normalizeCompletedIds, selectMusicBlockOneSounds } from '@/lib/three/prototypeData.mjs'
import { CAMERA_CONFIG, HUB_THIRD_PERSON_CAMERA_CONFIG } from '@/lib/three/cameraConfig.mjs'
import { PLAYER_START } from '@/lib/three/modelConfig.mjs'
import { getHubVillage, getPrototypeScene, HUB_PLAYER_START, resolveHubInteraction } from '@/lib/three/worldConfig.mjs'
import CameraDebugHUD from './CameraDebugHUD'
import MobileControls3D from './MobileControls3D'
import GameHUD3D from './GameHUD3D'
import VillageEntryOverlay from './VillageEntryOverlay'
import VillageScene from './VillageScene'
import HubScene from './world/HubScene'
import WebGLFallback from './WebGLFallback'
import styles from './prototype.module.css'

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch { return false }
}

function readRuntimeOptions() {
  if (typeof window === 'undefined') return { webglReady: null, debug: false, debugCamera: false, mock: false, models: false, forceFailure: false, scene: 'music', initialVillage: null }
  const params = new URLSearchParams(window.location.search)
  return {
    webglReady: !params.has('noWebGL') && supportsWebGL(),
    debug: params.has('debug'),
    debugCamera: params.has('debugCamera'),
    mock: params.has('mock'),
    models: params.has('models'),
    forceFailure: params.has('forceModelFailure'),
    scene: getPrototypeScene(params),
    initialVillage: getHubVillage(params.get('village')),
  }
}

class CanvasBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('[3D] Canvas unavailable:', error) }
  render() { return this.state.failed ? <WebGLFallback reason="3D 렌더러를 초기화하지 못했습니다." /> : this.props.children }
}

export default function SoundVillage3D() {
  const inputRef = useRef({ up: false, down: false, left: false, right: false })
  const [runtimeOptions] = useState(readRuntimeOptions)
  const webglReady = runtimeOptions.webglReady
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [participantId, setParticipantId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [placements, setPlacements] = useState([])
  const [completedIds, setCompletedIds] = useState(new Set())
  const [nearbySound, setNearbySound] = useState(null)
  const [nearbyHubTarget, setNearbyHubTarget] = useState(null)
  const [activeVillage, setActiveVillage] = useState(null)
  const [activeSound, setActiveSound] = useState(null)
  const [debugColliders, setDebugColliders] = useState(runtimeOptions.debug)
  const mockMode = runtimeOptions.mock
  const loadModels = runtimeOptions.models
  const forceModelFailure = runtimeOptions.forceFailure
  const debugCamera = runtimeOptions.debugCamera
  const sceneMode = runtimeOptions.scene
  const hubMode = sceneMode === 'hub'
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const begin = useCallback(async (nextParticipantId, nextGroupId) => {
    setLoading(true)
    const studyGroup = getStudyAccessGroup(nextParticipantId)
    const effectiveGroup = studyGroup || nextGroupId
    let nextPlacements = []
    let nextCompletedIds = new Set()
    if (!hubMode) {
      const bypassGroup = isStudyAccessParticipantId(nextParticipantId) && !studyGroup
      const sounds = selectMusicBlockOneSounds(soundMetadata.sounds, effectiveGroup, bypassGroup)
      nextPlacements = createSoundPlacements(sounds)
      const databaseIds = mockMode ? [] : await getAnnotatedByParticipantZone(nextParticipantId, 'Music')
      nextCompletedIds = normalizeCompletedIds(databaseIds, sounds)
    }
    setParticipantId(nextParticipantId)
    setGroupId(effectiveGroup)
    setPlacements(nextPlacements)
    setCompletedIds(nextCompletedIds)
    setNearbySound(null)
    setNearbyHubTarget(null)
    setActiveVillage(hubMode ? runtimeOptions.initialVillage : null)
    setStarted(true)
    setLoading(false)
  }, [hubMode, mockMode, runtimeOptions.initialVillage])

  const interact = useCallback(() => {
    if (hubMode && !activeVillage) {
      const action = resolveHubInteraction(nearbyHubTarget)
      if (action.type === 'enter-village') setActiveVillage(action.village)
      return
    }
    if (!hubMode && nearbySound && !activeSound) setActiveSound(nearbySound.sound)
  }, [hubMode, nearbyHubTarget, activeVillage, nearbySound, activeSound])

  useEffect(() => {
    const handleKey = event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (event.key === 'Escape' && activeVillage) {
        event.preventDefault()
        setActiveVillage(null)
      } else if ((event.key === 'Enter' || event.key === ' ') && started && !activeSound && !activeVillage) {
        event.preventDefault()
        interact()
      } else if (event.key === 'Escape' && started && !activeSound && !activeVillage) {
        setStarted(false)
        setNearbySound(null)
        setNearbyHubTarget(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSound, activeVillage, interact, started])

  const handleComplete = useCallback(() => {
    const soundId = activeSound?.sound_id
    if (soundId) setCompletedIds(previous => new Set([...previous, soundId]))
    setActiveSound(null)
  }, [activeSound])

  const completed = completedIds.size
  const total = placements.length
  const playerStart = hubMode ? HUB_PLAYER_START : PLAYER_START
  const initialCamera = hubMode
    ? {
        position: [playerStart[0], HUB_THIRD_PERSON_CAMERA_CONFIG.height, playerStart[2] + HUB_THIRD_PERSON_CAMERA_CONFIG.distance],
        fov: HUB_THIRD_PERSON_CAMERA_CONFIG.fov,
        near: HUB_THIRD_PERSON_CAMERA_CONFIG.near,
        far: HUB_THIRD_PERSON_CAMERA_CONFIG.far,
      }
    : {
        position: [playerStart[0] + CAMERA_CONFIG.positionOffset[0], CAMERA_CONFIG.positionOffset[1], playerStart[2] + CAMERA_CONFIG.positionOffset[2]],
        fov: CAMERA_CONFIG.fov,
        near: CAMERA_CONFIG.near,
        far: CAMERA_CONFIG.far,
      }
  if (webglReady === null) return <main className={styles.loading}>그래픽 환경을 확인하고 있어요…</main>
  if (!webglReady) return <WebGLFallback />
  if (!started) return <><StartPanel onStart={begin} />{loading && <div className={styles.startLoading}>진행 상태를 불러오는 중…</div>}</>

  return (
    <main className={styles.root} data-testid="three-prototype" data-scene={sceneMode}>
      <CanvasBoundary>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={initialCamera}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          {hubMode ? (
            <HubScene
              inputRef={inputRef}
              onNearbyHubTargetChange={setNearbyHubTarget}
              paused={Boolean(activeVillage)}
              reducedMotion={reducedMotion}
              debugColliders={debugColliders}
              debugCamera={debugCamera}
            />
          ) : (
            <VillageScene
              placements={placements}
              completedIds={completedIds}
              nearbyId={nearbySound?.id || null}
              inputRef={inputRef}
              onNearbySoundChange={setNearbySound}
              paused={Boolean(activeSound)}
              reducedMotion={reducedMotion}
              debugColliders={debugColliders}
              debugCamera={debugCamera}
              loadModels={loadModels}
              forceModelFailure={forceModelFailure}
            />
          )}
        </Canvas>
      </CanvasBoundary>

      <GameHUD3D
        participantId={participantId}
        groupId={groupId}
        completed={completed}
        total={total}
        nearbySound={nearbySound}
        nearbyHubTarget={nearbyHubTarget}
        sceneMode={sceneMode}
        mockMode={mockMode}
        debugColliders={debugColliders}
        onToggleDebug={() => setDebugColliders(value => !value)}
      />
      <MobileControls3D
        inputRef={inputRef}
        disabled={Boolean(activeSound || activeVillage)}
        onInteract={interact}
        interactionLabel={hubMode && nearbyHubTarget?.kind === 'village-exit' ? '마을 입장' : hubMode ? '둘러보기' : '소리 듣기'}
      />
      {debugCamera && <CameraDebugHUD mode={hubMode ? 'hub-third-person' : 'follow'} />}

      {!hubMode && activeSound && (
        <AnnotationPanel
          sound={activeSound}
          zone="Music"
          participantId={participantId}
          sessionId={groupId}
          mockMode={mockMode}
          onClose={() => setActiveSound(null)}
          onComplete={handleComplete}
        />
      )}
      {hubMode && activeVillage && <VillageEntryOverlay village={activeVillage} onClose={() => setActiveVillage(null)} />}
    </main>
  )
}
