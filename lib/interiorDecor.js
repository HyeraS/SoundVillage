import { getClient } from '@/lib/supabase';
import { getCurrencyBalance } from '@/lib/currency';
import { INTERIOR_SETS, getInteriorItem } from '@/lib/interiorCatalog';

/* ─────────────────────────────────────────────
   집꾸미기(인테리어) 데이터 계층 — design_handoff_cozy_room/README.md의
   "서버 연동" 절을 그대로 따른다. lib/currency.js의 purchaseOutfit과 완전히
   동일한 순서(잔액 확인 → 보유 기록 insert(PK 중복=이미 보유, 과금 안 함) →
   거래 기록 insert → increment_currency_balance RPC로 차감)를 재사용하되,
   currency.js 자체는 건드리지 않고 이 파일에서 같은 패턴을 새로 구현한다.
   type은 'spend_interior'로 outfit 상점('spend_shop')과 구분한다 —
   scripts/interior_decor_schema.sql이 이 타입을 CHECK 제약에 추가한다(미실행).
───────────────────────────────────────────── */

/* 보유한 인테리어 아이템 id 목록. */
export async function getOwnedInteriorItems(participantId) {
  const { data, error } = await getClient()
    .from('participant_interior_items')
    .select('item_id')
    .eq('participant_id', participantId);
  if (error) {
    console.error('[interiorDecor] getOwnedInteriorItems 오류:', error);
    return [];
  }
  return (data || []).map(r => r.item_id);
}

/* 단품 구매 — purchaseOutfit과 동일한 4단계.
   price는 호출부(상점 UI)가 lib/interiorCatalog.js의 getInteriorPrice로 계산해서
   넘긴다(오늘의 특가 할인가를 화면 표시값과 동일하게 유지하기 위함 —
   purchaseOutfit의 "오늘의 특가 할인가는 호출부가 넘겨줌" 주석과 동일한 이유). */
export async function purchaseInteriorItem({ participantId, itemId, price }) {
  const item = getInteriorItem(itemId);
  if (!item) return { ok: false, reason: 'unknown_item' };
  const chargeAmount = price ?? item.price;

  const balance = await getCurrencyBalance(participantId);
  if (balance < chargeAmount) return { ok: false, reason: 'insufficient_funds', balance, price: chargeAmount };

  const client = getClient();
  const { error: ownErr } = await client.from('participant_interior_items').insert([{
    participant_id: participantId,
    item_id: itemId,
  }]);
  if (ownErr) {
    if (ownErr.code === '23505') {
      console.log(`[interiorDecor] 이미 보유 중 — participant=${participantId} item=${itemId} (과금 안 함)`);
      return { ok: false, reason: 'already_owned' };
    }
    console.error('[interiorDecor] purchaseInteriorItem 보유기록 오류:', ownErr);
    return { ok: false, reason: 'error' };
  }

  try {
    const { error: txErr } = await client.from('currency_transactions').insert([{
      participant_id: participantId,
      type: 'spend_interior',
      amount: -chargeAmount,
      related_id: itemId,
    }]);
    if (txErr) throw txErr;

    const { error: balErr } = await client.rpc('increment_currency_balance', {
      p_participant_id: participantId,
      p_amount: -chargeAmount,
    });
    if (balErr) throw balErr;
  } catch (err) {
    console.error('[interiorDecor] purchaseInteriorItem 과금 실패 (보유 기록은 이미 생성됨):', err);
    return { ok: false, reason: 'error' };
  }

  console.log(`[interiorDecor] spend_interior 완료 — participant=${participantId} item=${itemId} amount=-${chargeAmount}`);
  return { ok: true, newBalance: balance - chargeAmount };
}

/* 테마 세트 구매 — 미보유 아이템만 지급하고 세트 가격 1회만 차감한다.
   ownedIds는 호출부가 이미 들고 있는 보유 목록을 그대로 넘긴다(왕복 쿼리 절약).
   보유 기록은 upsert(ignoreDuplicates)로 넣는다 — insert 배치 하나에 이미
   보유한 항목이 섞여 있으면(더블클릭 등) 단일 insert처럼 전체가 막히지 않게
   하기 위함. 거래 기록은 세트당 1건만 남긴다(related_id = setId). */
export async function purchaseInteriorSet({ participantId, setId, ownedIds }) {
  const set = INTERIOR_SETS.find(s => s.id === setId);
  if (!set) return { ok: false, reason: 'unknown_set' };

  const owned = new Set(ownedIds || []);
  const needIds = set.items.filter(id => !owned.has(id));
  if (needIds.length === 0) return { ok: true, alreadyOwned: true, grantedItemIds: [] };

  const balance = await getCurrencyBalance(participantId);
  if (balance < set.price) return { ok: false, reason: 'insufficient_funds', balance, price: set.price };

  const client = getClient();
  const { error: ownErr } = await client.from('participant_interior_items')
    .upsert(needIds.map(itemId => ({ participant_id: participantId, item_id: itemId })), {
      onConflict: 'participant_id,item_id',
      ignoreDuplicates: true,
    });
  if (ownErr) {
    console.error('[interiorDecor] purchaseInteriorSet 보유기록 오류:', ownErr);
    return { ok: false, reason: 'error' };
  }

  try {
    const { error: txErr } = await client.from('currency_transactions').insert([{
      participant_id: participantId,
      type: 'spend_interior',
      amount: -set.price,
      related_id: setId,
    }]);
    if (txErr) throw txErr;

    const { error: balErr } = await client.rpc('increment_currency_balance', {
      p_participant_id: participantId,
      p_amount: -set.price,
    });
    if (balErr) throw balErr;
  } catch (err) {
    console.error('[interiorDecor] purchaseInteriorSet 과금 실패 (보유 기록은 이미 생성됨):', err);
    return { ok: false, reason: 'error' };
  }

  console.log(`[interiorDecor] spend_interior(세트) 완료 — participant=${participantId} set=${setId} amount=-${set.price}`);
  return { ok: true, newBalance: balance - set.price, grantedItemIds: needIds };
}

/* ─────────────────────────────────────────────
   방 저장/불러오기 — participant_room 테이블에 room JSONB 하나를 통째로
   upsert(participant_id 유니크)한다. 친구 방 보기(?house=참가자ID 링크)도
   이 getRoom을 그대로 재사용해서 "그 사람이 실제로 저장한 방"을 읽는다 —
   room 자체에는 owned/balance가 없으므로 그 부분은 노출되지 않는다.
───────────────────────────────────────────── */
export async function getRoom(participantId) {
  const { data, error } = await getClient()
    .from('participant_room')
    .select('room')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) {
    console.error('[interiorDecor] getRoom 오류:', error);
    return null;
  }
  return data?.room ?? null;
}

export async function saveRoom({ participantId, room }) {
  const { error } = await getClient()
    .from('participant_room')
    .upsert([{ participant_id: participantId, room, updated_at: new Date().toISOString() }], {
      onConflict: 'participant_id',
    });
  if (error) {
    console.error('[interiorDecor] saveRoom 오류:', error);
    return false;
  }
  return true;
}
