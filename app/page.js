'use client'
import { useState, useEffect, useCallback } from 'react'
import StartPanel      from '@/components/StartPanel'
import WorldMap        from '@/components/WorldMap'
import ZoneMap         from '@/components/ZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import FeedbackPanel   from '@/components/FeedbackPanel'
import { getTotalCount, getCountByZone } from '@/lib/supabase'
import soundMetadata from '@/data/sound_metadata.json'

/* ─────────────────────────────────────────────
   Zone별 소리 목록 빌드
───────────────────────────────────────────── */
const ZONES = ['Forest', 'Creek', 'City', 'Stage', 'Lab']

function buildZoneMap(sounds) {
  const map = {}
  ZONES.forEach(z => { map[z] = [] })
  ;(sounds || []).forEach(s => {
    if (map[s.game_zone]) map[s.game_zone].push(s)
  })
  return map
}
const ZONE_SOUND_MAP = buildZoneMap(soundMetadata.sounds)

/* ─────────────────────────────────────────────
   화면 상태 정의
   'start'     → StartPanel (참여자 ID 입력)
   'world'     → WorldMap   (월드맵 탐험)
   'zone'      → ZoneMap    (마을 내부 탐험)
   'annotate'  → AnnotationPanel 오버레이 (ZoneMap 위에)
───────────────────────────────────────────── */
export default function HomePage() {
  const [screen,        setScreen]        = useState('start')
  const [participantId, setParticipantId] = useState('')
  const [sessionId,     setSessionId]     = useState('')

  // 현재 진입한 Zone
  const [activeZone,    setActiveZone]    = useState(null)
  // ZoneMap에서 줍기 트리거된 소리
  const [activeSound,   setActiveSound]   = useState(null)

  // 피드백 오버레이
  const [showFeedback,  setShowFeedback]  = useState(false)
  const [feedbackZone,  setFeedbackZone]  = useState('')

  // 세션 중 수집 완료된 sound_id Set (ZoneMap 아이템 복원 방지)
  const [collectedIds,  setCollectedIds]  = useState(new Set())

  // 카운트
  const [totalCount,    setTotalCount]    = useState(0)
  const [zoneProgress,  setZoneProgress]  = useState({})

  /* ── 카운트 갱신 ── */
  const refreshCounts = useCallback(async () => {
    try {
      const total = await getTotalCount()
      setTotalCount(total)
      const ZONE_MAX = 10
      const entries = await Promise.all(
        ZONES.map(async z => [z, Math.min((await getCountByZone(z)) / ZONE_MAX, 1)])
      )
      setZoneProgress(Object.fromEntries(entries))
    } catch {}
  }, [])

  useEffect(() => { refreshCounts() }, [refreshCounts])

  /* ── StartPanel → WorldMap ── */
  const handleStart = (pid, sid) => {
    setParticipantId(pid)
    setSessionId(sid)
    setScreen('world')
  }

  /* ── WorldMap → ZoneMap (ENTER로 진입) ── */
  const handleEnterZone = useCallback((zone) => {
    setActiveZone(zone)
    setScreen('zone')
  }, [])

  /* ── ZoneMap → WorldMap (ESC로 복귀) ── */
  const handleExitZone = useCallback(() => {
    setActiveZone(null)
    setActiveSound(null)
    setScreen('world')
  }, [])

  /* ── ZoneMap에서 소리 줍기 → AnnotationPanel 오버레이 ── */
  const handleCollectSound = useCallback((sound) => {
    setActiveSound(sound)
    setScreen('annotate')
  }, [])

  /* ── AnnotationPanel 완료 → ZoneMap 복귀 ── */
  const handleAnnotateComplete = useCallback(() => {
    if (activeSound) {
      setCollectedIds(prev => new Set([...prev, activeSound.sound_id]))
    }
    setFeedbackZone(activeZone)
    setShowFeedback(true)
    setActiveSound(null)
    setScreen('zone')
    refreshCounts()
  }, [activeSound, activeZone, refreshCounts])

  /* ── AnnotationPanel 닫기 (스킵) → ZoneMap 복귀 ── */
  const handleAnnotateClose = useCallback(() => {
    // 스킵한 소리도 collected 처리해서 같은 세션에 다시 안 나오게
    if (activeSound) {
      setCollectedIds(prev => new Set([...prev, activeSound.sound_id]))
    }
    setActiveSound(null)
    setScreen('zone')
  }, [activeSound])

  /* ── 피드백 닫기 ── */
  const handleFeedbackClose = useCallback(() => {
    setShowFeedback(false)
    setFeedbackZone('')
  }, [])

  /* ─────────────────────────────────────────────
     렌더
  ───────────────────────────────────────────── */

  // 1. 시작 화면
  if (screen === 'start') {
    return <StartPanel onStart={handleStart} />
  }

  // 2. 월드맵
  if (screen === 'world') {
    return (
      <WorldMap
        onEnterZone={handleEnterZone}
        totalCount={totalCount}
        zoneProgress={zoneProgress}
      />
    )
  }

  // 3. Zone 내부 맵 (+ annotation 오버레이)
  if (screen === 'zone' || screen === 'annotate') {
    const zoneSounds = ZONE_SOUND_MAP[activeZone] || []
    return (
      <>
        {/* ZoneMap은 항상 배경에 유지 */}
        <ZoneMap
          zone={activeZone}
          sounds={zoneSounds}
          onCollectSound={handleCollectSound}
          onExit={handleExitZone}
          collectedIds={collectedIds}
          isAnnotating={screen === 'annotate'}
        />

        {/* AnnotationPanel — ZoneMap 위에 오버레이 */}
        {screen === 'annotate' && activeSound && (
          <AnnotationPanel
            sound={activeSound}
            zone={activeZone}
            participantId={participantId}
            sessionId={sessionId}
            onClose={handleAnnotateClose}
            onComplete={handleAnnotateComplete}
          />
        )}

        {/* 완료 피드백 토스트 */}
        {showFeedback && (
          <FeedbackPanel
            zone={feedbackZone}
            onClose={handleFeedbackClose}
          />
        )}
      </>
    )
  }

  return null
}