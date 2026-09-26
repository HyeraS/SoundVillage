import { getClient } from '@/lib/supabase';
import { getOrCreateOperationKey, persistenceFailure, persistenceSuccess } from '@/lib/persistenceResult';

// participantId는 기존 UI 호출부와 호환을 위해 남겨 두지만, DB 함수는 JWT와
// study_participants 매핑으로 실제 참가자를 결정한다.
export async function ensureTodayCheckIn(participantId) {
  const operationType = 'attendance_claim';
  // The DB resolves the KST study date and scopes the operation type by that
  // date. Reusing this participant-scoped key therefore remains safe across days.
  const idempotencyKey = getOrCreateOperationKey(`${operationType}:${participantId}`);
  const { data, error } = await getClient().rpc('ensure_today_check_in_v4', { p_idempotency_key: idempotencyKey });
  if (error) {
    return persistenceFailure(error, operationType, idempotencyKey);
  }
  return persistenceSuccess(data || { row: null, isNew: false }, operationType, idempotencyKey);
}

export async function getAttendanceStatus(_participantId) {
  const { data, error } = await getClient().rpc('get_attendance_status');
  if (error) {
    console.error('[attendance] getAttendanceStatus 실패:', error);
    throw error;
  }
  if (!data) throw new Error('PARTICIPANT_NOT_CLAIMED');
  return data;
}
