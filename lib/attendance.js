import { getClient } from '@/lib/supabase';
import { awardAttendanceCurrency } from '@/lib/currency';

/* ─────────────────────────────────────────────
   출석 보상(연속 출석 스트릭) — 일일 퀘스트(lib/dailyQuests.js)와
   완전히 독립된 별도 시스템. annotations/votes/블록잠금/기존
   화폐·퀘스트 로직은 전혀 건드리지 않는 격리된 부가 기능. 모든 공개
   함수는 내부에서 절대 throw하지 않는다(호출부의 기존 흐름을 막지
   않기 위해 — lib/currency.js·lib/dailyQuests.js와 동일한 원칙).
───────────────────────────────────────────── */

const CYCLE_LEN = 7;

// daily_quest_schema.sql과 동일하게 UTC 날짜 키를 "오늘" 기준으로 쓴다.
function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDateKey(dateKey) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ─────────────────────────────────────────────
   오늘 아직 출석하지 않았으면 체크인 + 보상 지급, 이미 했으면 기존
   row를 그대로 반환. 스트릭 판정: 마지막 출석일이 "어제"였을 때만
   이어서 증가(7일차 다음은 1일차로 순환), 그 외(첫 출석이거나 하루
   이상 건너뜀)엔 1일차로 리셋.
───────────────────────────────────────────── */
export async function ensureTodayCheckIn(participantId) {
  const today = todayDateKey();
  const client = getClient();

  try {
    const { data: last, error: lastErr } = await client
      .from('participant_attendance')
      .select('*')
      .eq('participant_id', participantId)
      .order('check_in_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw lastErr;

    if (last?.check_in_date === today) {
      return { row: last, isNew: false };
    }

    const continuesStreak = last?.check_in_date === yesterdayDateKey(today);
    const streakDay = continuesStreak ? (last.streak_day % CYCLE_LEN) + 1 : 1;

    const { data: template, error: tErr } = await client
      .from('attendance_reward_templates')
      .select('*')
      .eq('day_index', streakDay)
      .single();
    if (tErr) throw tErr;

    const { data: inserted, error: iErr } = await client
      .from('participant_attendance')
      .insert([{
        participant_id:  participantId,
        check_in_date:   today,
        streak_day:      streakDay,
        reward_currency: template.reward_currency,
      }])
      .select()
      .single();

    if (iErr) {
      // 동시 호출(예: React StrictMode의 개발 모드 이펙트 이중 실행)로 다른
      // 요청이 오늘 row를 먼저 insert했을 수 있음 — UNIQUE(participant_id,
      // check_in_date) 충돌(23505). 실패로 보지 않고 그 row를 재조회해서
      // 반환한다(daily_quest_schema의 ensureTodayQuests와 동일한 복구 패턴).
      if (iErr.code === '23505') {
        const { data: existing } = await client
          .from('participant_attendance')
          .select('*')
          .eq('participant_id', participantId)
          .eq('check_in_date', today)
          .maybeSingle();
        return { row: existing, isNew: false };
      }
      throw iErr;
    }

    await awardAttendanceCurrency({
      participantId,
      attendanceRowId: inserted.id,
      amount: inserted.reward_currency,
    });

    return { row: inserted, isNew: true };
  } catch (err) {
    console.error('[attendance] ensureTodayCheckIn 실패:', err);
    return { row: null, isNew: false };
  }
}

/* ─────────────────────────────────────────────
   출석 패널 HUD용 — 보상 템플릿(7일 전체) + 오늘 체크인 상태.
   실패해도 절대 throw하지 않음(패널은 today가 null이면 "아직 오늘
   출석 전"으로 취급하면 됨).
───────────────────────────────────────────── */
export async function getAttendanceStatus(participantId) {
  const client = getClient();
  const today = todayDateKey();
  try {
    const [{ data: templates, error: tErr }, { data: todayRow, error: rErr }] = await Promise.all([
      client.from('attendance_reward_templates').select('*').order('day_index'),
      client.from('participant_attendance').select('*')
        .eq('participant_id', participantId).eq('check_in_date', today).maybeSingle(),
    ]);
    if (tErr) throw tErr;
    if (rErr) throw rErr;
    return { templates: templates || [], today: todayRow || null };
  } catch (err) {
    console.error('[attendance] getAttendanceStatus 실패:', err);
    return { templates: [], today: null };
  }
}
