'use client'

import { Component, Suspense, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { ASSET_MANIFEST } from '@/lib/three/assetManifest.mjs'
import EnvironmentPlaceholder from './EnvironmentPlaceholder'

const reportedModelFailures = new Set()

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) {
    if (reportedModelFailures.has(this.props.assetKey)) return
    reportedModelFailures.add(this.props.assetKey)
    console.warn('[3D] GLB placeholder fallback:', error?.message || error)
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function LoadedModel({ config }) {
  const gltf = useGLTF(config.url)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  useEffect(() => {
    scene.traverse(object => {
      if (!object.isMesh) return
      object.castShadow = config.castShadow
      object.receiveShadow = config.receiveShadow
    })
  }, [scene, config.castShadow, config.receiveShadow])

  return <primitive object={scene} />
}

export default function ModelAsset({ assetKey, loadModel = false }) {
  const config = ASSET_MANIFEST[assetKey]
  if (!config) return null
  const fallback = <EnvironmentPlaceholder type={config.placeholderType} color={config.fallbackColor} />

  return (
    <group position={config.positionOffset} rotation={config.rotation} scale={config.scale}>
      {loadModel ? (
        <ModelErrorBoundary assetKey={assetKey} fallback={fallback}>
          <Suspense fallback={fallback}><LoadedModel config={config} /></Suspense>
        </ModelErrorBoundary>
      ) : fallback}
    </group>
  )
}
