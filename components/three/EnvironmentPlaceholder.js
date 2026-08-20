'use client'

export default function EnvironmentPlaceholder({ type, color = '#C9B6E4' }) {
  if (type === 'player') return (
    <group>
      <mesh castShadow position={[0, 0.72, 0]}><capsuleGeometry args={[0.32, 0.72, 6, 12]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
      <mesh castShadow position={[0, 1.36, 0]}><sphereGeometry args={[0.3, 16, 12]} /><meshStandardMaterial color="#F5D2AF" roughness={0.85} /></mesh>
      <mesh castShadow position={[-0.2, 1.58, -0.02]} rotation={[0, 0, -0.35]}><coneGeometry args={[0.18, 0.52, 8]} /><meshStandardMaterial color="#8C6CC2" /></mesh>
      <mesh castShadow position={[0.2, 1.58, -0.02]} rotation={[0, 0, 0.35]}><coneGeometry args={[0.18, 0.52, 8]} /><meshStandardMaterial color="#8C6CC2" /></mesh>
    </group>
  )

  if (type === 'musicHouse') return (
    <group>
      <mesh castShadow receiveShadow position={[0, 1.25, 0]}><boxGeometry args={[3.7, 2.5, 2.7]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      <mesh castShadow position={[0, 2.75, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.65, 1.55, 4]} /><meshStandardMaterial color="#A96B86" roughness={0.85} /></mesh>
      <mesh position={[0, 0.72, 1.38]}><boxGeometry args={[0.8, 1.45, 0.1]} /><meshStandardMaterial color="#775243" /></mesh>
      <mesh position={[-1.1, 1.45, 1.39]}><boxGeometry args={[0.72, 0.72, 0.08]} /><meshStandardMaterial color="#BDE5E8" emissive="#8ED0D6" emissiveIntensity={0.12} /></mesh>
      <mesh position={[1.1, 1.45, 1.39]}><boxGeometry args={[0.72, 0.72, 0.08]} /><meshStandardMaterial color="#BDE5E8" emissive="#8ED0D6" emissiveIntensity={0.12} /></mesh>
      <mesh position={[0, 2.05, 1.52]}><torusGeometry args={[0.34, 0.09, 8, 20]} /><meshStandardMaterial color="#FFF1A8" /></mesh>
    </group>
  )

  if (type === 'museum') return (
    <group>
      <mesh castShadow receiveShadow position={[0, 1.25, 0]}><boxGeometry args={[4, 2.5, 2.8]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh castShadow position={[0, 2.78, 0]}><coneGeometry args={[2.8, 1.45, 4]} /><meshStandardMaterial color="#B49A70" roughness={0.9} /></mesh>
      {[-1.25, -0.42, 0.42, 1.25].map(x => <mesh key={x} castShadow position={[x, 1.25, 1.48]}><cylinderGeometry args={[0.13, 0.16, 2.1, 10]} /><meshStandardMaterial color="#FFF4D8" /></mesh>)}
      <mesh position={[0, 0.76, 1.5]}><boxGeometry args={[0.82, 1.5, 0.1]} /><meshStandardMaterial color="#7B624D" /></mesh>
    </group>
  )

  if (type === 'tree') return (
    <group>
      <mesh castShadow position={[0, 0.78, 0]}><cylinderGeometry args={[0.2, 0.28, 1.55, 9]} /><meshStandardMaterial color="#8D6546" roughness={1} /></mesh>
      <mesh castShadow position={[0, 2, 0]}><coneGeometry args={[1.05, 2.2, 10]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh castShadow position={[-0.35, 2.2, 0.35]}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color="#F28E86" /></mesh>
    </group>
  )

  if (type === 'flowerPink' || type === 'flowerWhite') return (
    <group>
      <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.025, 0.035, 0.36, 6]} /><meshStandardMaterial color="#5C9868" /></mesh>
      <mesh castShadow position={[0, 0.42, 0]}><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial color={type === 'flowerPink' ? color : '#FFF8EA'} /></mesh>
      <mesh position={[0, 0.43, 0.13]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#F5CE68" /></mesh>
    </group>
  )

  if (type === 'fence') return (
    <group>
      <mesh castShadow position={[0, 0.45, 0]}><boxGeometry args={[2, 0.16, 0.18]} /><meshStandardMaterial color={color} /></mesh>
      <mesh castShadow position={[0, 0.85, 0]}><boxGeometry args={[2, 0.14, 0.18]} /><meshStandardMaterial color={color} /></mesh>
      {[-0.85, 0.85].map(x => <mesh key={x} castShadow position={[x, 0.55, 0]}><boxGeometry args={[0.18, 1.25, 0.22]} /><meshStandardMaterial color="#95633F" /></mesh>)}
    </group>
  )

  if (type === 'bench') return (
    <group>
      <mesh castShadow position={[0, 0.48, 0]}><boxGeometry args={[1.7, 0.18, 0.55]} /><meshStandardMaterial color={color} /></mesh>
      <mesh castShadow position={[0, 0.9, -0.22]}><boxGeometry args={[1.7, 0.58, 0.16]} /><meshStandardMaterial color="#B77E55" /></mesh>
      {[-0.65, 0.65].map(x => <mesh key={x} position={[x, 0.2, 0]}><boxGeometry args={[0.12, 0.45, 0.42]} /><meshStandardMaterial color="#6E5A4A" /></mesh>)}
    </group>
  )

  if (type === 'lamp') return (
    <group>
      <mesh castShadow position={[0, 0.8, 0]}><cylinderGeometry args={[0.06, 0.09, 1.6, 8]} /><meshStandardMaterial color="#675B62" /></mesh>
      <mesh position={[0, 1.68, 0]}><sphereGeometry args={[0.22, 12, 8]} /><meshStandardMaterial color={color} emissive="#FFD97A" emissiveIntensity={0.8} /></mesh>
      <pointLight position={[0, 1.65, 0]} color="#FFD78D" intensity={0.45} distance={3.5} />
    </group>
  )

  return (
    <group>
      <mesh castShadow><sphereGeometry args={[0.42, 18, 12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.35} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.62, 0.035, 8, 32]} /><meshStandardMaterial color="#FFF8D5" emissive="#FFF1A8" emissiveIntensity={0.35} /></mesh>
    </group>
  )
}

