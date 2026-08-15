-- ============================================================
-- 상점(outfit 구매) 데이터 계층 — currency_schema.sql 이후 적용.
-- annotations/votes/블록 잠금/기존 화폐 로직은 전혀 건드리지 않음.
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요)
--
-- 권한 패턴은 currency_schema.sql과 동일(anon 실측 기준) — RLS는
-- 켜지 않고, anon/authenticated에 명시적 GRANT.
-- ============================================================

-- ── participant_outfits ─────────────────────────────────────
-- 참여자가 보유한(구매한) outfit 목록. 같은 outfit을 두 번 사면
-- 안 되므로 PK 자체가 "보유 여부" 중복방지 제약을 겸한다.
CREATE TABLE IF NOT EXISTS participant_outfits (
  participant_id text        NOT NULL,
  outfit_id      text        NOT NULL,
  purchased_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, outfit_id)
);

-- ── participant_equipped_outfit ─────────────────────────────
-- 참여자별 "지금 입고 있는" outfit 1개(없으면 기본 옷차림).
-- 보유 목록과 분리해서, 소유는 유지한 채 다른 걸로 갈아입는 것도 표현 가능.
CREATE TABLE IF NOT EXISTS participant_equipped_outfit (
  participant_id text        PRIMARY KEY,
  outfit_id      text        NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);


GRANT SELECT, INSERT         ON participant_outfits          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON participant_equipped_outfit  TO anon, authenticated;

-- ── 잔액 음수 방지 가드 ──────────────────────────────────────
-- 1단계 스키마의 increment_currency_balance는 지급(양수)에만 쓰였는데,
-- 이제 구매(spend_shop, 음수 amount)에도 재사용한다. 클라이언트가
-- 잔액보다 비싼 아이템을 구매 시도하는(또는 anon 키로 직접 RPC를
-- 조작하는) 경우에도 DB 차원에서 balance가 음수로 내려가지 않게
-- 막는 최후 방어선 — CREATE OR REPLACE라 기존 지급(양수) 흐름과
-- 완전히 하위호환.
CREATE OR REPLACE FUNCTION increment_currency_balance(
  p_participant_id text,
  p_amount         integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  INSERT INTO participant_currency (participant_id, balance, updated_at)
  VALUES (p_participant_id, p_amount, now())
  ON CONFLICT (participant_id) DO UPDATE
    SET balance    = participant_currency.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO v_new_balance;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient_balance: participant % amount % would go negative (%)',
      p_participant_id, p_amount, v_new_balance;
  END IF;

  RETURN v_new_balance;
END;
$$;

-- ── 실행 후 확인용 쿼리 ──────────────────────────────────────
-- SELECT * FROM participant_outfits ORDER BY purchased_at DESC LIMIT 20;
-- SELECT * FROM participant_equipped_outfit ORDER BY updated_at DESC LIMIT 20;
