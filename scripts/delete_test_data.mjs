/**
 * delete_test_data.mjs
 * 테스트 단계에서 남긴 데이터(annotations, votes)를 지운다.
 * seed_annotations.mjs와 같은 Supabase 클라이언트/키를 재사용.
 *
 * 실행 (프로젝트 루트에서):
 *   node scripts/delete_test_data.mjs <participant_id 접두어>   — 그 접두어만 삭제
 *   node scripts/delete_test_data.mjs --all --yes-really-delete-everything
 *                                                                — annotations/votes 전체 삭제
 *
 * 예:
 *   node scripts/delete_test_data.mjs TEST_
 *   node scripts/delete_test_data.mjs --all --yes-really-delete-everything
 *
 * 주의: vote_count는 increment_vote_count RPC로 올라간 값이라, votes 행을 지워도
 * 그 표현(annotation)의 vote_count는 자동으로 줄지 않는다. 접두어 삭제 모드에서는
 * 테스트용 표현 자체도 함께 지워지므로 문제되지 않지만, --all 모드는 애초에 모든
 * annotations/votes를 다 지우므로 이 문제 자체가 발생하지 않는다.
 *
 * --all은 실제 참여자 데이터가 하나라도 쌓인 뒤에는 절대 실행하지 말 것 —
 * 되돌릴 방법이 없다.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nzzesrjneqsbkgtbaoxy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_MjNaGGc1Dqt16Ap9HNs3rg_Vqedp7T2'

const client = createClient(SUPABASE_URL, SUPABASE_KEY)

const args = process.argv.slice(2)
const wipeAll = args.includes('--all')
const confirmed = args.includes('--yes-really-delete-everything')
const prefix = !wipeAll ? args[0] : null

if (!wipeAll && !prefix) {
  console.error('사용법: node scripts/delete_test_data.mjs <participant_id 접두어>')
  console.error('  또는: node scripts/delete_test_data.mjs --all --yes-really-delete-everything')
  process.exit(1)
}
if (wipeAll && !confirmed) {
  console.error('전체 삭제(--all)는 --yes-really-delete-everything 플래그도 같이 줘야 실행됩니다.')
  console.error('(실제 참여자 데이터가 있는 상태에서는 절대 쓰지 마세요 — 복구 불가)')
  process.exit(1)
}

// Supabase/PostgREST는 필터 없는 delete()를 막아서, participant_id가 절대
// 실제 값일 수 없는 문자열과 다르다(neq)는 조건으로 사실상 "전체"를 매칭시킨다.
// id 컬럼 타입(uuid/bigint 등)을 몰라도 되는 방식.
const IMPOSSIBLE_ID = '\x00__NEVER_A_REAL_PARTICIPANT_ID__\x00'

async function main() {
  if (wipeAll) {
    console.log('annotations/votes 테이블 전체를 삭제합니다...')
    const { error: voteErr, count: voteCount } = await client
      .from('votes').delete({ count: 'exact' }).neq('participant_id', IMPOSSIBLE_ID)
    if (voteErr) console.error('votes 삭제 오류:', voteErr.message)
    else console.log(`votes: ${voteCount ?? 0}개 삭제`)

    const { error: annErr, count: annCount } = await client
      .from('annotations').delete({ count: 'exact' }).neq('participant_id', IMPOSSIBLE_ID)
    if (annErr) console.error('annotations 삭제 오류:', annErr.message)
    else console.log(`annotations: ${annCount ?? 0}개 삭제`)
  } else {
    console.log(`participant_id가 "${prefix}"로 시작하는 데이터를 삭제합니다...`)
    const { error: voteErr, count: voteCount } = await client
      .from('votes').delete({ count: 'exact' }).like('participant_id', `${prefix}%`)
    if (voteErr) console.error('votes 삭제 오류:', voteErr.message)
    else console.log(`votes: ${voteCount ?? 0}개 삭제`)

    const { error: annErr, count: annCount } = await client
      .from('annotations').delete({ count: 'exact' }).like('participant_id', `${prefix}%`)
    if (annErr) console.error('annotations 삭제 오류:', annErr.message)
    else console.log(`annotations: ${annCount ?? 0}개 삭제`)
  }

  console.log('완료')
}

main().catch(console.error)
