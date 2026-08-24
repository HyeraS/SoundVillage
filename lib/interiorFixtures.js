/* 친구 방 보기(?house=참가자ID) 테스트용 — 실제로는 lib/interiorDecor.js의
   getRoom(participantId)이 그 사람의 진짜 participant_room을 읽어와야 하지만,
   스키마 미실행이라 저장된 진짜 데이터가 없다. getRoom이 null을 돌려주면(테이블
   없음/그 사람이 아직 저장 안 함) 이 픽스처로 대체해서 읽기전용 UI 자체는
   확인할 수 있게 한다 — design_handoff_cozy_room/Cozy Room.dc.html의
   FRIEND_ROOM을 그대로 옮김. 스키마 실행 후에는 필요 없어진다.

   (DEFAULT_ROOM/OWNED_START는 여기 있었지만, InteriorDecorRoom이 이제 내 방을
   실제 Supabase에서 불러와서 더 이상 안 쓴다 — 삭제함.)
───────────────────────────────────────────── */
export const FRIEND_ROOM = {
  wallpaper: 'wp_night',
  floor: 'fl_stone',
  items: [
    { uid: 1, itemId: 'rug_circle_teal', layer: 'rug', col: 5, row: 3, flip: false },
    { uid: 2, itemId: 'bed_teal', layer: 'floor', col: 9, row: 2, flip: false },
    { uid: 3, itemId: 'fireplace', layer: 'floor', col: 0, row: 1, flip: false },
    { uid: 4, itemId: 'candle', layer: 'floor', col: 3, row: 1, flip: false },
    { uid: 5, itemId: 'sofa_red', layer: 'floor', col: 5, row: 2, flip: false },
    { uid: 6, itemId: 'deer', layer: 'floor', col: 7, row: 4, flip: false },
    { uid: 7, itemId: 'xmas_tree', layer: 'floor', col: 2, row: 3, flip: false },
    { uid: 8, itemId: 'curtain_red', layer: 'wall', col: 4, row: 0, flip: false },
  ],
};
