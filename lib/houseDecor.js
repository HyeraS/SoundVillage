import { getClient } from '@/lib/supabase';
import { getCurrencyBalance, spendCurrency } from '@/lib/currency';
import { HOUSE_ITEMS } from '@/lib/houseCatalog';

/* ─────────────────────────────────────────────
   보유 아이템 + 수량. [{ itemId, quantity }]
───────────────────────────────────────────── */
export async function getOwnedHouseItems(participantId) {
  const { data, error } = await getClient()
    .from('participant_house_items')
    .select('item_id, quantity')
    .eq('participant_id', participantId);
  if (error) {
    console.error('[houseDecor] getOwnedHouseItems 오류:', error);
    return [];
  }
  return (data || []).map(r => ({ itemId: r.item_id, quantity: r.quantity }));
}

/* ─────────────────────────────────────────────
   현재 방에 배치된 인스턴스 목록 (좌표 포함, 인스턴스마다 고유 id).
───────────────────────────────────────────── */
export async function getHouseLayout(participantId) {
  const { data, error } = await getClient()
    .from('participant_house_layout')
    .select('id, item_id, grid_x, grid_y, rotation')
    .eq('participant_id', participantId);
  if (error) {
    console.error('[houseDecor] getHouseLayout 오류:', error);
    return [];
  }
  return (data || []).map(r => ({ layoutId: r.id, itemId: r.item_id, gridX: r.grid_x, gridY: r.grid_y, rotation: r.rotation }));
}

/* ─────────────────────────────────────────────
   구매: 잔액 확인(클라이언트 사전 체크, purchaseOutfit과 동일한 신뢰
   모델 — 최종 방어는 없음, PROJECT_SUMMARY.md §10 anon 키 리스크 참고)
   → 보유 수량 +1(RPC, 스택형이라 몇 개든 구매 가능) → 성공 시에만 차감.
   related_id에 매 구매마다 nonce를 섞는 이유는
   scripts/house_decor_schema.sql 상단 주석 참고 — currency_transactions의
   UNIQUE(participant_id, related_id, type) 제약이 item_id 고정 related_id로는
   두 번째 구매부터 막아버리기 때문.
   주의: 이 nonce는 매 호출마다 새로 생성되므로 재시도/중복 클릭 방지
   장치가 아니다 — 그냥 정상적인 반복 구매가 유니크 제약에 안 걸리게
   할 뿐. 더블클릭으로 이 함수가 두 번 호출되면 두 번 다 정상 처리돼
   버린다 — 그 방지는 호출부(app/house-decor-test/page.js)가 요청
   진행 중엔 구매 버튼을 비활성화하는 방식으로 한다.
───────────────────────────────────────────── */
export async function purchaseHouseItem({ participantId, itemId }) {
  const product = HOUSE_ITEMS.find(p => p.id === itemId);
  if (!product) return { ok: false, reason: 'unknown_item' };

  const balance = await getCurrencyBalance(participantId);
  if (balance < product.price) {
    return { ok: false, reason: 'insufficient_funds', balance, price: product.price };
  }

  const client = getClient();
  const { error: qtyErr } = await client.rpc('increment_house_item_quantity', {
    p_participant_id: participantId,
    p_item_id: itemId,
    p_delta: 1,
  });
  if (qtyErr) {
    console.error('[houseDecor] purchaseHouseItem 수량증가 오류:', qtyErr);
    return { ok: false, reason: 'error' };
  }

  const relatedId = `${itemId}:${crypto.randomUUID()}`;
  const spend = await spendCurrency({ participantId, amount: product.price, relatedId });
  if (!spend.ok) {
    console.error('[houseDecor] purchaseHouseItem 과금 실패 (보유 수량은 이미 증가함):', spend.reason);
    return { ok: false, reason: 'charge_error' };
  }

  console.log(`[houseDecor] 구매 완료 — participant=${participantId} item=${itemId} price=${product.price}`);
  return { ok: true, newBalance: balance - product.price };
}

