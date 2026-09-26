import { getClient } from '@/lib/supabase';
import { authorizedPost } from '@/lib/participantAuth';
import { newOperationKey } from '@/lib/persistenceResult';

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
    throw error;
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
    throw error;
  }
  return (data || []).map(r => ({ layoutId: r.id, itemId: r.item_id, gridX: r.grid_x, gridY: r.grid_y, rotation: r.rotation }));
}

/* ─────────────────────────────────────────────
   구매: 잔액 확인(클라이언트 사전 체크, lib/currency.js의 purchaseOutfit과
   동일한 신뢰 모델 — 최종 방어는 없음, PROJECT_SUMMARY.md §10 anon 키
   리스크 참고) → 보유 수량 +1(RPC, 스택형이라 몇 개든 구매 가능) →
   성공 시에만 차감. type은 purchaseOutfit과 동일하게 'spend_shop'을
   재사용한다(outfit_id와 item_id 네임스페이스가 'house_' 접두사로 이미
   분리돼 있어 currency_transactions에서 서로 섞이지 않음) — 그래서
   currency.js에 하우스 전용 spend 함수를 새로 추가하지 않고 여기서
   같은 패턴을 직접 재구현한다(이미 배포된 outfit 상점 코드는 건드리지 않음).
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
export async function purchaseHouseItem({ itemId, idempotencyKey }) {
  return authorizedPost('/api/participant-purchase', { kind: 'house_item', itemId }, idempotencyKey || newOperationKey());
}

/* ─────────────────────────────────────────────
   배치: 보유 수량 중 아직 안 놓인 개수(quantity - 현재 배치된 인스턴스 수)가
   남아있어야 새 인스턴스를 놓을 수 있다. 스택형이라 같은 아이템을 여러
   칸에 동시에 놓을 수 있으므로 insert(신규 행)만 하고, "옮기기"는
   기존 인스턴스를 removeHouseItem으로 지운 뒤 다시 놓는 방식으로 처리한다.
───────────────────────────────────────────── */
export async function placeHouseItem({ participantId, itemId, gridX, gridY, rotation = 0 }) {
  const client = getClient();

  const [{ data: owned, error: ownedError }, { count: placedCount, error: layoutError }] = await Promise.all([
    client.from('participant_house_items').select('quantity').eq('participant_id', participantId).eq('item_id', itemId).maybeSingle(),
    client.from('participant_house_layout').select('id', { count: 'exact', head: true }).eq('participant_id', participantId).eq('item_id', itemId),
  ]);
  if (ownedError) throw ownedError;
  if (layoutError) throw layoutError;
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
    throw error;
  }
  return { ok: true };
}

/* 벽지는 방의 바닥 그리드와 충돌하지 않도록 (-1, -1) 전용 슬롯에 저장한다. */
export async function applyHouseWallpaper({ participantId, itemId }) {
  const client = getClient();
  const { data: owned, error: ownedError } = await client
    .from('participant_house_items')
    .select('quantity')
    .eq('participant_id', participantId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (ownedError) throw ownedError;
  if ((owned?.quantity ?? 0) <= 0) return { ok: false, reason: 'not_owned' };

  const { error: clearError } = await client
    .from('participant_house_layout')
    .delete()
    .eq('participant_id', participantId)
    .eq('grid_x', -1)
    .eq('grid_y', -1);
  if (clearError) throw clearError;

  const { error } = await client.from('participant_house_layout').insert([{
    participant_id: participantId,
    item_id: itemId,
    grid_x: -1,
    grid_y: -1,
    rotation: 0,
  }]);
  if (error) {
    console.error('[houseDecor] applyHouseWallpaper 오류:', error);
    throw error;
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
    throw error;
  }
  return true;
}
