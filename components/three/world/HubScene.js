'use client'

import { useMemo, useRef } from 'react'
import { Color } from 'three'
import { HUB_LIGHTING, HUB_THEME } from '@/lib/three/themeConfig.mjs'
import { createHubInteractionTargets, HUB_BOUNDS, HUB_COLLIDERS, HUB_PLAYER_START } from '@/lib/three/worldConfig.mjs'
import Player3D from '../Player3D'
import HubThirdPersonCamera from './HubThirdPersonCamera'
import HubEnvironment from './HubEnvironment'

export default function HubScene({ inputRef, onNearbyHubTargetChange, paused, reducedMotion, debugColliders, debugCamera, startPosition = HUB_PLAYER_START, initialYaw = 0 }) {
  const playerRef = useRef(null)
  const yawRef = useRef(initialYaw)
  const facingYawRef = useRef(initialYaw)
  const movingRef = useRef(false)
  const interactionTargets = useMemo(() => createHubInteractionTargets(), [])
  const completedIds = useMemo(() => new Set(), [])

  return (
    <>
      <color attach="background" args={[HUB_THEME.sky]} />
      <fog attach="fog" args={[HUB_THEME.skyHaze, 31, 58]} />
      <hemisphereLight args={[HUB_LIGHTING.hemisphereSky, HUB_LIGHTING.hemisphereGround, HUB_LIGHTING.hemisphereIntensity]} />
      <ambientLight intensity={HUB_LIGHTING.ambientIntensity} />
      <directionalLight
        castShadow
        position={HUB_LIGHTING.sunPosition}
        intensity={HUB_LIGHTING.sunIntensity}
        color={new Color(HUB_LIGHTING.sunColor)}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <HubEnvironment reducedMotion={reducedMotion} debugColliders={debugColliders} />
      <Player3D
        playerRef={playerRef}
        inputRef={inputRef}
        placements={interactionTargets}
        completedIds={completedIds}
        enabled={!paused}
        onNearbySoundChange={onNearbyHubTargetChange}
        reducedMotion={reducedMotion}
        loadModel={false}
        debug={debugColliders || debugCamera}
        startPosition={startPosition}
        worldBounds={HUB_BOUNDS}
        worldColliders={HUB_COLLIDERS}
        interactionRadius={2.35}
        movementPositionOffset={[0, 0, 1]}
        movementYawRef={yawRef}
        facingYawRef={facingYawRef}
        movingRef={movingRef}
        showModel
      />
      <HubThirdPersonCamera
        playerRef={playerRef}
        yawRef={yawRef}
        facingYawRef={facingYawRef}
        movingRef={movingRef}
        reducedMotion={reducedMotion}
        paused={paused}
        debugCamera={debugCamera}
      />
    </>
  )
}
