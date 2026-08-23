'use client'

import { useEffect, useState } from 'react'
import HouseDecorRoom, { HouseMark } from '@/components/HouseDecorRoom'

export default function HouseDecorTestPage() {
  const [participantIdInput, setParticipantIdInput] = useState('AUDIOTEST')
  const [participantId, setParticipantId] = useState('')
  const [visitorMode, setVisitorMode] = useState(false)

  useEffect(() => {
    const invitedHouse = new URLSearchParams(window.location.search).get('house')?.trim()
    if (!invitedHouse) return
    setVisitorMode(true)
    setParticipantId(invitedHouse)
  }, [])

  const handleEnter = event => {
    event?.preventDefault()
    const pid = participantIdInput.trim()
    if (!pid) return
    setParticipantId(pid)
  }

  if (!participantId) {
    return (
      <main className="relative grid min-h-dvh place-items-center overflow-y-auto bg-[var(--house-cream)] px-5 py-10 text-[var(--house-cocoa)]">
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#F8CDBD]/65 blur-3xl" />
          <span className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#BFE2D2]/70 blur-3xl" />
          <span className="absolute left-[12%] top-[18%] text-3xl text-[#D8B45A]/70">✦</span>
          <span className="absolute bottom-[20%] right-[14%] text-2xl text-[#D8B45A]/60">✦</span>
        </div>
        <form onSubmit={handleEnter} className="relative w-full max-w-[380px] rounded-[28px] border border-white/80 bg-[var(--house-surface)] p-7 text-center shadow-[0_28px_80px_rgba(45,31,23,.18)]">
          <div className="mx-auto mb-4 h-24 w-24"><HouseMark /></div>
          <p className="text-center text-[11px] font-extrabold tracking-[0.22em] text-[#B2735B]">SOUND VILLAGE HOME</p>
          <h1 className="mt-1 text-2xl font-extrabold">집꾸미기 미리보기</h1>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#8A735E]">참가자 ID를 입력하면 그 집으로 바로 들어가요.</p>
          <input value={participantIdInput} onChange={event => setParticipantIdInput(event.target.value)} placeholder="참가자 ID" autoComplete="off" className="mt-5 h-13 w-full rounded-2xl border border-[#3A2A1E]/10 bg-[var(--house-cream)] px-4 text-center text-[15px] font-bold outline-none transition placeholder:text-[#A99989] focus:border-[var(--house-mint)] focus:ring-4 focus:ring-[#91CDB2]/20" />
          <button type="submit" disabled={!participantIdInput.trim()} className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--house-peach)] text-[15px] font-extrabold text-[var(--house-cocoa)] shadow-[0_10px_22px_rgba(205,117,87,.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55">
            내 집으로 들어가기<span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    )
  }

  return (
    <HouseDecorRoom
      participantId={participantId}
      visitorMode={visitorMode}
      onExit={() => visitorMode ? window.location.assign(window.location.pathname) : setParticipantId('')}
    />
  )
}
