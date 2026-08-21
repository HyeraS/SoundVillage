'use client'

import { MUSIC_EXIT_TARGET } from '@/lib/three/modelConfig.mjs'

export default function MusicVillageExit({ nearby }) {
  const [x, , z] = MUSIC_EXIT_TARGET.position
  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow position={[-1.65, 0.018, -0.45]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[1.35, 4.1]} />
        <meshStandardMaterial color="#E8D2A8" roughness={1} />
      </mesh>
      <mesh castShadow position={[-0.72, 1.05, 0]}><boxGeometry args={[0.2, 2.1, 0.25]} /><meshStandardMaterial color="#865B3E" /></mesh>
      <mesh castShadow position={[0.72, 1.05, 0]}><boxGeometry args={[0.2, 2.1, 0.25]} /><meshStandardMaterial color="#865B3E" /></mesh>
      <mesh castShadow position={[0, 2.02, 0]}><boxGeometry args={[1.65, 0.24, 0.3]} /><meshStandardMaterial color="#E88C72" /></mesh>
      <mesh castShadow position={[0, 2.42, 0]}><boxGeometry args={[1.5, 0.55, 0.16]} /><meshStandardMaterial color={nearby ? '#FFF0A8' : '#F8E5BC'} emissive={nearby ? '#E88C72' : '#000000'} emissiveIntensity={nearby ? 0.35 : 0} /></mesh>
      <mesh position={[0, 2.42, 0.1]}><boxGeometry args={[0.7, 0.09, 0.035]} /><meshStandardMaterial color="#76513A" /></mesh>
    </group>
  )
}
