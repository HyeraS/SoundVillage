import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('012 stores only token hashes and enforces two roles, one visitor and one active host session', async () => {
  const sql = await read('scripts/security/012_duo_session_v2.sql')
  assert.match(sql, /token_hash text primary key/)
  assert.doesNotMatch(sql, /\b(?:join|invite)_token\s+text\b/i)
  assert.match(sql, /unique\(session_id,role\)/)
  assert.match(sql, /duo_v2_one_active_session_per_host[\s\S]*where status='active'/)
  assert.match(sql, /heartbeat_at>now\(\)-interval '45 seconds'/)
  assert.match(sql, /duo_v2_host_room_eligible[\s\S]*count\(distinct placement->>'itemId'\)/)
  assert.match(sql, /room_system text not null/)
  assert.match(sql, /get_duo_v2_shared_room_admin\([\s\S]*p_client_id uuid/)
  assert.match(sql, /leave_duo_v2_session_admin[\s\S]*get diagnostics v_released=row_count[\s\S]*v_released<>1/)
  assert.match(sql, /duo_v2_visitor_legacy_currency_guard/)
  assert.match(sql, /set search_path=''/g)
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete).*authenticated/i)
  assert.doesNotMatch(sql, /drop policy/i)
})

test('Duo APIs derive identity from bearer auth and expose allow-listed response fields', async () => {
  const [api, routes, server] = await Promise.all([
    read('lib/duoApi.server.js'),
    Promise.all(['host','join','status','heartbeat','leave','revoke','recover','room'].map((name) => read(`app/api/duo-v2/${name}/route.js`))).then((parts) => parts.join('\n')),
    read('lib/duoSession.server.js'),
  ])
  assert.match(api, /requireSupabaseUser\(request\)/)
  assert.doesNotMatch(routes, /participantId|authUserId|serviceRole|realtimeTopic/)
  assert.doesNotMatch(routes, /body\.(?:participant|auth)/)
  assert.match(server, /createHmac\('sha256'/)
  assert.match(server, /createHash\('sha256'\)/)
  for (const claim of ['duo_session_id', 'duo_client_id', 'duo_role']) assert.match(server, new RegExp(claim))
})

test('client subscribes only to a validated server session and validates every position payload', async () => {
  const source = await read('lib/duoSession.js')
  assert.match(source, /duoRealtimeTopic\(sessionId\)/)
  assert.match(source, /config:\{ private: true, presence:\{ key:role \} \}/)
  assert.match(source, /validateDuoPositionPayload\(payload\)/)
  assert.match(source, /document\.visibilityState !== 'visible'/)
  assert.match(source, /DUO_POSITION_STALE_MS/)
  assert.match(source, /DUO_RECONNECT_MAX_ATTEMPTS/)
  assert.doesNotMatch(source, /shareToken|joinToken|inviteToken|probe.*channel/i)
})

test('new user events never add tokens, URLs, IDs or coordinates to metadata', async () => {
  const [events, page] = await Promise.all([read('lib/userEvents.js'), read('app/page.js')])
  for (const name of ['duo_invite_created','duo_invite_revoked','duo_join_attempted','duo_join_succeeded','duo_join_failed','duo_session_closed']) {
    assert.match(events, new RegExp(`'${name}'`))
  }
  for (const call of page.match(/trackEvent\('duo_[\s\S]{0,500}?\)/g) || []) {
    assert.doesNotMatch(call, /inviteToken|sessionId|participantId|realtimeClientId|\bx\b|\by\b|window\.location/)
  }
})

test('invite URLs are scrubbed before join and recovery retains no raw token', async () => {
  const page = await read('app/page.js')
  const scrub = page.slice(page.indexOf('function readAndScrubDuoInvite'), page.indexOf('function duoSessionState'))
  assert.match(scrub, /history\.replaceState/)
  assert.match(scrub, /sessionStorage\.removeItem\('soundvillage-duo-v2-invite'\)/)
  assert.match(page, /useLayoutEffect[\s\S]*url\.searchParams\.delete\('duo'\)/)
  assert.match(page, /const recovery = \{ sessionId:result\.sessionId, clientId:realtimeClientId, role:'visitor' \}/)
  assert.doesNotMatch(page, /setDuoRecovery\([^\n]*(?:inviteToken|duoInviteToken)/)
})
