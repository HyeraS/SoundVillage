-- ============================================================
-- sound_id 포맷 정규화 마이그레이션
-- 구버전 약어(MUS_, LAB_, ANI_ 등) → 신버전 전체명(Music_, Lab_, Animal_)
-- Supabase SQL Editor에서 실행 (서비스 롤 권한 필요)
-- ============================================================

-- 실행 전 현황 확인
SELECT sound_id, zone, COUNT(*) AS cnt
FROM annotations
WHERE sound_id ~ '^(City|MUS|LAB|ANI|HUM|NAT|URB)_'
GROUP BY sound_id, zone
ORDER BY zone, sound_id;

-- ── annotations 테이블 ────────────────────────────────────────

-- City_ → Urban_ (zone 필드도 함께 수정)
UPDATE annotations
SET sound_id = 'Urban_' || SPLIT_PART(sound_id, '_', 2),
    zone     = 'Urban'
WHERE sound_id LIKE 'City_%';

-- MUS_ → Music_
UPDATE annotations
SET sound_id = 'Music_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'MUS_%';

-- LAB_ (대문자) → Lab_
UPDATE annotations
SET sound_id = 'Lab_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'LAB_%';

-- ANI_ → Animal_
UPDATE annotations
SET sound_id = 'Animal_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'ANI_%';

-- HUM_ → Human_
UPDATE annotations
SET sound_id = 'Human_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'HUM_%';

-- NAT_ → Nature_
UPDATE annotations
SET sound_id = 'Nature_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'NAT_%';

-- URB_ → Urban_
UPDATE annotations
SET sound_id = 'Urban_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'URB_%';

-- ── votes 테이블 ──────────────────────────────────────────────

UPDATE votes
SET sound_id = 'Urban_' || SPLIT_PART(sound_id, '_', 2),
    zone     = 'Urban'
WHERE sound_id LIKE 'City_%';

UPDATE votes
SET sound_id = 'Music_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'MUS_%';

UPDATE votes
SET sound_id = 'Lab_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'LAB_%';

UPDATE votes
SET sound_id = 'Animal_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'ANI_%';

UPDATE votes
SET sound_id = 'Human_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'HUM_%';

UPDATE votes
SET sound_id = 'Nature_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'NAT_%';

UPDATE votes
SET sound_id = 'Urban_' || SPLIT_PART(sound_id, '_', 2)
WHERE sound_id LIKE 'URB_%';

-- 실행 후 검증 — 구 포맷 잔존 여부 확인
SELECT COUNT(*) AS remaining_old_format
FROM annotations
WHERE sound_id ~ '^(City|MUS|LAB|ANI|HUM|NAT|URB)_';

SELECT COUNT(*) AS remaining_old_format_votes
FROM votes
WHERE sound_id ~ '^(City|MUS|LAB|ANI|HUM|NAT|URB)_';
