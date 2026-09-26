-- ============================================================
-- 핵심 데이터 계층 — annotations / votes
--
-- Canonical source: git commit 2113e189eb8e788ac8efbddb48178a3d08a13e01,
-- copied from the production Table Editor SQL definition on 2026-08-15.
-- This file restores that reviewed historical artifact byte-for-byte below
-- this provenance note; it does not assert that production is still identical.
-- Apply only to a new disposable/local or separately approved environment.
-- ============================================================

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

GRANT SELECT, INSERT, UPDATE ON public.annotations TO anon, authenticated;
GRANT SELECT, INSERT         ON public.votes        TO anon, authenticated;

CREATE OR REPLACE FUNCTION increment_vote_count(annotation_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE annotations SET vote_count = vote_count + 1 WHERE id = annotation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_vote_count(uuid) TO anon, authenticated;

