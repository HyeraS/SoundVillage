'use client'

import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import StartPanel from '@/components/StartPanel'
import AnnotationPanel from '@/components/AnnotationPanel'
import soundMetadata from '@/data/sound_metadata.json'
import { getAnnotatedByParticipantZone } from '@/lib/supabase'
import { getStudyAccessGroup, isStudyAccessParticipantId } from '@/lib/studyAccess.mjs'
import { createSoundPlacements, normalizeCompletedIds, selectMusicBlockOneSounds } from '@/lib/three/prototypeData.mjs'
import { CAMERA_CONFIG } from '@/lib/three/cameraConfig.mjs'
import { PLAYER_START } from '@/lib/three/modelConfig.mjs'
import CameraDebugHUD from './CameraDebugHUD'
import MobileControls3D from './MobileControls3D'
import GameHUD3D from './GameHUD3D'
import VillageScene from './VillageScene'
import WebGLFallback from './WebGLFallback'
import styles from './prototype.module.css'

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch { return false }
}

function readRuntimeOptions() {
  if (typeof window === 'undefined') return { webglReady: null, debug: false, debugCamera: false, mock: false, models: false, forceFailure: false }
  const params = new URLSearchParams(window.location.search)
  return {
    webglReady: !params.has('noWebGL') && supportsWebGL(),
    debug: params.has('debug'),
    debugCamera: params.has('debugCamera'),
    mock: params.has('mock'),
    models: params.has('models'),
    forceFailure: params.has('forceModelFailure'),
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
  const [activeSound, setActiveSound] = useState(null)
  const [debugColliders, setDebugColliders] = useState(runtimeOptions.debug)
  const mockMode = runtimeOptions.mock
  const loadModels = runtimeOptions.models
  const forceModelFailure = runtimeOptions.forceFailure
  const debugCamera = runtimeOptions.debugCamera
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
    const bypassGroup = isStudyAccessParticipantId(nextParticipantId) && !studyGroup
    const sounds = selectMusicBlockOneSounds(soundMetadata.sounds, effectiveGroup, bypassGroup)
    const nextPlacements = createSoundPlacements(sounds)
    const databaseIds = mockMode ? [] : await getAnnotatedByParticipantZone(nextParticipantId, 'Music')
    setParticipantId(nextParticipantId)
    setGroupId(effectiveGroup)
    setPlacements(nextPlacements)
    setCompletedIds(normalizeCompletedIds(databaseIds, sounds))
    setNearbySound(null)
    setStarted(true)
    setLoading(false)
  }, [mockMode])

  const interact = useCallback(() => {
    if (nearbySound && !activeSound) setActiveSound(nearbySound.sound)
  }, [nearbySound, activeSound])

  useEffect(() => {
    const handleKey = event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if ((event.key === 'Enter' || event.key === ' ') && started && !activeSound) {
        event.preventDefault()
        interact()
      } else if (event.key === 'Escape' && started && !activeSound) {
        setStarted(false)
        setNearbySound(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSound, interact, started])

  const handleComplete = useCallback(() => {
    const soundId = activeSound?.sound_id
    if (soundId) setCompletedIds(previous => new Set([...previous, soundId]))
    setActiveSound(null)
  }, [activeSound])

  const completed = completedIds.size
  const total = placements.length
  if (webglReady === null) return <main className={styles.loading}>그래픽 환경을 확인하고 있어요…</main>
  if (!webglReady) return <WebGLFallback />
  if (!started) return <><StartPanel onStart={begin} />{loading && <div className={styles.startLoading}>진행 상태를 불러오는 중…</div>}</>

  return (
    <main className={styles.root} data-testid="three-prototype">
      <CanvasBoundary>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{
            position: [
              PLAYER_START[0] + CAMERA_CONFIG.positionOffset[0],
              CAMERA_CONFIG.positionOffset[1],
              PLAYER_START[2] + CAMERA_CONFIG.positionOffset[2],
            ],
            fov: CAMERA_CONFIG.fov,
            near: CAMERA_CONFIG.near,
            far: CAMERA_CONFIG.far,
          }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
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
        </Canvas>
      </CanvasBoundary>

      <GameHUD3D
        participantId={participantId}
        groupId={groupId}
        completed={completed}
        total={total}
        nearbySound={nearbySound}
        mockMode={mockMode}
        debugColliders={debugColliders}
        onToggleDebug={() => setDebugColliders(value => !value)}
      />
      <MobileControls3D inputRef={inputRef} disabled={Boolean(activeSound)} onInteract={interact} />
      {debugCamera && <CameraDebugHUD />}

      {activeSound && (
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
    </main>
  )
}
