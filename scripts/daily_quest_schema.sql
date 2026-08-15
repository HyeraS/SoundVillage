-- ============================================================
-- 일일 퀘스트(Daily Quest) 데이터 계층 — 신규 테이블 2개 +
-- currency_transactions.type 확장(earn_quest 추가).
-- annotations/votes/블록 잠금/기존 화폐·상점 로직은 전혀 건드리지 않음.
-- currency_schema.sql, shop_schema.sql 이후에 실행.
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요)
--
-- 권한 패턴은 currency_schema.sql/shop_schema.sql과 동일(anon 실측
-- 기준) — RLS는 켜지 않고, anon/authenticated에 명시적 GRANT.
--
-- 마일스톤 구간(5/10/20개) 추적 방식: jsonb 배열 컬럼 대신 "구간별
-- 별도 row"로 설계 — daily_quest_templates에 마일스톤 3구간을 각각
-- 별도 row(tier_index 1/2/3)로 두고, participant_daily_quests도
-- 구간마다 별도 row가 생긴다. 이렇게 하면 currency_transactions의
-- 기존 UNIQUE(participant_id, related_id, type) + "insert 먼저
-- 확정 → 성공하면 balance 증가" 원자적 중복지급 방지 패턴을 그대로
-- 재사용할 수 있다(related_id = 그 구간의 participant_daily_quests.id).
-- jsonb 배열 방식은 합성 related_id와 read-modify-write 경쟁조건
-- 방지용 RPC가 새로 필요해서 기각했다.

-- ============================================================

-- ── daily_quest_templates ───────────────────────────────────
-- 퀘스트 카탈로그(정적). 마일스톤 3구간 + 다양성 2종 + 투표, 총 6 row.
CREATE TABLE IF NOT EXISTS daily_quest_templates (

  id                      text        PRIMARY KEY,
  type                    text        NOT NULL

    CHECK (type IN ('collect_milestone', 'visit_zone', 'category_participate', 'vote_n_times')),
  tier_index              integer,     -- collect_milestone만 1/2/3, 나머진 null(정렬·그룹핑용)
  description             text        NOT NULL,

  target_count            integer     NOT NULL,
  reward_currency         integer     NOT NULL,
  reward_material_zone    text,        -- 재료 시스템 미구현이라 지금은 전부 null(화폐만 지급 폴백)
  reward_material_count   integer,
  active                  boolean     NOT NULL DEFAULT true
);

INSERT INTO daily_quest_templates
  (id, type, tier_index, description, target_count, reward_currency)
VALUES
  ('collect_milestone_1', 'collect_milestone', 1, '오늘 소리 5개 채집하기',  5,  20),
  ('collect_milestone_2', 'collect_milestone', 2, '오늘 소리 10개 채집하기', 10, 30),
  ('collect_milestone_3', 'collect_milestone', 3, '오늘 소리 20개 채집하기', 20, 50),
  ('visit_zone',          'visit_zone',        null, '오늘 안 가본 Zone에서 소리 1개 채집하기', 1, 40),
  ('category_participate','category_participate', null, '참여가 적었던 카테고리 소리 1개 전사하기', 1, 40),
  ('vote_10',             'vote_n_times',      null, '오늘 투표 10회 하기', 10, 30)
ON CONFLICT (id) DO UPDATE SET
  type                  = EXCLUDED.type,
  tier_index            = EXCLUDED.tier_index,
  description            = EXCLUDED.description,
  target_count            = EXCLUDED.target_count,
  reward_currency          = EXCLUDED.reward_currency;

-- ── participant_daily_quests ────────────────────────────────
-- 참여자별/날짜별 퀘스트 진행 상태. 마일스톤은 구간마다(row 3개) 별도로
-- 배정된다. progress_count는 항상 "현재 시점의 절대 누적값"을 그대로
-- 덮어써서 기록한다(증분(+=) 아님) — 소스오브트루스(annotations/votes
-- 카운트)에서 계산한 값을 그대로 UPDATE하는 방식이라 별도 원자적
-- 증가 RPC 없이도 lost-update 문제가 생기지 않는다.
CREATE TABLE IF NOT EXISTS participant_daily_quests (
  id                    bigint      generated always as identity PRIMARY KEY,
  participant_id        text        NOT NULL,
  quest_template_id     text        NOT NULL REFERENCES daily_quest_templates(id),
  assigned_date          date        NOT NULL,
  progress_count          integer     NOT NULL DEFAULT 0,
  target_sub_category      text,      -- category_participate만: 배정 시점에 고른 대상 카테고리
  completed                boolean     NOT NULL DEFAULT false,
  completed_at              timestamptz,
  UNIQUE (participant_id, quest_template_id, assigned_date)
);

CREATE INDEX IF NOT EXISTS idx_participant_daily_quests_lookup
  ON participant_daily_quests (participant_id, assigned_date);

-- annotations/votes와 동일한 패턴: RLS는 켜지 않는다(currency_schema.sql
-- 상단 주석의 실측 근거와 동일). 카탈로그는 읽기만, 진행 테이블은
-- 배정(insert)·진행도 갱신(update)까지 클라이언트(anon 키)가 직접 하므로
-- 명시적 GRANT.
GRANT SELECT                        ON daily_quest_templates    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE        ON participant_daily_quests TO anon, authenticated;

-- ── currency_transactions.type 확장 ─────────────────────────
-- 새 리워드 원장 테이블을 따로 만들지 않고 기존 currency_transactions를
-- 재사용한다(earn_annotation/earn_vote와 동일한 지급 패턴 — insert 먼저
-- 확정 → increment_currency_balance). related_id에는 보상을 지급하는
-- participant_daily_quests row의 id(text 캐스팅)를 넣는다 — row 하나당
-- id가 유일하므로 기존 UNIQUE(participant_id, related_id, type) 제약이
-- 구간별 중복지급을 자동으로 막아준다(새 제약/RPC 불필요).
ALTER TABLE currency_transactions DROP CONSTRAINT IF EXISTS currency_transactions_type_check;
ALTER TABLE currency_transactions ADD CONSTRAINT currency_transactions_type_check
  CHECK (type IN ('earn_annotation', 'earn_vote', 'spend_shop', 'earn_quest'));

-- ── 실행 후 확인용 쿼리 ──────────────────────────────────────
-- SELECT * FROM daily_quest_templates ORDER BY type, tier_index;
-- SELECT * FROM participant_daily_quests ORDER BY assigned_date DESC, id DESC LIMIT 20;
-- SELECT * FROM currency_transactions WHERE type = 'earn_quest' ORDER BY created_at DESC LIMIT 20;







\
\


