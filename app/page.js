'use client'
import { useState, useEffect, useCallback } from 'react'
import StartPanel      from '@/components/StartPanel'
import WorldMap        from '@/components/WorldMap'
import ZoneMap         from '@/components/ZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import SoundMuseum     from '@/components/SoundMuseum'
import FeedbackPanel   from '@/components/FeedbackPanel'
import { getCountsByZone, getAnnotationCountsBySoundId, getAnnotatedByParticipantZone, getVotedSoundIdsByParticipant } from '@/lib/supabase'
import { isStudyAccessParticipantId, getStudyAccessGroup } from '@/lib/studyAccess.mjs'
import soundMetadata from '@/data/sound_metadata.json'

/* ─────────────────────────────────────────────
   Zone별 소리 목록 빌드
───────────────────────────────────────────── */
const ZONES = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']

// 처음엔 Music 마을만 열려있고, Music 구역 1을 전사 완료해야 나머지가 열림
const FIRST_ZONE          = 'Music'
const ZONES_LOCKED_AT_START = ZONES.filter(z => z !== FIRST_ZONE)

// Sound Museum에 올라가려면 오디오 하나당 이 인원수만큼 전사가 완료돼야 한다.
// 원래는 그룹당 5명 기준이었는데, P/Q 그룹에 결원이 생겨 4명으로 낮춤(2026-08-01).
const MUSEUM_MIN_ANNOTATIONS = 4

function buildZoneMap(sounds) {
  const map = {}
  ZONES.forEach(z => { map[z] = [] })
  ;(sounds || []).forEach(s => {
    if (map[s.game_zone]) map[s.game_zone].push(s)
  })
  return map
}
const ZONE_SOUND_MAP = buildZoneMap(soundMetadata.sounds)

// 그룹 필터: groupId가 없으면 전체, 있으면 해당 그룹만.
// 그룹 무관 연구용 접근 ID(RESEARCHER 등)일 때만 필터를 완전히 우회한다 — 이 경우
// ZoneMap의 아이템 배치는 실제 참여자 화면과 일치하지 않는다(배치 시드가 사운드
// 목록 전체에서 계산되기 때문). ALLAUDIO_A/ALLAUDIO_B처럼 그룹이 고정된 접근은
// bypassAll=false로 호출해서 실제 그룹 참여자와 동일한 목록·배치를 보게 한다.
function getGroupSounds(zone, groupId, bypassAll = false) {
  const all = ZONE_SOUND_MAP[zone] || []
  if (bypassAll || !groupId) return all
  const g = groupId.trim().toUpperCase().replace(/^G/i, '')  // "G1"→"1", "A"→"A"
  const label = g === '1' ? 'A' : g === '2' ? 'B' : g      // 그룹 번호 → 라벨 변환
  return all.filter(s => !s.group || s.group === label)
}

