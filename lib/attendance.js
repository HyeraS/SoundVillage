import { getClient } from '@/lib/supabase';
import { getOrCreateOperationKey, persistenceSuccess } from '@/lib/persistenceResult';
import { rewardFailure } from '@/lib/rewardReliability.mjs';

// participantId는 기존 UI 호출부와 호환을 위해 남겨 두지만, DB 함수는 JWT와
// study_participants 매핑으로 실제 참가자를 결정한다.
export async function ensureTodayCheckIn(participantId) {
  const operationType = 'attendance_claim';
  // The DB resolves the KST study date and scopes the operation type by that
  // date. Reusing this participant-scoped key therefore remains safe across days.
  const idempotencyKey = getOrCreateOperationKey(`${operationType}:${participantId}`);
  const client = getClient();
  try {
    const { data: auth, error: authError } = await client.auth.getSession();
    if (authError || !auth.session) {
      const failure = rewardFailure(authError || new Error('AUTH_REQUIRED'));
      return { ...failure, error:{ code:failure.code, retryable:failure.retryable }, operationType, idempotencyKey };
    }
    const { data, error } = await client.rpc('ensure_today_check_in_v4', { p_idempotency_key: idempotencyKey });
    if (error) {
      const failure = rewardFailure(error);
      return { ...failure, error:{ code:failure.code, retryable:failure.retryable }, operationType, idempotencyKey };
    }
    return persistenceSuccess(data || { row: null, isNew: false }, operationType, idempotencyKey);
  } catch (error) {
    const failure = rewardFailure(error);
    return { ...failure, error:{ code:failure.code, retryable:failure.retryable }, operationType, idempotencyKey };
  }
}

export async function getAttendanceStatus(_participantId) {
  const client = getClient();
  try {
    const { data: auth, error: authError } = await client.auth.getSession();
    if (authError || !auth.session) return rewardFailure(authError || new Error('AUTH_REQUIRED'));
    const { data, error } = await client.rpc('get_attendance_status');
    if (error) return rewardFailure(error);
    if (!data) return rewardFailure(new Error('PARTICIPANT_NOT_CLAIMED'));
    return { ok:true, code:'success', retryable:false, data };
  } catch (error) {
    return rewardFailure(error);
  }
}
