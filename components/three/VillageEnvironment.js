'use client'

import { DECORATION_POSITIONS, WORLD_COLLIDERS } from '@/lib/three/modelConfig.mjs'
import ModelAsset from './ModelAsset'
import MusicVillageExit from './MusicVillageExit'

function AssetAt({ assetKey, position, rotation, loadModel }) {
  return <group position={[position[0], 0, position[1]]} rotation={rotation}><ModelAsset assetKey={assetKey} loadModel={loadModel} /></group>
}

export default function VillageEnvironment({ loadModels, debugColliders, showHubExit = false, exitNearby = false }) {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.55, 0]} scale={[1, 0.72, 1]}>
        <cylinderGeometry args={[13.2, 12.7, 1.1, 48]} />
        <meshStandardMaterial color="#87B969" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 15.5]} />
        <meshStandardMaterial color="#E8D2A8" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, 0.025, 4.9]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[2.4, 18.5]} />
        <meshStandardMaterial color="#E8D2A8" roughness={1} />
      </mesh>

      <AssetAt assetKey="musicVillageHouse" position={[-5.2, -2.7]} loadModel={loadModels} />
      <AssetAt assetKey="soundMuseum" position={[5.2, -2.7]} loadModel={loadModels} />
      {showHubExit && <MusicVillageExit nearby={exitNearby} />}
      <group position={[2.9, 0, 1.9]} rotation={[0, -0.28, 0]}>
        <mesh castShadow position={[0, 0.75, 0]}><cylinderGeometry args={[0.07, 0.1, 1.5, 8]} /><meshStandardMaterial color="#7A543C" /></mesh>
        <mesh castShadow position={[0, 1.35, 0]}><boxGeometry args={[1.45, 0.58, 0.13]} /><meshStandardMaterial color="#C18A5C" /></mesh>
        <mesh position={[0.44, 1.36, 0.08]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.13, 0.035, 8, 18]} /><meshStandardMaterial color="#FFF1A8" emissive="#FFF1A8" emissiveIntensity={0.25} /></mesh>
      </group>

      {DECORATION_POSITIONS.trees.map((position, index) => (
        <AssetAt key={`tree-${index}`} assetKey="appleTree" position={position} loadModel={loadModels} />
      ))}
      {DECORATION_POSITIONS.flowers.map((position, index) => (
        <AssetAt key={`flower-${index}`} assetKey={index % 2 ? 'flowerWhite' : 'flowerPink'} position={position} loadModel={loadModels} />
      ))}
      {DECORATION_POSITIONS.benches.map((position, index) => (
        <AssetAt key={`bench-${index}`} assetKey="bench" position={position} rotation={[0, index ? -0.18 : 0.18, 0]} loadModel={loadModels} />
      ))}
      {DECORATION_POSITIONS.lamps.map((position, index) => (
        <AssetAt key={`lamp-${index}`} assetKey="lampPost" position={position} loadModel={loadModels} />
      ))}
      {[-6.5, -4.3, -2.1, 2.1, 4.3, 6.5].map((x, index) => (
        <AssetAt key={`fence-${index}`} assetKey="woodenFence" position={[x, -7.1]} loadModel={loadModels} />
      ))}

      {debugColliders && WORLD_COLLIDERS.map(collider => (
        <mesh key={collider.id} position={[collider.position[0], collider.height / 2, collider.position[1]]}>
          <boxGeometry args={[collider.size[0], collider.height, collider.size[1]]} />
          <meshBasicMaterial color="#FF4D71" wireframe transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}
