/**
 * delete_test_data.mjs
 * 특정 participant_id 접두어로 남긴 테스트 데이터(annotations, votes)를 지운다.
 * seed_annotations.mjs와 같은 Supabase 클라이언트/키를 재사용.
 *
 * 실행 (프로젝트 루트에서):
 *   node scripts/delete_test_data.mjs <participant_id 접두어>
 *
 * 예:
 *   node scripts/delete_test_data.mjs TEST_
 *
 * 주의: vote_count는 increment_vote_count RPC로 올라간 값이라, votes 행을 지워도
 * 그 표현(annotation)의 vote_count는 자동으로 줄지 않는다. 테스트용 표현 자체도
 * 함께 지워지는 이 스크립트의 사용 범위에서는 문제되지 않는다.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nzzesrjneqsbkgtbaoxy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_MjNaGGc1Dqt16Ap9HNs3rg_Vqedp7T2'

const client = createClient(SUPABASE_URL, SUPABASE_KEY)

const prefix = process.argv[2]
if (!prefix) {
  console.error('사용법: node scripts/delete_test_data.mjs <participant_id 접두어>')
  console.error('예:     node scripts/delete_test_data.mjs TEST_')
  process.exit(1)
}

async function main() {
  console.log(`participant_id가 "${prefix}"로 시작하는 데이터를 삭제합니다...`)

  const { error: voteErr, count: voteCount } = await client
    .from('votes')
    .delete({ count: 'exact' })
    .like('participant_id', `${prefix}%`)
  if (voteErr) console.error('votes 삭제 오류:', voteErr.message)
  else console.log(`votes: ${voteCount ?? 0}개 삭제`)

  const { error: annErr, count: annCount } = await client
    .from('annotations')
    .delete({ count: 'exact' })
    .like('participant_id', `${prefix}%`)
  if (annErr) console.error('annotations 삭제 오류:', annErr.message)
  else console.log(`annotations: ${annCount ?? 0}개 삭제`)

  console.log('완료')
}

main().catch(console.error)
