'use client'

import { HUB_THEME } from '@/lib/three/themeConfig.mjs'

function Door({ width = 0.85, height = 1.45 }) {
  return (
    <group position={[0, height / 2, 1.46]}>
      <mesh castShadow><boxGeometry args={[width, height, 0.14]} /><meshStandardMaterial color={HUB_THEME.woodDark} roughness={0.88} /></mesh>
      <mesh position={[width * 0.3, 0, 0.09]}><sphereGeometry args={[0.055, 8, 6]} /><meshStandardMaterial color={HUB_THEME.gold} /></mesh>
    </group>
  )
}

function Window({ position }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[0.7, 0.7, 0.12]} /><meshStandardMaterial color={HUB_THEME.mint} emissive={HUB_THEME.mint} emissiveIntensity={0.08} roughness={0.5} /></mesh>
      <mesh position={[0, 0, 0.07]}><torusGeometry args={[0.27, 0.035, 6, 16]} /><meshStandardMaterial color={HUB_THEME.cream} /></mesh>
    </group>
  )
}

function PlayerHome() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 1.25, 0]}><boxGeometry args={[3.8, 2.5, 2.8]} /><meshStandardMaterial color={HUB_THEME.cream} roughness={0.92} /></mesh>
      <mesh castShadow position={[0, 2.78, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.65, 1.55, 4]} /><meshStandardMaterial color={HUB_THEME.coral} roughness={0.86} /></mesh>
      <mesh castShadow position={[0.9, 3.45, -0.35]}><cylinderGeometry args={[0.22, 0.27, 0.8, 8]} /><meshStandardMaterial color={HUB_THEME.coralDark} /></mesh>
      <Door />
      <Window position={[-1.15, 1.45, 1.46]} />
      <Window position={[1.15, 1.45, 1.46]} />
    </group>
  )
}

function ListeningPavilion() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0.18, 0]}><boxGeometry args={[4.35, 0.36, 2.45]} /><meshStandardMaterial color={HUB_THEME.wood} roughness={0.92} /></mesh>
      {[-1.75, 1.75].flatMap(x => [-0.82, 0.82].map(z => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 1.45, z]}><cylinderGeometry args={[0.12, 0.16, 2.55, 8]} /><meshStandardMaterial color={HUB_THEME.woodDark} roughness={0.85} /></mesh>
      )))}
      <mesh castShadow position={[0, 2.92, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.35, 1, 0.82]}><coneGeometry args={[2.4, 1.3, 4]} /><meshStandardMaterial color={HUB_THEME.teal} roughness={0.83} /></mesh>
      <mesh position={[0, 1.42, -0.5]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.58, 0.12, 10, 28]} /><meshStandardMaterial color={HUB_THEME.gold} roughness={0.4} /></mesh>
      <mesh position={[0, 1.42, -0.5]}><cylinderGeometry args={[0.08, 0.12, 0.95, 8]} /><meshStandardMaterial color={HUB_THEME.wood} /></mesh>
    </group>
  )
}

function SoundMuseum() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 1.3, 0]}><boxGeometry args={[4.25, 2.6, 3]} /><meshStandardMaterial color={HUB_THEME.cream} roughness={0.94} /></mesh>
      <mesh castShadow position={[0, 2.92, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.25, 1, 0.9]}><coneGeometry args={[2.55, 1.25, 4]} /><meshStandardMaterial color={HUB_THEME.tealDark} roughness={0.88} /></mesh>
      <mesh castShadow position={[0, 3.66, 0]}><cylinderGeometry args={[0.62, 0.78, 0.38, 12]} /><meshStandardMaterial color={HUB_THEME.teal} /></mesh>
      <Door width={1} height={1.6} />
      {[-1.45, 1.45].map(x => <mesh key={x} castShadow position={[x, 1.2, 1.58]}><cylinderGeometry args={[0.14, 0.18, 2, 10]} /><meshStandardMaterial color={HUB_THEME.sandLight} /></mesh>)}
      <mesh position={[0, 2.15, 1.58]}><torusGeometry args={[0.34, 0.08, 8, 20]} /><meshStandardMaterial color={HUB_THEME.gold} /></mesh>
    </group>
  )
}

export default function BuildingPlaceholder({ building }) {
  return (
    <group name={building.id} position={building.position} rotation={building.rotation}>
      {building.type === 'home' && <PlayerHome />}
      {building.type === 'pavilion' && <ListeningPavilion />}
      {building.type === 'museum' && <SoundMuseum />}
    </group>
  )
}
