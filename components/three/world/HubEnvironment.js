'use client'

import { HUB_BUILDINGS, HUB_COLLIDERS } from '@/lib/three/worldConfig.mjs'
import BuildingPlaceholder from './BuildingPlaceholder'
import DecorationSet from './DecorationSet'
import Ground from './Ground'
import LandmarkOrb from './LandmarkOrb'

export default function HubEnvironment({ reducedMotion, debugColliders }) {
  return (
    <group name="b-theme-central-plaza">
      <Ground />
      {HUB_BUILDINGS.map(building => <BuildingPlaceholder key={building.id} building={building} />)}
      <DecorationSet />
      <LandmarkOrb reducedMotion={reducedMotion} />
      {debugColliders && HUB_COLLIDERS.map(collider => (
        <mesh key={collider.id} position={[collider.position[0], collider.height / 2, collider.position[1]]}>
          <boxGeometry args={[collider.size[0], collider.height, collider.size[1]]} />
          <meshBasicMaterial color="#FF4D71" wireframe transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}
