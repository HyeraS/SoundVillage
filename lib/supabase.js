import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnon);

/* ─────────────────────────────────────────────
   Stage 1: 의성어 저장
───────────────────────────────────────────── */
export async function saveAnnotation(data) {
  const { error } = await supabase.from('annotations').insert([{
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

  const { error: voteError } = await supabase.from('votes').insert(rows);
  if (voteError) throw voteError;

  // annotations 테이블의 vote_count 일괄 증가 (RPC 사용)
  for (const id of voted_ids) {
    await supabase.rpc('increment_vote_count', { annotation_id: id });
  }
}

/* ─────────────────────────────────────────────
   Stage 2: 후보 표현 조회
   - 같은 sound_id의 다른 참여자 표현
   - is_skipped=false, expression_text 있음
   - 최대 6개, vote_count DESC
───────────────────────────────────────────── */
export async function getCandidateExpressions(soundId, excludeExpression = '') {
  const { data, error } = await supabase
    .from('annotations')
    .select('id, expression_text, confidence, vote_count')
    .eq('sound_id', soundId)
    .eq('is_skipped', false)
    .eq('stage', 1)
    .neq('expression_text', '')
    .neq('expression_text', excludeExpression)
    .order('vote_count', { ascending: false })
    .limit(6);

  if (error) throw error;

  const CONF_LABEL = { 1: '자신감 낮음', 2: '보통', 3: '보통', 4: '자신감 높음', 5: '매우 자신 있음' };

  return (data || []).map((row) => ({
    id:               row.id,
    expression_text:  row.expression_text,
    vote_count:       row.vote_count ?? 0,
    confidence_label: CONF_LABEL[row.confidence] ?? '보통',
  }));
}

/* ─────────────────────────────────────────────
   기타 유틸
───────────────────────────────────────────── */
export async function getCountByZone(zone) {
  const { count, error } = await supabase
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('zone', zone)
    .eq('is_skipped', false);
  if (error) throw error;
  return count ?? 0;
}

export async function getTotalCount() {
  const { count, error } = await supabase
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('is_skipped', false);
  if (error) throw error;
  return count ?? 0;
}