export const QA_QUEST_FIXTURE = Object.freeze([
  Object.freeze({ id:'qa-quest-collect', completed:false, template:Object.freeze({ description:'자연의 소리 3개 수집하기', reward_currency:3 }) }),
  Object.freeze({ id:'qa-quest-visit', completed:true, template:Object.freeze({ description:'오늘의 마을 한 곳 방문하기', reward_currency:2 }) }),
  Object.freeze({ id:'qa-quest-vote', completed:false, template:Object.freeze({ description:'Sound Library에서 표현 1개 고르기', reward_currency:2 }) }),
])

export const QA_ATTENDANCE_FIXTURE = Object.freeze({
  attendanceDay:3,
  claims:Object.freeze([
    Object.freeze({ day:1, amount:2 }),
    Object.freeze({ day:2, amount:2 }),
  ]),
  templates:Object.freeze([
    Object.freeze({ day_index:1, description:'1일차 보상', reward_currency:2 }),
    Object.freeze({ day_index:2, description:'2일차 보상', reward_currency:2 }),
    Object.freeze({ day_index:3, description:'3일차 보상', reward_currency:2 }),
    Object.freeze({ day_index:4, description:'4일차 보상', reward_currency:3 }),
    Object.freeze({ day_index:5, description:'5일차 보상', reward_currency:3 }),
    Object.freeze({ day_index:6, description:'6일차 보상', reward_currency:4 }),
    Object.freeze({ day_index:7, description:'7일차 보상', reward_currency:5 }),
  ]),
})

const NETWORK_PATTERN = /FAILED TO FETCH|FETCH FAILED|NETWORK|ECONN|ENOTFOUND|TIMEOUT|ABORT/i
const AUTH_PATTERN = /JWT|AUTH|SESSION_REQUIRED|PARTICIPANT_(?:NOT_CLAIMED|SESSION_REQUIRED|INACTIVE)|PGRST301|401|403/i

export function rewardFailure(error, fallbackCode = 'database_error') {
  const signal = `${error?.code || ''} ${error?.message || ''}`
  const code = AUTH_PATTERN.test(signal)
    ? 'auth_required'
    : NETWORK_PATTERN.test(signal) || error instanceof TypeError
      ? 'network_error'
      : fallbackCode
  return {
    ok:false,
    code,
    retryable:code === 'network_error' || code === 'database_error',
  }
}

export function rewardRuntimePolicy(runtimeState) {
  if (['legacy','preview','cutover'].includes(runtimeState)) {
    return {
      canRead:true,
      canClaimLegacyAttendance:runtimeState === 'legacy' || runtimeState === 'preview',
      canClaimEconomyAttendance:runtimeState === 'cutover',
      code:'ready',
    }
  }
  if (runtimeState === 'maintenance') {
    return { canRead:false, canClaimLegacyAttendance:false, canClaimEconomyAttendance:false, code:'maintenance' }
  }
  if (runtimeState === 'blocked') {
    return { canRead:false, canClaimLegacyAttendance:false, canClaimEconomyAttendance:false, code:'blocked' }
  }
  return { canRead:false, canClaimLegacyAttendance:false, canClaimEconomyAttendance:false, code:'runtime_pending' }
}

export function panelStateFromResult(result) {
  if (!result?.ok) return { status:'error', code:result?.code || 'database_error', data:null }
  if (Array.isArray(result.data) && result.data.length === 0) return { status:'empty', code:'empty', data:[] }
  return { status:'ready', code:'success', data:result.data }
}

export function claimQaAttendance(claimed) {
  if (claimed) return { claimed:true, awarded:false }
  return { claimed:true, awarded:true }
}

export function createRewardRequestCoordinator({ reuseMs = 1_000, now = () => Date.now() } = {}) {
  const requests = new Map()
  return {
    run(key, task, { force = false } = {}) {
      const existing = requests.get(key)
      if (!force && existing && (existing.pending || now() - existing.settledAt < reuseMs)) return existing.promise
      const entry = { pending:true, settledAt:0, promise:null }
      entry.promise = Promise.resolve().then(task)
      requests.set(key, entry)
      entry.promise.then(
        () => { entry.pending = false; entry.settledAt = now() },
        () => { entry.pending = false; entry.settledAt = now() },
      )
      return entry.promise
    },
    clear(key) {
      requests.delete(key)
    },
  }
}
