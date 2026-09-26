import { createClient } from '@supabase/supabase-js';
import { newOperationKey, persistenceFailure, persistenceSuccess } from '@/lib/persistenceResult';

let _client = null;
export const getClient = () => {
  if (!_client) _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return _client;
};

/* ─────────────────────────────────────────────
   Stage 1: 의성어 저장
───────────────────────────────────────────── */
export async function saveAnnotation(data) {
  const idempotencyKey = data.idempotencyKey || newOperationKey();
  const operationType = data.is_skipped ? 'annotation_skip' : 'annotation_submit';
  const { data: result, error } = await getClient().rpc('submit_annotation_v4', {
    p_idempotency_key: idempotencyKey,
    p_sound_id: data.sound_id,
    p_zone: data.zone,
    p_expression_text: data.expression_text || '',
    p_selected_features: data.selected_features ?? null,
    p_confidence: data.confidence ?? null,
    p_difficulty: data.difficulty ?? null,
    p_play_count: data.play_count ?? 0,
    p_listening_time_sec: data.listening_time_sec ?? 0,
    p_is_skipped: data.is_skipped ?? false,
    p_skip_reason: data.skip_reason || '',
    p_device_info: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    p_stage: data.stage ?? 1,
    p_version: data.version || 'v0.4-web',
  });
  if (error) return persistenceFailure(error, operationType, idempotencyKey);
  return persistenceSuccess(result, operationType, idempotencyKey);
}

/* ─────────────────────────────────────────────
   Stage 2: 투표 저장 (votes 테이블)
   + 해당 annotation의 vote_count 증가
───────────────────────────────────────────── */
export async function saveVote({ sound_id, zone, voted_ids, confidence, play_count, listening_time_sec, stage, version, idempotencyKey: suppliedKey }) {
  const idempotencyKey = suppliedKey || newOperationKey();
  if (!voted_ids || voted_ids.length !== 1) {
    return persistenceFailure(new Error('exactly_one_vote_required'), 'museum_vote', idempotencyKey);
  }
  const { data, error } = await getClient().rpc('submit_museum_vote_v4', {
    p_idempotency_key: idempotencyKey,
    p_sound_id: sound_id,
    p_zone: zone,
    p_annotation_id: voted_ids[0],
    p_confidence: confidence ?? 3,
    p_play_count: play_count ?? 0,
    p_listening_time_sec: listening_time_sec ?? 0,
    p_stage: stage ?? 2,
    p_version: version || 'v0.4-web',
  });
  if (error) return persistenceFailure(error, 'museum_vote', idempotencyKey);
  return persistenceSuccess(data, 'museum_vote', idempotencyKey);
}

/* ─────────────────────────────────────────────
   sound_id 포맷 브리지
   DB에는 구버전 포맷(Forest_066514)이 있고
   현재 코드는 신버전(Animal_66514)을 쓴다.
   숫자 부분(파일번호)만 추출해서 양쪽 포맷을 모두 생성한다.
───────────────────────────────────────────── */
const ALL_ZONE_PREFIXES = [
  'Animal','Human','Nature','Urban','Music','Lab',        // 신버전
  'Forest','Creek','City','Stage','Human_v1',              // 구버전 zone명
  'ANI','HUM','NAT','URB','MUS','LAB',                    // 구버전 약어
]

function soundIdVariants(soundId) {
  const num = parseInt(String(soundId).split('_').pop(), 10)
  if (isNaN(num)) return [soundId]
  const numStr    = String(num)
  const paddedStr = numStr.padStart(6, '0')
  const variants = ALL_ZONE_PREFIXES.flatMap(z => [`${z}_${numStr}`, `${z}_${paddedStr}`])
  variants.push(soundId)
  return [...new Set(variants)]
}

/* ─────────────────────────────────────────────
   Stage 2: 후보 표현 조회
   - 같은 파일번호의 다른 참여자 표현 (구·신 포맷 모두)
   - is_skipped 필터 제거 (expression_text 필터로만 충분)
   - 최대 5개, 투표수와 무관하게 무작위 순서로 반환
     (인기 순으로 보여주면 화면에 표를 안 띄워도 카드 순서 자체가
     편향을 줄 수 있어서, 정렬을 포기하고 매번 섞어서 준다)
───────────────────────────────────────────── */
export async function getCandidateExpressions(soundId, excludeExpression = '') {
  const { data, error } = await getClient().rpc('museum_candidate_expressions_v2', {
    p_sound_id: soundId,
    p_exclude_expression: excludeExpression || null,
    p_limit: 5,
  })

  console.log('[Museum] getCandidateExpressions 결과:', data, '오류:', error)
  if (error) throw error

  const CONF_LABEL = { 1: '매우 약함', 2: '약함', 3: '보통', 4: '강한 동의', 5: '매우동의' }

  const rows = (data || []).map((row) => ({
    id:               row.id,
    expression_text:  row.expression_text,
    vote_count:       row.vote_count ?? 0,
    confidence_label: CONF_LABEL[row.confidence] ?? '보통',
  }))

  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  return rows
}

