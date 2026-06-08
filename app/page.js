'use client'
import { useState, useEffect, useCallback } from 'react'
import StartPanel      from '@/components/StartPanel'
import WorldMap        from '@/components/WorldMap'
import ZoneMap         from '@/components/ZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import SoundMuseum     from '@/components/SoundMuseum'
import FeedbackPanel   from '@/components/FeedbackPanel'
import { getTotalCount, getCountByZone } from '@/lib/supabase'
import soundMetadata from '@/data/sound_metadata.json'

/* ─────────────────────────────────────────────
   Zone별 소리 목록 빌드
───────────────────────────────────────────── */
const ZONES = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']

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
   'start'    → StartPanel
   'world'    → WorldMap
   'zone'     → ZoneMap
   'annotate' → AnnotationPanel 오버레이 (ZoneMap 위)
   'museum'   → SoundMuseum 풀스크린
───────────────────────────────────────────── */
export default function HomePage() {
  const [screen,        setScreen]        = useState('start')
  const [participantId, setParticipantId] = useState('')
  const [sessionId,     setSessionId]     = useState('')

  const [activeZone,    setActiveZone]    = useState(null)
  const [activeSound,   setActiveSound]   = useState(null)
  const [myExpression,  setMyExpression]  = useState('')
  const [museumSource,  setMuseumSource]  = useState(null) // 'zone' | 'world'

  // 피드백 오버레이
  const [showFeedback,  setShowFeedback]  = useState(false)
  const [feedbackZone,  setFeedbackZone]  = useState('')

  // 세션 중 수집 완료된 sound_id Set
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

  /* ── WorldMap에서 Sound Museum 직접 진입 ── */
  const handleEnterMuseum = useCallback(() => {
    const all = soundMetadata.sounds
    if (!all || all.length === 0) return
    const sound = all[Math.floor(Math.random() * all.length)]
    setActiveSound(sound)
    setActiveZone(sound.game_zone || 'Forest')
    setMyExpression('')
    setMuseumSource('world')
    setScreen('museum')
  }, [])

  /* ── AnnotationPanel Stage1 완료 → SoundMuseum ── */
  const handleAnnotateComplete = useCallback(({ expression_text }) => {
    setMyExpression(expression_text)
    setMuseumSource('zone')
    setScreen('museum')
  }, [])

  /* ── SoundMuseum 완료 → 출처에 따라 분기 ── */
  const handleMuseumDone = useCallback(() => {
    if (museumSource === 'zone') {
      if (activeSound) {
        setCollectedIds(prev => new Set([...prev, activeSound.sound_id]))
      }
      setFeedbackZone(activeZone)
      setShowFeedback(true)
      setScreen('zone')
      refreshCounts()
    } else {
      // 'world'에서 진입 — 월드맵으로 복귀
      setScreen('world')
    }
    setActiveSound(null)
    setMyExpression('')
    setMuseumSource(null)
  }, [museumSource, activeSound, activeZone, refreshCounts])

  /* ── AnnotationPanel 닫기 (X / 건너뛰기) → ZoneMap 복귀, 소리는 그대로 유지 ── */
  const handleAnnotateClose = useCallback(() => {
    setActiveSound(null)
    setScreen('zone')
  }, [])

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
        onEnterMuseum={handleEnterMuseum}
        totalCount={totalCount}
        zoneProgress={zoneProgress}
      />
    )
  }

  // 3. Sound Museum (Stage 1 제출 후)
  if (screen === 'museum' && activeSound) {
    return (
      <>
        <SoundMuseum
          sound={activeSound}
          zone={activeZone}
          myExpression={myExpression}
          participantId={participantId}
          sessionId={sessionId}
          onDone={handleMuseumDone}
        />
      </>
    )
  }

  // 4. Zone 내부 맵 (+ annotation 오버레이)
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