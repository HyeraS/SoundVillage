import { getClient } from '@/lib/supabase';
import soundMetadata from '@/data/sound_metadata.json';

const ALL_SUB_CATEGORIES = [...new Set(
  (soundMetadata.sounds || []).map((sound) => sound.sub_category).filter(Boolean)
)];

// 모든 변경과 보상 계산은 DB에서 현재 JWT 참가자를 기준으로 원자적으로 수행한다.
// participantId는 기존 호출부 호환용이며 보안 판단에 사용하지 않는다.
export async function ensureTodayQuests(_participantId) {
  const { data, error } = await getClient().rpc('ensure_today_quests', {
    p_known_sub_categories: ALL_SUB_CATEGORIES,
  });
  if (error) {
    console.error('[dailyQuests] ensureTodayQuests 실패:', error);
    throw error;
  }
  if (!data) throw new Error('PARTICIPANT_NOT_CLAIMED');
  return data;
}

export async function getTodayQuestSummary(participantId) {
  return ensureTodayQuests(participantId);
}
