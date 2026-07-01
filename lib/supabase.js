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
export async function saveVote({ participant_id, session_id, sound_id, zone, voted_ids, play_count, listening_time_sec, stage, version }) {
  if (!voted_ids || voted_ids.length === 0) return;

  // votes 테이블에 각 투표 insert
  const rows = voted_ids.map((annotation_id) => ({
    participant_id,
    session_id,
    sound_id,
    zone,
    annotation_id,
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
   - 최대 6개, vote_count DESC
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
  const { data, error } = await query
    .order('vote_count', { ascending: false })
    .limit(5)

  console.log('[Museum] getCandidateExpressions 결과:', data, '오류:', error)
  if (error) throw error

  const CONF_LABEL = { 1: '자신감 낮음', 2: '보통', 3: '보통', 4: '자신감 높음', 5: '매우 자신 있음' }

  return (data || []).map((row) => ({
    id:               row.id,
    expression_text:  row.expression_text,
    vote_count:       row.vote_count ?? 0,
    confidence_label: CONF_LABEL[row.confidence] ?? '보통',
  }))
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
   기타 유틸
───────────────────────────────────────────── */
export async function getCountByZone(zone) {
  const { count, error } = await getClient()
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('zone', zone)
    .eq('is_skipped', false);
  if (error) throw error;
  return count ?? 0;
}

export async function getTotalCount() {
  const { count, error } = await getClient()
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('is_skipped', false);
  if (error) throw error;
  return count ?? 0;
}