-- ============================================================
-- 화폐 시스템 데이터 계층 — 신규 테이블 2개 + 잔액 증가 RPC
-- annotations/votes/블록 잠금 로직은 전혀 건드리지 않음, 완전히 별도 테이블.
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요)
--
-- ── 권한 패턴: annotations/votes와 동일하게 맞춤 ──────────────
-- 이 저장소에는 annotations/votes를 만든 원본 SQL이 없어서(기존
-- 리스크) pg_policies/pg_tables를 직접 조회할 방법이 없다(psql/
-- Supabase CLI 없음, PostgREST는 카탈로그를 노출 안 함). 대신
-- anon 키와 service_role 키로 같은 쿼리를 던져 행 수를 비교하고,
-- increment_vote_count RPC를 anon 키로 호출해 실제로 어떤 권한이
-- 적용 중인지 실측했다(2026-08-05):
--   - annotations: service_role count=4052 / anon count=4052 (동일)
--   - votes:       service_role count=4006 / anon count=4006 (동일)
--     → anon이 행 단위 제약 없이 전체를 그대로 보고 있음 = RLS가
--       비활성 상태이거나, 있어도 anon에 완전 허용 정책이 걸려있어
--       사실상 동일한 효과. (participant_id는 인증 없는 자유입력
--       텍스트라 애초에 auth.uid() 기반 정책을 걸 근거도 없음.)
--   - increment_vote_count(annotation_id=-999999999)를 anon 키로
--     호출 → "permission denied"(42501)가 아니라 "invalid input
--     syntax for type uuid"(22P02)로 실패 = 권한 체크를 통과해서
--     함수 본문의 타입 캐스팅 단계까지 도달했다는 뜻 → anon이 이미
--     이 함수에 대한 EXECUTE 권한을 갖고 있음(명시적 GRANT문 없이
--     Supabase 프로젝트 기본 권한으로 자동 부여된 것으로 보임).
--
-- 아래서는 이 실측 결과를 그대로 복제한다: 새 테이블 2개는 RLS를
-- 켜지 않고(기존과 동일하게 비활성 유지), 혹시 이 프로젝트의 기본
-- 권한 설정이 다를 경우에 대비해 anon/authenticated에 대한 명시적
-- GRANT도 추가해 이중으로 보장한다.
-- ============================================================

-- ── participant_currency ────────────────────────────────────
-- 참여자별 현재 잔액. participant_id가 PK이므로 upsert로 증감.
CREATE TABLE IF NOT EXISTS participant_currency (
  participant_id text        PRIMARY KEY,
  balance         integer     NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── currency_transactions ───────────────────────────────────
-- 지급/차감 이력 전부 기록. amount 계산에 지금 당장 안 쓰는 컨텍스트
-- (sound_duration_sec, sub_category, category_count_at_time, confidence)도
-- 항상 채워서 저장 — 나중에 보상 정책을 카테고리 희귀도/난이도 기반으로
-- 바꿀 때 소급 분석 및 실시간 전환에 쓸 재료.
CREATE TABLE IF NOT EXISTS currency_transactions (
  id                      bigint generated always as identity PRIMARY KEY,
  participant_id          text        NOT NULL,
  type                    text        NOT NULL
    CHECK (type IN ('earn_annotation', 'earn_vote', 'spend_shop')),
  amount                  integer     NOT NULL,
  related_id              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  sound_duration_sec      numeric,
  sub_category            text,
  category_count_at_time  integer,
  confidence              integer
);

-- 같은 참여자가 같은 대상(sound_id/annotation_id 등)에 같은 타입으로
-- 두 번 지급받는 것을 DB 레벨에서 막는다 — awardCurrency가 중복
-- 호출되거나(네트워크 재시도 등) 나중에 UI에서 이중 클릭 방지가
-- 뚫리는 경우에도 이 제약이 최후 방어선이 됨. DROP IF EXISTS를 먼저 해서
-- 재실행 가능하게 함(daily_quest_schema.sql의 type CHECK 제약과 동일 패턴).
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS unique_reward_per_action;
ALTER TABLE currency_transactions
  ADD CONSTRAINT unique_reward_per_action
  UNIQUE (participant_id, related_id, type);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_participant
  ON currency_transactions (participant_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_type
  ON currency_transactions (type);

-- annotations/votes와 동일한 패턴: RLS는 켜지 않는다(위 실측 근거).
-- 클라이언트(anon 키)가 잔액 upsert(RPC 경유)·거래 기록 insert·
-- (다음 단계 UI용) 잔액 select를 바로 할 수 있도록 명시적 GRANT.
GRANT SELECT, INSERT, UPDATE ON participant_currency  TO anon, authenticated;
GRANT SELECT, INSERT         ON currency_transactions TO anon, authenticated;

-- ── increment_currency_balance RPC ──────────────────────────
-- participant_currency를 원자적으로 upsert(insert or balance += amount).
-- votes 테이블의 increment_vote_count RPC와 동일한 패턴.
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

  RETURN v_new_balance;
END;
$$;

-- increment_vote_count는 명시 GRANT 없이도 anon이 이미 EXECUTE 가능했지만
-- (Supabase 기본 권한으로 추정), 이 프로젝트의 기본 설정을 100% 확신할 수
-- 없으므로 이 함수는 명시적으로 GRANT해 애매함을 없앤다.
GRANT EXECUTE ON FUNCTION increment_currency_balance(text, integer) TO anon, authenticated;

-- ── 실행 후 확인용 쿼리 ──────────────────────────────────────
-- SELECT * FROM participant_currency ORDER BY updated_at DESC LIMIT 20;
-- SELECT * FROM currency_transactions ORDER BY created_at DESC LIMIT 20;
