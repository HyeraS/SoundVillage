'use client'

import { useLayoutEffect, useRef } from 'react'
import { Object3D } from 'three'
import { HUB_DECORATIONS, HUB_EXITS } from '@/lib/three/worldConfig.mjs'
import { HUB_THEME } from '@/lib/three/themeConfig.mjs'

function Instances({ items, children, castShadow = true, receiveShadow = false }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const object = new Object3D()
    items.forEach((item, index) => {
      object.position.set(item[0], item[3] ?? 0, item[1])
      object.rotation.set(0, item[2] ?? 0, 0)
      object.scale.setScalar(item[4] ?? 1)
      object.updateMatrix()
      ref.current.setMatrixAt(index, object.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  return <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow={receiveShadow}>{children}</instancedMesh>
}

function Trees() {
  const trunks = HUB_DECORATIONS.trees.map(([x, z]) => [x, z, 0, 0.82, 1])
  const crowns = HUB_DECORATIONS.trees.map(([x, z]) => [x, z, 0, 2.05, 1])
  const apples = HUB_DECORATIONS.trees.map(([x, z], index) => [x + (index % 2 ? 0.34 : -0.3), z + (index % 3 ? 0.15 : -0.2), 0, 2.25, 1])
  return (
    <group>
      <Instances items={trunks}><cylinderGeometry args={[0.22, 0.31, 1.65, 8]} /><meshStandardMaterial color={HUB_THEME.woodDark} roughness={1} /></Instances>
      <Instances items={crowns}><dodecahedronGeometry args={[1.12, 0]} /><meshStandardMaterial color={HUB_THEME.deepGreen} roughness={0.96} /></Instances>
      <Instances items={apples}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color={HUB_THEME.coral} roughness={0.8} /></Instances>
    </group>
  )
}

function Flowers({ items, color }) {
  const stems = items.map(([x, z]) => [x, z, 0, 0.17, 1])
  const tops = items.map(([x, z]) => [x, z, 0, 0.36, 1])
  return (
    <group>
      <Instances items={stems} castShadow={false}><cylinderGeometry args={[0.018, 0.026, 0.34, 6]} /><meshStandardMaterial color={HUB_THEME.deepGreen} /></Instances>
      <Instances items={tops} castShadow={false}><sphereGeometry args={[0.12, 7, 5]} /><meshStandardMaterial color={color} roughness={0.9} /></Instances>
    </group>
  )
}

function Fences() {
  const upper = HUB_DECORATIONS.fences.map(([x, z, r]) => [x, z, r, 0.72, 1])
  const lower = HUB_DECORATIONS.fences.map(([x, z, r]) => [x, z, r, 0.38, 1])
  return (
    <group>
      <Instances items={upper}><boxGeometry args={[2, 0.14, 0.18]} /><meshStandardMaterial color={HUB_THEME.wood} roughness={0.9} /></Instances>
      <Instances items={lower}><boxGeometry args={[2, 0.14, 0.18]} /><meshStandardMaterial color={HUB_THEME.wood} roughness={0.9} /></Instances>
    </group>
  )
}

function Bench({ item }) {
  return <group position={[item[0], 0, item[1]]} rotation={[0, item[2], 0]}>
    <mesh castShadow position={[0, 0.47, 0]}><boxGeometry args={[1.75, 0.18, 0.55]} /><meshStandardMaterial color={HUB_THEME.wood} /></mesh>
    <mesh castShadow position={[0, 0.9, -0.22]}><boxGeometry args={[1.75, 0.58, 0.15]} /><meshStandardMaterial color={HUB_THEME.woodDark} /></mesh>
  </group>
}

function Lamp({ position }) {
  return <group position={[position[0], 0, position[1]]}>
    <mesh castShadow position={[0, 0.85, 0]}><cylinderGeometry args={[0.055, 0.09, 1.7, 8]} /><meshStandardMaterial color={HUB_THEME.woodDark} /></mesh>
    <mesh position={[0, 1.82, 0]}><sphereGeometry args={[0.2, 10, 7]} /><meshStandardMaterial color={HUB_THEME.lamp} emissive={HUB_THEME.lamp} emissiveIntensity={0.32} /></mesh>
  </group>
}

function Pot({ position, index }) {
  return <group position={[position[0], 0, position[1]]}>
    <mesh castShadow position={[0, 0.25, 0]}><cylinderGeometry args={[0.26, 0.2, 0.5, 10]} /><meshStandardMaterial color={index % 2 ? HUB_THEME.teal : HUB_THEME.coral} roughness={0.86} /></mesh>
    <mesh position={[0, 0.68, 0]}><dodecahedronGeometry args={[0.34, 0]} /><meshStandardMaterial color={HUB_THEME.deepGreen} roughness={0.95} /></mesh>
  </group>
}

function ExitMarker({ exit, locked }) {
  return <group name={`exit-${exit.id}`} position={exit.position} rotation={[0, exit.rotationY, 0]}>
    <mesh castShadow position={[-0.9, 1.05, 0]}><cylinderGeometry args={[0.11, 0.15, 2.1, 8]} /><meshStandardMaterial color={HUB_THEME.woodDark} /></mesh>
    <mesh castShadow position={[0.9, 1.05, 0]}><cylinderGeometry args={[0.11, 0.15, 2.1, 8]} /><meshStandardMaterial color={HUB_THEME.woodDark} /></mesh>
    <mesh castShadow position={[0, 2.05, 0]}><boxGeometry args={[2.05, 0.52, 0.2]} /><meshStandardMaterial color={locked ? '#8D8A82' : exit.color} roughness={0.78} /></mesh>
    <mesh position={[0, 2.05, 0.13]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.045, 7, 18]} /><meshStandardMaterial color={HUB_THEME.goldLight} /></mesh>
    {locked && <group position={[0, 2.65, 0]}>
      <mesh position={[0, 0.1, 0]}><torusGeometry args={[0.18, 0.06, 7, 14, Math.PI]} /><meshStandardMaterial color="#5D5A55" /></mesh>
      <mesh position={[0, -0.13, 0]}><boxGeometry args={[0.48, 0.34, 0.18]} /><meshStandardMaterial color="#6E6A63" /></mesh>
    </group>}
  </group>
}

function DirectionSign() {
  return <group name="hub-direction-sign" position={[5.1, 0, 4.9]} rotation={[0, -0.34, 0]}>
    <mesh castShadow position={[0, 0.85, 0]}><cylinderGeometry args={[0.07, 0.11, 1.7, 8]} /><meshStandardMaterial color={HUB_THEME.woodDark} /></mesh>
    {[
      { y: 1.46, x: -0.26, color: HUB_THEME.coral, rotation: -0.08 },
      { y: 1.12, x: 0.24, color: HUB_THEME.teal, rotation: 0.08 },
      { y: 0.8, x: -0.2, color: HUB_THEME.mint, rotation: -0.04 },
    ].map((arrow, index) => <group key={index} position={[arrow.x, arrow.y, 0]} rotation={[0, 0, arrow.rotation]}>
      <mesh castShadow><boxGeometry args={[0.88, 0.22, 0.13]} /><meshStandardMaterial color={arrow.color} roughness={0.82} /></mesh>
      <mesh position={[index % 2 ? 0.49 : -0.49, 0, 0]} rotation={[0, 0, index % 2 ? -Math.PI / 2 : Math.PI / 2]}><coneGeometry args={[0.19, 0.34, 3]} /><meshStandardMaterial color={arrow.color} /></mesh>
    </group>)}
  </group>
}

export default function DecorationSet({ villagesUnlocked = false }) {
  return (
    <group>
      <Trees />
      <Flowers items={HUB_DECORATIONS.flowersPink} color={HUB_THEME.flowerPink} />
      <Flowers items={HUB_DECORATIONS.flowersWhite} color={HUB_THEME.flowerWhite} />
      <Fences />
      {HUB_DECORATIONS.benches.map((item, index) => <Bench key={`bench-${index}`} item={item} />)}
      {HUB_DECORATIONS.lamps.map((position, index) => <Lamp key={`lamp-${index}`} position={position} />)}
      {HUB_DECORATIONS.pots.map((position, index) => <Pot key={`pot-${index}`} position={position} index={index} />)}
      {HUB_EXITS.map(exit => <ExitMarker key={exit.id} exit={exit} locked={exit.id !== 'music' && !villagesUnlocked} />)}
      <DirectionSign />
    </group>
  )
}
