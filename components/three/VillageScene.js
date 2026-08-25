'use client'

import { useRef } from 'react'
import { Color } from 'three'
import { getVillageRuntimeConfig } from '@/lib/three/modelConfig.mjs'
import { createVillageInteractionTargets } from '@/lib/three/sceneFlow.mjs'
import AnimalVillageEnvironment from './AnimalVillageEnvironment'
import InteractableSound from './InteractableSound'
import Player3D from './Player3D'
import VillageEnvironment from './VillageEnvironment'
import HubThirdPersonCamera from './world/HubThirdPersonCamera'

export default function VillageScene({ sceneId = 'music', placements, completedIds, nearbyId, inputRef, onNearbySoundChange, paused, reducedMotion, debugColliders, debugCamera, loadModels, forceModelFailure, showHubExit = false }) {
  const playerRef = useRef(null)
  const yawRef = useRef(0)
  const facingYawRef = useRef(0)
  const movingRef = useRef(false)
  const config = getVillageRuntimeConfig(sceneId)
  const interactionTargets = createVillageInteractionTargets(placements, config.exitTarget, showHubExit)
  const animalMode = sceneId === 'animal'

  return (
    <>
      <color attach="background" args={[animalMode ? '#BCE4EE' : '#B9DDF0']} />
      <fog attach="fog" args={[animalMode ? '#BCE4EE' : '#B9DDF0', 20, 39]} />
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
      {animalMode ? (
        <AnimalVillageEnvironment debugColliders={debugColliders} showHubExit={showHubExit} exitNearby={nearbyId === config.exitTarget.id} />
      ) : (
        <VillageEnvironment loadModels={loadModels} debugColliders={debugColliders} showHubExit={showHubExit} exitNearby={nearbyId === config.exitTarget.id} />
      )}
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
        startPosition={config.playerStart}
        worldBounds={config.worldBounds}
        worldColliders={config.worldColliders}
      />
      <HubThirdPersonCamera
        playerRef={playerRef}
        yawRef={yawRef}
        facingYawRef={facingYawRef}
        movingRef={movingRef}
        reducedMotion={reducedMotion}
        paused={paused}
        debugCamera={debugCamera}
        debugLabel={config.cameraDebugLabel}
      />
    </>
  )
}
