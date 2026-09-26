import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('transaction RPCs are authenticated, security definer, and fixed search path', async () => {
  const sql = await read('scripts/security/003_transactional_integrity.sql')
  for (const fn of ['submit_annotation_v3','submit_museum_vote_v3','ensure_today_check_in_v3','set_equipped_outfit_v3']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}`,'i'))
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}`,'i'))
  }
  assert.doesNotMatch(sql, /grant execute on function public\.award_participant_currency[^\n]*authenticated/i)
  assert.match(sql, /security definer set search_path = ''/i)
})

test('browser source writes and legacy reward/progress calls are revoked', async () => {
  const [sql,browser,currency,quests] = await Promise.all([
    read('scripts/security/003_transactional_integrity.sql'),read('lib/supabase.js'),read('lib/currency.js'),read('lib/dailyQuests.js'),
  ])
  assert.match(sql,/revoke insert on public\.annotations,public\.votes from authenticated/i)
  assert.doesNotMatch(browser,/\.from\(['"](?:annotations|votes)['"]\)\.insert/)
  assert.doesNotMatch(currency,/p_amount|increment_currency_balance/)
  assert.doesNotMatch(quests,/record_(?:annotation|vote)_quest_progress/)
  assert.match(sql,/revoke execute on function public\.record_annotation_quest_progress/)
})

test('purchase key originates in the browser and participant and price are not accepted from it', async () => {
  const [route,auth] = await Promise.all([read('app/api/participant-purchase/route.js'),read('lib/participantAuth.js')])
  assert.match(route,/body\?\.idempotencyKey/)
  assert.doesNotMatch(route,/body\?\.(?:participantId|participant_id|price)/)
  assert.match(route,/resolvePurchase\(kind, itemId\)/)
  assert.match(auth,/Authorization: `Bearer/)
})

test('UI advances only after successful annotation and vote results', async () => {
  const [annotation,museum] = await Promise.all([read('components/AnnotationPanel.js'),read('components/SoundMuseum.js')])
  assert.match(annotation,/if \(!result\.ok\) throw/)
  assert.match(annotation,/!e\.repeat/)
  assert.match(museum,/if \(!result\.ok\) throw/)
  assert.match(museum,/setSubmitError/)
  assert.doesNotMatch(museum,/catch \{\}\s*setSubmitting\(false\)\s*onDone\(\)/)
})
