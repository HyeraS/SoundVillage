'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SOUND_ORB_VISUAL_SCALE } from '@/lib/three/modelConfig.mjs'
import ModelAsset from './ModelAsset'

export default function InteractableSound({ placement, completed, nearby, reducedMotion, loadModel }) {
  const groupRef = useRef(null)
  const baseY = placement.position[1]

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    if (!reducedMotion) {
      groupRef.current.position.y = baseY + Math.sin(clock.elapsedTime * 1.7 + placement.position[0]) * 0.12
      groupRef.current.rotation.y += delta * 0.45
    }
  })

  return (
    <group ref={groupRef} position={placement.position}>
      <group scale={completed ? SOUND_ORB_VISUAL_SCALE.completed : nearby ? SOUND_ORB_VISUAL_SCALE.nearby : SOUND_ORB_VISUAL_SCALE.default}>
        <ModelAsset assetKey="soundOrb" loadModel={loadModel} />
      </group>
      <pointLight color={completed ? '#E6C87A' : '#B897EE'} intensity={nearby ? 1.7 : 0.75} distance={3.2} />
      {completed && (
        <mesh position={[0.34, 0.38, 0.12]}>
          <sphereGeometry args={[0.18, 12, 8]} />
          <meshStandardMaterial color="#79A879" emissive="#79A879" emissiveIntensity={0.25} />
        </mesh>
      )}
    </group>
  )
}
