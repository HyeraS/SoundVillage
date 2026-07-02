import { createClient } from '@supabase/supabase-js';

let _client = null;
const getClient = () => {
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
  const { error } = await getClient().from('annotations').insert([{
    participant_id:     data.participant_id,
    session_id:         data.session_id,
    sound_id:           data.sound_id,
    zone:               data.zone,
    sub_category:       data.sub_category      ?? '',
    expression_text:    data.expression_text   ?? '',
    selected_features:  data.selected_features ?? [],
    confidence:         data.confidence        ?? 3,
    difficulty:         data.difficulty        ?? 3,
    play_count:         data.play_count        ?? 0,
    listening_time_sec: data.listening_time_sec ?? 0,
    is_skipped:         data.is_skipped        ?? false,
    skip_reason:        data.skip_reason       ?? '',
    device_info:        navigator?.userAgent   ?? '',
    stage:              data.stage             ?? 1,
    is_verified:        data.is_verified       ?? false,
    vote_count:         0,
    version:            data.version           ?? 'v0.4-web',
  }]);
  if (error) {
    console.error('[supabase] saveAnnotation 오류:', error);
    throw error;
  }
}

/* ─────────────────────────────────────────────
   Stage 2: 투표 저장 (votes 테이블)
   + 해당 annotation의 vote_count 증가
───────────────────────────────────────────── */
export async function saveVote({ participant_id, session_id, sound_id, zone, voted_ids, confidence, play_count, listening_time_sec, stage, version }) {
  if (!voted_ids || voted_ids.length === 0) return;

  // votes 테이블에 각 투표 insert
  const rows = voted_ids.map((annotation_id) => ({
    participant_id,
    session_id,
    sound_id,
    zone,
    annotation_id,
    confidence:        confidence        ?? 3,
    play_count:        play_count        ?? 0,
    listening_time_sec: listening_time_sec ?? 0,
    stage:             stage             ?? 2,
    version:           version           ?? 'v0.4-web',
    created_at:        new Date().toISOString(),
  }));

  const { error: voteError } = await getClient().from('votes').insert(rows);
  if (voteError) throw voteError;

  // annotations 테이블의 vote_count 일괄 증가 (RPC 사용)
  for (const id of voted_ids) {
    await getClient().rpc('increment_vote_count', { annotation_id: id });
  }
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
  const variants = soundIdVariants(soundId)
  console.log('[Museum] getCandidateExpressions 호출 soundId=', soundId, 'variants=', variants)

  let query = getClient()
    .from('annotations')
    .select('id, expression_text, confidence, vote_count')
    .in('sound_id', variants)
    .not('expression_text', 'is', null)
    .neq('expression_text', '')
  if (excludeExpression) query = query.neq('expression_text', excludeExpression)
  const { data, error } = await query.limit(5)

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
  const { count, error } = await getClient()
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .in('sound_id', variants)
    .not('expression_text', 'is', null)
    .neq('expression_text', '')
  if (error) return 0
  return count ?? 0
}

/* ─────────────────────────────────────────────
   어노테이션이 있는 sound_id 목록 (Museum WorldMap 진입용)
   is_skipped 필터 없이 expression_text 있는 것만
───────────────────────────────────────────── */
export async function getAnnotatedSoundIds() {
  const { data, error } = await getClient()
    .from('annotations')
    .select('sound_id')
    .not('expression_text', 'is', null)
    .neq('expression_text', '')
  console.log('[Museum] getAnnotatedSoundIds 결과 count=', data?.length, '오류=', error)
  if (error) return []
  return [...new Set((data || []).map(r => r.sound_id))]
}

/* ─────────────────────────────────────────────
   참여자가 Stage 2(Sound Museum)에서 이미 투표한 sound_id 목록
   — 같은 소리가 Museum에 다시 뜨지 않도록 제외하는 용도
───────────────────────────────────────────── */
export async function getVotedSoundIdsByParticipant(participantId) {
  const { data, error } = await getClient()
    .from('votes')
    .select('sound_id')
    .eq('participant_id', participantId)
  if (error) return []
  return [...new Set((data || []).map(r => r.sound_id))]
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
   블록 퀘스트: 특정 참여자가 특정 zone에서
   실제로 전사를 완료한 sound_id 목록
   건너뛴(is_skipped) 소리는 미완료로 취급 — 블록 진행에도
   반영되지 않고, ZoneMap에서 계속 재시도 가능해야 하므로 제외
───────────────────────────────────────────── */
export async function getAnnotatedByParticipantZone(participantId, zone) {
  const { data, error } = await getClient()
    .from('annotations')
    .select('sound_id')
    .eq('participant_id', participantId)
    .eq('zone', zone)
    .eq('is_skipped', false)
  if (error) return []
  return [...new Set((data || []).map(r => r.sound_id))]
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