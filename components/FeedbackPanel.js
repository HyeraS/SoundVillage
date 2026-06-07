'use client'
import { useEffect, useState } from 'react'
import { ZONE_META } from '@/components/GameEngine'

/* ─────────────────────────────────────────────
   Phase 2 FeedbackPanel — Cozy 토스트 팝업
   2초 후 자동 닫힘 + 진행바
───────────────────────────────────────────── */
export default function FeedbackPanel({ zone, onClose }) {
  const [progress, setProgress] = useState(100)
  const meta = ZONE_META[zone] || { color: '#5B9E3A', emoji: '🎵', label: zone }
  const DURATION = 2200

  useEffect(() => {
    // 닫기 타이머
    const closeTimer = setTimeout(onClose, DURATION)
    // 진행바 감소
    const start = Date.now()
    const tick  = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100))
    }, 30)
    return () => { clearTimeout(closeTimer); clearInterval(tick) }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: '80px',
        zIndex: 200, pointerEvents: 'none',
      }}
    >
      <div style={{
        background: '#F5EDD8',
        border: `3px solid ${meta.color}`,
        borderRadius: '20px',
        padding: '20px 28px',
        minWidth: '280px',
        textAlign: 'center',
        fontFamily: 'Nunito, sans-serif',
        boxShadow: `0 8px 32px ${meta.color}44, 0 2px 0 ${meta.color} inset`,
        animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 진행바 (하단) */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          height: '4px', borderRadius: '0 0 20px 20px',
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${meta.color}88, ${meta.color})`,
          transition: 'width 0.03s linear',
        }}/>

        {/* 체크 아이콘 */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: `${meta.color}22`,
          border: `2px solid ${meta.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
          fontSize: '22px',
        }}>
          ✓
        </div>

        <div style={{ fontSize: '16px', fontWeight: 800, color: '#3A2A14', marginBottom: '4px' }}>
          소리 수집 완료!
        </div>
        <div style={{ fontSize: '12px', color: '#8B6A3A', lineHeight: 1.6 }}>
          {meta.emoji} {meta.label}의 소리가 기록됐어요<br/>
          <span style={{ fontSize: '11px', color: '#A09080' }}>
            다른 소리를 찾아 탐험해보세요 🌿
          </span>
        </div>
      </div>
    </div>
  )
}