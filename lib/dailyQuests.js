import { getClient } from '@/lib/supabase';
import { awardQuestCurrency } from '@/lib/currency';
import soundMetadata from '@/data/sound_metadata.json';

/* ─────────────────────────────────────────────
   일일 퀘스트 — 배정/진행도/보상. annotations/votes/블록잠금/기존
   화폐 로직은 절대 건드리지 않는 완전히 격리된 부가 기능. 모든 공개
   함수는 내부에서 절대 throw하지 않는다(호출부의 기존 저장 흐름을
   막지 않기 위해 — awardCurrency와 동일한 원칙).
───────────────────────────────────────────── */

// getDailyDeal()(lib/shopCatalog.js)과 동일한 "오늘" 기준(UTC 날짜 키).
function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function dayRange(dateKey) {
  return {
    start: `${dateKey}T00:00:00.000Z`,
    end:   `${dateKey}T23:59:59.999Z`,
  };
}

const ALL_SUB_CATEGORIES = [...new Set(
  (soundMetadata.sounds || []).map(s => s.sub_category).filter(Boolean)
)];

/* ─────────────────────────────────────────────
   참여자의 sub_category별 완료(전사) 이력을 세서, 지금까지 가장 적게
   참여한 카테고리를 하나 고른다. 카테고리 자체 목록은 sound_metadata의
   전체 카탈로그 기준 — 참여자가 아직 한 번도 안 한 카테고리(count=0)도
   후보에 포함되도록 하기 위함.
───────────────────────────────────────────── */
async function pickLeastParticipatedCategory(participantId) {
  const { data, error } = await getClient()
    .from('annotations')
    .select('sub_category')
    .eq('participant_id', participantId)
    .eq('is_skipped', false);
  if (error) {
    console.error('[dailyQuests] pickLeastParticipatedCategory 오류:', error);
    return ALL_SUB_CATEGORIES[0] ?? null;
  }

  const counts = {};
  ALL_SUB_CATEGORIES.forEach(c => { counts[c] = 0; });
  (data || []).forEach(r => { if (r.sub_category in counts) counts[r.sub_category] += 1; });

  let min = null;
  for (const c of ALL_SUB_CATEGORIES) {
    if (min === null || counts[c] < counts[min]) min = c;
  }
  return min;
}

/* ─────────────────────────────────────────────
   오늘의 퀘스트를 보장 + 템플릿과 함께 조회. 없으면 배정(insert),
   있으면 그대로 반환. category_participate는 배정 시점에만
   target_sub_category를 고정한다(이미 배정된 뒤엔 안 바뀜).
───────────────────────────────────────────── */
export async function ensureTodayQuests(participantId) {
  const assignedDate = todayDateKey();
  const client = getClient();

  const fetchExisting = async () => {
    const { data, error } = await client
      .from('participant_daily_quests')
      .select('*, template:daily_quest_templates(*)')
      .eq('participant_id', participantId)
      .eq('assigned_date', assignedDate);
    if (error) throw error;
    return data || [];
  };

  try {
    const { data: templates, error: tErr } = await client
      .from('daily_quest_templates')
      .select('*')
      .eq('active', true);
    if (tErr) throw tErr;

    const existing = await fetchExisting();
    const existingIds = new Set(existing.map(r => r.quest_template_id));
    const missing = (templates || []).filter(t => !existingIds.has(t.id));
    if (missing.length === 0) return existing;

    let targetSubCategory = null;
    if (missing.some(t => t.type === 'category_participate')) {
      targetSubCategory = await pickLeastParticipatedCategory(participantId);
    }

    const rows = missing.map(t => ({
      participant_id:      participantId,
      quest_template_id:   t.id,
      assigned_date:        assignedDate,
      target_sub_category:  t.type === 'category_participate' ? targetSubCategory : null,
    }));

    const { error: iErr } = await client
      .from('participant_daily_quests')
      .insert(rows);

    if (iErr) {
      // 동시 호출(예: React StrictMode의 개발 모드 이펙트 이중 실행)로 다른
      // 요청이 같은 row를 먼저 insert했을 수 있음 — UNIQUE(participant_id,
      // quest_template_id, assigned_date) 충돌(23505/409). 실패로 보지 않고
      // 최신 상태를 다시 읽어서 반환한다(그 요청이 이미 배정을 끝냈을 것).
      if (iErr.code !== '23505') throw iErr;
      console.log('[dailyQuests] 동시 배정 충돌 감지 — 최신 상태 재조회로 복구');
    }

    return await fetchExisting();
  } catch (err) {
    console.error('[dailyQuests] ensureTodayQuests 실패:', err);
    return [];
  }
}

