'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import StartPanel      from '@/components/StartPanel'
import WorldMap        from '@/components/WorldMap'
import ZoneMap         from '@/components/ZoneMap'
import MusicZoneMap    from '@/components/MusicZoneMap'
import NatureZoneMap   from '@/components/NatureZoneMap'
import HumanZoneMap    from '@/components/HumanZoneMap'
import UrbanZoneMap    from '@/components/UrbanZoneMap'
import AnimalZoneMap   from '@/components/AnimalZoneMap'
import LabZoneMap      from '@/components/LabZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import SoundMuseum     from '@/components/SoundMuseum'
import FeedbackPanel   from '@/components/FeedbackPanel'
import InteriorDecorRoom from '@/components/InteriorDecorRoom'
import { getMyExperimentProgress, getMuseumAnnotationCounts, getAnnotatedByParticipantZone, getVotedSoundIdsByParticipant } from '@/lib/supabase'
import { getCurrencyBalance, getEquippedOutfit } from '@/lib/currency'
import { ensureTodayCheckIn } from '@/lib/attendance'
import { getOrCreateRoomShare, getOwnedInteriorItems, getRoom, getSharedRoom } from '@/lib/interiorDecor'
import { getEconomyRoom, getEconomySharedRoom, getOrCreateEconomyRoomShare } from '@/lib/economyV1.client'
import { probeHost } from '@/lib/duoSession'
import { claimParticipantSession, restoreParticipantSession } from '@/lib/participantAuth'
import { OUTFIT_SHEETS } from '@/components/AssetRegistry'
import { useEconomyRuntime } from '@/components/economy-v1/EconomyRuntimeProvider'
import EconomyRuntimeNotice from '@/components/economy-v1/EconomyRuntimeNotice'
import { isStudyAccessParticipantId, getStudyAccessGroup } from '@/lib/studyAccess.mjs'
import { completeStudySession, flushEvents, setUserEventContext, startStudySession, trackEvent } from '@/lib/userEvents'
import { canonicalAudioId, uniqueSoundsByCanonicalAudio } from '@/lib/soundIdentity.mjs'
import { FRIEND_ROOM } from '@/lib/interiorFixtures'
import { INTERIOR_CATALOG, INTERIOR_STARTER_IDS } from '@/lib/interiorCatalog'
import { getUniquePlacedInteriorIds } from '@/lib/homeHub.mjs'
import soundMetadata from '@/data/sound_metadata.json'

/* ─────────────────────────────────────────────
   Zone별 소리 목록 빌드
───────────────────────────────────────────── */
const ZONES = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']

// 임시 플레이테스트: 일반 플레이에서는 모든 마을을 처음부터 열어 둔다.
// false로 바꾸면 기존 Music 구역 1 완료 기반 순차 해금으로 즉시 복귀한다.
const FIRST_ZONE          = 'Music'
const ZONES_LOCKED_AT_START = ZONES.filter(z => z !== FIRST_ZONE)
const TEMPORARILY_UNLOCK_ALL_ZONES = true
const NATURE_QA_PARTICIPANT_ID = 'NATURE_QA_LOCAL'
const HUMAN_QA_PARTICIPANT_ID = 'HUMAN_QA_LOCAL'

// Sound Museum에 올라가려면 오디오 하나당 이 인원수만큼 전사가 완료돼야 한다.
// 원래는 그룹당 5명 기준이었는데, P/Q 그룹에 결원이 생겨 4명으로 낮춤(2026-07-31).
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

async function initializeUserLogging(initialScreen, zone = null) {
  const session = await startStudySession(initialScreen).catch(() => null)
  if (!session) return null
  setUserEventContext({ screen: initialScreen, zone })
  trackEvent('screen_viewed', { screen: initialScreen, zone, target_type: 'screen', target_id: initialScreen }, {
    dedupeKey: `screen:${session.studySessionId}:${initialScreen}:initial`,
  })
  return session
}

// 그룹 필터: groupId가 없으면 전체, 있으면 해당 그룹만.
// 그룹 무관 연구용 접근 ID(RESEARCHER 등)일 때만 필터를 완전히 우회한다 — 이 경우
// ZoneMap의 아이템 배치는 실제 참여자 화면과 일치하지 않는다(배치 시드가 사운드
// 목록 전체에서 계산되기 때문). ALLAUDIO_A/ALLAUDIO_B처럼 그룹이 고정된 접근은
// bypassAll=false로 호출해서 실제 그룹 참여자와 동일한 목록·배치를 보게 한다.
function getGroupSounds(zone, groupId, bypassAll = false) {
  const all = ZONE_SOUND_MAP[zone] || []
  // Lab placement and study progress are keyed by the real sound_id. Two A
  // records intentionally share canonical audio, so canonical de-duplication
  // would silently turn the contracted 84 items into 82 in the live HUD.
  const preserveLabSoundIds = sounds => zone === 'Lab' ? sounds : uniqueSoundsByCanonicalAudio(sounds)
  if (bypassAll || !groupId) return preserveLabSoundIds(all)
  const g = groupId.trim().toUpperCase().replace(/^G/i, '')  // "G1"→"1", "A"→"A"
  const label = g === '1' ? 'A' : g === '2' ? 'B' : g      // 그룹 번호 → 라벨 변환
  return preserveLabSoundIds(all.filter(s => !s.group || s.group === label))
}

// Museum용: 다른 그룹 사운드 전체 목록
function getOtherGroupSounds(groupId, bypassAll = false) {
  const all = soundMetadata.sounds || []
  if (bypassAll || !groupId) return uniqueSoundsByCanonicalAudio(all)
  const g = groupId.trim().toUpperCase().replace(/^G/i, '')
  const myLabel    = g === '1' ? 'A' : g === '2' ? 'B' : g
  if (!myLabel) return uniqueSoundsByCanonicalAudio(all)
  const otherLabel = myLabel === 'A' ? 'B' : 'A'
  return uniqueSoundsByCanonicalAudio(all.filter(s => !s.group || s.group === otherLabel))
}

