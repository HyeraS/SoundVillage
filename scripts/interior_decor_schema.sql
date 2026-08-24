-- ============================================================
-- 집꾸미기(인테리어) 데이터 계층 — 신규 테이블 2개(참여자 보유 아이템,
-- 방 배치) + currency_transactions.type 확장(spend_interior 추가).
-- annotations/votes/블록 잠금/기존 화폐·상점·퀘스트·출석 로직은 전혀
-- 건드리지 않음. currency_schema.sql, shop_schema.sql, daily_quest_schema.sql,
-- attendance_schema.sql 이후에 실행.
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요)
--
-- 권한 패턴은 나머지 schema 파일들과 동일(anon 실측 기준) — RLS는
-- 켜지 않고, anon/authenticated에 명시적 GRANT.
--
-- 이 파일은 design_handoff_cozy_room/README.md "서버 연동" 절의 스키마를
-- 그대로 따른다. participant_room은 6단계(방 저장/불러오기)에서부터 실제로
-- 쓰이지만, README의 구현 순서상 5단계에서 두 테이블을 함께 만들어 둔다.
-- ============================================================

-- ── participant_interior_items ──────────────────────────────
-- 참여자가 보유한(구매/획득한) 인테리어 아이템 id 목록. 같은 아이템을
-- 두 번 사도 안 되므로(스택형이 아니라 "1개만 있으면 여러 칸에 놓을 수
-- 있는" 방식 — 기존 house_decor_schema.sql의 스택형 수량 모델과는 다름)
-- PK 자체가 "보유 여부" 중복방지 제약을 겸한다.
CREATE TABLE IF NOT EXISTS participant_interior_items (
  participant_id text        NOT NULL,
  item_id        text        NOT NULL,
  acquired_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, item_id)
);

-- ── participant_room ─────────────────────────────────────────
-- 참여자별 방 배치 전체를 JSONB 하나로 저장(6단계에서 사용 시작).
-- room 구조는 lib/interiorFixtures.js의 DEFAULT_ROOM과 동일:
-- { wallpaper: itemId, floor: itemId, items: [{uid, itemId, layer, col, row, flip}] }
CREATE TABLE IF NOT EXISTS participant_room (
  participant_id text        PRIMARY KEY,
  room           jsonb       NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT         ON participant_interior_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON participant_room           TO anon, authenticated;

-- ── currency_transactions.type 확장 ─────────────────────────
-- outfit 상점(spend_shop)과 구분되는 별도 타입을 쓴다 — item_id
-- 네임스페이스는 이미 서로 겹치지 않지만(outfit id vs 인테리어 카탈로그
-- id vs house_ 접두사), 타입을 분리해 두면 나중에 "얼마를 무엇에
-- 썼는지" 집계할 때 더 명확하다. related_id는 단품은 item_id,
-- 세트는 set_id를 그대로 넣는다(세트 구매는 거래 1건으로 기록).
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_type_check;
ALTER TABLE currency_transactions ADD CONSTRAINT currency_transactions_type_check
  CHECK (type IN ('earn_annotation', 'earn_vote', 'spend_shop', 'earn_quest', 'earn_attendance', 'spend_interior'));

-- ── 실행 후 확인용 쿼리 ──────────────────────────────────────
-- SELECT * FROM participant_interior_items ORDER BY acquired_at DESC LIMIT 20;
-- SELECT * FROM participant_room ORDER BY updated_at DESC LIMIT 20;
-- SELECT * FROM currency_transactions WHERE type = 'spend_interior' ORDER BY created_at DESC LIMIT 20;
