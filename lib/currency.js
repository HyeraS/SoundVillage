import { getClient, getParticipantSubCategoryCount } from '@/lib/supabase';
import { SHOP_PRODUCTS } from '@/lib/shopCatalog';

/* ─────────────────────────────────────────────
   화폐 시스템 — 데이터 계층만 (UI는 다음 단계)
   annotations/votes/블록 잠금 로직은 절대 건드리지 않음.
   지급 실패는 항상 이 모듈 안에서 흡수되고, 기존 제출 흐름에는
   never throw — 호출부는 결과를 기다리지 않아도 안전하다.
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   지급액 계산 — 지금은 고정값, 나중에 이 함수 내부만 바꿔서
   카테고리 희귀도/난이도 기반 차등 지급으로 전환한다.
   context는 지금 당장 안 쓰여도 시그니처에 유지 — 호출부가
   이미 항상 채워서 넘기므로, 정책 전환 시 호출부 수정 없이
   여기 로직만 바꾸면 됨.
───────────────────────────────────────────── */
export function calculateReward(type, context = {}) {
  switch (type) {
    case 'earn_annotation':
      return 5;
    case 'earn_vote':
      return 2;
    case 'earn_quest':
      // 퀘스트 보상액은 daily_quest_templates.reward_currency가 단일 출처 —
      // 호출부(lib/dailyQuests.js)가 이미 그 값을 context.amount로 넘겨준다.
      return context.amount ?? 0;
    case 'earn_attendance':
      // 출석 보상액은 attendance_reward_templates.reward_currency가 단일 출처 —
      // 호출부(lib/attendance.js)가 이미 그 값을 context.amount로 넘겨준다.
      return context.amount ?? 0;
    default:
      return 0;
  }
}

/* ─────────────────────────────────────────────
   공용 지급 함수: 거래 기록 insert 먼저 → 성공하면 잔액 증가(RPC).
   순서가 중요함 — currency_transactions에는
   UNIQUE(participant_id, related_id, type) 제약이 있어서, 같은
   대상에 같은 타입으로 중복 지급 시도가 들어오면 insert에서 막힌다.
   먼저 balance를 올리고 나중에 insert했다면, insert가 막힐 때
   balance만 중복으로 올라간 채 거래 기록은 안 남는 불일치가
   생긴다 — 그래서 반드시 insert를 먼저 확정하고 그게 성공했을
   때만 balance를 올린다.
   실패해도 절대 throw하지 않음 — 호출부(AnnotationPanel/SoundMuseum)의
   기존 저장 흐름을 절대 막아서는 안 되기 때문.
───────────────────────────────────────────── */
async function awardCurrency({ participantId, type, relatedId, context = {} }) {
  try {
    const amount = calculateReward(type, context);
    const client = getClient();

    const { error: txErr } = await client.from('currency_transactions').insert([{
      participant_id:         participantId,
      type,
      amount,
      related_id:             relatedId ?? null,
      sound_duration_sec:     context.soundDurationSec ?? null,
      sub_category:           context.subCategory ?? null,
      category_count_at_time: context.categoryCountAtTime ?? null,
      confidence:             context.confidence ?? null,
    }]);
    if (txErr) {
      if (txErr.code === '23505') {
        console.log(`[currency] ${type} 이미 지급됨 — participant=${participantId} related_id=${relatedId} (중복 지급 방지, 정상 동작)`);
        return null;
      }
      throw txErr;
    }

    const { error: balErr } = await client.rpc('increment_currency_balance', {
      p_participant_id: participantId,
      p_amount: amount,
    });
    if (balErr) throw balErr;

    console.log(`[currency] ${type} 지급 완료 — participant=${participantId} amount=${amount}`);
    return amount;
  } catch (err) {
    console.error('[currency] 지급 실패 (게임 흐름에는 영향 없음):', err);
    return null;
  }
}

/* ─────────────────────────────────────────────
   Stage 1 제출(AnnotationPanel) 성공 후 호출.
   category_count_at_time은 이 함수 안에서 직접 조회 —
   호출부는 subCategory만 넘기면 됨.
───────────────────────────────────────────── */
export async function awardAnnotationCurrency({ participantId, soundId, subCategory, soundDurationSec, confidence }) {
  const categoryCountAtTime = await getParticipantSubCategoryCount(participantId, subCategory);
  return awardCurrency({
    participantId,
    type: 'earn_annotation',
    relatedId: soundId ?? null,
    context: { subCategory, soundDurationSec, confidence, categoryCountAtTime },
  });
}

/* ─────────────────────────────────────────────
   Museum 투표(SoundMuseum) 제출 성공 후 호출.
   related_id는 투표 대상 annotation의 id.
───────────────────────────────────────────── */
export async function awardVoteCurrency({ participantId, annotationId, subCategory, soundDurationSec, confidence }) {
  return awardCurrency({
    participantId,
    type: 'earn_vote',
    relatedId: annotationId ?? null,
    context: { subCategory, soundDurationSec, confidence },
  });
}

/* ─────────────────────────────────────────────
   일일 퀘스트 구간 완료 보상(lib/dailyQuests.js에서 호출).
   related_id = 완료된 participant_daily_quests row의 id — 그 row는
   구간 하나당 하나뿐이라 기존 UNIQUE(participant_id, related_id, type)
   제약이 구간별 중복지급을 자동으로 막아준다.
───────────────────────────────────────────── */
export async function awardQuestCurrency({ participantId, questRowId, amount }) {
  return awardCurrency({
    participantId,
    type: 'earn_quest',
    relatedId: String(questRowId),
    context: { amount },
  });
}