/* ─────────────────────────────────────────────
   무상 지급: purchaseHouseItem과 달리 잔액 확인/차감이 전혀 없다 —
   increment_house_item_quantity RPC만 그대로 재사용(스택형이라 구매
   여부와 무관하게 수량만 늘리면 됨). 마일스톤 보상처럼 화폐를 거치지
   않고 바로 아이템을 주는 경로용(lib/voteRewards.js 참고).
───────────────────────────────────────────── */
export async function grantHouseItem({ participantId, itemId }) {
  const { error } = await getClient().rpc('increment_house_item_quantity', {
    p_participant_id: participantId,
    p_item_id: itemId,
    p_delta: 1,
  });
  if (error) {
    console.error('[houseDecor] grantHouseItem 오류:', error);
    return false;
  }
  console.log(`[houseDecor] 무상 지급 완료 — participant=${participantId} item=${itemId}`);
  return true;
}

/* ─────────────────────────────────────────────
   배치: 보유 수량 중 아직 안 놓인 개수(quantity - 현재 배치된 인스턴스 수)가
   남아있어야 새 인스턴스를 놓을 수 있다. 스택형이라 같은 아이템을 여러
   칸에 동시에 놓을 수 있으므로 insert(신규 행)만 하고, "옮기기"는
   기존 인스턴스를 removeHouseItem으로 지운 뒤 다시 놓는 방식으로 처리한다.
───────────────────────────────────────────── */
export async function placeHouseItem({ participantId, itemId, gridX, gridY, rotation = 0 }) {
  const client = getClient();

  const [{ data: owned }, { count: placedCount }] = await Promise.all([
    client.from('participant_house_items').select('quantity').eq('participant_id', participantId).eq('item_id', itemId).maybeSingle(),
    client.from('participant_house_layout').select('id', { count: 'exact', head: true }).eq('participant_id', participantId).eq('item_id', itemId),
  ]);
  const available = (owned?.quantity ?? 0) - (placedCount ?? 0);
  if (available <= 0) return { ok: false, reason: 'not_owned' };

  const { error } = await client.from('participant_house_layout').insert([{
    participant_id: participantId,
    item_id: itemId,
    grid_x: gridX,
    grid_y: gridY,
    rotation,
  }]);
  if (error) {
    if (error.code === '23505') {
      return { ok: false, reason: 'tile_occupied' };
    }
    console.error('[houseDecor] placeHouseItem 오류:', error);
    return { ok: false, reason: 'error' };
  }
  return { ok: true };
}

/* 벽지는 방의 바닥 그리드와 충돌하지 않도록 (-1, -1) 전용 슬롯에 저장한다. */
export async function applyHouseWallpaper({ participantId, itemId }) {
  const client = getClient();
  const { data: owned } = await client
    .from('participant_house_items')
    .select('quantity')
    .eq('participant_id', participantId)
    .eq('item_id', itemId)
    .maybeSingle();
  if ((owned?.quantity ?? 0) <= 0) return { ok: false, reason: 'not_owned' };

  const { error: clearError } = await client
    .from('participant_house_layout')
    .delete()
    .eq('participant_id', participantId)
    .eq('grid_x', -1)
    .eq('grid_y', -1);
  if (clearError) return { ok: false, reason: 'error' };

  const { error } = await client.from('participant_house_layout').insert([{
    participant_id: participantId,
    item_id: itemId,
    grid_x: -1,
    grid_y: -1,
    rotation: 0,
  }]);
  if (error) {
    console.error('[houseDecor] applyHouseWallpaper 오류:', error);
    return { ok: false, reason: 'error' };
  }
  return { ok: true };
}

/* ─────────────────────────────────────────────
   배치 해제: layout 인스턴스 행만 삭제, 보유 수량(participant_house_items)은
   그대로 남아 인벤토리로 돌아간다. layoutId로 특정 인스턴스만 지운다 —
   같은 item_id가 여러 칸에 놓여 있을 수 있으므로 item_id만으로는 어느
   인스턴스인지 구분이 안 됨.
───────────────────────────────────────────── */
export async function removeHouseItem({ participantId, layoutId }) {
  const { error } = await getClient()
    .from('participant_house_layout')
    .delete()
    .eq('participant_id', participantId)
    .eq('id', layoutId);
  if (error) {
    console.error('[houseDecor] removeHouseItem 오류:', error);
    return false;
  }
  return true;
}