// Museum용: 다른 그룹 사운드 전체 목록
function getOtherGroupSounds(groupId, bypassAll = false) {
  const all = soundMetadata.sounds || []
  if (bypassAll || !groupId) return all
  const g = groupId.trim().toUpperCase().replace(/^G/i, '')
  const myLabel    = g === '1' ? 'A' : g === '2' ? 'B' : g
  if (!myLabel) return all
  const otherLabel = myLabel === 'A' ? 'B' : 'A'
  return all.filter(s => !s.group || s.group === otherLabel)
}

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
  const [museumEmpty,   setMuseumEmpty]   = useState(false)  // Museum: 5개 미달 알림
  const [museumDoneToast, setMuseumDoneToast] = useState(false) // Museum 관람 완료 후 안내 토스트

  // 세션 중 수집 완료된 sound_id Set
  const [collectedIds,  setCollectedIds]  = useState(new Set())

  // 블록 퀘스트 상태
  const [unlockedBlock,   setUnlockedBlock]   = useState({})  // { zone: blockNum }
  const [blockUnlockInfo, setBlockUnlockInfo] = useState(null) // { block, zone } 완료 오버레이용
  const [zoneLoading,     setZoneLoading]     = useState(false)
  const [museumLoading,   setMuseumLoading]   = useState(false)

  // 마을 잠금 상태 — Music 구역 1을 전사 완료해야 나머지 마을이 열림
  const [villagesUnlocked, setVillagesUnlocked] = useState(false)

  // 카운트
  const [totalCount,    setTotalCount]    = useState(0)
  const [zoneProgress,  setZoneProgress]  = useState({})
  const studyAccessEnabled = isStudyAccessParticipantId(participantId)
  // ALLAUDIO_A/ALLAUDIO_B처럼 그룹이 ID에 고정된 접근이면 그 그룹으로, 아니면
  // 입력받은 groupId를 그대로 쓴다. RESEARCHER 등 그룹 무관 접근만 완전히 우회한다.
  const studyAccessGroup   = getStudyAccessGroup(participantId)
  const effectiveGroupId   = studyAccessGroup || groupId
  const bypassGroupFilter  = studyAccessEnabled && !studyAccessGroup

  /* ── 카운트 갱신 (현재 참여자 + 그룹 기준) ── */
  const refreshCounts = useCallback(async () => {
    if (!participantId) return
    try {
      const { total, byZone } = await getCountsByZone(participantId)
      setTotalCount(total)
      const entries = ZONES.map(z => {
        const zoneMax = getGroupSounds(z, effectiveGroupId, bypassGroupFilter).length || 100
        const count   = byZone[z] || 0
        return [z, Math.min(count / zoneMax, 1)]
      })
      setZoneProgress(Object.fromEntries(entries))
    } catch {}
  }, [participantId, effectiveGroupId, bypassGroupFilter])

  useEffect(() => { if (participantId) refreshCounts() }, [participantId, refreshCounts])

  // Museum 관람 완료 토스트 자동 닫힘
  useEffect(() => {
    if (!museumDoneToast) return
    const t = setTimeout(() => setMuseumDoneToast(false), 3200)
    return () => clearTimeout(t)
  }, [museumDoneToast])

  /* ── StartPanel → WorldMap ── */
  const handleStart = (pid, gid) => {
    const enabled = isStudyAccessParticipantId(pid)
    setParticipantId(pid)
    setGroupId(gid)
    setVillagesUnlocked(enabled)
    setScreen('world')
    // participantId가 set된 후 카운트 갱신은 useEffect에서 처리
  }

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

  /* ── Music 구역 1 전사 완료 여부 확인 → 나머지 마을 잠금 해제 ── */
  const checkVillagesUnlocked = useCallback(async () => {
    if (!participantId) return
    if (studyAccessEnabled) {
      setVillagesUnlocked(true)
      return
    }
    try {
      const dbIds = await getAnnotatedByParticipantZone(participantId, FIRST_ZONE)
      const all   = soundMetadata.sounds
      const annotatedSet = new Set()
      for (const dbId of dbIds) {
        const found = findSoundByDbId(dbId, all)
        if (found) annotatedSet.add(found.sound_id)
      }
      const firstZoneSounds = getGroupSounds(FIRST_ZONE, effectiveGroupId, bypassGroupFilter)
      const block1 = firstZoneSounds.filter(s => (s.block || 1) === 1)
      if (block1.length > 0 && block1.every(s => annotatedSet.has(s.sound_id))) {
        setVillagesUnlocked(true)
      }
    } catch (e) {
      console.error('[Village] 잠금 상태 확인 오류:', e)
    }
  }, [participantId, effectiveGroupId, bypassGroupFilter, studyAccessEnabled, findSoundByDbId])

  useEffect(() => { if (participantId) checkVillagesUnlocked() }, [participantId, checkVillagesUnlocked])

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

  /* ── WorldMap → ZoneMap (ENTER로 진입) ── */
  const handleEnterZone = useCallback(async (zone) => {
    setZoneLoading(true)
    setActiveZone(zone)
    try {
      const dbIds = await getAnnotatedByParticipantZone(participantId, zone)
      const all   = soundMetadata.sounds

      // DB sound_id → 메타데이터 sound_id 변환 (구버전 포맷 브리지)
      const annotatedSet = new Set()
      for (const dbId of dbIds) {
        const found = findSoundByDbId(dbId, all)
        if (found) annotatedSet.add(found.sound_id)
      }

      // 현재 언락된 블록 계산 (완료된 블록의 다음 블록)
      const zoneSounds = getGroupSounds(zone, effectiveGroupId, bypassGroupFilter)
      const maxBlock   = zoneSounds.reduce((m, s) => Math.max(m, s.block || 1), 1)
      let currentBlock = studyAccessEnabled ? maxBlock : 1
      if (!studyAccessEnabled) {
        for (let b = 1; b <= maxBlock; b++) {
          const bs = zoneSounds.filter(s => (s.block || 1) === b)
          if (bs.length > 0 && bs.every(s => annotatedSet.has(s.sound_id))) {
            currentBlock = b + 1
          } else break
        }
        currentBlock = Math.min(currentBlock, maxBlock)
      }

      setUnlockedBlock(prev => ({ ...prev, [zone]: currentBlock }))
      setCollectedIds(annotatedSet)
    } catch (e) {
      console.error('[Zone] 블록 로드 오류:', e)
      setUnlockedBlock(prev => ({ ...prev, [zone]: prev[zone] || 1 }))
      setCollectedIds(new Set())
    }
    setZoneLoading(false)
    setScreen('zone')
  }, [participantId, effectiveGroupId, bypassGroupFilter, studyAccessEnabled, findSoundByDbId])

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
  const handleEnterMuseum = useCallback(async () => {
    setMuseumEmpty(false)
    setMuseumLoading(true)
    const all = soundMetadata.sounds
    if (!all || all.length === 0) { setMuseumLoading(false); return }

    // 내 그룹이 아닌 그룹의 사운드만 Museum에 표시
    const otherGroupSounds = getOtherGroupSounds(effectiveGroupId, bypassGroupFilter)
    const otherIds = new Set(otherGroupSounds.map(s => s.sound_id))

    let sound = null
    try {
      const [rawCounts, votedIds] = await Promise.all([
        getAnnotationCountsBySoundId(),
        getVotedSoundIdsByParticipant(participantId),
      ])
      const votedSet = new Set(votedIds)

      // 구버전 sound_id 포맷(Forest_066514 등)이 섞여 있을 수 있어서, 같은 소리를
      // 가리키는 raw id들의 개수를 canonical sound_id 기준으로 합산한다.
      const canonicalCounts = {}
      for (const [rawId, cnt] of Object.entries(rawCounts)) {
        const found = findSoundByDbId(rawId, all)
        const key = found ? found.sound_id : rawId
        canonicalCounts[key] = (canonicalCounts[key] || 0) + cnt
      }

      // 후보: 표현이 MUSEUM_MIN_ANNOTATIONS개 이상 쌓였고, 다른 그룹 소리이면서, 내가 이 소리에
      // 대해 아직 Stage 2 투표를 안 한 것만 (한 번 투표한 소리는 다시 뜨지 않게)
      const candidates = Object.entries(canonicalCounts)
        .filter(([soundId, cnt]) => cnt >= MUSEUM_MIN_ANNOTATIONS && otherIds.has(soundId) && !votedSet.has(soundId))
        .map(([soundId]) => resolveSoundFromDbId(soundId, all))
        .filter(Boolean)

      const shuffled = [...candidates].sort(() => Math.random() - 0.5)
      sound = shuffled[0] || null
    } catch (e) {
      console.error('[Museum] 진입 오류:', e)
    }
    if (!sound) {
      setMuseumLoading(false)
      setMuseumEmpty(true)
      return
    }

    setMuseumLoading(false)
    setActiveSound(sound)
    setActiveZone(sound.game_zone || 'Lab')
    setMyExpression('')
    setMuseumSource('world')
    setScreen('museum')
  }, [effectiveGroupId, bypassGroupFilter, participantId, findSoundByDbId, resolveSoundFromDbId])

  /* ── AnnotationPanel Stage1 완료 → Zone 복귀 + 블록 완료 체크 ── */
  const handleAnnotateComplete = useCallback(() => {
    const newCollected = new Set([...collectedIds, ...(activeSound ? [activeSound.sound_id] : [])])
    setCollectedIds(newCollected)

    // 블록 완료 여부 체크
    if (activeSound && activeZone) {
      const currentBlock = unlockedBlock[activeZone] || 1
      const zoneSounds   = getGroupSounds(activeZone, effectiveGroupId, bypassGroupFilter)
      const maxBlock     = zoneSounds.reduce((m, s) => Math.max(m, s.block || 1), 1)
      const blockSounds  = zoneSounds.filter(s => (s.block || 1) === currentBlock)
      const allDone      = blockSounds.every(s => newCollected.has(s.sound_id))

      // Music 구역 1을 지금 막 완료했다면 나머지 마을 잠금 해제
      const justUnlockedVillages = activeZone === FIRST_ZONE && currentBlock === 1 && allDone && !villagesUnlocked
      if (justUnlockedVillages) setVillagesUnlocked(true)

      if (allDone && currentBlock < maxBlock) {
        const next = currentBlock + 1
        setUnlockedBlock(prev => ({ ...prev, [activeZone]: next }))
        setBlockUnlockInfo({ block: next, zone: activeZone, villagesUnlocked: justUnlockedVillages })
      }
    }

    setFeedbackZone(activeZone)
    setShowFeedback(true)
    setActiveSound(null)
    setMyExpression('')
    setScreen('zone')
    refreshCounts()
  }, [activeSound, activeZone, collectedIds, effectiveGroupId, bypassGroupFilter, unlockedBlock, villagesUnlocked, refreshCounts])

  /* ── SoundMuseum 완료 → WorldMap 복귀 (+ "오늘은 여기까지" 토스트) ── */
  const handleMuseumDone = useCallback(() => {
    setActiveSound(null)
    setMyExpression('')
    setMuseumSource(null)
    setScreen('world')
    setMuseumDoneToast(true)
  }, [])

  /* ── SoundMuseum에서 월드맵 직접 이동 ── */
  const handleMuseumExit = useCallback(() => {
    setActiveSound(null)
    setMyExpression('')
    setMuseumSource(null)
    setScreen('world')
  }, [])

  /* ── AnnotationPanel 닫기 (X, 제출 없이 취소) → ZoneMap 복귀. 제출 안 했으므로 collectedIds에 넣지 않음 ── */
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

  // 2. 월드맵 (zone 진입 로딩 포함)
  if (screen === 'world') {
    return (
      <>
        <WorldMap
          onEnterZone={handleEnterZone}
          onEnterMuseum={handleEnterMuseum}
          totalCount={totalCount}
          zoneProgress={zoneProgress}
          lockedZones={studyAccessEnabled || villagesUnlocked ? [] : ZONES_LOCKED_AT_START}
        />
        {/* Zone 진입 로딩 */}
        {zoneLoading && (
          <div style={{
            position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'#00000055', zIndex:200, fontFamily:'Nunito, sans-serif',
          }}>
            <div style={{
              background:'#F5EDD8', border:'2px solid #C8A96E', borderRadius:'16px',
              padding:'24px 36px', textAlign:'center',
            }}>
              <div style={{ fontSize:'24px', marginBottom:'8px' }}>🎧</div>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#3A2A14' }}>소리 목록 불러오는 중...</div>
            </div>
          </div>
        )}

        {/* Museum 진입 로딩 — ENTER를 누른 즉시 반응이 보이도록(안 그러면 응답 없는 것처럼 느껴짐) */}
        {museumLoading && (
          <div style={{
            position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'#00000055', zIndex:200, fontFamily:'Nunito, sans-serif',
          }}>
            <div style={{
              background:'#F5EDD8', border:'2px solid #C8A96E', borderRadius:'16px',
              padding:'24px 36px', textAlign:'center',
            }}>
              <div style={{ fontSize:'24px', marginBottom:'8px' }}>🏛</div>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#3A2A14' }}>전시 확인하는 중...</div>
            </div>
          </div>
        )}

        {museumEmpty && (
          <div style={{
            position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'#00000055', zIndex:200,
          }} onClick={() => setMuseumEmpty(false)}>
            <div style={{
              background:'#F5EDD8', border:'2px solid #C8A96E', borderRadius:'16px',
              padding:'28px 36px', textAlign:'center', fontFamily:'Nunito, sans-serif',
              boxShadow:'0 8px 32px #00000044',
            }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>🏛</div>
              <div style={{ fontSize:'14px', fontWeight:800, color:'#3A2A14', marginBottom:'8px' }}>
                아직 전시 중인 소리가 없어요
              </div>
              <div style={{ fontSize:'12px', color:'#8B6A3A', lineHeight:1.6 }}>
                다른 그룹 참여자들이 소리를 더 수집하면<br/>
                Sound Museum에서 만날 수 있어요 ✨
              </div>
              <div style={{ marginTop:'16px', fontSize:'11px', color:'#A09080' }}>
                화면을 클릭하면 닫힙니다
              </div>
            </div>
          </div>
        )}

        {/* Museum 관람 완료 토스트 — 표현 하나 투표하고 나면 곧장 사라지지 않고,
            다른 그룹이 더 채울 때까지 기다려야 한다는 걸 짧게 알려준다 */}
        {museumDoneToast && (
          <div onClick={() => setMuseumDoneToast(false)} style={{
            position:'fixed', left:'50%', bottom:'28px', transform:'translateX(-50%)',
            zIndex:200, cursor:'pointer',
          }}>
            <div style={{
              background:'#F5EDD8ee', border:'2px solid #C8A96E', borderRadius:'16px',
              padding:'14px 22px', textAlign:'center', fontFamily:'Nunito, sans-serif',
              boxShadow:'0 8px 28px #00000044', backdropFilter:'blur(6px)',
              animation:'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              maxWidth:'320px',
            }}>
              <div style={{ fontSize:'13px', fontWeight:800, color:'#3A2A14', marginBottom:'4px' }}>
                🏛 오늘의 전시 관람 완료!
              </div>
              <div style={{ fontSize:'11px', color:'#8B6A3A', lineHeight:1.5 }}>
                다른 그룹이 소리를 더 채우면<br/>또 새로운 전시를 만날 수 있어요 ✨
              </div>
            </div>
          </div>
        )}
      </>
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
    const currentBlock = unlockedBlock[activeZone] || 1
    const zoneSounds   = getGroupSounds(activeZone, effectiveGroupId, bypassGroupFilter)
    const maxBlock     = zoneSounds.reduce((m, s) => Math.max(m, s.block || 1), 1)
    return (
      <>
        {/* ZoneMap — zone의 모든 소리를 한 화면에 유지. 잠긴/해제된 구역 표시는
            blockNum prop으로 ZoneMap 내부에서 처리하므로 리마운트하지 않는다. */}
        <ZoneMap
          zone={activeZone}
          sounds={zoneSounds}
          onCollectSound={handleCollectSound}
          onExit={handleExitZone}
          collectedIds={collectedIds}
          isAnnotating={screen === 'annotate'}
          blockNum={currentBlock}
          blockTotal={maxBlock}
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

        {/* 블록 해제 오버레이 */}
        {blockUnlockInfo && blockUnlockInfo.zone === activeZone && (
          <div style={{
            position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            background:'#00000066', zIndex:300, fontFamily:'Nunito, sans-serif',
          }} onClick={() => setBlockUnlockInfo(null)}>
            <div style={{
              background:'#F5EDD8', border:'3px solid #C8A96E', borderRadius:'20px',
              padding:'32px 40px', textAlign:'center',
              boxShadow:'0 12px 48px #00000044',
              animation:'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>{blockUnlockInfo.villagesUnlocked ? '🗺' : '🎉'}</div>
              <div style={{ fontSize:'16px', fontWeight:800, color:'#3A2A14', marginBottom:'8px' }}>
                구역 {blockUnlockInfo.block - 1} 완료!
              </div>
              <div style={{ fontSize:'13px', color:'#8B6A3A', lineHeight:1.7, marginBottom:'20px' }}>
                새로운 소리들이 나타났어요.<br/>
                구역 {blockUnlockInfo.block}을 탐험해 보세요 ✨
                {blockUnlockInfo.villagesUnlocked && (
                  <><br/><br/>🔓 다른 마을들도 모두 열렸어요!</>
                )}
              </div>
              <button onClick={() => setBlockUnlockInfo(null)} style={{
                padding:'10px 28px', borderRadius:'10px',
                background:'linear-gradient(180deg, #7BC850 0%, #5B9E3A 100%)',
                border:'2px solid #4A8A2A', color:'#fff',
                fontSize:'13px', fontWeight:800, cursor:'pointer',
                boxShadow:'0 4px 0 #2A6A10',
              }}>
                계속 탐험하기 →
              </button>
            </div>
          </div>
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