/* ─────────────────────────────────────────────
   화면 상태 정의
   'start'    → StartPanel
   'world'    → WorldMap
   'zone'     → ZoneMap
   'annotate' → AnnotationPanel 오버레이 (ZoneMap 위)
   'museum'   → SoundMuseum 풀스크린
   'house'    → HouseDecorRoom 풀스크린 (우리 집 집꾸미기)
───────────────────────────────────────────── */
export default function HomePage() {
  const economy = useEconomyRuntime()
  const loadEconomy = economy.load
  const resetEconomy = economy.reset
  const applyEconomyActivityResult = economy.applyActivityResult
  const [screen,        setScreen]        = useState('start')
  const [participantId, setParticipantId] = useState('')
  const [groupId,       setGroupId]       = useState('')
  const [natureQaEnabled, setNatureQaEnabled] = useState(false)
  const [humanQaOptions, setHumanQaOptions] = useState(null)
  const [worldOverviewQa, setWorldOverviewQa] = useState(false)
  const [worldLockQaEnabled, setWorldLockQaEnabled] = useState(false)
  const [worldHomeQaState] = useState(() => (
    typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
      ? new URLSearchParams(window.location.search).get('worldHomeState') || ''
      : ''
  ))
  const [worldRoomShareQa] = useState(() => (
    typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
      ? new URLSearchParams(window.location.search).get('worldShareQa') || ''
      : ''
  ))
  const localQaRef = useRef(false)
  const worldLockQaRef = useRef(false)
  const [activeZone,    setActiveZone]    = useState(null)
  const [activeSound,   setActiveSound]   = useState(null)
  const [myExpression,  setMyExpression]  = useState('')
  const [museumSource,  setMuseumSource]  = useState(null) // 'zone' | 'world'
  const [unlockedBlock,   setUnlockedBlock]   = useState({})  // { zone: blockNum }
  const [blockUnlockInfo, setBlockUnlockInfo] = useState(null) // { block, zone } 완료 오버레이용
  const [zoneLoading,     setZoneLoading]     = useState(false)
  const [villagesUnlocked, setVillagesUnlocked] = useState(false)
  const [authRestoring, setAuthRestoring] = useState(true)
  const [authError, setAuthError] = useState('')
  const [experimentProgress, setExperimentProgress] = useState(null)
  const [progressError, setProgressError] = useState('')
  const [roomShareToken, setRoomShareToken] = useState(null)
  const [roomShareState, setRoomShareState] = useState({ status:'idle', message:'' })
  const [homePlacedCount, setHomePlacedCount] = useState(0)
  const [realtimeSelfId] = useState(() => `peer-${crypto.randomUUID()}`)
  const [duoUrlToken] = useState(() => (
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('duo')?.trim() || null
  ))
  const trackedParticipantRef = useRef(null)
  const previousScreenRef = useRef(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search)
      setWorldOverviewQa(process.env.NODE_ENV === 'development' && (
        query.get('worldOverview') === '1' || query.get('worldCapture') === '1' || query.get('worldClean') === '1'
      ))
      const natureEnabled = process.env.NODE_ENV === 'development' && query.get('natureQa') === '1'
      const worldLockQa = process.env.NODE_ENV === 'development' && query.get('worldLockQa') === '1'
      worldLockQaRef.current = worldLockQa
      setWorldLockQaEnabled(worldLockQa)
      const humanMode = process.env.NODE_ENV === 'development' ? query.get('humanQa') : null
      const humanEnabled = ['world', 'gameplay', 'static'].includes(humanMode)
      localQaRef.current = natureEnabled || humanEnabled
      setNatureQaEnabled(natureEnabled)
      if (humanEnabled) {
        const [tx, ty] = (query.get('start') || '').split(',').map(Number)
        setHumanQaOptions({
          mode: humanMode,
          block: Math.max(1, Math.min(6, Number(query.get('block')) || 6)),
          overview: query.get('overview') === '1',
          collision: query.get('collision') === '1',
          spawns: query.get('spawns') === '1',
          start: Number.isFinite(tx) && Number.isFinite(ty) ? { tx, ty } : null,
        })
        setParticipantId(HUMAN_QA_PARTICIPANT_ID)
        setGroupId('A')
        setVillagesUnlocked(true)
        setUnlockedBlock(prev => ({ ...prev, Human: Math.max(1, Math.min(6, Number(query.get('block')) || 6)) }))
        if (humanMode === 'world') {
          setScreen('world')
        } else {
          setActiveZone('Human')
          setScreen('zone')
        }
        setAuthRestoring(false)
        return
      }
      if (natureEnabled) {
        setParticipantId(NATURE_QA_PARTICIPANT_ID)
        setGroupId('A')
        setVillagesUnlocked(!worldLockQa)
        setScreen('world')
        setAuthRestoring(false)
        return
      }

      restoreParticipantSession()
        .then(async participant => {
          if (!participant) return
          await initializeUserLogging('world')
          const progress = await getMyExperimentProgress()
          trackedParticipantRef.current = participant.participantId
          previousScreenRef.current = 'world'
          resetEconomy()
          setParticipantId(participant.participantId)
          setGroupId(participant.groupId)
          setExperimentProgress(progress)
          setVillagesUnlocked(isStudyAccessParticipantId(participant.participantId))
          setScreen('world')
        })
        .catch(error => setAuthError(error?.code || 'session_restore_failed'))
        .finally(() => setAuthRestoring(false))
    }, 0)
    return () => window.clearTimeout(id)
  }, [resetEconomy])

  // 집꾸미기 초대 링크(?house=<호스트>)로 들어온 경우 — app/interior-test/page.js가
  // 검증용으로 먼저 갖고 있던 로직을 실제 앱(루트 경로)에도 그대로 옮긴 것.
  // InteriorDecorRoom의 초대 링크가 이제 여기(스왑 후 screen==='house')에서
  // 만들어지므로, 그 링크를 열었을 때 실제로 응답하는 곳도 여기여야 한다 —
  // 옮기지 않으면 링크가 그냥 평범한 시작 화면으로 떨어져서 초대 기능이
  // 통째로 죽는다. 호스트가 지금 정확히 월드맵에 있을 때만 실시간 동행
  // (?duo=)으로 보낸다 — 호스트가 집 안에 있으면(4단계) 굳이 월드맵으로
  // 우회시키지 않고 바로 아래 방문 화면으로 들어가는데, InteriorDecorRoom이
  // 방문 모드에서도 같은 duo 채널에 접속해 있으므로 호스트가 집 안에서
  // 움직이는 걸 그 자리에서 실시간으로 보게 된다. 호스트가 아예 오프라인이면
  // 저장된 방을 읽기 전용으로 보여준다(기존과 동일) — 이땐 duo 채널에 아무도
  // 없으니 그냥 조용히 비어 있을 뿐이다.
  const [visiting,      setVisiting]      = useState(null) // null | { token, room }
  const [visitRedirecting, setVisitRedirecting] = useState(false)
  // 방문 중이던 방(집 안)에서 호스트가 다른 화면(주로 월드맵)으로 나가버리면
  // 방문객이 방 안에만 혼자 남는 문제가 있었다 — 호스트를 따라 그 화면으로
  // 같이 옮겨가기 위한 상태. WorldMap이 이 값을 duoHostId prop으로 받아서
  // URL을 새로고침하지 않고(=재로그인 없이) 바로 그 호스트와 짝지어진다.
  const [followHostId, setFollowHostId] = useState(null)

  const prepareRoomShare = useCallback(async () => {
    if (authRestoring || !participantId || experimentProgress?.isComplete) return
    if (new URLSearchParams(window.location.search).has('house')) return
    if (localQaRef.current) {
      setRoomShareToken(null)
      setRoomShareState(worldRoomShareQa === 'error'
        ? { status:'error', message:'네트워크 연결이 없어 초대 토큰을 받지 못했어요.' }
        : { status:'qa', message:'QA 모드에서는 실제 공유 링크를 만들지 않아요.' })
      return
    }
    if (economy.runtimeState === 'unknown') return
    if (!['legacy','preview','cutover'].includes(economy.runtimeState)) {
      setRoomShareToken(null)
      setRoomShareState({ status:'idle', message:'현재 모드에서는 초대 링크를 만들 수 없어요.' })
      return
    }
    setRoomShareState({ status:'loading', message:'' })
    try {
      const share = economy.runtimeState === 'cutover'
        ? await getOrCreateEconomyRoomShare()
        : await getOrCreateRoomShare()
      if (economy.runtimeState === 'cutover' && !share?.ok) throw new Error(share?.code || 'economy_room_share_failed')
      const token = share?.shareToken?.trim()
      if (!token) throw new Error('empty_share_token')
      setRoomShareToken(token)
      setRoomShareState({ status:'ready', message:'' })
    } catch (error) {
      console.error('[room-share] 공유 토큰 준비 실패:', error)
      setRoomShareToken(null)
      setRoomShareState({ status:'error', message:'초대 링크를 만들지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.' })
    }
  }, [authRestoring, experimentProgress?.isComplete, participantId, worldRoomShareQa, economy.runtimeState])

  useEffect(() => {
    if (authRestoring || !participantId || experimentProgress?.isComplete) return
    const id = window.setTimeout(() => { prepareRoomShare().catch(() => {}) }, 0)
    return () => window.clearTimeout(id)
  }, [authRestoring, experimentProgress?.isComplete, participantId, prepareRoomShare])

  const refreshHomeHub = useCallback(async () => {
    if (!participantId || localQaRef.current) return
    if (economy.runtimeState === 'unknown') return
    if (!['legacy','preview','cutover'].includes(economy.runtimeState)) { setHomePlacedCount(0); return }
    try {
      if (economy.runtimeState === 'cutover') {
        const result = await getEconomyRoom()
        if (!result.ok) throw new Error(result.code || 'economy_room_load_failed')
        const runtimeItems = [...economy.interiorStarters, ...economy.interiorItems]
        const ownedItemIds = [...INTERIOR_STARTER_IDS, ...economy.ownedItemIds]
        setHomePlacedCount(getUniquePlacedInteriorIds({ room:result.room, ownedItemIds, runtimeItems }).length)
      } else {
        const [room, ownedItemIds] = await Promise.all([getRoom(participantId), getOwnedInteriorItems(participantId)])
        setHomePlacedCount(getUniquePlacedInteriorIds({ room, ownedItemIds, runtimeItems:INTERIOR_CATALOG }).length)
      }
    } catch (error) {
      console.error('[home-hub] 방 준비 상태 조회 실패:', error)
    }
  }, [participantId, economy.runtimeState, economy.interiorStarters, economy.interiorItems, economy.ownedItemIds])

  useEffect(() => {
    if (!participantId || experimentProgress?.isComplete) return
    const id = window.setTimeout(() => { refreshHomeHub() }, 0)
    return () => window.clearTimeout(id)
  }, [experimentProgress?.isComplete, participantId, refreshHomeHub])

  useEffect(() => {
    const shareToken = new URLSearchParams(window.location.search).get('house')?.trim()
    if (!shareToken || authRestoring || !participantId || experimentProgress?.isComplete || economy.runtimeState === 'unknown') return
    if (!['legacy','preview','cutover'].includes(economy.runtimeState)) return
    let cancelled = false
    trackEvent('friend_room_open_attempted', { target_type: 'friend_room', target_id: 'shared-room' })
    const sharedRequest = economy.runtimeState === 'cutover'
      ? getEconomySharedRoom(shareToken)
      : getSharedRoom(shareToken)
    Promise.resolve(sharedRequest).then((shared) => {
      if (economy.runtimeState === 'cutover' && !shared?.ok) throw new Error(shared?.code || 'shared_room_load_failed')
      if (cancelled || !shared?.room) return
      return probeHost(shareToken).then(({ screen }) => {
        if (cancelled) return
        if (screen === 'worldmap') {
          setVisitRedirecting(true)
          window.location.assign(`/?duo=${encodeURIComponent(shareToken)}`)
          return
        }
        trackEvent('friend_room_open_succeeded', { target_type: 'friend_room', target_id: 'shared-room', outcome: 'succeeded' })
        setVisiting({ token: shareToken, room: shared.room })
      })
    }).catch((error) => {
      if (cancelled) return
      console.error('[room-share] 공유 방 조회 실패:', error)
      trackEvent('friend_room_open_failed', { target_type: 'friend_room', target_id: 'shared-room', outcome: 'failed', error_code: 'shared_room_load_failed' })
    })
    return () => { cancelled = true }
  }, [authRestoring, experimentProgress?.isComplete, participantId, economy.runtimeState])

  useEffect(() => {
    if (!participantId || localQaRef.current || trackedParticipantRef.current === participantId) return
    trackedParticipantRef.current = participantId
    initializeUserLogging(screen, activeZone).catch(() => {})
  }, [participantId, screen, activeZone])

  useEffect(() => {
    if (!participantId || localQaRef.current) return
    const previous = previousScreenRef.current
    if (previous === screen) return
    if (previous) trackEvent('screen_exited', { screen: previous, zone: activeZone, target_type: 'screen', target_id: previous })
    previousScreenRef.current = screen
    setUserEventContext({ screen, zone: activeZone })
    trackEvent('screen_viewed', { screen, zone: activeZone, target_type: 'screen', target_id: screen })
  }, [participantId, screen, activeZone])

  // 피드백 오버레이
  const [showFeedback,  setShowFeedback]  = useState(false)
  const [feedbackZone,  setFeedbackZone]  = useState('')
  const [museumEmpty,   setMuseumEmpty]   = useState(false)  // Museum: 5개 미달 알림
  const [museumDoneToast, setMuseumDoneToast] = useState(false) // Museum 관람 완료 후 안내 토스트
  const [attendanceToast, setAttendanceToast] = useState(null) // 출석 체크인 완료 토스트 { streakDay, reward }

  // 세션 중 수집 완료된 sound_id Set
  const [collectedIds,  setCollectedIds]  = useState(new Set())

  // 카운트
  const [totalCount,    setTotalCount]    = useState(0)
  const [zoneProgress,  setZoneProgress]  = useState({})
  // 전시 현황 탭용 — zoneProgress(비율)와 같은 루프에서 분자/분모를 함께 보관.
  // 새 쿼리 아님 — 이미 zoneProgress 계산에 쓰는 count/zoneMax를 그대로 노출만 함.
  const [zoneCounts,    setZoneCounts]    = useState({})
  // 화폐 시스템 — WorldMap HUD 잔액 + 장착 중인 outfit(캐릭터 렌더링용)
  const [balance,          setBalance]          = useState(0)
  const [equippedOutfitId, setEquippedOutfitId] = useState(null)
  const runtimeItemMap = new Map((economy.runtimeItems || []).map((item) => [item.id, item]))
  const economyOutfit = runtimeItemMap.get(economy.loadout.outfitId)
  const economyAccessory = runtimeItemMap.get(economy.loadout.accessoryId)
  const runtimeOutfitSrc = economy.mode === 'cutover'
    ? (economyOutfit?.runtimeAsset || '/assets/world/player_clothes.png')
    : (equippedOutfitId ? OUTFIT_SHEETS[equippedOutfitId]?.src : undefined)
  const runtimeAccessorySrc = economy.mode === 'cutover' ? economyAccessory?.runtimeAsset : undefined
  const studyAccessEnabled = isStudyAccessParticipantId(participantId)
  // ALLAUDIO_A/ALLAUDIO_B처럼 그룹이 ID에 고정된 접근이면 그 그룹으로, 아니면
  // 입력받은 groupId를 그대로 쓴다. RESEARCHER 등 그룹 무관 접근만 완전히 우회한다.
  const studyAccessGroup   = getStudyAccessGroup(participantId)
  const effectiveGroupId   = studyAccessGroup || groupId
  const bypassGroupFilter  = studyAccessEnabled && !studyAccessGroup
  // worldLockQa는 잠금 UI 회귀 테스트를 위해 임시 전체 해금보다 우선한다.
  const allZonesUnlocked = !worldLockQaEnabled && (
    TEMPORARILY_UNLOCK_ALL_ZONES || natureQaEnabled || studyAccessEnabled || villagesUnlocked
  )

  /* ── 카운트 갱신 (현재 참여자 + 그룹 기준) ── */
  const refreshCounts = useCallback(async () => {
    if (!participantId || localQaRef.current) return
    try {
      const progress = await getMyExperimentProgress()
      const counts = progress?.zoneCounts || {}
      setExperimentProgress(progress)
      setProgressError('')
      setTotalCount(Number(progress?.completedCount) || 0)
      setZoneProgress(Object.fromEntries(ZONES.map(zone => {
        const count = counts[zone] || {}
        return [zone, count.assigned ? Math.min(count.completed / count.assigned, 1) : 0]
      })))
      setZoneCounts(Object.fromEntries(ZONES.map(zone => {
        const count = counts[zone] || {}
        return [zone, { collected: Number(count.completed) || 0, total: Number(count.assigned) || 0 }]
      })))
    } catch (error) {
      console.error('[progress] 실험 진행 조회 실패:', error)
      setProgressError('experiment_progress_load_failed')
    }

    if (economy.effectiveMainMode !== 'legacy') return
    try {
      const [bal, outfitId] = await Promise.all([
        getCurrencyBalance(participantId),
        getEquippedOutfit(participantId),
      ])
      setBalance(bal)
      setEquippedOutfitId(outfitId)
    } catch {}
  }, [economy.effectiveMainMode, participantId])

  useEffect(() => {
    if (!participantId || localQaRef.current || experimentProgress?.isComplete) return
    const id = window.setTimeout(() => { void loadEconomy() }, 0)
    return () => window.clearTimeout(id)
  }, [participantId, experimentProgress?.isComplete, loadEconomy])

  useEffect(() => {
    if (!participantId || experimentProgress?.isComplete) return
    const id = window.setTimeout(() => { refreshCounts() }, 0)
    return () => window.clearTimeout(id)
  }, [participantId, experimentProgress?.isComplete, refreshCounts])

  // 출석 체크인 — 오늘 처음 월드에 들어왔을 때 한 번만 자동 지급.
  // lib/attendance.js가 "이미 오늘 체크인했음"을 자체적으로 판별하므로
  // 여기서는 그냥 참여자가 정해질 때마다 호출하기만 하면 됨(멱등).
  useEffect(() => {
    if (!participantId || localQaRef.current || experimentProgress?.isComplete || economy.effectiveMainMode !== 'legacy') return
    trackEvent('attendance_check_attempted', {
      target_type: 'attendance', target_id: 'daily-check-in', operation_type: 'attendance_claim',
    }, { critical: true })
    ensureTodayCheckIn(participantId).then((result) => {
      if (!result.ok) {
        trackEvent('attendance_check_failed', {
          target_type: 'attendance', target_id: 'daily-check-in', outcome: 'failed',
          operation_type: result.operationType, operation_idempotency_key: result.idempotencyKey,
          error_code: result.error.code, metadata: { retryable: result.error.retryable },
        }, { critical: true, flush: true })
        throw new Error(result.error.code)
      }
      const { row, isNew } = result.data
      trackEvent('attendance_check_succeeded', {
        target_type: 'attendance', target_id: 'daily-check-in', outcome: 'succeeded',
        operation_type: result.operationType, operation_idempotency_key: result.idempotencyKey,
        result_entity_type: row?.id ? 'attendance' : undefined, result_entity_id: row?.id,
        metadata: { is_new: !!isNew, reward_amount: row?.reward_currency, transaction_id: result.data?.reward?.transactionId },
      }, { critical: true, flush: true })
      if (isNew && row) {
        setAttendanceToast({ streakDay: row.streak_day, reward: row.reward_currency })
        refreshCounts()
      }
    }).catch(error => console.error('[attendance] 인증된 체크인 처리 실패:', error))
  }, [participantId, experimentProgress?.isComplete, refreshCounts, economy.effectiveMainMode])

  // Museum 관람 완료 토스트 자동 닫힘
  useEffect(() => {
    if (!museumDoneToast) return
    const t = setTimeout(() => setMuseumDoneToast(false), 3200)
    return () => clearTimeout(t)
  }, [museumDoneToast])

  // 출석 토스트 자동 닫힘
  useEffect(() => {
    if (!attendanceToast) return
    const t = setTimeout(() => setAttendanceToast(null), 3800)
    return () => clearTimeout(t)
  }, [attendanceToast])

  /* ── StartPanel → WorldMap ── */
  const handleStart = async (pid, gid) => {
    const participant = await claimParticipantSession(pid, gid)
    await initializeUserLogging('world')
    const progress = await getMyExperimentProgress()
    trackedParticipantRef.current = participant.participantId
    previousScreenRef.current = 'world'
    const enabled = isStudyAccessParticipantId(participant.participantId)
    resetEconomy()
    setParticipantId(participant.participantId)
    setGroupId(participant.groupId)
    setExperimentProgress(progress)
    setProgressError('')
    setVillagesUnlocked(enabled)
    setScreen('world')
    setAuthError('')
    // participantId가 set된 후 카운트 갱신은 useEffect에서 처리
  }

  /* ── 집 안에서 방문 중이던 호스트가 다른 화면(주로 월드맵)으로 나갔을 때 —
     방문객도 그 화면으로 따라간다. URL을 새로고침하지 않으므로 이미 받은
     참여자ID/그룹을 다시 물어보지 않는다. */
  const handlePartnerLeftScreen = useCallback(hostScreen => {
    if (hostScreen !== 'worldmap' || !visiting) return
    setFollowHostId(visiting.token)
    window.history.replaceState(null, '', window.location.pathname)
    setVisiting(null)
    setScreen('world')
  }, [visiting])

  /* ── sound_id 포맷 무관하게 메타데이터 소리를 찾는 헬퍼 ── */
  const findSoundByCanonicalId = useCallback((canonicalId, all) => (
    all.find(sound => canonicalAudioId(sound) === canonicalId) || null
  ), [])

  /* ── Music 구역 1 전사 완료 여부 확인 → 나머지 마을 잠금 해제 ── */
  const checkVillagesUnlocked = useCallback(async () => {
    if (!participantId) return
    if (localQaRef.current) {
      if (!worldLockQaRef.current) setVillagesUnlocked(true)
      return
    }
    if (studyAccessEnabled) {
      setVillagesUnlocked(true)
      return
    }
    try {
      const canonicalIds = await getAnnotatedByParticipantZone(participantId, FIRST_ZONE)
      const all   = soundMetadata.sounds
      const annotatedSet = new Set()
      for (const canonicalId of canonicalIds) {
        const found = findSoundByCanonicalId(canonicalId, all)
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
  }, [participantId, effectiveGroupId, bypassGroupFilter, studyAccessEnabled, findSoundByCanonicalId])

  useEffect(() => {
    if (!participantId || experimentProgress?.isComplete) return
    const id = window.setTimeout(() => { checkVillagesUnlocked() }, 0)
    return () => window.clearTimeout(id)
  }, [participantId, experimentProgress?.isComplete, checkVillagesUnlocked])

  /* ── DB sound_id → 재생 가능한 sound 오브젝트 (메타데이터에 없으면 합성) ── */
  /* ── WorldMap → ZoneMap (ENTER로 진입) ── */
  const handleEnterZone = useCallback(async (zone) => {
    trackEvent('zone_entry_attempted', { zone, target_type: 'zone', target_id: `zone-${zone.toLowerCase()}` })
    setZoneLoading(true)
    setActiveZone(zone)
    if (localQaRef.current) {
      const zoneSounds = getGroupSounds(zone, effectiveGroupId, bypassGroupFilter)
      const maxBlock = zoneSounds.reduce((m, sound) => Math.max(m, sound.block || 1), 1)
      setUnlockedBlock(prev => ({ ...prev, [zone]: maxBlock }))
      setCollectedIds(new Set())
      setZoneLoading(false)
      setScreen('zone')
      trackEvent('zone_entry_succeeded', { zone, target_type: 'zone', target_id: `zone-${zone.toLowerCase()}`, outcome: 'succeeded' })
      return
    }
    try {
      const canonicalIds = await getAnnotatedByParticipantZone(participantId, zone)
      const all   = soundMetadata.sounds

      // DB sound_id → 메타데이터 sound_id 변환 (구버전 포맷 브리지)
      const annotatedSet = new Set()
      for (const canonicalId of canonicalIds) {
        if (zone === 'Lab') {
          // Lab intentionally keeps every real sound_id even when two records
          // share one audio source. Restore all matching group records instead
          // of collapsing each canonical identity to the first catalog row.
          for (const sound of getGroupSounds(zone, effectiveGroupId, bypassGroupFilter)) {
            if (canonicalAudioId(sound) === canonicalId) annotatedSet.add(sound.sound_id)
          }
        } else {
          const found = findSoundByCanonicalId(canonicalId, all)
          if (found) annotatedSet.add(found.sound_id)
        }
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
      trackEvent('navigation_failed', { zone, target_type: 'zone', target_id: `zone-${zone.toLowerCase()}`, outcome: 'failed', error_code: 'zone_progress_load_failed' })
    }
    setZoneLoading(false)
    setScreen('zone')
    trackEvent('zone_entry_succeeded', { zone, target_type: 'zone', target_id: `zone-${zone.toLowerCase()}`, outcome: 'succeeded' })
  }, [participantId, effectiveGroupId, bypassGroupFilter, studyAccessEnabled, findSoundByCanonicalId, setActiveZone, setZoneLoading, setUnlockedBlock, setCollectedIds, setScreen])

  /* ── ZoneMap → WorldMap (ESC로 복귀) ── */
  const handleExitZone = useCallback(() => {
    trackEvent('zone_exited', { zone: activeZone, target_type: 'button', target_id: 'zone-exit' })
    setActiveZone(null)
    setActiveSound(null)
    setScreen('world')
  }, [activeZone, setActiveZone, setActiveSound, setScreen])

  /* ── ZoneMap에서 소리 줍기 → AnnotationPanel 오버레이 ── */
  const handleCollectSound = useCallback((sound) => {
    trackEvent('collectible_activated', {
      zone: activeZone, sound_id: sound?.sound_id, target_type: 'sound_collectible',
      target_id: sound?.sound_id, outcome: 'succeeded',
    })
    setActiveSound(sound)
    setScreen('annotate')
  }, [activeZone])

  /* ── WorldMap에서 Sound Museum 직접 진입 ── */
  const handleEnterMuseum = useCallback(async () => {
    trackEvent('museum_candidate_load_attempted', { target_type: 'museum', target_id: 'museum-entry' })
    setMuseumEmpty(false)
    const all = soundMetadata.sounds
    if (!all || all.length === 0) return

    // Browser QA runs intentionally have no Supabase session. Keep the product
    // navigation real, but do not turn that expected offline state into a
    // console error while validating the world-map entry flow.
    if (localQaRef.current) {
      setActiveSound(null)
      setActiveZone('Lab')
      setMyExpression('')
      setMuseumSource('world')
      setScreen('museum')
      return
    }

    // 내 그룹이 아닌 그룹의 사운드만 Museum에 표시
    const otherGroupSounds = getOtherGroupSounds(effectiveGroupId, bypassGroupFilter)
    const otherSoundsByIdentity = new Map()
    for (const candidateSound of otherGroupSounds) {
      const identity = canonicalAudioId(candidateSound)
      if (!otherSoundsByIdentity.has(identity)) otherSoundsByIdentity.set(identity, candidateSound)
    }

    let sound = null
    try {
      const [rawCounts, votedIds] = await Promise.all([
        getMuseumAnnotationCounts(),
        getVotedSoundIdsByParticipant(participantId),
      ])
      const votedSet = new Set(votedIds)

      // 후보: 최소 전사 수를 충족한 다른 그룹 오디오 중 아직 투표하지 않은 것.
      const candidates = Object.entries(rawCounts)
        .filter(([identity, count]) => count >= MUSEUM_MIN_ANNOTATIONS && otherSoundsByIdentity.has(identity) && !votedSet.has(identity))
        .map(([identity]) => otherSoundsByIdentity.get(identity))
        .filter(Boolean)

      const shuffled = [...candidates].sort(() => Math.random() - 0.5)
      sound = shuffled[0] || null
    } catch (e) {
      console.error('[Museum] 진입 오류:', e)
      trackEvent('museum_candidate_load_failed', { target_type: 'museum', target_id: 'museum-entry', outcome: 'failed', error_code: 'museum_sound_load_failed' })
    }

    // 투표할 소리가 아직 없어도(데이터 미달) Museum 자체는 들어갈 수 있게 한다 —
    // 상점/전시 현황 탭은 sound와 무관하게 동작하므로, 투표 탭만 SoundMuseum
    // 내부에서 "아직 없어요" 안내로 대체한다(사용자 확정, 2026-08-25).
    setActiveSound(sound)
    setActiveZone(sound ? (sound.game_zone || 'Lab') : 'Lab')
    setMyExpression('')
    setMuseumSource('world')
    setScreen('museum')
    trackEvent(sound ? 'museum_candidate_loaded' : 'museum_candidate_empty', {
      zone: sound?.game_zone || 'Lab', sound_id: sound?.sound_id,
      target_type: 'museum', target_id: 'museum-entry', outcome: sound ? 'succeeded' : 'empty',
    })
  }, [effectiveGroupId, bypassGroupFilter, participantId, setMuseumEmpty, setActiveSound, setActiveZone, setMyExpression, setMuseumSource, setScreen])

  /* ── AnnotationPanel Stage1 완료 → Zone 복귀 + 블록 완료 체크 ── */
  const handleAnnotateComplete = useCallback(({ persistence } = {}) => {
    applyEconomyActivityResult(persistence)
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

    const progress = persistence?.progress
    if (progress) setExperimentProgress(progress)
    setActiveSound(null)
    setMyExpression('')
    if (progress?.isComplete) {
      void completeStudySession('all_assigned_annotations_completed', {
        operationType: 'annotation_submit', idempotencyKey: persistence?.operationIdempotencyKey,
        annotationId: persistence?.annotationId,
      })
      setScreen('complete')
    } else {
      setFeedbackZone(activeZone)
      setShowFeedback(true)
      setScreen('zone')
    }
    refreshCounts()
  }, [activeSound, activeZone, collectedIds, effectiveGroupId, bypassGroupFilter, unlockedBlock, villagesUnlocked, refreshCounts, setUnlockedBlock, applyEconomyActivityResult])

  /* ── SoundMuseum 완료 → WorldMap 복귀 (+ "오늘은 여기까지" 토스트) ── */
  const handleMuseumDone = useCallback(() => {
    trackEvent('museum_exited', { zone: activeZone, sound_id: activeSound?.sound_id, target_type: 'button', target_id: 'museum-next-candidate', close_reason: 'submitted' })
    setActiveSound(null)
    setMyExpression('')
    setMuseumSource(null)
    setScreen('world')
    setMuseumDoneToast(true)
  }, [activeZone, activeSound])

  /* ── SoundMuseum에서 월드맵 직접 이동 ── */
  const handleMuseumExit = useCallback(() => {
    trackEvent('museum_exited', { zone: activeZone, sound_id: activeSound?.sound_id, target_type: 'button', target_id: 'museum-exit', close_reason: 'navigation' })
    setActiveSound(null)
    setMyExpression('')
    setMuseumSource(null)
    setScreen('world')
  }, [activeZone, activeSound])

  /* ── WorldMap → 우리 집 (ENTER로 진입) ── */
  const handleEnterHouse = useCallback(() => {
    trackEvent('interior_entered', { target_type: 'building', target_id: 'my-house' })
    setScreen('house')
  }, [])

  /* ── 우리 집 → WorldMap (뒤로가기/ESC) — 가구를 샀을 수 있으니 코인 잔액을 새로 읽는다 ── */
  const handleExitHouse = useCallback(() => {
    trackEvent('interior_exited', { target_type: 'button', target_id: 'interior-exit' })
    setScreen('world')
    void flushEvents()
    refreshCounts()
    refreshHomeHub()
  }, [refreshCounts, refreshHomeHub])

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

  const economyGuard = participantId && !natureQaEnabled && !humanQaOptions
    ? <EconomyRuntimeNotice runtimeState={economy.runtimeState} error={economy.error} onRetry={loadEconomy}/>
    : null

  // 0. 집꾸미기 초대 링크(?house=)로 들어온 경우 — 방문객도 다른 진입 경로와
  // 똑같이 참여자ID/그룹을 먼저 선택해야 한다(익명 구경 아님). participantId가
  // 아직 없으면 평소 StartPanel을 그대로 재사용해서 받고, handleStart가
  // 끝나면(participantId가 생기면) 그제서야 방으로 들어간다 — 그래야 연구
  // 참여자 집계·출석 등 다른 진입 경로와 동일하게 처리된다.
  if (visitRedirecting) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EDE2C6', fontFamily: "'Gothic A1', sans-serif", background: '#3A2A14' }}>
        지금 접속해 있어요 — 같이 놀 수 있는 곳으로 이동할게요…
      </main>
    )
  }
  if (participantId && progressError) {
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#3A2A14',color:'#F5EDD8',fontFamily:'Nunito, sans-serif',textAlign:'center',padding:24}}>
      <div><h1 style={{fontSize:24}}>진행 상태를 불러오지 못했어요</h1><p>완료한 과제가 다시 표시되지 않도록 진행을 멈췄습니다.</p><button onClick={() => window.location.reload()} style={{padding:'10px 18px'}}>다시 불러오기</button></div>
    </main>
  }
  if (participantId && experimentProgress?.isComplete) {
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'linear-gradient(160deg,#87CEEB,#5A9A3A)',fontFamily:'Nunito, sans-serif',padding:24}}>
      <section style={{maxWidth:520,background:'#F5EDD8',border:'3px solid #C8A96E',borderRadius:24,padding:'38px 42px',textAlign:'center',boxShadow:'0 16px 50px #0004'}}>
        <div style={{fontSize:52}}>🎉</div><h1 style={{color:'#3A2A14'}}>모든 소리 과제를 완료했어요</h1>
        <p style={{color:'#8B6A3A',lineHeight:1.7}}>배정된 {experimentProgress.assignedCount}개 음원의 응답이 안전하게 저장되었습니다.<br/>참여해 주셔서 감사합니다.</p>
      </section>
    </main>
  }
  if (participantId && !natureQaEnabled && !humanQaOptions && !experimentProgress) {
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#3A2A14',color:'#F5EDD8',fontFamily:'Nunito, sans-serif'}}>실험 진행 상태 확인 중…</main>
  }
  if (visiting) {
    if (!participantId) {
      return <StartPanel onStart={handleStart} restoring={authRestoring} initialError={authError} />
    }
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#6E5844',
        backgroundImage:
          'linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px)',
        backgroundSize: '8px 8px',
        padding: '24px',
      }}>
        <InteriorDecorRoom
          visitorMode
          visitorName="친구"
          roomShareToken={visiting.token}
          realtimeSelfId={realtimeSelfId}
          initialRoom={visiting.room}
          onLeaveVisit={() => {
            // 이미 참여자ID/그룹을 받았으니(handleStart가 screen도 'world'로
            // 돌려놨다) 다시 물어보지 않고 그대로 내 월드맵으로 넘어간다 —
            // ?house= 쿼리는 지워서 새로고침해도 방문 판정이 다시 걸리지 않게.
            window.history.replaceState(null, '', window.location.pathname)
            setVisiting(null)
          }}
          onPartnerLeftScreen={handlePartnerLeftScreen}
        />
        {economyGuard}
      </main>
    )
  }
  // checkedVisit 자체로 화면을 막지는 않는다 — ?house= 없는 압도적 다수의
  // 정상 진입에서 그 확인 한 번 때문에 시작 화면이 매번 잠깐 깜빡이면 안 되므로,
  // 판정이 끝나기 전엔 그냥 평소 화면(아래)을 그대로 보여주다가 결과가 나오면
  // (visiting/visitRedirecting) 그때 위 분기로 바뀐다.

  // 1. 시작 화면
  if (screen === 'start') {
    return <StartPanel onStart={handleStart} restoring={authRestoring} initialError={authError} />
  }

  // 2. 월드맵 (zone 진입 로딩 포함)
  if (screen === 'world') {
    return (
      <>
        <WorldMap
          onEnterZone={handleEnterZone}
          onEnterMuseum={handleEnterMuseum}
          onEnterHouse={handleEnterHouse}
          totalCount={totalCount}
          zoneProgress={zoneProgress}
          balance={balance}
          economyMode={economy.effectiveMainMode}
          economyBalances={economy.balances}
          economyAttendance={economy.attendance}
          onEconomyAttendanceClaim={economy.claimAttendance}
          outfitSrc={runtimeOutfitSrc}
          accessorySrc={runtimeAccessorySrc}
          lockedZones={allZonesUnlocked ? [] : ZONES_LOCKED_AT_START}
          participantId={participantId}
          roomShareToken={roomShareToken}
          homeHubStatus={{ placedCount:homePlacedCount, shareStatus:roomShareState.status }}
          realtimeSelfId={realtimeSelfId}
          duoHostId={followHostId || duoUrlToken}
        />
        {economyGuard}
        {!worldOverviewQa && !worldLockQaEnabled && (natureQaEnabled || humanQaOptions?.mode === 'world') && (
          <button type="button" onClick={() => handleEnterZone(natureQaEnabled ? 'Nature' : 'Human')} style={{
            position:'fixed', right:16, bottom:16, zIndex:199,
            border:'2px solid #5f8d42', borderRadius:8, background:'#eef8d6',
            color:'#29401f', padding:'8px 12px', fontWeight:800, cursor:'pointer',
          }}>
            QA · {natureQaEnabled ? 'Nature' : 'Human'} 제품 경로 진입
          </button>
        )}
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
                도서관에서 만날 수 있어요 ✨
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

        {/* 출석 체크인 완료 토스트 */}
        {attendanceToast && (
          <div onClick={() => setAttendanceToast(null)} style={{
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
                📅 출석 완료! 연속 {attendanceToast.streakDay}일차
              </div>
              <div style={{ fontSize:'11px', color:'#8B6A3A', lineHeight:1.5 }}>
                +{attendanceToast.reward}🪙 획득했어요
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // 3. 우리 집 (집꾸미기)
  if (screen === 'house') {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#6E5844',
        backgroundImage:
          'linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px)',
        backgroundSize: '8px 8px',
        padding: '24px',
      }}>
        <InteriorDecorRoom participantId={participantId} initialRoom={worldHomeQaState === 'invite-ready' ? FRIEND_ROOM : undefined} roomShareToken={roomShareToken} roomShareState={roomShareState} onRetryRoomShare={prepareRoomShare} realtimeSelfId={realtimeSelfId}
          dryRun={natureQaEnabled || Boolean(humanQaOptions)} onExit={handleExitHouse} onCurrencyChange={refreshCounts} onRoomStatusChange={setHomePlacedCount} />
        {economyGuard}
      </main>
    )
  }

  // 4. Sound Museum — 투표할 소리가 없어도(activeSound=null) 들어갈 수 있다.
  // 상점/전시 현황 탭은 sound와 무관하게 동작하고, 투표 탭만 SoundMuseum
  // 내부에서 "아직 없어요" 안내로 대체된다.
  if (screen === 'museum') {
    return (
      <>
        <SoundMuseum
          key={activeSound ? canonicalAudioId(activeSound) : 'museum-empty'}
          sound={activeSound}
          zone={activeZone}
          myExpression={myExpression}
          participantId={participantId}
          sessionId={groupId}
          zoneCounts={zoneCounts}
          outfitSrc={runtimeOutfitSrc}
          accessorySrc={runtimeAccessorySrc}
          economyMode={economy.effectiveMainMode}
          economyViewMode={economy.mode}
          onEconomyActivity={economy.applyActivityResult}
          onCurrencyChange={refreshCounts}
          onDone={handleMuseumDone}
          onExit={handleMuseumExit}
        />
        {economyGuard}
      </>
    )
  }

  // 5. Zone 내부 맵 (+ annotation 오버레이)
  if (screen === 'zone' || screen === 'annotate') {
    const currentBlock = unlockedBlock[activeZone] || 1
    const zoneSounds   = getGroupSounds(activeZone, effectiveGroupId, bypassGroupFilter)
    const maxBlock     = zoneSounds.reduce((m, s) => Math.max(m, s.block || 1), 1)
    const zoneInputBlocked = screen === 'annotate' || showFeedback || Boolean(blockUnlockInfo)
    return (
      <>
        {/* ZoneMap — zone의 모든 소리를 한 화면에 유지. 잠긴/해제된 구역 표시는
            blockNum prop으로 ZoneMap 내부에서 처리하므로 리마운트하지 않는다.
            Music/Nature/Human/Urban/Animal만 예외 — 전용 캔버스 엔진을 쓴다(Music: 절차적
            드로잉 handoff를 이식한 MusicZoneMap/lib/musicVillage.js. Nature: 구매
            에셋 기반 타일맵 handoff를 이식한 NatureZoneMap/lib/natureVillage.js.
            Human: 모듈형 픽셀 에셋 기반 공동 회관 광장 캔버스.
            Urban: ImageGen 래스터 에셋 기반 Midnight Metro Media Core 캔버스.
            Animal: 최종 기준 PNG를 정적 월드 레이어로 쓰는
            AnimalZoneMap/lib/animalVillage.js). 소리 데이터·전사 흐름
            (onCollectSound/AnnotationPanel)은 다른 Zone과 완전히 동일. */}
        {activeZone === 'Music' ? (
          <MusicZoneMap
            sounds={zoneSounds}
            onCollectSound={handleCollectSound}
            onExit={handleExitZone}
            collectedIds={collectedIds}
            isAnnotating={zoneInputBlocked}
            blockNum={currentBlock}
            blockTotal={maxBlock}
            outfitSrc={runtimeOutfitSrc}
            accessorySrc={runtimeAccessorySrc}
          />
        ) : activeZone === 'Human' ? (
          <HumanZoneMap
            sounds={zoneSounds}
            onCollectSound={handleCollectSound}
            onExit={handleExitZone}
            collectedIds={collectedIds}
            isAnnotating={zoneInputBlocked}
            blockNum={currentBlock}
            blockTotal={maxBlock}
            debugOverview={humanQaOptions?.overview}
            debugCollision={humanQaOptions?.collision}
            debugSpawns={humanQaOptions?.spawns}
            debugStart={humanQaOptions?.start}
            staticArt={humanQaOptions?.mode === 'static'}
            outfitSrc={runtimeOutfitSrc}
            accessorySrc={runtimeAccessorySrc}
          />
        ) : activeZone === 'Nature' ? (
          <NatureZoneMap
            sounds={zoneSounds}
            onCollectSound={handleCollectSound}
            onExit={handleExitZone}
            collectedIds={collectedIds}
            isAnnotating={zoneInputBlocked}
            blockNum={currentBlock}
            blockTotal={maxBlock}
            debugFirstItem={natureQaEnabled}
            outfitSrc={runtimeOutfitSrc}
            accessorySrc={runtimeAccessorySrc}
          />
        ) : activeZone === 'Urban' ? (
          <UrbanZoneMap
            sounds={zoneSounds}
            onCollectSound={handleCollectSound}
            onExit={handleExitZone}
            collectedIds={collectedIds}
            isAnnotating={zoneInputBlocked}
            blockNum={currentBlock}
            blockTotal={maxBlock}
            outfitSrc={runtimeOutfitSrc}
            accessorySrc={runtimeAccessorySrc}
          />
        ) : activeZone === 'Animal' ? (
          <AnimalZoneMap
            sounds={zoneSounds}
            onCollectSound={handleCollectSound}
            onExit={handleExitZone}
            collectedIds={collectedIds}
            isAnnotating={zoneInputBlocked}
            blockNum={currentBlock}
            blockTotal={maxBlock}
            outfitSrc={runtimeOutfitSrc}
            accessorySrc={runtimeAccessorySrc}
          />
        ) : activeZone === 'Lab' ? (
          <LabZoneMap
            sounds={zoneSounds}
            onCollectSound={handleCollectSound}
            onExit={handleExitZone}
            collectedIds={collectedIds}
            isAnnotating={zoneInputBlocked}
            blockNum={currentBlock}
            blockTotal={maxBlock}
            outfitSrc={runtimeOutfitSrc}
            accessorySrc={runtimeAccessorySrc}
          />
        ) : (
          <ZoneMap
            zone={activeZone}
            sounds={zoneSounds}
            onCollectSound={handleCollectSound}
            onExit={handleExitZone}
            collectedIds={collectedIds}
            isAnnotating={zoneInputBlocked}
            blockNum={currentBlock}
            blockTotal={maxBlock}
            outfitSrc={runtimeOutfitSrc}
            accessorySrc={runtimeAccessorySrc}
          />
        )}

        {/* AnnotationPanel — ZoneMap 위에 오버레이 */}
        {screen === 'annotate' && activeSound && (
          <AnnotationPanel
            sound={activeSound}
            zone={activeZone}
            participantId={participantId}
            sessionId={groupId}
            economyMode={economy.effectiveMainMode}
            dryRun={natureQaEnabled || Boolean(humanQaOptions)}
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
        {economyGuard}

        {/* 완료 피드백 토스트 */}
        {showFeedback && (
          <FeedbackPanel
            key={feedbackZone}
            zone={feedbackZone}
            onClose={handleFeedbackClose}
          />
        )}
      </>
    )
  }

  return null
}
