'use client'

import { useRef } from 'react'
import { Color } from 'three'
import { MUSIC_EXIT_TARGET } from '@/lib/three/modelConfig.mjs'
import { createMusicInteractionTargets } from '@/lib/three/sceneFlow.mjs'
import InteractableSound from './InteractableSound'
import Player3D from './Player3D'
import VillageEnvironment from './VillageEnvironment'
import HubThirdPersonCamera from './world/HubThirdPersonCamera'

export default function VillageScene({ placements, completedIds, nearbyId, inputRef, onNearbySoundChange, paused, reducedMotion, debugColliders, debugCamera, loadModels, forceModelFailure, showHubExit = false }) {
  const playerRef = useRef(null)
  const yawRef = useRef(0)
  const facingYawRef = useRef(0)
  const movingRef = useRef(false)
  const interactionTargets = createMusicInteractionTargets(placements, MUSIC_EXIT_TARGET, showHubExit)

  return (
    <>
      <color attach="background" args={['#B9DDF0']} />
      <fog attach="fog" args={['#B9DDF0', 20, 39]} />
      <hemisphereLight args={['#FFF6DD', '#668855', 1.45]} />
      <ambientLight intensity={0.42} />
      <directionalLight
        castShadow
        position={[-8, 14, 8]}
        intensity={2.1}
        color={new Color('#FFF0C7')}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <VillageEnvironment loadModels={loadModels} debugColliders={debugColliders} showHubExit={showHubExit} exitNearby={nearbyId === MUSIC_EXIT_TARGET.id} />
      {placements.map(placement => (
        <InteractableSound
          key={placement.id}
          placement={placement}
          completed={completedIds.has(placement.id)}
          nearby={nearbyId === placement.id}
          reducedMotion={reducedMotion}
          loadModel={loadModels || forceModelFailure}
        />
      ))}
      <Player3D
        playerRef={playerRef}
        inputRef={inputRef}
        placements={interactionTargets}
        completedIds={completedIds}
        enabled={!paused}
        onNearbySoundChange={onNearbySoundChange}
        reducedMotion={reducedMotion}
        loadModel={loadModels}
        debug={debugColliders || debugCamera}
        movementPositionOffset={[0, 0, 1]}
        movementYawRef={yawRef}
        facingYawRef={facingYawRef}
        movingRef={movingRef}
      />
      <HubThirdPersonCamera
        playerRef={playerRef}
        yawRef={yawRef}
        facingYawRef={facingYawRef}
        movingRef={movingRef}
        reducedMotion={reducedMotion}
        paused={paused}
        debugCamera={debugCamera}
        debugLabel="music-third-person"
      />
    </>
  )
}
