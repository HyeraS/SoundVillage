'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D } from 'three'
import { ANIMAL_ENVIRONMENT_CONFIG, ANIMAL_EXIT_TARGET, ANIMAL_WORLD_COLLIDERS } from '@/lib/three/modelConfig.mjs'

const TREE_POSITIONS = [
  [-14.4, -6.8], [-14.2, 1.7], [-13.8, 9.4], [-10.8, 9.9],
  [14.4, -6.4], [14.3, 2.2], [13.8, 9.4], [10.7, 9.9],
]
const SHRUB_POSITIONS = [[-11, 5.9], [-8.8, 4.7], [-5.7, 7.7], [6.2, 7.5], [9.1, 5.8], [11.5, -6.9], [2.2, -8.8]]
const FLOWER_POSITIONS = [[-9.6, 6.8], [-8.9, 6.4], [-5.5, 8.4], [5.6, 8.3], [6.3, 8], [9.4, 6.7], [-2.8, -8.2], [2.8, -8.4]]
const FOOTPRINT_POSITIONS = [[-4.9, 3.9, -0.18], [-2.7, 3.3, 0.12], [-0.5, 2.8, -0.08], [1.8, 2.9, 0.15], [4.1, 3.6, -0.14]]

function Instances({ positions, children }) {
  const ref = useRef(null)
  const helper = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => {
    positions.forEach((position, index) => {
      helper.position.set(position[0], position[1] || 0, position[2] ?? position[1])
      helper.rotation.set(position[4] || 0, position[3] || 0, 0)
      helper.updateMatrix()
      ref.current.setMatrixAt(index, helper.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [helper, positions])
  return <instancedMesh ref={ref} args={[null, null, positions.length]} castShadow receiveShadow>{children}</instancedMesh>
}

function AnimalExit({ nearby }) {
  const [x, , z] = ANIMAL_EXIT_TARGET.position
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[-0.78, 1.05, 0]}><cylinderGeometry args={[0.11, 0.14, 2.1, 8]} /><meshStandardMaterial color="#825B3F" /></mesh>
      <mesh castShadow position={[0.78, 1.05, 0]}><cylinderGeometry args={[0.11, 0.14, 2.1, 8]} /><meshStandardMaterial color="#825B3F" /></mesh>
      <mesh castShadow position={[0, 2.02, 0]}><boxGeometry args={[1.8, 0.25, 0.28]} /><meshStandardMaterial color="#D98268" /></mesh>
      <mesh castShadow position={[0, 2.42, 0]}><boxGeometry args={[1.55, 0.56, 0.16]} /><meshStandardMaterial color={nearby ? '#FFF0A8' : '#F4E3BD'} emissive={nearby ? '#E58C70' : '#000'} emissiveIntensity={nearby ? 0.3 : 0} /></mesh>
      <mesh position={[0, 2.42, 0.1]}><boxGeometry args={[0.76, 0.08, 0.03]} /><meshStandardMaterial color="#76513A" /></mesh>
    </group>
  )
}

export default function AnimalVillageEnvironment({ debugColliders, showHubExit = false, exitNearby = false }) {
  const shelter = ANIMAL_ENVIRONMENT_CONFIG.shelterPosition
  const pond = ANIMAL_ENVIRONMENT_CONFIG.pondPosition
  return (
    <group>
      <mesh receiveShadow position={[0, -0.55, 0]} scale={[1, 0.72, 1]}>
        <cylinderGeometry args={[ANIMAL_ENVIRONMENT_CONFIG.groundTopRadius, ANIMAL_ENVIRONMENT_CONFIG.groundBottomRadius, 1.1, 48]} />
        <meshStandardMaterial color="#86BD62" roughness={1} />
      </mesh>

      {[
        [0, 6.3, 2.8, 8.9, 0], [-1.8, 2.4, 2.6, 5.2, -0.28], [1.5, -0.5, 2.6, 4.9, 0.34],
        [-0.8, -4.2, 2.5, 5.8, -0.18], [3.1, -6.7, 2.3, 5.1, Math.PI / 2.7],
      ].map(([x, z, width, length, rotation], index) => (
        <mesh key={index} receiveShadow position={[x, 0.018 + index * 0.001, z]} rotation={[-Math.PI / 2, 0, rotation]}>
          <planeGeometry args={[width, length]} /><meshStandardMaterial color="#E7D1A3" roughness={1} />
        </mesh>
      ))}

      <group position={[shelter[0], 0, shelter[1]]}>
        <mesh castShadow receiveShadow position={[0, 1.15, 0]}><boxGeometry args={[3.4, 2.3, 2.55]} /><meshStandardMaterial color="#F3E1BC" roughness={0.95} /></mesh>
        <mesh castShadow position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.42, 1.45, 4]} /><meshStandardMaterial color="#D97C62" roughness={0.9} /></mesh>
        <mesh position={[0, 0.75, 1.3]}><boxGeometry args={[0.85, 1.5, 0.12]} /><meshStandardMaterial color="#805A3F" /></mesh>
        <mesh position={[1.05, 1.45, 1.32]}><circleGeometry args={[0.38, 16]} /><meshStandardMaterial color="#A9DDD4" /></mesh>
      </group>

      <group position={[pond[0], 0, pond[1]]}>
        <mesh receiveShadow position={[0, -0.04, 0]} scale={[1.45, 1, 1]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.55, 28]} /><meshStandardMaterial color="#79C9C2" roughness={0.55} /></mesh>
        <mesh position={[0, -0.02, 0]} scale={[1.45, 1, 1]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.52, 1.82, 28]} /><meshStandardMaterial color="#D7C48D" roughness={1} /></mesh>
      </group>

      {[-5.4, 4.9].map((x, index) => (
        <group key={x} position={[x, 0, index ? -6.5 : 5.8]} rotation={[0, index ? -0.25 : 0.25, 0]}>
          <mesh castShadow position={[0, 1.1, 0]}><cylinderGeometry args={[0.07, 0.1, 2.2, 8]} /><meshStandardMaterial color="#815A3C" /></mesh>
          <mesh castShadow position={[0, 2, 0]}><boxGeometry args={[0.78, 0.72, 0.62]} /><meshStandardMaterial color={index ? '#74B9A6' : '#E58C70'} /></mesh>
          <mesh position={[0, 2.03, 0.32]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.13, 12]} /><meshStandardMaterial color="#5F4938" /></mesh>
          <mesh castShadow position={[0, 2.48, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.66, 0.42, 4]} /><meshStandardMaterial color="#8B6244" /></mesh>
        </group>
      ))}

      {[[-5.6, -7.8, 0.18], [7.4, 6.8, -0.28]].map(([x, z, rotation]) => (
        <group key={x} position={[x, 0.35, z]} rotation={[0, rotation, Math.PI / 2]}>
          <mesh castShadow><cylinderGeometry args={[0.32, 0.38, 2.2, 9]} /><meshStandardMaterial color="#9A6845" roughness={1} /></mesh>
          <mesh position={[0, 1.11, 0]}><circleGeometry args={[0.31, 12]} /><meshStandardMaterial color="#C99462" /></mesh>
        </group>
      ))}

      <Instances positions={TREE_POSITIONS.map(([x, z]) => [x, 0.78, z])}>
        <cylinderGeometry args={[0.2, 0.28, 1.55, 9]} /><meshStandardMaterial color="#8D6546" roughness={1} />
      </Instances>
      <Instances positions={TREE_POSITIONS.map(([x, z]) => [x, 2, z])}>
        <coneGeometry args={[1.05, 2.2, 10]} /><meshStandardMaterial color="#4F9D58" roughness={1} />
      </Instances>
      <Instances positions={SHRUB_POSITIONS.map(([x, z]) => [x, 0.55, z])}>
        <dodecahedronGeometry args={[0.68, 0]} /><meshStandardMaterial color="#69AA59" roughness={1} />
      </Instances>
      <Instances positions={FLOWER_POSITIONS.map(([x, z]) => [x, 0.22, z])}>
        <sphereGeometry args={[0.16, 7, 5]} /><meshStandardMaterial color="#F39A91" roughness={0.9} />
      </Instances>
      <Instances positions={FOOTPRINT_POSITIONS.map(([x, z, rotation]) => [x, 0.035, z, rotation, -Math.PI / 2])}>
        <circleGeometry args={[0.18, 8]} /><meshStandardMaterial color="#B89468" roughness={1} />
      </Instances>

      <group position={[-2.8, 0.9, -7.8]}>
        <mesh rotation={[0, 0, -0.35]}><coneGeometry args={[0.18, 0.55, 5]} /><meshStandardMaterial color="#72BBA8" /></mesh>
        <mesh position={[0.4, 0.2, 0]} rotation={[0, 0, 0.4]}><coneGeometry args={[0.16, 0.48, 5]} /><meshStandardMaterial color="#F1A07E" /></mesh>
      </group>

      {showHubExit && <AnimalExit nearby={exitNearby} />}
      {debugColliders && ANIMAL_WORLD_COLLIDERS.map(collider => (
        <mesh key={collider.id} position={[collider.position[0], collider.height / 2, collider.position[1]]}>
          <boxGeometry args={[collider.size[0], collider.height, collider.size[1]]} />
          <meshBasicMaterial color="#FF4D71" wireframe transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}
