import { getClient } from '@/lib/supabase';
import { authorizedPost } from '@/lib/participantAuth';
import { newOperationKey, persistenceFailure, persistenceSuccess } from '@/lib/persistenceResult';

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
    throw error;
  }
  return (data || []).map(r => r.item_id);
}

/* 단품 구매 — purchaseOutfit과 동일한 4단계.
   price는 호출부(상점 UI)가 lib/interiorCatalog.js의 getInteriorPrice로 계산해서
   넘긴다(오늘의 특가 할인가를 화면 표시값과 동일하게 유지하기 위함 —
   purchaseOutfit의 "오늘의 특가 할인가는 호출부가 넘겨줌" 주석과 동일한 이유). */
export async function purchaseInteriorItem({ itemId, idempotencyKey }) {
  return authorizedPost('/api/participant-purchase', { kind: 'interior_item', itemId }, idempotencyKey || newOperationKey());
}

/* 테마 세트 구매 — 미보유 아이템만 지급하고 세트 가격 1회만 차감한다.
   ownedIds는 호출부가 이미 들고 있는 보유 목록을 그대로 넘긴다(왕복 쿼리 절약).
   보유 기록은 upsert(ignoreDuplicates)로 넣는다 — insert 배치 하나에 이미
   보유한 항목이 섞여 있으면(더블클릭 등) 단일 insert처럼 전체가 막히지 않게
   하기 위함. 거래 기록은 세트당 1건만 남긴다(related_id = setId). */
export async function purchaseInteriorSet({ setId, idempotencyKey }) {
  return authorizedPost('/api/participant-purchase', { kind: 'interior_set', itemId: setId }, idempotencyKey || newOperationKey());
}

/* ─────────────────────────────────────────────
   방 저장/불러오기 — participant_room 테이블에 room JSONB 하나를 통째로
   upsert(participant_id 유니크)한다. 친구 방은 participant ID 직접 조회 대신
   getSharedRoom의 불투명 공유 토큰 RPC로 필요한 room JSON만 받는다.
───────────────────────────────────────────── */
export async function getRoom(participantId) {
  const { data, error } = await getClient()
    .from('participant_room')
    .select('room')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (error) {
    console.error('[interiorDecor] getRoom 오류:', error);
    throw error;
  }
  return data?.room ?? null;
}

export async function getOrCreateRoomShare() {
  const { data, error } = await getClient().rpc('get_or_create_room_share');
  if (error) throw error;
  return data;
}

export async function getSharedRoom(shareToken) {
  const { data, error } = await getClient().rpc('get_shared_room', {
    p_share_token: shareToken,
  });
  if (error) throw error;
  return data;
}

export async function saveRoom({ participantId: _participantId, room, idempotencyKey: suppliedKey }) {
  const idempotencyKey = suppliedKey || newOperationKey();
  const { data, error } = await getClient().rpc('save_participant_room_v3', {
    p_idempotency_key: idempotencyKey,
    p_room: room,
  });
  if (error) return persistenceFailure(error, 'room_save', idempotencyKey);
  return persistenceSuccess(data, 'room_save', idempotencyKey);
}
