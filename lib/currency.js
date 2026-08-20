import { getClient } from '@/lib/supabase';

/* ─────────────────────────────────────────────
   화폐 시스템 — 잔액 조회/지급/차감.
   annotations/votes/블록 잠금 로직은 참조만 하고 전혀 건드리지 않음.
───────────────────────────────────────────── */

export async function getCurrencyBalance(participantId) {
  const { data, error } = await getClient()
    .from('participant_currency')
    .select('balance')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) {
    console.error('[currency] getCurrencyBalance 오류:', error);
    return 0;
  }
  return data?.balance ?? 0;
}

/* ─────────────────────────────────────────────
   공용 차감 함수: 거래 기록 insert 먼저 → 성공하면 잔액 감소(RPC).
   순서가 중요한 이유는 currency_schema.sql의 awardCurrency와 동일 —
   먼저 balance를 내리고 나중에 insert가 막히면 잔액만 중복으로
   깎인 채 거래 기록이 안 남는 불일치가 생긴다.
   type은 'spend_shop' 고정 — currency_transactions.type CHECK 제약이
   이미 배포된 값 목록으로 고정돼 있고 이 테이블은 ALTER하지 않기로
   했으므로, 무엇을 샀는지는 related_id(item_id)로만 구분한다.
───────────────────────────────────────────── */
export async function spendCurrency({ participantId, amount, relatedId }) {
  const client = getClient();

  const { error: txErr } = await client.from('currency_transactions').insert([{
    participant_id: participantId,
    type:           'spend_shop',
    amount:         -amount,
    related_id:     relatedId ?? null,
  }]);
  if (txErr) {
    if (txErr.code === '23505') {
      console.log(`[currency] 이미 차감됨 — participant=${participantId} related_id=${relatedId} (중복 차감 방지, 정상 동작)`);
      return { ok: false, reason: 'already_charged' };
    }
    console.error('[currency] spendCurrency 거래기록 오류:', txErr);
    return { ok: false, reason: 'error' };
  }

  const { error: balErr } = await client.rpc('increment_currency_balance', {
    p_participant_id: participantId,
    p_amount: -amount,
  });
  if (balErr) {
    console.error('[currency] spendCurrency 잔액차감 오류:', balErr);
    return { ok: false, reason: 'error' };
  }

  return { ok: true };
}

/* ─────────────────────────────────────────────
   공용 지급 함수: 거래 기록 insert 먼저 → 성공하면 잔액 증가(RPC).
   spendCurrency와 순서 원리는 동일(먼저 insert가 막히면 잔액을 안
   건드려서 불일치 방지) — 방향만 반대(양수 amount).
   type/related_id는 호출부가 결정 — currency_transactions.type CHECK
   제약이 ('earn_annotation','earn_vote','spend_shop')로 고정돼 있어서
   호출부는 이 세 값 중 하나만 넘겨야 한다(ALTER 금지).
   amount=0으로 호출하면 잔액 변동 없이 감사로그만 남긴다(예: 하우스
   아이템 마일스톤처럼 실제 화폐 이동은 없지만 이벤트 자체는 기록하고
   싶은 경우 — lib/voteRewards.js 참고).
───────────────────────────────────────────── */
export async function awardCurrency({ participantId, type, amount, relatedId }) {
  const client = getClient();

  const { error: txErr } = await client.from('currency_transactions').insert([{
    participant_id: participantId,
    type,
    amount,
    related_id: relatedId ?? null,
  }]);
  if (txErr) {
    if (txErr.code === '23505') {
      console.log(`[currency] 이미 지급됨 — participant=${participantId} type=${type} related_id=${relatedId} (중복 지급 방지, 정상 동작)`);
      return { ok: false, reason: 'already_awarded' };
    }
    console.error('[currency] awardCurrency 거래기록 오류:', txErr);
    return { ok: false, reason: 'error' };
  }

  if (amount === 0) return { ok: true };

  const { error: balErr } = await client.rpc('increment_currency_balance', {
    p_participant_id: participantId,
    p_amount: amount,
  });
  if (balErr) {
    console.error('[currency] awardCurrency 잔액증가 오류:', balErr);
    return { ok: false, reason: 'error' };
  }

  return { ok: true };
}
