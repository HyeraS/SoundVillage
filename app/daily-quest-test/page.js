'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { saveAnnotation, saveVote, getClient } from '@/lib/supabase'
import { awardAnnotationCurrency, awardVoteCurrency, getCurrencyBalance } from '@/lib/currency'
import { recordAnnotationQuestProgress, recordVoteQuestProgress, getTodayQuestSummary, ensureTodayQuests } from '@/lib/dailyQuests'
import soundMetadata from '@/data/sound_metadata.json'

/* ─────────────────────────────────────────────
   격리된 일일 퀘스트 E2E 테스트 하네스 — fence-test/library-test와 같은 패턴.
   실제 게임 흐름(app/page.js, AnnotationPanel, SoundMuseum)은 전혀 건드리지
   않고, 그 컴포넌트들이 제출 시 실제로 호출하는 것과 똑같은 lib 함수 체인
   (saveAnnotation → awardAnnotationCurrency → recordAnnotationQuestProgress,
   saveVote → awardVoteCurrency → recordVoteQuestProgress)을 그대로 호출해서
   실제 Supabase에 대해 검증한다.

   쿼리 파라미터: ?pid=AUDIOTEST_E2E_QUEST&annotations=20&votes=10
───────────────────────────────────────────── */
function TestInner() {
  const params = useSearchParams()
  const pid = params.get('pid') || 'AUDIOTEST_E2E_QUEST'
  const annotationCount = Number(params.get('annotations') || 20)
  const voteCount = Number(params.get('votes') || 10)
  const peekOnly = params.get('mode') === 'peek'

  const [log, setLog] = useState([])
  const [result, setResult] = useState(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const push = (msg) => setLog(l => [...l, msg])

    // 자정 리셋 검증용 — 배정 로직만 호출해서 오늘(또는 강제 변경된 날짜) 상태를
    // 그대로 들여다본다. 전사/투표 제출은 전혀 하지 않는다.
    if (peekOnly) {
      ;(async () => {
        push(`peek 모드 — participant=${pid}, 브라우저 Date=${new Date().toString()}`)
        const quests = await ensureTodayQuests(pid)
        setResult({
          nowDate: new Date().toISOString(),
          quests: quests.map(q => ({
            id: q.quest_template_id, assigned_date: q.assigned_date,
            completed: q.completed, progress: q.progress_count,
          })),
        })
        push('=== 완료(peek) ===')
      })().catch(err => { push('ERROR: ' + (err?.message || String(err))); console.error(err) })
      return
    }

    ;(async () => {
      const client = getClient()
      push(`시작 — participant=${pid}`)

      const before = await getCurrencyBalance(pid)
      push(`시작 잔액: ${before}`)

      const initialQuests = await ensureTodayQuests(pid)
      const categoryQuest = initialQuests.find(q => q.template?.type === 'category_participate')
      const targetSubCategory = categoryQuest?.target_sub_category
      push(`오늘 배정된 퀘스트 ${initialQuests.length}개, 다양성 대상 카테고리: ${targetSubCategory}`)

      const categorySound = soundMetadata.sounds.find(s => s.sub_category === targetSubCategory)

      const zoneOrder = ['Music', 'Animal', 'Human', 'Nature', 'Urban', 'Lab']
      const picks = []

      // 1) 첫 제출 — visit_zone(오늘 첫 Zone 방문) 유도
      const firstSound = soundMetadata.sounds.find(s => s.game_zone === zoneOrder[0])
      if (firstSound) picks.push(firstSound)

      // 2) 다양성 카테고리 매칭 소리
      if (categorySound && !picks.includes(categorySound)) picks.push(categorySound)

      // 3) 나머지는 여러 Zone에서 채워 채집 마일스톤(최대 20) 채우기
      let zi = 1
      let guard = 0
      while (picks.length < annotationCount && guard < 500) {
        const z = zoneOrder[zi % zoneOrder.length]
        const s = soundMetadata.sounds.find(s => s.game_zone === z && !picks.includes(s))
        if (s) picks.push(s)
        zi++; guard++
      }

      for (let i = 0; i < picks.length; i++) {
        const s = picks[i]
        await saveAnnotation({
          participant_id: pid, session_id: 'e2e-test',
          sound_id: s.sound_id, zone: s.game_zone, sub_category: s.sub_category || '',
          expression_text: `테스트표현_${i}`, confidence: 3,
          play_count: 1, listening_time_sec: 3, stage: 1,
          is_verified: false, version: 'v0.4-web-e2e-test',
        })
        await awardAnnotationCurrency({
          participantId: pid, soundId: s.sound_id, subCategory: s.sub_category || '',
          soundDurationSec: 3, confidence: 3,
        })
        await recordAnnotationQuestProgress({ participantId: pid, zone: s.game_zone, subCategory: s.sub_category || '' })
        push(`[전사 ${i + 1}/${picks.length}] zone=${s.game_zone} sub=${s.sub_category}`)
      }

      // 투표 — 다른 참여자의 실제 annotation을 그대로 후보로 사용
      const { data: candidates } = await client
        .from('annotations')
        .select('id, sound_id, zone, sub_category')
        .neq('participant_id', pid)
        .not('expression_text', 'is', null)
        .neq('expression_text', '')
        .limit(voteCount)

      for (let i = 0; i < (candidates || []).length; i++) {
        const c = candidates[i]
        await saveVote({
          participant_id: pid, session_id: 'e2e-test', sound_id: c.sound_id, zone: c.zone,
          voted_ids: [c.id], confidence: 3, play_count: 1, listening_time_sec: 2,
          stage: 2, version: 'v0.4-web-e2e-test',
        })
        await awardVoteCurrency({ participantId: pid, annotationId: c.id, subCategory: c.sub_category || '', soundDurationSec: 2, confidence: 3 })
        await recordVoteQuestProgress({ participantId: pid })
        push(`[투표 ${i + 1}/${candidates.length}] annotation_id=${c.id}`)
      }

      const after = await getCurrencyBalance(pid)
      const finalQuests = await getTodayQuestSummary(pid)
      const { data: txs } = await client.from('currency_transactions').select('*').eq('participant_id', pid)

      setResult({
        before, after, delta: after - before,
        txSum: (txs || []).reduce((sum, t) => sum + t.amount, 0),
        txCount: txs?.length,
        quests: finalQuests.map(q => ({
          id: q.quest_template_id, completed: q.completed, progress: q.progress_count,
          target_sub_category: q.target_sub_category, reward: q.template?.reward_currency,
        })),
        earnQuestTxs: (txs || []).filter(t => t.type === 'earn_quest').map(t => ({ related_id: t.related_id, amount: t.amount })),
      })
      push('=== 완료 ===')
    })().catch(err => {
      push('ERROR: ' + (err?.message || String(err)))
      console.error(err)
    })
  }, [pid, annotationCount, voteCount])

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
      <div id="log">{log.join('\n')}</div>
      <div id="result" data-done={result ? 'true' : 'false'}>{result ? JSON.stringify(result, null, 2) : ''}</div>
    </div>
  )
}

export default function DailyQuestTestPage() {
  return (
    <Suspense fallback={null}>
      <TestInner/>
    </Suspense>
  )
}