/* ─────────────────────────────────────────────
   특정 sound의 유효 annotation 수 (표현 입력된 것만)
───────────────────────────────────────────── */
export async function getAnnotationCountForSound(soundId) {
  const variants = soundIdVariants(soundId)
  const { data, error } = await getClient().rpc('museum_annotation_count', {
    p_sound_ids: variants,
  })
  if (error) throw error
  return data ?? 0
}

/* ─────────────────────────────────────────────
   Museum 진입 후보별 annotation 수 일괄 조회
   DB에서 sound_id별로 집계하므로 N+1 요청과 1,000행 제한을 피한다.
───────────────────────────────────────────── */
export async function getMuseumAnnotationCounts() {
  const { data, error } = await getClient().rpc('museum_annotation_counts_v2')
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.canonical_audio_id, Number(row.annotation_count) || 0]))
}

/* ─────────────────────────────────────────────
   어노테이션이 있는 sound_id 목록 (Museum WorldMap 진입용)
   is_skipped 필터 없이 expression_text 있는 것만
───────────────────────────────────────────── */
export async function getAnnotatedSoundIds() {
  const { data, error } = await getClient().rpc('museum_annotated_sound_ids')
  console.log('[Museum] getAnnotatedSoundIds 결과 count=', data?.length, '오류=', error)
  if (error) throw error
  return [...new Set((data || []).map(r => r.sound_id))]
}

/* ─────────────────────────────────────────────
   참여자가 Stage 2(Sound Museum)에서 이미 투표한 sound_id 목록
   — 같은 소리가 Museum에 다시 뜨지 않도록 제외하는 용도
───────────────────────────────────────────── */
export async function getVotedSoundIdsByParticipant(_participantId) {
  const { data, error } = await getClient().rpc('museum_voted_audio_ids_v1')
  if (error) throw error
  return [...new Set((data || []).map(r => r.canonical_audio_id))]
}

/* ─────────────────────────────────────────────
   기타 유틸
───────────────────────────────────────────── */
export async function getCountByZone(zone, participantId) {
  let q = getClient()
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('zone', zone)
    .eq('is_skipped', false)
  if (participantId) q = q.eq('participant_id', participantId)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

/* ─────────────────────────────────────────────
   화폐 시스템: 특정 참여자가 특정 sub_category에서
   지금까지 완료한 전사 개수 (이번 제출 포함) —
   currency_transactions.category_count_at_time 채우는 용도.
   실패해도 화폐 지급 자체가 죽지 않도록 호출부에서 격리한다.
───────────────────────────────────────────── */
export async function getParticipantSubCategoryCount(participantId, subCategory) {
  if (!subCategory) return null
  const { count, error } = await getClient()
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('participant_id', participantId)
    .eq('sub_category', subCategory)
    .eq('is_skipped', false)
  if (error) {
    console.error('[supabase] getParticipantSubCategoryCount 오류:', error)
    throw error
  }
  return count ?? 0
}

/* ─────────────────────────────────────────────
   블록 퀘스트: 특정 참여자가 특정 zone에서
   실제로 전사를 완료한 sound_id 목록
   건너뛴(is_skipped) 소리는 미완료로 취급 — 블록 진행에도
   반영되지 않고, ZoneMap에서 계속 재시도 가능해야 하므로 제외
───────────────────────────────────────────── */
export async function getAnnotatedByParticipantZone(participantId, zone) {
  void participantId
  const { data, error } = await getClient().rpc('get_my_completed_audio_v1', { p_zone: zone })
  if (error) throw error
  return [...new Set((data || []).map(r => r.canonical_audio_id))]
}

export async function getMyExperimentProgress() {
  const { data, error } = await getClient().rpc('get_my_experiment_progress_v1')
  if (error) throw error
  return data
}

export async function getTotalCount(participantId) {
  let q = getClient()
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('is_skipped', false)
  if (participantId) q = q.eq('participant_id', participantId)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}
