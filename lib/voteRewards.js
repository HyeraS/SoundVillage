import { getVoteCountByParticipant } from '@/lib/supabase';
import { awardCurrency } from '@/lib/currency';
import { grantHouseItem } from '@/lib/houseDecor';
import { HOUSE_ITEMS } from '@/lib/houseCatalog';

/* ─────────────────────────────────────────────
   투표 마일스톤 보상 — 누적 투표 수가 N의 배수가 될 때마다 코인,
   M의 배수가 될 때마다 하우스 아이템 1개를 지급한다.
   components/SoundMuseum.js의 saveVote 성공 직후에서만 호출.
   annotations/votes/블록 잠금 로직은 참조만 하고 절대 안 건드림.
───────────────────────────────────────────── */
export const VOTE_COIN_MILESTONE_INTERVAL       = 5   // N: 코인 지급 주기(투표 5회마다)
export const VOTE_COIN_MILESTONE_AMOUNT         = 10  // 마일스톤 1회당 지급 코인
export const VOTE_HOUSE_ITEM_MILESTONE_INTERVAL = 20  // M: 하우스 아이템 지급 주기(투표 20회마다)

/* ─────────────────────────────────────────────
   currency_transactions.type CHECK 제약이 이미
   ('earn_annotation','earn_vote','spend_shop')로 고정 배포돼 있고
   이 테이블은 ALTER 금지라, 두 마일스톤 보상 모두 'earn_vote'를
   재사용한다(둘 다 투표 활동에서 비롯된 보상이라 의미상으로도 맞음).
   같은 type을 쓰는 두 이벤트가 서로 충돌하지 않도록 related_id
   접두사를 다르게 준다:
     - 코인:  vote_coin_milestone:{voteCount}
     - 아이템: vote_item_milestone:{voteCount}
   voteCount는 참여자별로 단조증가하고 마일스톤 숫자는 한 번만
   등장하므로, related_id 자체가 자연스러운 idempotency key가 된다 —
   같은 마일스톤에서 이 함수가 실수로 두 번 불려도 UNIQUE(participant_id,
   related_id, type) 제약이 두 번째 지급을 막아준다(house-decor의
   nonce 방식과 달리 여기선 진짜 재시도 방지가 됨).
   아이템 마일스톤은 화폐 이동이 없으므로 amount=0으로 감사로그만 남긴다.
───────────────────────────────────────────── */
export async function awardVoteMilestoneRewards(participantId) {
  try {
    const voteCount = await getVoteCountByParticipant(participantId);
    let coinAwarded = false;
    let itemAwarded = null;

    if (voteCount > 0 && voteCount % VOTE_COIN_MILESTONE_INTERVAL === 0) {
      const result = await awardCurrency({
        participantId,
        type: 'earn_vote',
        amount: VOTE_COIN_MILESTONE_AMOUNT,
        relatedId: `vote_coin_milestone:${voteCount}`,
      });
      coinAwarded = result.ok;
    }

    if (voteCount > 0 && voteCount % VOTE_HOUSE_ITEM_MILESTONE_INTERVAL === 0) {
      const item = HOUSE_ITEMS[Math.floor(Math.random() * HOUSE_ITEMS.length)];
      const granted = await grantHouseItem({ participantId, itemId: item.id });
      if (granted) {
        itemAwarded = item.id;
        await awardCurrency({
          participantId,
          type: 'earn_vote',
          amount: 0,
          relatedId: `vote_item_milestone:${voteCount}`,
        });
      }
    }

    return { voteCount, coinAwarded, itemAwarded };
  } catch (err) {
    console.error('[voteRewards] awardVoteMilestoneRewards 오류 (투표 저장에는 영향 없음):', err);
    return { voteCount: null, coinAwarded: false, itemAwarded: null };
  }
}
