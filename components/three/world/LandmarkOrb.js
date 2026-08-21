'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { getLandmarkOrbMotion, HUB_LANDMARK } from '@/lib/three/worldConfig.mjs'
import { HUB_THEME } from '@/lib/three/themeConfig.mjs'

export default function LandmarkOrb({ reducedMotion }) {
  const orbRef = useRef(null)
  useFrame(({ clock }) => {
    if (!orbRef.current) return
    const motion = getLandmarkOrbMotion(clock.elapsedTime, reducedMotion)
    orbRef.current.position.y = HUB_LANDMARK.position[1] + motion.yOffset
    orbRef.current.rotation.y = motion.rotationY
  })

  return (
    <group name={HUB_LANDMARK.id}>
      <mesh receiveShadow position={[0, 0.12, 0]}><cylinderGeometry args={[1.35, 1.55, 0.24, 20]} /><meshStandardMaterial color={HUB_THEME.cream} roughness={0.94} /></mesh>
      <mesh receiveShadow position={[0, 0.32, 0]}><cylinderGeometry args={[0.82, 1.12, 0.34, 20]} /><meshStandardMaterial color={HUB_THEME.sand} roughness={0.9} /></mesh>
      <group ref={orbRef} position={HUB_LANDMARK.position}>
        <mesh castShadow><sphereGeometry args={[0.74, 20, 14]} /><meshStandardMaterial color={HUB_THEME.gold} emissive={HUB_THEME.gold} emissiveIntensity={0.34} roughness={0.28} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.99, 0.055, 10, 40]} /><meshStandardMaterial color={HUB_THEME.goldLight} emissive={HUB_THEME.goldLight} emissiveIntensity={0.22} /></mesh>
        <mesh rotation={[0.35, 0, Math.PI / 2]}><torusGeometry args={[0.9, 0.035, 8, 36]} /><meshStandardMaterial color={HUB_THEME.mint} /></mesh>
      </group>
      <pointLight position={[0, 1.05, 0]} color={HUB_THEME.gold} intensity={0.72} distance={4.2} />
    </group>
  )
}
