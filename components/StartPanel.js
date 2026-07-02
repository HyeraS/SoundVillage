'use client'
import { useState } from 'react'

/* ─────────────────────────────────────────────
   Phase 2 StartPanel — Cozy 낮 감성, 마을 테마
───────────────────────────────────────────── */
export default function StartPanel({ onStart }) {
  const [participantId, setParticipantId] = useState('')
  const [groupId,       setGroupId]       = useState('')
  const [focused,       setFocused]       = useState(null)

  function handleStart() {
    if (!participantId.trim() || !groupId.trim()) return
    // 대소문자 차이로 같은 참여자가 다른 사람 취급되지 않도록 정규화
    // (예: "p1"과 "P1"이 Supabase에서 다른 participant_id로 갈라지는 것 방지)
    onStart(participantId.trim().toUpperCase(), groupId.trim())
  }
  const canStart = participantId.trim() && groupId.trim()

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(160deg, #87CEEB 0%, #C8E8A0 60%, #5A9A3A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, fontFamily: 'Nunito, sans-serif',
      overflow: 'hidden',
    }}>

      {/* 배경 장식 나무들 */}
      {[
        {left:'5%',  bottom:'0', fontSize:'64px'},
        {left:'12%', bottom:'0', fontSize:'48px'},
        {right:'6%', bottom:'0', fontSize:'72px'},
        {right:'14%',bottom:'0', fontSize:'52px'},
        {left:'28%', bottom:'0', fontSize:'40px'},
        {right:'28%',bottom:'0', fontSize:'44px'},
      ].map((s,i) => (
        <div key={i} aria-hidden="true" style={{
          position:'absolute', ...s,
          userSelect:'none', pointerEvents:'none',
          animation:`float ${3+i*0.5}s ease-in-out ${i*0.4}s infinite alternate`,
        }}>🌲</div>
      ))}

      {/* 구름 */}
      {[
        {left:'8%',  top:'8%',  fontSize:'36px', dur:'6s'},
        {left:'55%', top:'5%',  fontSize:'28px', dur:'8s'},
        {right:'10%',top:'12%', fontSize:'32px', dur:'7s'},
      ].map((s,i) => (
        <div key={i} aria-hidden="true" style={{
          position:'absolute', left:s.left, right:s.right,
          top:s.top, fontSize:s.fontSize,
          userSelect:'none', pointerEvents:'none', opacity:0.85,
          animation:`float ${s.dur} ease-in-out ${i*1.2}s infinite alternate`,
        }}>☁️</div>
      ))}

      {/* 메인 카드 */}
      <div style={{
        background: '#F5EDD8',
        border: '3px solid #C8A96E',
        borderRadius: '24px',
        padding: '36px 40px',
        width: '360px',
        boxShadow: '0 12px 48px #00000033, 0 2px 0 #C8A96E inset',
        position: 'relative', zIndex: 1,
        animation: 'slideUp 0.45s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* 마을 간판 느낌 */}
          <div style={{
            display: 'inline-block',
            background: '#8B6347',
            border: '3px solid #6B4327',
            borderRadius: '12px',
            padding: '8px 20px',
            marginBottom: '16px',
            boxShadow: '0 4px 0 #4A2C0A',
          }}>
            <div style={{ fontSize: '11px', color: '#F4D03F', letterSpacing: '0.15em', fontWeight: 700 }}>
              WELCOME TO
            </div>
          </div>

          <div style={{ fontSize: '28px', marginBottom: '6px' }}>🎧</div>
          <h1 style={{
            fontSize: '22px', fontWeight: 800,
            color: '#3A2A14', marginBottom: '8px', lineHeight: 1.2,
          }}>
            SoundMimic Village
          </h1>
          <p style={{ fontSize: '12px', color: '#8B6A3A', lineHeight: 1.7 }}>
            마을을 탐험하며 소리를 수집하고<br/>
            내 언어로 표현해 보세요 🌿
          </p>
        </div>

        {/* 구분선 */}
        <div style={{
          height: '2px', background: 'linear-gradient(90deg, transparent, #C8A96E, transparent)',
          margin: '0 0 24px',
        }}/>

        {/* 입력 필드 */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{
            display: 'block', fontSize: '11px', fontWeight: 800,
            color: '#6B4A2A', marginBottom: '6px', letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            🪪 참여자 ID
          </label>
          <input
            placeholder="예: P001"
            value={participantId}
            onChange={e => setParticipantId(e.target.value)}
            onFocus={() => setFocused('pid')}
            onBlur={()  => setFocused(null)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px', borderRadius: '10px',
              background: '#FFF8ED',
              border: `2px solid ${focused === 'pid' ? '#C8A96E' : '#D4C4A0'}`,
              color: '#3A2A14', fontSize: '14px',
              fontFamily: 'Nunito, sans-serif', fontWeight: 600,
              outline: 'none', transition: 'border-color 0.15s',
              boxShadow: focused === 'pid' ? '0 0 0 3px #C8A96E33' : 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '22px' }}>
          <label style={{
            display: 'block', fontSize: '11px', fontWeight: 800,
            color: '#6B4A2A', marginBottom: '6px', letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            👥 그룹 ID
          </label>
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            onFocus={() => setFocused('gid')}
            onBlur={()  => setFocused(null)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px', borderRadius: '10px',
              background: '#FFF8ED',
              border: `2px solid ${focused === 'gid' ? '#C8A96E' : '#D4C4A0'}`,
              color: groupId ? '#3A2A14' : '#A09080', fontSize: '14px',
              fontFamily: 'Nunito, sans-serif', fontWeight: 600,
              outline: 'none', transition: 'border-color 0.15s',
              boxShadow: focused === 'gid' ? '0 0 0 3px #C8A96E33' : 'none',
              cursor: 'pointer', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238B6A3A' strokeWidth='2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: '36px',
            }}
          >
            <option value="" disabled>그룹을 선택하세요</option>
            <option value="A">그룹 A</option>
            <option value="B">그룹 B</option>
          </select>
        </div>

        {/* 시작 버튼 — 나무 간판 스타일 */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          style={{
            width: '100%', padding: '14px',
            borderRadius: '12px',
            background: canStart
              ? 'linear-gradient(180deg, #7BC850 0%, #5B9E3A 100%)'
              : '#D4C4A0',
            border: canStart ? '2px solid #4A8A2A' : '2px solid #C4B490',
            boxShadow: canStart ? '0 4px 0 #2A6A10, 0 6px 16px #5B9E3A44' : 'none',
            color: canStart ? '#fff' : '#A09080',
            fontSize: '15px', fontWeight: 800,
            fontFamily: 'Nunito, sans-serif',
            cursor: canStart ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            transform: canStart ? 'translateY(0)' : 'none',
            letterSpacing: '0.03em',
          }}
          onMouseDown={e => { if (canStart) e.currentTarget.style.transform = 'translateY(2px)' }}
          onMouseUp={e   => { if (canStart) e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {canStart ? '🌿 마을 입장하기' : '정보를 입력해주세요'}
        </button>

        {/* 하단 힌트 */}
        <div style={{
          marginTop: '16px', textAlign: 'center',
          fontSize: '11px', color: '#A09080', lineHeight: 1.6,
        }}>
          방향키로 마을을 탐험하고<br/>
          반짝이는 소리 상자를 찾아보세요 ✨
        </div>
      </div>
    </div>
  )
}