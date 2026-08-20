-- ============================================================
-- 핵심 데이터 계층 — annotations / votes
-- 이 저장소에는 원래 이 두 테이블을 만든 SQL이 없었다(프로젝트 초창기에
-- Supabase 대시보드에서 직접 생성됨). 새 Supabase 프로젝트(프리뷰/스테이징용
-- 등)를 만들 때 필요해서, 기존(프로덕션) 프로젝트의 Table Editor →
-- "Export as SQL definition"으로 뽑은 실제 컬럼 정의를 그대로 옮기고
-- (2026-08-15 기준), currency_schema.sql 등과 동일한 패턴으로
-- GRANT + increment_vote_count RPC를 채워 완전한 스크립트로 만들었다.
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요)
--
-- ── 권한 패턴: currency_schema.sql 상단 주석의 실측 근거와 동일 ──
-- 프로덕션에서 anon 키로 annotations/votes를 RLS 제약 없이 전체 조회
-- 가능함을 실측으로 확인했음(2026-08-05, currency_schema.sql 참고).
-- 여기서도 RLS는 켜지 않고 anon/authenticated에 명시적 GRANT.
-- ============================================================

-- ── annotations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id text NOT NULL,
  session_id text NOT NULL,
  sound_id text NOT NULL,
  zone text NOT NULL,
  expression_text text,
  selected_features text[],
  confidence integer,
  difficulty integer,
  play_count integer DEFAULT 0,
  listening_time_sec double precision,
  is_skipped boolean DEFAULT false,
  skip_reason text,
  device_info text,
  version text DEFAULT 'v0.3-web'::text,
  created_at timestamp with time zone DEFAULT now(),
  sub_category text DEFAULT ''::text,
  stage integer DEFAULT 1,
  is_verified boolean DEFAULT false,
  vote_count integer DEFAULT 0,
  source_type text DEFAULT ''::text,
  audioset_class text DEFAULT ''::text,
  CONSTRAINT annotations_pkey PRIMARY KEY (id)
);

-- ── votes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id text NOT NULL,
  session_id text NOT NULL,
  sound_id text NOT NULL,
  zone text NOT NULL,
  annotation_id uuid NOT NULL,
  play_count integer DEFAULT 0,
  listening_time_sec double precision DEFAULT 0,
  stage integer DEFAULT 2,
  version text DEFAULT 'v0.4-web'::text,
  created_at timestamp with time zone DEFAULT now(),
  confidence integer DEFAULT 3,
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_annotation_id_fkey FOREIGN KEY (annotation_id) REFERENCES public.annotations(id)
);

-- 클라이언트(anon 키)가 직접 select/insert하므로 명시적 GRANT.
-- annotations는 increment_vote_count RPC가 내부적으로 UPDATE(vote_count)를
-- 실행하는데 SECURITY DEFINER가 아니라 호출자(anon) 권한으로 도니 UPDATE도 필요.
GRANT SELECT, INSERT, UPDATE ON public.annotations TO anon, authenticated;
GRANT SELECT, INSERT         ON public.votes        TO anon, authenticated;

-- ── increment_vote_count RPC ─────────────────────────────────
-- lib/supabase.js의 submitVotes()가 votes insert 후 각 annotation_id마다
-- 호출 — annotations.vote_count를 1씩 증가시킨다.
CREATE OR REPLACE FUNCTION increment_vote_count(annotation_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE annotations SET vote_count = vote_count + 1 WHERE id = annotation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_vote_count(uuid) TO anon, authenticated;

-- ── 실행 후 확인용 쿼리 ──────────────────────────────────────
-- SELECT * FROM annotations ORDER BY created_at DESC LIMIT 20;
-- SELECT * FROM votes ORDER BY created_at DESC LIMIT 20;
