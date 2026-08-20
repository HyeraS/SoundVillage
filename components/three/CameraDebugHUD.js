'use client'

import { useEffect, useRef } from 'react'
import { CAMERA_CONFIG } from '@/lib/three/cameraConfig.mjs'
import styles from './prototype.module.css'

export default function CameraDebugHUD() {
  const liveRef = useRef(null)

  useEffect(() => {
    const update = () => {
      const root = document.querySelector('[data-testid="three-prototype"]')
      if (!root || !liveRef.current) return
      liveRef.current.textContent = `camera ${root.dataset.cameraPosition || '—'} · target ${root.dataset.cameraTarget || '—'} · ${root.dataset.cameraLayout || '—'} · ${root.dataset.cameraPaused === 'true' ? 'paused' : 'tracking'}`
    }
    update()
    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside className={styles.cameraDebug} aria-label="카메라 디버그 정보">
      <strong>Perspective follow</strong>
      <span>FOV {CAMERA_CONFIG.fov}° · offset {CAMERA_CONFIG.positionOffset.join(', ')}</span>
      <span>look Y {CAMERA_CONFIG.lookTargetHeight} · ahead {CAMERA_CONFIG.lookAhead}</span>
      <span>damping {CAMERA_CONFIG.positionDamping} / {CAMERA_CONFIG.targetDamping}</span>
      <span ref={liveRef}>camera — · target —</span>
    </aside>
  )
}