/* ─────────────────────────────────────────────
   구간 하나를 최신 진행값으로 갱신하고, 이번에 처음 완료됐다면 보상 지급.
   progress_count는 항상 "현재 시점의 절대 누적값"을 그대로 덮어쓴다
   (증분이 아님) — 소스오브트루스(annotations/votes 카운트)에서 계산한
   값을 매번 다시 쓰는 방식이라 별도 원자적 증가 없이도 lost-update가
   생기지 않는다. eq('completed', false)로 이미 완료된 row는 건드리지
   않고, 혹시 동시 호출로 두 번 완료 판정이 나도 currency_transactions의
   UNIQUE(participant_id, related_id, type)가 중복지급을 최종 방어한다.
───────────────────────────────────────────── */
async function advanceQuest(questRow, newProgress) {
  const template = questRow.template;
  if (!template || questRow.completed) return;

  const client = getClient();
  const nowCompleted = newProgress >= template.target_count;
  const patch = { progress_count: newProgress };
  if (nowCompleted) {
    patch.completed = true;
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await client
    .from('participant_daily_quests')
    .update(patch)
    .eq('id', questRow.id)
    .eq('completed', false);
  if (error) {
    console.error('[dailyQuests] advanceQuest 갱신 오류:', error);
    return;
  }

  if (nowCompleted) {
    await awardQuestCurrency({
      participantId: questRow.participant_id,
      questRowId:    questRow.id,
      amount:        template.reward_currency,
    });
  }
}

async function isFirstZoneVisitToday(participantId, zone, start, end) {
  const { count, error } = await getClient()
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('participant_id', participantId)
    .eq('zone', zone)
    .eq('is_skipped', false)
    .gte('created_at', start)
    .lte('created_at', end);
  if (error) {
    console.error('[dailyQuests] isFirstZoneVisitToday 오류:', error);
    return false;
  }
  return (count ?? 0) === 1;
}

/* ─────────────────────────────────────────────
   Stage 1 제출(전사) 성공 후 호출. 채집 마일스톤(3구간) + 다양성
   퀘스트(오늘 첫 Zone 방문 / 최소참여 카테고리) 진행을 갱신한다.
   AnnotationPanel의 기존 저장 흐름과 완전히 분리 — await 없이 호출되고
   내부에서 절대 throw하지 않는다.
───────────────────────────────────────────── */
export async function recordAnnotationQuestProgress({ participantId, zone, subCategory }) {
  try {
    const assignedDate = todayDateKey();
    const { start, end } = dayRange(assignedDate);
    const quests = await ensureTodayQuests(participantId);
    if (quests.length === 0) return;

    const { count: totalToday, error: cErr } = await getClient()
      .from('annotations')
      .select('*', { count: 'exact', head: true })
      .eq('participant_id', participantId)
      .eq('is_skipped', false)
      .gte('created_at', start)
      .lte('created_at', end);
    if (cErr) throw cErr;

    for (const q of quests) {
      if (q.completed || !q.template) continue;
      const t = q.template;

      if (t.type === 'collect_milestone') {
        await advanceQuest(q, totalToday ?? 0);
      } else if (t.type === 'visit_zone') {
        if (await isFirstZoneVisitToday(participantId, zone, start, end)) {
          await advanceQuest(q, t.target_count);
        }
      } else if (t.type === 'category_participate') {
        if (q.target_sub_category && subCategory === q.target_sub_category) {
          await advanceQuest(q, t.target_count);
        }
      }
    }
  } catch (err) {
    console.error('[dailyQuests] recordAnnotationQuestProgress 실패 (게임 흐름에는 영향 없음):', err);
  }
}

/* ─────────────────────────────────────────────
   Stage 2 투표(SoundMuseum) 제출 성공 후 호출. 투표 퀘스트 진행 갱신.
───────────────────────────────────────────── */
export async function recordVoteQuestProgress({ participantId }) {
  try {
    const assignedDate = todayDateKey();
    const { start, end } = dayRange(assignedDate);
    const quests = await ensureTodayQuests(participantId);
    if (quests.length === 0) return;

    const { count: votesToday, error: vErr } = await getClient()
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('participant_id', participantId)
      .gte('created_at', start)
      .lte('created_at', end);
    if (vErr) throw vErr;

    for (const q of quests) {
      if (q.completed || q.template?.type !== 'vote_n_times') continue;
      await advanceQuest(q, votesToday ?? 0);
    }
  } catch (err) {
    console.error('[dailyQuests] recordVoteQuestProgress 실패 (게임 흐름에는 영향 없음):', err);
  }
}

/* ─────────────────────────────────────────────
   HUD용 — 오늘의 퀘스트 전체 목록(템플릿 포함, 완료여부/진행도까지).
   실패 시 빈 배열 반환(HUD는 "퀘스트 없음"으로 취급하면 됨).
───────────────────────────────────────────── */
export async function getTodayQuestSummary(participantId) {
  return ensureTodayQuests(participantId);
}
