'use client'

import { HUB_EXITS, HUB_MUSEUM_PATH } from '@/lib/three/worldConfig.mjs'
import { HUB_THEME } from '@/lib/three/themeConfig.mjs'

function PathTo({ position }) {
  const x = position[0]
  const z = position[2]
  const length = Math.hypot(x, z)
  const angle = Math.atan2(x, z)
  return (
    <mesh receiveShadow position={[x / 2, 0.035, z / 2]} rotation={[0, angle, 0]}>
      <boxGeometry args={[2.15, 0.07, length]} />
      <meshStandardMaterial color={HUB_THEME.sand} roughness={1} />
    </mesh>
  )
}

function PathSegment({ start, end, width }) {
  const deltaX = end[0] - start[0]
  const deltaZ = end[2] - start[2]
  const length = Math.hypot(deltaX, deltaZ)
  const angle = Math.atan2(deltaX, deltaZ)
  return (
    <mesh receiveShadow position={[(start[0] + end[0]) / 2, 0.145, (start[2] + end[2]) / 2]} rotation={[0, angle, 0]}>
      <boxGeometry args={[width, 0.055, length]} />
      <meshStandardMaterial color={HUB_THEME.sandLight} roughness={1} />
    </mesh>
  )
}

export default function Ground() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.58, 0]} scale={[1, 0.76, 1]}>
        <cylinderGeometry args={[14.2, 13.7, 1.15, 24]} />
        <meshStandardMaterial color={HUB_THEME.grass} roughness={1} />
      </mesh>
      <PathTo position={[0, 0, 10.8]} />
      {HUB_EXITS.map(exit => <PathTo key={exit.id} position={exit.position} />)}
      <mesh receiveShadow position={[-0.3, 0.07, 0.15]} scale={[1.08, 0.92, 1]}>
        <cylinderGeometry args={[4.9, 5.05, 0.12, 32]} />
        <meshStandardMaterial color={HUB_THEME.sandLight} roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.65, 3.83, 32]} />
        <meshStandardMaterial color={HUB_THEME.cream} roughness={1} />
      </mesh>
      {HUB_MUSEUM_PATH.points.slice(1).map((point, index) => (
        <PathSegment
          key={`${HUB_MUSEUM_PATH.id}-${index}`}
          start={HUB_MUSEUM_PATH.points[index]}
          end={point}
          width={HUB_MUSEUM_PATH.width}
        />
      ))}
    </group>
  )
}
