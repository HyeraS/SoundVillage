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
   sound_id별 유효 annotation 수(표현 입력된 것만)를 한 번에 조회 (Museum 진입용).
   예전엔 후보 소리마다 getAnnotationCountForSound()를 순서대로(await) 하나씩 불러서,
   후보가 많을 땐 요청이 수십~수백 개까지 이어져 느려지고 실패도 잦았다(Supabase
   무료 플랜 커넥션 부담 + 응답 지연). 그래서 expression_text 있는 행을 한 번에 다
   받아서 클라이언트에서 sound_id별로 집계하는 방식으로 바꿨었는데, annotations가
   Supabase 기본 max-rows(1000)를 넘어가면서부터 원본 행 자체가 잘려 들어와
   소리별 카운트가 실제보다 훨씬 적게(거의 항상 1로) 집계되는 문제가 생겼다
   (5명이 전사해도 Museum 진입 조건 cnt>=5를 영원히 못 넘김).
   DB에서 group by로 이미 집계된 결과(소리 종류 수만큼의 행)만 받아오는
   RPC(get_annotation_counts_by_sound_id, Supabase SQL Editor에 등록됨)로 교체 —
   1000행 제한과 무관하게 항상 정확하고, 여전히 요청은 1번으로 끝난다.
───────────────────────────────────────────── */
export async function getAnnotationCountsBySoundId() {
  const { data, error } = await getClient().rpc('get_annotation_counts_by_sound_id')
  if (error) return {}
  const counts = {}
  for (const r of (data || [])) counts[r.sound_id] = Number(r.cnt)
  return counts
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
/* ─────────────────────────────────────────────
   참여자의 zone별 + 전체 완료 개수를 한 번에 조회.
   예전엔 zone 6개 + 전체를 따로(총 7개) 동시 요청해서 커넥션을 많이 잡아먹었는데
   (참여자 여러 명이 겹치면 Supabase 무료 플랜 pool이 금방 바닥나 503이 남),
   is_skipped=false인 row의 zone 컬럼만 한 번에 받아서 클라이언트에서 집계한다.
───────────────────────────────────────────── */
export async function getCountsByZone(participantId) {
  const { data, error } = await getClient()
    .from('annotations')
    .select('zone')
    .eq('is_skipped', false)
    .eq('participant_id', participantId)
  if (error) throw error
  const rows = data || []
  const byZone = {}
  for (const r of rows) byZone[r.zone] = (byZone[r.zone] || 0) + 1
  return { total: rows.length, byZone }
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
