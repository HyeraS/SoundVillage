import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('migration creates an isolated six-wallet model and preserves legacy names', async () => {
  const sql = await read('scripts/security/008_multi_village_economy.sql')
  assert.match(sql, /create table public\.participant_village_wallets/i)
  assert.match(sql, /primary key \(participant_id, village\)/i)
  assert.match(sql, /village in \('Animal','Human','Nature','Urban','Music','Lab'\)/)
  assert.match(sql, /balance bigint not null default 0 check \(balance >= 0\)/i)
  assert.doesNotMatch(sql, /(?:drop|truncate|update|delete from) public\.participant_currency/i)
  assert.doesNotMatch(sql, /(?:drop|truncate|update|delete from) public\.currency_transactions/i)
})

test('wallet mutation is service-only, own-read RLS protected, and ledger immutable', async () => {
  const sql = await read('scripts/security/008_multi_village_economy.sql')
  assert.match(sql, /participant_village_wallets_select_own[\s\S]*private\.current_participant_id\(\)/i)
  assert.match(sql, /revoke all on public\.participant_village_wallets[\s\S]*from public,anon,authenticated/i)
  assert.match(sql, /grant select on public\.participant_village_wallets[\s\S]*to authenticated/i)
  assert.match(sql, /village_currency_ledger_immutable/i)
  for (const fn of ['purchase_multi_village_item_admin', 'claim_multi_village_attendance_admin', 'credit_verified_activity_village_admin']) {
    assert.match(sql, new RegExp(`function public\\.${fn}[\\s\\S]*service_role_required`, 'i'))
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`, 'i'))
  }
})

test('purchase locks canonical wallets, validates the full vector, and records atomic grouped effects', async () => {
  const sql = await read('scripts/security/008_multi_village_economy.sql')
  const purchase = sql.match(/create or replace function public\.purchase_multi_village_item_admin[\s\S]*?end \$\$;/i)?.[0] || ''
  assert.match(purchase, /order by array_position\(array\['Animal','Human','Nature','Urban','Music','Lab'\]/)
  assert.match(purchase, /for update/)
  assert.ok(purchase.indexOf("v_shortages <> '{}'::jsonb") < purchase.indexOf('set balance=balance-v_required'))
  assert.match(purchase, /operation_id[\s\S]*v_purchase_id/)
  assert.match(purchase, /sum\(value::bigint\)[\s\S]*< 1/)
  assert.match(purchase, /bundle_partially_owned/)
  assert.match(purchase, /already_owned/)
  assert.match(purchase, /participant_catalog_items\(participant_id,item_id,acquisition_source,source_purchase_id\)/)
  assert.match(purchase, /eligible_pending_asset/)
  assert.doesNotMatch(purchase, /insert into public\.participant_catalog_items[^;]*placeholder_/i)
})

test('attendance stores HMAC decisions, uses a KST ISO week, and chooses day 7 after wallet locks', async () => {
  const sql = await read('scripts/security/008_multi_village_economy.sql')
  const claim = sql.match(/create or replace function public\.claim_multi_village_attendance_admin[\s\S]*?end \$\$;/i)?.[0] || ''
  assert.match(sql, /multi_village_attendance_weeks/)
  assert.match(sql, /multi_village_today_kst[\s\S]*now\(\) at time zone 'Asia\/Seoul'/)
  assert.match(claim, /private\.multi_village_today_kst\(\)/)
  assert.match(claim, /extract\(isodow from v_today\)/)
  assert.match(claim, /array\[2,2,2,3,3,4\]/)
  assert.match(claim, /v_amount:=5/)
  assert.ok(claim.indexOf('for update') < claim.indexOf('select min(balance)'))
  assert.match(claim, /primary key|multi_village_attendance_claims/i)
})

test('new API accepts IDs only and contains no daily deal or discount behavior', async () => {
  const [route, adapter, server, legacy] = await Promise.all([
    read('app/api/economy-v1/purchase/route.js'),
    read('lib/economyCatalogV1.server.js'),
    read('lib/multiVillageEconomy.server.js'),
    read('app/api/participant-purchase/route.js'),
  ])
  const newEconomy = [route, adapter, server].join('\n')
  assert.match(route, /body\?\.itemId/)
  assert.match(route, /idempotencyKey/)
  assert.doesNotMatch(route, /body\?\.(?:price|cost|village|amount|grantItemIds)/)
  assert.doesNotMatch(newEconomy, /daily.?deal|discount/i)
  assert.match(legacy, /secure_purchase_admin/)
})
