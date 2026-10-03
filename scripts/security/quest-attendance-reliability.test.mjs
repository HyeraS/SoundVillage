import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  QA_ATTENDANCE_FIXTURE,
  QA_QUEST_FIXTURE,
  claimQaAttendance,
  createRewardRequestCoordinator,
  panelStateFromResult,
  rewardFailure,
  rewardRuntimePolicy,
} from '../../lib/rewardReliability.mjs'

const read = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')
const ui = read('components/world-map/WorldMapUI.js')
const world = read('components/WorldMap.js')
const page = read('app/page.js')
const quests = read('lib/dailyQuests.js')
const attendance = read('lib/rewardRuntime.client.js')

test('QA fixtures are deterministic, complete, and browser-memory-only', () => {
  assert.equal(QA_QUEST_FIXTURE.length, 3)
  assert.equal(QA_ATTENDANCE_FIXTURE.templates.length, 7)
  assert.equal(QA_ATTENDANCE_FIXTURE.attendanceDay, 3)
  assert.deepEqual(claimQaAttendance(false), { claimed:true, awarded:true })
  assert.deepEqual(claimQaAttendance(true), { claimed:true, awarded:false })
  assert.match(ui, /if \(dryRun \|\| !policy\.canRead\) return/)
  assert.match(page, /qaAttendanceClaimed/)
  assert.match(page, /onDryRunAttendanceClaim=\{\(\) => setQaAttendanceClaimed\(true\)\}/)
  assert.match(world, /onQaClaim=\{onDryRunAttendanceClaim\}/)
  assert.doesNotMatch(ui, /onQaClaim[^\n]+(?:rpc|fetch|onClaim)/)
  assert.match(ui, /미리보기 · 실제 데이터와 보상은 변경되지 않음/)
})

test('expected quest and attendance failures are structured without console errors', () => {
  assert.deepEqual(rewardFailure(new TypeError('Failed to fetch')), { ok:false, code:'network_error', retryable:true })
  assert.deepEqual(rewardFailure({ code:'PGRST301', message:'JWT expired' }), { ok:false, code:'auth_required', retryable:false })
  assert.deepEqual(rewardFailure({ code:'XX000', message:'storage unavailable' }), { ok:false, code:'database_error', retryable:true })
  assert.deepEqual(panelStateFromResult({ ok:true, data:[] }), { status:'empty', code:'empty', data:[] })
  assert.deepEqual(panelStateFromResult({ ok:false, code:'auth_required' }), { status:'error', code:'auth_required', data:null })
  assert.doesNotMatch(quests, /console\.error/)
  assert.doesNotMatch(attendance, /console\.error/)
  assert.doesNotMatch(page.slice(page.indexOf('// 출석 체크인'), page.indexOf('// Museum 관람')), /console\.error|throw new Error/)
})

test('legacy, preview, cutover, maintenance, blocked, and pending policies are explicit', () => {
  assert.deepEqual(rewardRuntimePolicy('legacy'), { canRead:true, canClaimLegacyAttendance:true, canClaimEconomyAttendance:false, code:'ready' })
  assert.deepEqual(rewardRuntimePolicy('preview'), { canRead:true, canClaimLegacyAttendance:true, canClaimEconomyAttendance:false, code:'ready' })
  assert.deepEqual(rewardRuntimePolicy('cutover'), { canRead:true, canClaimLegacyAttendance:false, canClaimEconomyAttendance:true, code:'ready' })
  assert.equal(rewardRuntimePolicy('maintenance').code, 'maintenance')
  assert.equal(rewardRuntimePolicy('blocked').code, 'blocked')
  assert.equal(rewardRuntimePolicy('unknown').code, 'runtime_pending')
  assert.equal(rewardRuntimePolicy('maintenance').canRead, false)
  assert.equal(rewardRuntimePolicy('blocked').canClaimEconomyAttendance, false)
})

test('Strict Mode-style duplicate loads coalesce while an explicit retry starts once', async () => {
  let now = 100
  let calls = 0
  let release
  const coordinator = createRewardRequestCoordinator({ reuseMs:1_000, now:() => now })
  const task = () => {
    calls += 1
    return new Promise((resolve) => { release = resolve })
  }
  const first = coordinator.run('quest:a:legacy', task)
  const strictRemount = coordinator.run('quest:a:legacy', task)
  assert.equal(first, strictRemount)
  assert.equal(calls, 0)
  await Promise.resolve()
  assert.equal(calls, 1)
  release({ ok:true, data:[1] })
  await first
  now += 10
  assert.equal(await coordinator.run('quest:a:legacy', task), await first)
  assert.equal(calls, 1)
  const retry = coordinator.run('quest:a:legacy', () => { calls += 1; return { ok:true, data:[2] } }, { force:true })
  assert.deepEqual(await retry, { ok:true, data:[2] })
  assert.equal(calls, 2)
})

test('retry, unmount, and mutation guards are present on both panels', () => {
  assert.match(ui, /if \(pendingRef\.current\) return/g)
  assert.match(ui, /return \(\) => \{ active = false \}/g)
  assert.match(ui, /if \(active\) setState/g)
  assert.match(ui, /runtimeState !== 'cutover'/)
  assert.match(page, /localQaRef\.current/)
  assert.match(page, /economy\.effectiveMainMode !== 'legacy'/)
  assert.match(page, /return \(\) => \{ active = false \}/)
})

test('participant IDs remain compatibility inputs and never become reward authority', () => {
  assert.match(quests, /getTodayQuestSummary\(_participantId\)/)
  assert.match(attendance, /getAttendanceStatusSafe\(_participantId\)/)
  assert.match(quests, /client\.auth\.getSession\(\)/)
  assert.match(attendance, /client\.auth\.getSession\(\)/)
  assert.doesNotMatch(quests, /p_participant|participant_id/)
  assert.doesNotMatch(attendance, /p_participant|participant_id/)
})
