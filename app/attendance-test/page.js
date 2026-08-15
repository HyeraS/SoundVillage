'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ensureTodayCheckIn, getAttendanceStatus } from '@/lib/attendance'
import { getCurrencyBalance } from '@/lib/currency'
import { getClient } from '@/lib/supabase'

/* ─────────────────────────────────────────────
   격리된 출석 보상 E2E 테스트 하네스 — daily-quest-test와 같은 패턴.
   실제 게임 흐름(app/page.js, WorldMap)은 전혀 건드리지 않고, WorldMap
   진입 시 app/page.js가 실제로 호출하는 것과 똑같은 lib/attendance.js
   함수를 그대로 호출해서 실제 Supabase에 대해 검증한다.

   쿼리 파라미터:
   - ?pid=AUDIOTEST_E2E_ATTEND (기본값)
   - ?mode=checkin (기본) — ensureTodayCheckIn 1회 호출 + 현재 상태 표시
   - ?mode=peek — 체크인 없이 getAttendanceStatus만 조회(자정/스트릭 리셋
     검증용, 브라우저 Date를 강제로 바꾼 뒤 재방문해서 확인하는 시나리오)
   - ?mode=cleanup — 이 pid의 participant_attendance/currency_transactions
     (type=earn_attendance) 행을 service-role 없이는 못 지우므로, 삭제
     대상 개수만 세어서 보여줌(실제 삭제는 Supabase SQL Editor에서 수행)
───────────────────────────────────────────── */
function TestInner() {
  const params = useSearchParams()
  const pid = params.get('pid') || 'AUDIOTEST_E2E_ATTEND'
  const mode = params.get('mode') || 'checkin'

  const [log, setLog] = useState([])
  const [result, setResult] = useState(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const push = (msg) => setLog(l => [...l, msg])

    ;(async () => {
      push(`시작 — participant=${pid}, mode=${mode}, 브라우저 Date=${new Date().toString()}`)

      if (mode === 'cleanup') {
        const client = getClient()
        const { count: attendCount } = await client
          .from('participant_attendance').select('*', { count: 'exact', head: true })
          .eq('participant_id', pid)
        const { count: txCount } = await client
          .from('currency_transactions').select('*', { count: 'exact', head: true })
          .eq('participant_id', pid).eq('type', 'earn_attendance')
        push(`participant_attendance ${attendCount ?? 0}행, earn_attendance 거래 ${txCount ?? 0}행 — 삭제는 Supabase SQL Editor에서 수행할 것`)
        setResult({ attendCount, txCount })
        push('=== 완료(cleanup 조회) ===')
        return
      }

      if (mode === 'peek') {
        const status = await getAttendanceStatus(pid)
        setResult(status)
        push(`오늘 상태: ${status.today ? `streak_day=${status.today.streak_day}, reward=${status.today.reward_currency}` : '아직 출석 안 함'}`)
        push('=== 완료(peek) ===')
        return
      }

      const before = await getCurrencyBalance(pid)
      push(`체크인 전 잔액: ${before}`)

      const { row, isNew } = await ensureTodayCheckIn(pid)
      push(`ensureTodayCheckIn 결과: isNew=${isNew}, streak_day=${row?.streak_day}, reward=${row?.reward_currency}`)

      // 같은 날 두 번째 호출 — 중복 지급 방지 확인
      const second = await ensureTodayCheckIn(pid)
      push(`재호출(같은 날) 결과: isNew=${second.isNew} (false여야 정상, 중복 지급 없음)`)

      const after = await getCurrencyBalance(pid)
      push(`체크인 후 잔액: ${after} (증가분 ${after - before})`)

      const status = await getAttendanceStatus(pid)
      setResult({ before, after, delta: after - before, checkIn: row, status })
      push('=== 완료 ===')
    })().catch(err => { push('ERROR: ' + (err?.message || String(err))); console.error(err) })
  }, [pid, mode])

  return (
    <div style={{ padding: '24px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
      <h2>출석 보상 E2E 테스트 — pid={pid}, mode={mode}</h2>
      <div style={{ marginBottom: '16px' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      {result && (
        <pre style={{ background: '#f0f0f0', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function AttendanceTestPage() {
  return (
    <Suspense fallback={<div>로딩...</div>}>
      <TestInner />
    </Suspense>
  )
}
