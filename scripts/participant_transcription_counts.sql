-- ============================================================
-- 참여자별 전사(transcription) 개수 확인
-- Supabase SQL Editor에서 실행
--
-- "완료된 전사"는 코드(lib/supabase.js)의 정의를 그대로 따른다:
--   - is_skipped = false (건너뛴 건 미완료로 취급)
--   - expression_text가 비어있지 않음 (getAnnotationCountForSound와 동일 기준)
-- ============================================================

-- 1) 참여자별 완료 전사 개수 (기본)
SELECT
  participant_id,
  COUNT(*) AS completed_count
FROM annotations
WHERE is_skipped = false
  AND expression_text IS NOT NULL
  AND expression_text <> ''
GROUP BY participant_id
ORDER BY completed_count DESC;

-- 2) 참여자별 완료 / 건너뜀 / 전체 시도 개수를 한 번에
SELECT
  participant_id,
  COUNT(*) FILTER (
    WHERE is_skipped = false
      AND expression_text IS NOT NULL
      AND expression_text <> ''
  ) AS completed_count,
  COUNT(*) FILTER (WHERE is_skipped = true) AS skipped_count,
  COUNT(*) AS total_attempts
FROM annotations
GROUP BY participant_id
ORDER BY completed_count DESC;

-- 3) 참여자 × zone별 완료 전사 개수 (구역별로 얼마나 진행했는지 보고 싶을 때)
SELECT
  participant_id,
  zone,
  COUNT(*) AS completed_count
FROM annotations
WHERE is_skipped = false
  AND expression_text IS NOT NULL
  AND expression_text <> ''
GROUP BY participant_id, zone
ORDER BY participant_id, zone;
