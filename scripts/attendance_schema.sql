-- ============================================================
-- 출석 보상(연속 출석 스트릭) 데이터 계층 — 신규 테이블 2개 +
-- currency_transactions.type 확장(earn_attendance 추가).
-- 일일 퀘스트(daily_quest_schema.sql)와는 완전히 별개 시스템 —
-- annotations/votes/블록 잠금/기존 화폐·퀘스트 로직은 전혀 건드리지 않음.
-- currency_schema.sql, daily_quest_schema.sql 이후에 실행.
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요)
--
-- 권한 패턴은 currency_schema.sql/daily_quest_schema.sql과 동일(anon 실측
-- 기준) — RLS는 켜지 않고, anon/authenticated에 명시적 GRANT.
--
-- 스트릭 모델: 7일 사다리. 마지막 출석일이 "어제"였을 때만 다음 날로
-- 이어서 증가하고, 하루라도 건너뛰면 1일차로 리셋(게임에서 가장 흔한
-- "연속 출석" 패턴). 7일차를 채운 다음 날은 다시 1일차부터 순환.
-- ============================================================

-- ── attendance_reward_templates ─────────────────────────────
-- 보상 카탈로그(정적). 1~7일차, 총 7 row. 날짜가 이어질수록 보상이
-- 커지고 7일차는 주간 보너스로 크게 지급.
CREATE TABLE IF NOT EXISTS attendance_reward_templates (
  day_index        integer     PRIMARY KEY CHECK (day_index BETWEEN 1 AND 7),
  reward_currency  integer     NOT NULL,
  description      text        NOT NULL
);

INSERT INTO attendance_reward_templates (day_index, reward_currency, description) VALUES
  (1, 10, '출석 1일차'),
  (2, 15, '출석 2일차'),
  (3, 20, '출석 3일차'),
  (4, 25, '출석 4일차'),
  (5, 30, '출석 5일차'),
  (6, 40, '출석 6일차'),
  (7, 70, '출석 7일차 — 주간 보너스!')
ON CONFLICT (day_index) DO UPDATE SET
  reward_currency = EXCLUDED.reward_currency,
  description     = EXCLUDED.description;

-- ── participant_attendance ──────────────────────────────────
-- 참여자별 출석 로그. 하루 최대 1 row. reward_currency는 지급 시점의
-- 템플릿 값을 스냅샷으로 같이 저장(daily_quest의 category_count_at_time과
-- 같은 이유 — 나중에 템플릿 보상액을 바꿔도 과거 지급 이력은 그대로 남음).
CREATE TABLE IF NOT EXISTS participant_attendance (
  id                bigint      generated always as identity PRIMARY KEY,
  participant_id    text        NOT NULL,
  check_in_date     date        NOT NULL,
  streak_day        integer     NOT NULL CHECK (streak_day BETWEEN 1 AND 7),
  reward_currency   integer     NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_participant_attendance_lookup
  ON participant_attendance (participant_id, check_in_date DESC);

-- annotations/votes와 동일한 패턴: RLS는 켜지 않는다(currency_schema.sql
-- 상단 주석의 실측 근거와 동일). 클라이언트(anon 키)가 오늘 체크인
-- insert·조회를 직접 하므로 명시적 GRANT.
GRANT SELECT             ON attendance_reward_templates TO anon, authenticated;
GRANT SELECT, INSERT     ON participant_attendance       TO anon, authenticated;

-- ── currency_transactions.type 확장 ─────────────────────────
-- 새 리워드 원장 테이블을 따로 만들지 않고 기존 currency_transactions를
-- 재사용한다(earn_quest와 동일한 지급 패턴). related_id에는 그 날의
-- participant_attendance row id(text 캐스팅)를 넣는다 — 하루당
-- id가 유일하므로 기존 UNIQUE(participant_id, related_id, type) 제약이
-- 날짜별 중복지급을 자동으로 막아준다(새 제약/RPC 불필요).
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_type_check;
ALTER TABLE currency_transactions ADD CONSTRAINT currency_transactions_type_check
  CHECK (type IN ('earn_annotation', 'earn_vote', 'spend_shop', 'earn_quest', 'earn_attendance'));

-- ── 실행 후 확인용 쿼리 ──────────────────────────────────────
-- SELECT * FROM attendance_reward_templates ORDER BY day_index;
-- SELECT * FROM participant_attendance ORDER BY check_in_date DESC, id DESC LIMIT 20;
-- SELECT * FROM currency_transactions WHERE type = 'earn_attendance' ORDER BY created_at DESC LIMIT 20;
