-- ============================================================
-- 집꾸미기(House Decor) 데이터 계층 — 신규 테이블 2개.
-- annotations/votes/participant_currency/currency_transactions는
-- 전혀 ALTER하지 않음.
--
-- ── 화폐 차감: increment_currency_balance RPC 그대로 재사용 ──
-- RPC 시그니처(increment_currency_balance(p_participant_id text,
-- p_amount integer))는 outfit 전용 파라미터가 전혀 없는 범용 잔액
-- 증감 함수라 house 구매도 amount에 음수를 넘겨 그대로 쓸 수 있다
-- (lib/currency.js의 spendCurrency 참고). 이미 anon/authenticated에
-- EXECUTE 권한이 GRANT돼 있어(scripts/currency_schema.sql) 이 스크립트에서
-- 추가 GRANT도 필요 없다.
--
-- currency_transactions.type CHECK 제약이 이미
-- ('earn_annotation','earn_vote','spend_shop')로 고정 배포돼 있고
-- 이 테이블은 ALTER 금지 지시라서, house 구매도 type='spend_shop'으로
-- 기록한다 — outfit 구매와 currency_transactions 상에서는 타입으로
-- 구분되지 않고, related_id(item_id)와 아래 participant_house_items로만
-- 구분됨. 이 때문에 house 아이템 id는 반드시 'house_' 접두사로 고정해서
-- outfit 카탈로그 id와 절대 겹치지 않게 한다 — 안 그러면
-- UNIQUE(participant_id, related_id, type) 제약이 서로 다른 상품인데도
-- "이미 구매함"으로 잘못 막을 수 있다.
--
-- 권한 패턴은 currency_schema.sql/core_schema.sql과 동일: RLS는 켜지
-- 않고(annotations/votes부터 이어진 기존 신뢰 모델), anon/authenticated에
-- 명시적 GRANT.
--
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요).
-- ⚠️ 사용자 승인 전 실행 금지.
-- ============================================================

-- ── participant_house_items ─────────────────────────────────
-- 아이템 보유(구매) 기록. 아이템당 한 번만 구매 가능(스택 없음, v1 단순화).
CREATE TABLE IF NOT EXISTS participant_house_items (
  participant_id text        NOT NULL,
  item_id         text        NOT NULL,
  acquired_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, item_id)
);

-- ── participant_house_layout ────────────────────────────────
-- 보유 아이템 중 현재 방에 배치된 것의 좌표. 배치 해제 시 이 행만
-- 삭제(보유 기록인 participant_house_items는 그대로 남아 인벤토리로 복귀).
-- UNIQUE(participant_id, grid_x, grid_y)로 한 칸에 아이템 하나만 허용.
CREATE TABLE IF NOT EXISTS participant_house_layout (
  participant_id text        NOT NULL,
  item_id         text        NOT NULL,
  grid_x          integer     NOT NULL,
  grid_y          integer     NOT NULL,
  rotation        integer     NOT NULL DEFAULT 0,
  placed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, item_id),
  UNIQUE (participant_id, grid_x, grid_y)
);

CREATE INDEX IF NOT EXISTS idx_house_items_participant  ON participant_house_items  (participant_id);
CREATE INDEX IF NOT EXISTS idx_house_layout_participant ON participant_house_layout (participant_id);

-- annotations/votes/participant_currency와 동일한 패턴: RLS는 켜지 않는다.
-- 클라이언트(anon 키)가 구매(insert)·배치(insert/update/upsert)·해제(delete)·
-- 조회(select)를 바로 할 수 있도록 명시적 GRANT.
GRANT SELECT, INSERT                 ON participant_house_items  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON participant_house_layout TO anon, authenticated;

-- ── 실행 후 확인용 쿼리 ──────────────────────────────────────
-- SELECT * FROM participant_house_items  ORDER BY acquired_at DESC LIMIT 20;
-- SELECT * FROM participant_house_layout ORDER BY placed_at DESC LIMIT 20;
