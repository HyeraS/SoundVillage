'use client'
import { useEffect, useRef, useState } from 'react'

/* ─────────────────────────────────────────────
   Zone 정의 — Effect → Mystery 교체
───────────────────────────────────────────── */
const ZONES = [
  { name: 'Forest',  emoji: '🌲', accent: '#5B9E3A', bg: '#1C3512', desc: '숲속 소리',   sub: 'Animals · Wind',    icon: FOREST_ICON  },
  { name: 'Water',   emoji: '💧', accent: '#4A8FD4', bg: '#0E2040', desc: '물의 소리',   sub: 'Flow · Impact',     icon: WATER_ICON   },
  { name: 'City',    emoji: '🏙', accent: '#C4B99A', bg: '#1C1B17', desc: '도시 소리',   sub: 'Vehicle · Crowd',   icon: CITY_ICON    },
  { name: 'Music',   emoji: '🎵', accent: '#9B6DD4', bg: '#18123A', desc: '음악 소리',   sub: 'Melodic · Percussive', icon: MUSIC_ICON },
  { name: 'Mystery', emoji: '✨', accent: '#D4883A', bg: '#1A1420', desc: '미스터리',    sub: 'Synthetic · Abstract', icon: MYSTERY_ICON },
]

/* ─────────────────────────────────────────────
   SVG 아이콘 (각 Zone 픽셀 감성)
───────────────────────────────────────────── */
function FOREST_ICON({ color }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <polygon points="24,6 36,26 12,26" fill={color} opacity="0.9"/>
      <polygon points="24,14 38,36 10,36" fill={color} opacity="0.7"/>
      <rect x="21" y="36" width="6" height="8" rx="1" fill={color} opacity="0.6"/>
    </svg>
  )
}
function WATER_ICON({ color }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M24 8 C24 8 12 22 12 30 C12 37 17.4 42 24 42 C30.6 42 36 37 36 30 C36 22 24 8 24 8Z" fill={color} opacity="0.8"/>
      <ellipse cx="18" cy="28" rx="3" ry="2" fill="white" opacity="0.3"/>
    </svg>
  )
}
function CITY_ICON({ color }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="6"  y="24" width="10" height="20" rx="1" fill={color} opacity="0.5"/>
      <rect x="19" y="14" width="10" height="30" rx="1" fill={color} opacity="0.8"/>
      <rect x="32" y="20" width="10" height="24" rx="1" fill={color} opacity="0.6"/>
      <rect x="22" y="10" width="4" height="4" rx="0.5" fill={color}/>
    </svg>
  )
}
function MUSIC_ICON({ color }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M20 34 L20 16 L38 12 L38 30" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9"/>
      <circle cx="16" cy="36" r="5" fill={color} opacity="0.8"/>
      <circle cx="34" cy="32" r="5" fill={color} opacity="0.6"/>
    </svg>
  )
}
function MYSTERY_ICON({ color }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <polygon points="24,8 27,18 38,18 29,24 32,35 24,29 16,35 19,24 10,18 21,18" fill={color} opacity="0.85"/>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   별 데이터 — 컴포넌트 밖에서 한 번만 생성
───────────────────────────────────────────── */
const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  left:  `${Math.random() * 100}%`,
  top:   `${Math.random() * 80}%`,
  size:  Math.random() * 2.2 + 0.8,
  delay: `${Math.random() * 4}s`,
  dur:   `${1.8 + Math.random() * 2.5}s`,
  opacity: 0.4 + Math.random() * 0.6,
}))

