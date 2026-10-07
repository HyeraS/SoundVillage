import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('012 remains historical while 015 switches Duo Realtime to Supabase Auth membership', async () => {
  const [sql, forward] = await Promise.all([
    read('scripts/security/012_duo_session_v2.sql'),
    read('scripts/security/015_duo_es256_realtime_authorization.sql'),
  ])
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
  assert.match(forward, /PREFLIGHT_REQUIRED: apply and verify migrations 001 through 014 first/)
  assert.match(forward, /create or replace function private\.is_realtime_room_member\(p_topic text\)/)
  assert.match(forward, /auth\.uid\(\) is not null/)
  assert.match(forward, /p_topic='duo-v2:'\|\|session\.id::text/)
  assert.match(forward, /member\.auth_user_id=auth\.uid\(\)/)
  assert.match(forward, /participant\.status='active'/)
  assert.match(forward, /session\.status='active'/)
  assert.match(forward, /session\.expires_at>now\(\)/)
  assert.match(forward, /member\.left_at is null/)
  assert.match(forward, /lease\.state='active'/)
  assert.match(forward, /lease\.heartbeat_at>now\(\)-interval '45 seconds'/)
  assert.match(forward, /security definer set search_path=''/)
  assert.doesNotMatch(forward.slice(forward.indexOf('create or replace function')), /duo_(?:session_id|client_id|role)/)
  assert.doesNotMatch(forward, /grant (?:select|insert|update|delete)|to (?:public|anon)|drop policy|alter policy/i)
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
  assert.doesNotMatch(`${api}\n${routes}\n${server}`, /SUPABASE_JWT_SECRET|realtimeToken|duo_session_id|duo_client_id|duo_role/)
  assert.match(server, /DUO_SESSION_HMAC_SECRET/)
  assert.doesNotMatch(api, /console\.error\([^\n]*(?:message|access_token|inviteToken|sessionId|clientId)/)
})

test('client subscribes only to a validated server session and validates every position payload', async () => {
  const source = await read('lib/duoSession.js')
  assert.match(source, /duoRealtimeTopic\(sessionId\)/)
  assert.match(source, /config:\{ private: true, presence:\{ key:role \} \}/)
  assert.match(source, /validateDuoPositionPayload\(payload\)/)
  assert.match(source, /document\.visibilityState !== 'visible'/)
  assert.match(source, /DUO_POSITION_STALE_MS/)
  assert.match(source, /DUO_RECONNECT_MAX_ATTEMPTS/)
  assert.match(source, /auth\.getSession\(\)/)
  assert.match(source, /realtime\.setAuth\(data\.session\.access_token\)/)
  assert.match(source, /lastPositionRef/)
  assert.match(source, /currentScreen[\s\S]*channel\.send\(\{ type:'broadcast', event:'pos'/)
  assert.doesNotMatch(source, /shareToken|joinToken|inviteToken|probe.*channel/i)
  assert.doesNotMatch(source, /realtimeToken|SUPABASE_JWT_SECRET/)
})

test('private navigation uses waiting presence without making one participant follow the other', async () => {
  const [page, navigation, contract] = await Promise.all([
    read('app/page.js'),
    read('lib/duoNavigation.mjs'),
    read('lib/duoSessionContract.mjs'),
  ])
  assert.match(contract, /\['worldmap', 'interior', 'waiting'\]/)
  assert.doesNotMatch(contract, /'zone'|'museum'|'music'|'nature'/)
  assert.match(page, /resolveDuoPresenceScreen\(\{ screen, visiting:Boolean\(visiting\) \}\)/)
  assert.match(page, /resolveDuoVisitorFollowAction/)
  assert.match(navigation, /screen === 'world'[\s\S]*return 'worldmap'/)
  assert.match(navigation, /return 'waiting'/)
  assert.match(navigation, /peerScreen === 'interior'/)
  assert.match(navigation, /peerScreen === 'worldmap' && visiting/)
  assert.doesNotMatch(navigation, /setScreen|setActiveZone|participantId|groupId|unlockedBlock/)
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
