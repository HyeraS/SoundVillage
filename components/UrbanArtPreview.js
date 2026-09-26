'use client'

import { useEffect, useRef, useState } from 'react'
import { T, MAP_W, MAP_H } from '@/lib/urbanVillageConfig.mjs'
import { loadUrbanAssetSet, drawUrbanAssetAll } from '@/lib/urbanAssetArt'

export default function UrbanArtPreview() {
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    loadUrbanAssetSet().then((assets) => {
      if (cancelled || !canvasRef.current) return
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      context.imageSmoothingEnabled = false
      drawUrbanAssetAll(context, assets)
      setReady(true)
    }).catch((loadError) => {
      if (cancelled) return
      console.error(loadError)
      setError(loadError.message)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <main
      data-urban-art-preview
      data-urban-asset-renderer="imagegen-v2"
      data-urban-ready={ready ? 'true' : 'false'}
      data-urban-asset-error={error || undefined}
      style={{
        width: '100vw', height: '100vh', display: 'grid', placeItems: 'center',
        overflow: 'hidden', background: '#05091a',
      }}
    >
      <canvas
        ref={canvasRef}
        width={MAP_W * T}
        height={MAP_H * T}
        aria-label="Urban Midnight Metro art-only full map"
        style={{
          display: 'block', width: 'min(100vw, calc(100vh * 4 / 3))', height: 'auto',
          maxHeight: '100vh', aspectRatio: '4 / 3', imageRendering: 'pixelated',
        }}
      />
    </main>
  )
}