/* ─────────────────────────────────────────────
   VillageScene — 메인
───────────────────────────────────────────── */
export default function VillageScene({ onZoneClick, totalCount, zoneProgress = {} }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #0d0d1f 0%, #121828 45%, #0f1a12 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* 별빛 배경 */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {STARS.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            left: s.left, top: s.top,
            width: s.size, height: s.size,
            background: '#fff',
            borderRadius: '50%',
            opacity: s.opacity,
            animation: `twinkle ${s.dur} ${s.delay} infinite ease-in-out`,
          }} />
        ))}
        {/* 배경 오로라 */}
        <div style={{
          position: 'absolute', top: '-20%', left: '10%',
          width: '60%', height: '50%',
          background: 'radial-gradient(ellipse, #2d4a2422 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'float 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '5%',
          width: '50%', height: '40%',
          background: 'radial-gradient(ellipse, #1a1a4422 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'float 10s ease-in-out 2s infinite reverse',
        }} />
      </div>

      {/* 타이틀 */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '13px', color: '#6B6660', letterSpacing: '0.15em', marginBottom: '8px', textTransform: 'uppercase' }}>
          Sound Annotation Village
        </div>
        <h1 style={{
          fontSize: '26px', fontWeight: 800, color: '#F0EDE8',
          letterSpacing: '0.03em', marginBottom: '8px', lineHeight: 1.2,
        }}>
          🎧 SoundMimic Village
        </h1>
        <p style={{ fontSize: '13px', color: '#9A9585', lineHeight: 1.6 }}>
          탐험하고 싶은 Zone을 골라 소리를 들어보세요
        </p>
      </div>

      {/* Zone 그리드 — 중앙 1개 + 좌우 2개씩 */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '460px' }}>

        {/* 상단 행: Forest / Water */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          {ZONES.slice(0, 2).map(z => (
            <ZoneIsland key={z.name} zone={z} onClick={() => onZoneClick(z.name)} progress={zoneProgress[z.name] || 0} />
          ))}
        </div>

        {/* 중간 행: City (중앙 강조) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <ZoneIsland zone={ZONES[2]} onClick={() => onZoneClick(ZONES[2].name)} featured progress={zoneProgress['City'] || 0} />
        </div>

        {/* 하단 행: Music / Mystery */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {ZONES.slice(3).map(z => (
            <ZoneIsland key={z.name} zone={z} onClick={() => onZoneClick(z.name)} progress={zoneProgress[z.name] || 0} />
          ))}
        </div>
      </div>

      {/* 수집 카운트 */}
      <div style={{
        marginTop: '2.5rem', position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '12px', color: '#6B6660',
      }}>
        <span style={{ color: '#5B9E3A' }}>✦</span>
        지금까지 <strong style={{ color: '#F0EDE8' }}>{totalCount}</strong>개의 소리가 기록됐어요
        <span style={{ color: '#5B9E3A' }}>✦</span>
      </div>

    </div>
  )
}

/* ─────────────────────────────────────────────
   ZoneIsland — 개별 섬 카드
───────────────────────────────────────────── */
function ZoneIsland({ zone, onClick, featured = false, progress = 0 }) {
  const ref = useRef(null)
  const [hovered, setHovered] = useState(false)
  const IconComp = zone.icon

  const size = featured ? { width: '200px', padding: '1.6rem 1.2rem' } : { flex: 1, padding: '1.25rem 1rem' }
  const progressClamped = Math.min(Math.max(progress, 0), 1)

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${zone.name} — ${zone.desc}`}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...size,
        borderRadius: '18px',
        background: zone.bg,
        border: hovered
          ? `1.5px solid ${zone.accent}88`
          : `1px solid ${zone.accent}28`,
        cursor: 'pointer',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        transform: hovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s, box-shadow 0.3s',
        boxShadow: hovered
          ? `0 12px 40px ${zone.accent}33, 0 0 0 1px ${zone.accent}22`
          : `0 4px 16px #00000044`,
      }}
    >
      {/* 배경 glow */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 100%, ${zone.accent}18 0%, transparent 70%)`,
        opacity: hovered ? 1 : 0.4,
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
      }} />

      {/* progress 바 (하단) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: '3px',
        width: `${progressClamped * 100}%`,
        background: `linear-gradient(90deg, ${zone.accent}88, ${zone.accent})`,
        borderRadius: '0 2px 0 0',
        transition: 'width 0.6s ease',
      }} />

      {/* 아이콘 */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        marginBottom: '8px',
        filter: hovered ? `drop-shadow(0 0 8px ${zone.accent}88)` : 'none',
        transition: 'filter 0.3s',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
      }}>
        <IconComp color={zone.accent} />
      </div>

      {/* Zone 이름 */}
      <div style={{
        fontSize: featured ? '15px' : '13px',
        fontWeight: 700,
        color: '#F0EDE8',
        marginBottom: '3px',
        position: 'relative', zIndex: 1,
      }}>
        {zone.name}
      </div>

      {/* 설명 */}
      <div style={{
        fontSize: '11px',
        color: zone.accent,
        opacity: 0.85,
        position: 'relative', zIndex: 1,
        marginBottom: '4px',
      }}>
        {zone.desc}
      </div>

      {/* sub-category 태그 */}
      <div style={{
        fontSize: '10px',
        color: '#6B6660',
        position: 'relative', zIndex: 1,
        lineHeight: 1.4,
      }}>
        {zone.sub}
      </div>

      {/* hover 시 파티클 점 */}
      {hovered && [0,1,2].map(i => (
        <div key={i} aria-hidden="true" style={{
          position: 'absolute',
          width: '4px', height: '4px',
          borderRadius: '50%',
          background: zone.accent,
          opacity: 0.6,
          top: `${20 + i * 25}%`,
          right: '12px',
          animation: `float ${1.2 + i * 0.3}s ease-in-out ${i * 0.2}s infinite alternate`,
        }} />
      ))}
    </div>
  )
}