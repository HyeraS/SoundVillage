'use client'
import { useState, useEffect, useCallback } from 'react'
import StartPanel      from '@/components/StartPanel'
import WorldMap        from '@/components/WorldMap'
import ZoneMap         from '@/components/ZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import SoundMuseum     from '@/components/SoundMuseum'
import FeedbackPanel   from '@/components/FeedbackPanel'
import { getTotalCount, getCountByZone, getAnnotatedSoundIds, getAnnotationCountForSound } from '@/lib/supabase'
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
  const [groupId,       setGroupId]       = useState('')

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
  const handleStart = (pid, gid) => {
    setParticipantId(pid)
    setGroupId(gid)
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

  /* ── sound_id 포맷 무관하게 메타데이터 소리를 찾는 헬퍼 ── */
  const findSoundByDbId = useCallback((dbId, all) => {
    // 먼저 exact match
    const exact = all.find(s => s.sound_id === dbId)
    if (exact) return exact
    // 파일번호(숫자)로 fallback — 구버전(Forest_066514) ↔ 신버전(Animal_66514) 브리지
    const dbNum = parseInt(String(dbId).split('_').pop(), 10)
    if (isNaN(dbNum)) return null
    return all.find(s => parseInt(String(s.sound_id).split('_').pop(), 10) === dbNum) || null
  }, [])

  /* ── DB sound_id → 재생 가능한 sound 오브젝트 (메타데이터에 없으면 합성) ── */
  const resolveSoundFromDbId = useCallback((dbId, all) => {
    const fromMeta = findSoundByDbId(dbId, all)
    if (fromMeta) return fromMeta
    // 메타데이터에 없는 구버전 sound_id → 파일번호로 경로 합성
    const fileNum = parseInt(String(dbId).split('_').pop(), 10)
    if (isNaN(fileNum)) return null
    return {
      sound_id:     dbId,
      file_path:    `Audio/Forest/${fileNum}`,
      game_zone:    'Lab',
      sub_category: String(dbId),
    }
  }, [findSoundByDbId])

  /* ── WorldMap에서 Sound Museum 직접 진입 ── */
  const handleEnterMuseum = useCallback(async () => {
    const all = soundMetadata.sounds
    if (!all || all.length === 0) return

    let sound = null
    try {
      const annotatedIds = await getAnnotatedSoundIds()
      console.log('[Museum] annotatedIds:', annotatedIds)
      // 셔플 후 최대 12개 시도 — 실제로 후보가 있는 소리를 찾을 때까지
      const shuffled = [...annotatedIds].sort(() => Math.random() - 0.5)
      for (const dbId of shuffled.slice(0, 20)) {
        const found = resolveSoundFromDbId(dbId, all)
        if (!found) continue
        const count = await getAnnotationCountForSound(found.sound_id)
        if (count >= 5) { sound = found; break }
      }
    } catch (e) {
      console.error('[Museum] 진입 오류:', e)
    }
    if (!sound) sound = all[Math.floor(Math.random() * all.length)]

    setActiveSound(sound)
    setActiveZone(sound.game_zone || 'Lab')
    setMyExpression('')
    setMuseumSource('world')
    setScreen('museum')
  }, [findSoundByDbId, resolveSoundFromDbId])

  /* ── AnnotationPanel Stage1 완료 → Zone 복귀 (Museum은 WorldMap에서 별도 진입) ── */
  const handleAnnotateComplete = useCallback(() => {
    if (activeSound) setCollectedIds(prev => new Set([...prev, activeSound.sound_id]))
    setFeedbackZone(activeZone)
    setShowFeedback(true)
    setActiveSound(null)
    setMyExpression('')
    setScreen('zone')
    refreshCounts()
  }, [activeSound, activeZone, refreshCounts])

  /* ── SoundMuseum 완료 → WorldMap 복귀 ── */
  const handleMuseumDone = useCallback(() => {
    setActiveSound(null)
    setMyExpression('')
    setMuseumSource(null)
    setScreen('world')
  }, [])

  /* ── SoundMuseum에서 월드맵 직접 이동 ── */
  const handleMuseumExit = useCallback(() => {
    setActiveSound(null)
    setMyExpression('')
    setMuseumSource(null)
    setScreen('world')
  }, [])

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
          sessionId={groupId}
          onDone={handleMuseumDone}
          onExit={handleMuseumExit}
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
            sessionId={groupId}
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