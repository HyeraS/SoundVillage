'use client'

import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import StartPanel from '@/components/StartPanel'
import AnnotationPanel from '@/components/AnnotationPanel'
import soundMetadata from '@/data/sound_metadata.json'
import { getAnnotatedByParticipantZone } from '@/lib/supabase'
import { resetAudio } from '@/lib/audioManager'
import { getStudyAccessGroup, isStudyAccessParticipantId } from '@/lib/studyAccess.mjs'
import { createSoundPlacements, normalizeCompletedIds, selectMusicBlockOneSounds } from '@/lib/three/prototypeData.mjs'
import { CAMERA_CONFIG, HUB_THIRD_PERSON_CAMERA_CONFIG, getYawForward } from '@/lib/three/cameraConfig.mjs'
import { PLAYER_START } from '@/lib/three/modelConfig.mjs'
import { SCENE_IDS, addCompletedSound, createMockCompletedIds, createReleasedInputState, getVillageAccessState, hasCompletedRequiredSounds, resolveMusicInteraction, resolveSceneTransition, shouldLoadRemoteProgress } from '@/lib/three/sceneFlow.mjs'
import { getHubReturnPose, getHubVillage, getPrototypeScene, HUB_PLAYER_START, resolveHubInteraction } from '@/lib/three/worldConfig.mjs'
import CameraDebugHUD from './CameraDebugHUD'
import MobileControls3D from './MobileControls3D'
import GameHUD3D from './GameHUD3D'
import MusicExitOverlay from './MusicExitOverlay'
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
  if (typeof window === 'undefined') return { webglReady: null, debug: false, debugCamera: false, mock: false, mockCompleted: null, models: false, forceFailure: false, scene: 'music', initialVillage: null }
  const params = new URLSearchParams(window.location.search)
  return {
    webglReady: !params.has('noWebGL') && supportsWebGL(),
    debug: params.has('debug'),
    debugCamera: params.has('debugCamera'),
    mock: params.has('mock'),
    mockCompleted: params.has('mock') && params.has('mockCompleted') ? params.get('mockCompleted') : null,
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
  const [loadError, setLoadError] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [placements, setPlacements] = useState([])
  const [completedIds, setCompletedIds] = useState(new Set())
  const [nearbySound, setNearbySound] = useState(null)
  const [nearbyHubTarget, setNearbyHubTarget] = useState(null)
  const [activeVillage, setActiveVillage] = useState(null)
  const [activeSound, setActiveSound] = useState(null)
  const [exitOverlayOpen, setExitOverlayOpen] = useState(false)
  const [unlockNotice, setUnlockNotice] = useState(false)
  const [sceneId, setSceneId] = useState(runtimeOptions.scene)
  const [sceneRevision, setSceneRevision] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [enteredMusicFromHub, setEnteredMusicFromHub] = useState(false)
  const [hubPose, setHubPose] = useState(() => ({ position: [...HUB_PLAYER_START], yaw: 0 }))
  const transitionLockRef = useRef(false)
  const [debugColliders, setDebugColliders] = useState(runtimeOptions.debug)
  const mockMode = runtimeOptions.mock
  const loadModels = runtimeOptions.models
  const forceModelFailure = runtimeOptions.forceFailure
  const debugCamera = runtimeOptions.debugCamera
  const hubMode = sceneId === SCENE_IDS.HUB
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!unlockNotice) return undefined
    const timer = window.setTimeout(() => setUnlockNotice(false), 3600)
    return () => window.clearTimeout(timer)
  }, [unlockNotice])

  const begin = useCallback(async (nextParticipantId, nextGroupId) => {
    setLoading(true)
    setLoadError('')
    const studyGroup = getStudyAccessGroup(nextParticipantId)
    const effectiveGroup = studyGroup || nextGroupId
    try {
      const bypassGroup = isStudyAccessParticipantId(nextParticipantId) && !studyGroup
      const sounds = selectMusicBlockOneSounds(soundMetadata.sounds, effectiveGroup, bypassGroup)
      const nextPlacements = createSoundPlacements(sounds)
      const databaseIds = shouldLoadRemoteProgress(mockMode) ? await getAnnotatedByParticipantZone(nextParticipantId, 'Music') : []
      const nextCompletedIds = mockMode && runtimeOptions.mockCompleted !== null
        ? createMockCompletedIds(sounds.map(sound => sound.sound_id), runtimeOptions.mockCompleted)
        : normalizeCompletedIds(databaseIds, sounds)
      setParticipantId(nextParticipantId)
      setGroupId(effectiveGroup)
      setPlacements(nextPlacements)
      setCompletedIds(nextCompletedIds)
      setNearbySound(null)
      setNearbyHubTarget(null)
      setActiveVillage(runtimeOptions.scene === SCENE_IDS.HUB ? runtimeOptions.initialVillage : null)
      setActiveSound(null)
      setExitOverlayOpen(false)
      setUnlockNotice(false)
      setSceneId(runtimeOptions.scene)
      setEnteredMusicFromHub(false)
      setHubPose({ position: [...HUB_PLAYER_START], yaw: 0 })
      inputRef.current = createReleasedInputState()
      setStarted(true)
    } catch (error) {
      console.error('[3D] Music 진행 상태 초기화 실패:', error)
      setLoadError('Music 진행 상태를 불러오지 못했습니다. 잠시 후 다시 시작해 주세요.')
    } finally {
      setLoading(false)
    }
  }, [mockMode, runtimeOptions.initialVillage, runtimeOptions.mockCompleted, runtimeOptions.scene])

  const transitionScene = useCallback((targetScene) => {
    const result = resolveSceneTransition({
      currentScene: sceneId,
      targetScene,
      transitioning: transitionLockRef.current,
      annotationOpen: Boolean(activeSound),
    })
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
      setHubPose(getHubReturnPose('music'))
      setEnteredMusicFromHub(false)
    } else {
      setEnteredMusicFromHub(true)
    }
    setSceneId(targetScene)
    setSceneRevision(value => value + 1)
    window.requestAnimationFrame(() => {
      transitionLockRef.current = false
      setTransitioning(false)
    })
    return true
  }, [activeSound, sceneId])

  const enterMusic = useCallback(() => transitionScene(SCENE_IDS.MUSIC), [transitionScene])
  const returnToHub = useCallback(() => transitionScene(SCENE_IDS.HUB), [transitionScene])

  const interact = useCallback(() => {
    if (hubMode && !activeVillage && !transitioning) {
      const action = resolveHubInteraction(nearbyHubTarget)
      if (action.type === 'enter-village') setActiveVillage(action.village)
      return
    }
    if (!hubMode && nearbySound && !activeSound && !exitOverlayOpen && !transitioning) {
      const action = resolveMusicInteraction(nearbySound)
      if (action.type === 'return-hub') setExitOverlayOpen(true)
      if (action.type === 'annotate-sound') setActiveSound(action.sound)
    }
  }, [hubMode, nearbyHubTarget, activeVillage, nearbySound, activeSound, exitOverlayOpen, transitioning])

  useEffect(() => {
    const handleKey = event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (activeVillage || exitOverlayOpen) return
      if ((event.key === 'Enter' || event.key === ' ') && started && !activeSound) {
        event.preventDefault()
        interact()
      } else if (event.key === 'Escape' && started && !activeSound) {
        event.preventDefault()
        if (!hubMode && enteredMusicFromHub) setExitOverlayOpen(true)
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
  }, [activeSound, activeVillage, enteredMusicFromHub, exitOverlayOpen, hubMode, interact, started])

  const handleComplete = useCallback(() => {
    const soundId = activeSound?.sound_id
    if (soundId) {
      const requiredIds = placements.map(placement => placement.id)
      const nextCompletedIds = addCompletedSound(completedIds, soundId, true)
      if (!hasCompletedRequiredSounds(requiredIds, completedIds) && hasCompletedRequiredSounds(requiredIds, nextCompletedIds)) {
        setUnlockNotice(true)
      }
      setCompletedIds(nextCompletedIds)
    }
    setActiveSound(null)
  }, [activeSound, completedIds, placements])

  const completed = completedIds.size
  const total = placements.length
  const requiredMusicIds = placements.map(placement => placement.id)
  const villagesUnlocked = isStudyAccessParticipantId(participantId) || hasCompletedRequiredSounds(requiredMusicIds, completedIds)
  const playerStart = hubMode ? hubPose.position : PLAYER_START
  const hubForward = getYawForward(hubPose.yaw)
  const initialCamera = hubMode
    ? {
        position: [playerStart[0] - hubForward.x * HUB_THIRD_PERSON_CAMERA_CONFIG.distance, HUB_THIRD_PERSON_CAMERA_CONFIG.height, playerStart[2] - hubForward.z * HUB_THIRD_PERSON_CAMERA_CONFIG.distance],
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
  if (!started) return <><StartPanel onStart={begin} />{loading && <div className={styles.startLoading}>진행 상태를 불러오는 중…</div>}{loadError && <div className={styles.startError}>{loadError}</div>}</>

  return (
    <main className={styles.root} data-testid="three-prototype" data-scene={sceneId} data-transitioning={String(transitioning)} data-villages-unlocked={String(villagesUnlocked)}>
      <CanvasBoundary>
        <Canvas
          key={`${sceneId}-${sceneRevision}`}
          shadows
          dpr={[1, 1.5]}
          camera={initialCamera}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          {hubMode ? (
            <HubScene
              inputRef={inputRef}
              onNearbyHubTargetChange={setNearbyHubTarget}
              paused={Boolean(activeVillage || transitioning)}
              reducedMotion={reducedMotion}
              debugColliders={debugColliders}
              debugCamera={debugCamera}
              startPosition={hubPose.position}
              initialYaw={hubPose.yaw}
              villagesUnlocked={villagesUnlocked}
            />
          ) : (
            <VillageScene
              placements={placements}
              completedIds={completedIds}
              nearbyId={nearbySound?.id || null}
              inputRef={inputRef}
              onNearbySoundChange={setNearbySound}
              paused={Boolean(activeSound || exitOverlayOpen || transitioning)}
              reducedMotion={reducedMotion}
              debugColliders={debugColliders}
              debugCamera={debugCamera}
              loadModels={loadModels}
              forceModelFailure={forceModelFailure}
              showHubExit={enteredMusicFromHub}
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
        sceneMode={sceneId}
        enteredMusicFromHub={enteredMusicFromHub}
        villagesUnlocked={villagesUnlocked}
        mockMode={mockMode}
        debugColliders={debugColliders}
        onToggleDebug={() => setDebugColliders(value => !value)}
      />
      <MobileControls3D
        inputRef={inputRef}
        movementDisabled={Boolean(activeSound || activeVillage || exitOverlayOpen || transitioning)}
        interactionDisabled={Boolean(activeSound || activeVillage || exitOverlayOpen || transitioning || (hubMode ? !nearbyHubTarget : !nearbySound))}
        onInteract={interact}
        interactionLabel={hubMode && nearbyHubTarget?.kind === 'village-exit'
          ? getVillageAccessState(nearbyHubTarget.villageId, villagesUnlocked).mode === 'locked' ? '잠금 확인' : '마을 들어가기'
          : hubMode ? '랜드마크 보기' : nearbySound?.kind === 'music-exit' ? '광장으로 돌아가기' : '소리 듣기'}
      />
      {debugCamera && <CameraDebugHUD mode={hubMode ? 'hub-third-person' : 'music-third-person'} />}

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
      {hubMode && activeVillage && <VillageEntryOverlay village={activeVillage} completed={completed} total={total} villagesUnlocked={villagesUnlocked} onEnter={enterMusic} onClose={() => setActiveVillage(null)} />}
      {!hubMode && exitOverlayOpen && <MusicExitOverlay onConfirm={returnToHub} onClose={() => setExitOverlayOpen(false)} />}
      {unlockNotice && <div className={styles.unlockNotice} role="status">🔓 Music 15개 완료! 나머지 다섯 마을이 모두 열렸습니다.</div>}
      {transitioning && <div className={styles.sceneTransition}>마을 길을 이동하고 있어요…</div>}
    </main>
  )
}
