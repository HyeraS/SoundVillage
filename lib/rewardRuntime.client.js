'use client'

import { getClient } from '@/lib/supabase'
import { getOrCreateOperationKey } from '@/lib/persistenceResult'
import { rewardFailure } from '@/lib/rewardReliability.mjs'

async function requireRewardSession(client) {
  try {
    const { data, error } = await client.auth.getSession()
    if (error || !data.session) return { failure:rewardFailure(error || new Error('AUTH_REQUIRED')) }
    return { session:data.session }
  } catch (error) {
    return { failure:rewardFailure(error) }
  }
}

export async function getAttendanceStatusSafe(_participantId) {
  const client = getClient()
  const auth = await requireRewardSession(client)
  if (auth.failure) return auth.failure
  try {
    const { data, error } = await client.rpc('get_attendance_status')
    if (error) return rewardFailure(error)
    if (!data) return rewardFailure(new Error('PARTICIPANT_NOT_CLAIMED'))
    return { ok:true, code:'success', retryable:false, data }
  } catch (error) {
    return rewardFailure(error)
  }
}

export async function ensureTodayCheckInSafe(participantId) {
  const operationType = 'attendance_claim'
  const idempotencyKey = getOrCreateOperationKey(`${operationType}:${participantId}`)
  const client = getClient()
  const auth = await requireRewardSession(client)
  if (auth.failure) {
    return { ...auth.failure, error:{ code:auth.failure.code, retryable:auth.failure.retryable }, operationType, idempotencyKey }
  }
  try {
    const { data, error } = await client.rpc('ensure_today_check_in_v4', { p_idempotency_key:idempotencyKey })
    if (error) {
      const failure = rewardFailure(error)
      return { ...failure, error:{ code:failure.code, retryable:failure.retryable }, operationType, idempotencyKey }
    }
    return { ok:true, code:'success', retryable:false, data:data || { row:null, isNew:false }, operationType, idempotencyKey }
  } catch (error) {
    const failure = rewardFailure(error)
    return { ...failure, error:{ code:failure.code, retryable:failure.retryable }, operationType, idempotencyKey }
  }
}
