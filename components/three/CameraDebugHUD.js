'use client'

import { useEffect, useRef } from 'react'
import { CAMERA_CONFIG, HUB_THIRD_PERSON_CAMERA_CONFIG } from '@/lib/three/cameraConfig.mjs'
import styles from './prototype.module.css'

export default function CameraDebugHUD({ mode = 'follow' }) {
  const liveRef = useRef(null)
  const thirdPerson = mode === 'hub-third-person' || mode === 'music-third-person'

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
      <strong>{thirdPerson ? `${mode === 'hub-third-person' ? 'Hub' : 'Music'} third-person camera` : 'Perspective follow'}</strong>
      {thirdPerson ? (
        <>
          <span>FOV {HUB_THIRD_PERSON_CAMERA_CONFIG.fov}° · height {HUB_THIRD_PERSON_CAMERA_CONFIG.height}</span>
          <span>distance {HUB_THIRD_PERSON_CAMERA_CONFIG.distance} · ahead {HUB_THIRD_PERSON_CAMERA_CONFIG.lookAhead}</span>
          <span>damping {HUB_THIRD_PERSON_CAMERA_CONFIG.positionDamping} / {HUB_THIRD_PERSON_CAMERA_CONFIG.targetDamping}</span>
        </>
      ) : (
        <>
          <span>FOV {CAMERA_CONFIG.fov}° · offset {CAMERA_CONFIG.positionOffset.join(', ')}</span>
          <span>look Y {CAMERA_CONFIG.lookTargetHeight} · ahead {CAMERA_CONFIG.lookAhead}</span>
          <span>damping {CAMERA_CONFIG.positionDamping} / {CAMERA_CONFIG.targetDamping}</span>
        </>
      )}
      <span ref={liveRef}>camera — · target —</span>
    </aside>
  )
}