/* ─────────────────────────────────────────────
   출석 체크인 보상(lib/attendance.js에서 호출).
   related_id = 그 날의 participant_attendance row id — 하루당
   하나뿐이라 기존 UNIQUE(participant_id, related_id, type) 제약이
   날짜별 중복지급을 자동으로 막아준다.
───────────────────────────────────────────── */
export async function awardAttendanceCurrency({ participantId, attendanceRowId, amount }) {
  return awardCurrency({
    participantId,
    type: 'earn_attendance',
    relatedId: String(attendanceRowId),
    context: { amount },
  });
}

/* ─────────────────────────────────────────────
   잔액 조회 — 다음 단계 UI에서 쓸 예정이지만, 지금 단계
   검증(DB 직접 확인 대신 코드로)에도 바로 쓸 수 있게 같이 추가.
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
   상점 성장 연출용 — 누적 earn 총액(지출은 제외, earn_annotation +
   earn_vote만 합산). 새 배치 쿼리 없이 currency_transactions를
   그대로 재사용.
───────────────────────────────────────────── */
export async function getTotalEarned(participantId) {
  const { data, error } = await getClient()
    .from('currency_transactions')
    .select('amount')
    .eq('participant_id', participantId)
    .in('type', ['earn_annotation', 'earn_vote']);
  if (error) {
    console.error('[currency] getTotalEarned 오류:', error);
    return 0;
  }
  return (data || []).reduce((sum, row) => sum + row.amount, 0);
}

/* ─────────────────────────────────────────────
   보유 outfit 목록 / 현재 장착 outfit 조회.
───────────────────────────────────────────── */
export async function getOwnedOutfits(participantId) {
  const { data, error } = await getClient()
    .from('participant_outfits')
    .select('outfit_id')
    .eq('participant_id', participantId);
  if (error) {
    console.error('[currency] getOwnedOutfits 오류:', error);
    return [];
  }
  return (data || []).map(r => r.outfit_id);
}

export async function getEquippedOutfit(participantId) {
  const { data, error } = await getClient()
    .from('participant_equipped_outfit')
    .select('outfit_id')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) {
    console.error('[currency] getEquippedOutfit 오류:', error);
    return null;
  }
  return data?.outfit_id ?? null;
}

export async function setEquippedOutfit(participantId, outfitId) {
  const { error } = await getClient()
    .from('participant_equipped_outfit')
    .upsert([{ participant_id: participantId, outfit_id: outfitId, updated_at: new Date().toISOString() }], { onConflict: 'participant_id' });
  if (error) {
    console.error('[currency] setEquippedOutfit 오류:', error);
    return false;
  }
  return true;
}

/* ─────────────────────────────────────────────
   outfit 구매: 잔액 확인(클라이언트 사전 체크, 최종 방어는 DB의
   음수잔액 가드) → 보유 기록 insert(PK 중복이면 "이미 보유" 처리,
   과금 안 함) → 성공 시에만 spend_shop 거래 기록 + 잔액 차감(RPC)
   → 구매 직후 자동 장착.
   가격은 SHOP_PRODUCTS(단일 출처)에서만 읽는다 — 호출부가 price를
   따로 넘기지 않게 해서 화면에 표시된 값과 실제 차감액이 어긋날
   여지를 없앤다.
───────────────────────────────────────────── */
export async function purchaseOutfit({ participantId, outfitId, price }) {
  const product = SHOP_PRODUCTS.find(p => p.id === outfitId);
  if (!product) return { ok: false, reason: 'unknown_outfit' };
  const chargeAmount = price ?? product.price; // 오늘의 특가 할인가는 호출부(Shop UI)가 넘겨줌

  const balance = await getCurrencyBalance(participantId);
  if (balance < chargeAmount) return { ok: false, reason: 'insufficient_funds', balance, price: chargeAmount };

  const client = getClient();
  const { error: ownErr } = await client.from('participant_outfits').insert([{
    participant_id: participantId,
    outfit_id: outfitId,
  }]);
  if (ownErr) {
    if (ownErr.code === '23505') {
      console.log(`[currency] outfit 이미 보유 중 — participant=${participantId} outfit=${outfitId} (과금 안 함)`);
      return { ok: false, reason: 'already_owned' };
    }
    console.error('[currency] purchaseOutfit 보유기록 오류:', ownErr);
    return { ok: false, reason: 'error' };
  }

  try {
    const { error: txErr } = await client.from('currency_transactions').insert([{
      participant_id: participantId,
      type: 'spend_shop',
      amount: -chargeAmount,
      related_id: outfitId,
    }]);
    if (txErr) throw txErr;

    const { error: balErr } = await client.rpc('increment_currency_balance', {
      p_participant_id: participantId,
      p_amount: -chargeAmount,
    });
    if (balErr) throw balErr;
  } catch (err) {
    console.error('[currency] purchaseOutfit 과금 실패 (보유 기록은 이미 생성됨):', err);
    return { ok: false, reason: 'error' };
  }

  await setEquippedOutfit(participantId, outfitId);
  console.log(`[currency] spend_shop 완료 — participant=${participantId} outfit=${outfitId} amount=-${chargeAmount}`);
  return { ok: true, newBalance: balance - chargeAmount };
}
