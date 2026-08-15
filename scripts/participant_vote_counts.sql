-- ============================================================
-- 참여자별 투표(votes) 개수 확인
-- Supabase SQL Editor에서 실행
--
-- 주의: votes 테이블은 saveVote()에서 voted_ids 배열을 한 줄씩 insert하므로,
-- 사운드 하나에 여러 표현을 투표하면 그만큼 행이 여러 개 생긴다.
-- → "raw_vote_count"는 투표한 행(표현 하나하나) 개수, "sounds_voted"는
--   실제로 투표를 마친 사운드(세션) 개수다. 보통 후자가 진행 상황 파악에 더 유용하다.
-- ============================================================

-- 1) 참여자별 투표 행 개수 + 투표한 고유 사운드 개수
SELECT
  participant_id,
  COUNT(*)                          AS raw_vote_count,
  COUNT(DISTINCT sound_id)          AS sounds_voted
FROM votes
GROUP BY participant_id
ORDER BY sounds_voted DESC;

-- 2) 참여자 × zone별 투표한 고유 사운드 개수 (구역별 진행 상황)
SELECT
  participant_id,
  zone,
  COUNT(DISTINCT sound_id) AS sounds_voted
FROM votes
GROUP BY participant_id, zone
ORDER BY participant_id, zone;
