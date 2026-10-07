import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) throw new Error('Local Duo Realtime environment is incomplete')
await requireLoopbackSupabaseUrl(url, 'SECURITY_TEST_SUPABASE_URL')

const options = { auth:{ autoRefreshToken:false, detectSessionInUrl:false, persistSession:false } }
const admin = createClient(url, serviceKey, options)
const host = createClient(url, anonKey, options)
const visitor = createClient(url, anonKey, options)
const outsider = createClient(url, anonKey, options)
const secondVisitor = createClient(url, anonKey, options)
const users = []
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const participantIds = ['HOST','VISITOR','OUTSIDER'].map((role) => `DUO_RT_${role}_${suffix}`)
const clientIds = [crypto.randomUUID(), crypto.randomUUID()]
const inviteToken = randomBytes(32).toString('base64url')
const tokenHash = createHash('sha256').update(inviteToken).digest('hex')
const requestHash = (clientId) => createHash('sha256').update(JSON.stringify([clientId, tokenHash])).digest('hex')
let sessionId
let hostChannel
let visitorChannel
let copiedTokenChannel

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

function jwtHeader(accessToken) {
  return JSON.parse(Buffer.from(accessToken.split('.')[0], 'base64url').toString('utf8'))
}

async function accessToken(client) {
  const { data, error } = await client.auth.getSession()
  assert.equal(error, null)
  assert(data.session?.access_token)
  assert.equal(jwtHeader(data.session.access_token).alg, 'ES256', 'Supabase Auth must issue ES256 access tokens')
  return data.session.access_token
}

function waitForSubscription(channel, expected = 'SUBSCRIBED', timeout = 12_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Realtime subscribe timeout; expected ${expected}`)), timeout)
    channel.subscribe((status) => {
      if (status === expected || (expected === 'DENIED' && ['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))) {
        clearTimeout(timer)
        resolve(status)
      } else if (expected === 'DENIED' && status === 'SUBSCRIBED') {
        clearTimeout(timer)
        reject(new Error('Realtime authorization unexpectedly allowed a denied subscription'))
      } else if (expected === 'SUBSCRIBED' && ['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
        clearTimeout(timer)
        reject(new Error(`Realtime authorization unexpectedly returned ${status}`))
      }
    })
  })
}

function waitForBroadcast(channel, expectedSender, timeout = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`broadcast from ${expectedSender} not received`)), timeout)
    channel.on('broadcast', { event:'pos' }, ({ payload }) => {
      if (payload?.senderRole !== expectedSender) return
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

try {
  for (const client of [host, visitor, outsider]) {
    const signed = ok(await client.auth.signInAnonymously(), 'Realtime sign in')
    assert.equal(jwtHeader(signed.session.access_token).alg, 'ES256', 'Supabase Auth sign-in must return ES256')
    users.push(signed.user)
  }
  ok(await admin.from('study_participants').insert(users.map((user, index) => ({
    participant_id:participantIds[index], auth_user_id:user.id, group_id:index % 2 ? 'B' : 'A', status:'active',
  }))), 'create Realtime participants')
  const itemIds = ['plant_tall','plant_bush','books','fruitbowl']
  ok(await admin.from('participant_catalog_items').insert(itemIds.map((itemId) => ({
    participant_id:participantIds[0], item_id:itemId, acquisition_source:'individual_purchase',
  }))), 'seed Realtime host ownership')
  ok(await admin.from('participant_catalog_items').insert(itemIds.map((itemId) => ({
    participant_id:participantIds[2], item_id:itemId, acquisition_source:'individual_purchase',
  }))), 'seed outsider room ownership')
  const eligibleRoom = (participantId) => ({
    participant_id:participantId, revision:1, invite_unique_item_count:4,
    room:{ wallpaper:'starter_wall_neutral', floor:'starter_floor_beige', items:itemIds.map((itemId, index) => ({
      uid:index + 1, itemId, layer:'floor', col:index, row:0, flip:false,
    })) },
  })
  ok(await admin.from('participant_economy_v1_rooms').insert([
    eligibleRoom(participantIds[0]), eligibleRoom(participantIds[2]),
  ]), 'seed Realtime host rooms')
  const hosted = ok(await admin.rpc('create_duo_v2_session_admin', {
    p_auth_user_id:users[0].id, p_client_id:clientIds[0], p_token_hash:tokenHash,
    p_idempotency_key:crypto.randomUUID(),
    p_request_hash:createHash('sha256').update(JSON.stringify([clientIds[0], tokenHash, 'economy_v1'])).digest('hex'),
    p_room_system:'economy_v1',
  }), 'Realtime host session')
  sessionId = hosted.sessionId
  ok(await admin.rpc('join_duo_v2_session_admin', {
    p_auth_user_id:users[1].id, p_client_id:clientIds[1], p_token_hash:tokenHash,
    p_idempotency_key:crypto.randomUUID(), p_request_hash:requestHash(clientIds[1]),
  }), 'Realtime visitor join')

  const otherToken = randomBytes(32).toString('base64url')
  const otherTokenHash = createHash('sha256').update(otherToken).digest('hex')
  const otherClientId = crypto.randomUUID()
  const realOtherHosted = ok(await admin.rpc('create_duo_v2_session_admin', {
    p_auth_user_id:users[2].id, p_client_id:otherClientId, p_token_hash:otherTokenHash,
    p_idempotency_key:crypto.randomUUID(),
    p_request_hash:createHash('sha256').update(JSON.stringify([otherClientId, otherTokenHash, 'economy_v1'])).digest('hex'),
    p_room_system:'economy_v1',
  }), 'other Realtime session with valid request')
  assert.equal(realOtherHosted.ok, true)

  const topic = `duo-v2:${sessionId}`
  const publicChannel = outsider.channel('public-channels-must-be-disabled')
  await waitForSubscription(publicChannel, 'DENIED')
  await outsider.removeChannel(publicChannel)
  await Promise.all([
    host.realtime.setAuth(await accessToken(host)),
    visitor.realtime.setAuth(await accessToken(visitor)),
  ])
  hostChannel = host.channel(topic, { config:{ private:true, presence:{ key:'host' } } })
  visitorChannel = visitor.channel(topic, { config:{ private:true, presence:{ key:'visitor' } } })
  await Promise.all([waitForSubscription(hostChannel), waitForSubscription(visitorChannel)])
  await Promise.all([hostChannel.track({ role:'host' }), visitorChannel.track({ role:'visitor' })])

  const visitorReceived = waitForBroadcast(visitorChannel, 'host')
  await hostChannel.send({ type:'broadcast', event:'pos', payload:{ senderRole:'host', x:10, y:20, facing:'down', screen:'worldmap', moving:true } })
  assert.equal((await visitorReceived).screen, 'worldmap')
  const hostReceived = waitForBroadcast(hostChannel, 'visitor')
  await visitorChannel.send({ type:'broadcast', event:'pos', payload:{ senderRole:'visitor', x:12, y:22, facing:'left', screen:'interior', moving:false } })
  assert.equal((await hostReceived).screen, 'interior')

  const outsiderChannel = outsider.channel(topic, { config:{ private:true} })
  await waitForSubscription(outsiderChannel, 'DENIED')
  await outsider.removeChannel(outsiderChannel)
  const tamperedChannel = outsider.channel(`duo-v2:${crypto.randomUUID()}`, { config:{ private:true } })
  await waitForSubscription(tamperedChannel, 'DENIED')
  await outsider.removeChannel(tamperedChannel)

  const otherSessionChannel = host.channel(`duo-v2:${realOtherHosted.sessionId}`, { config:{ private:true } })
  await waitForSubscription(otherSessionChannel, 'DENIED')
  await host.removeChannel(otherSessionChannel)

  const outsiderOwnChannel = outsider.channel(`duo-v2:${realOtherHosted.sessionId}`, { config:{ private:true } })
  await waitForSubscription(outsiderOwnChannel)
  await outsider.removeChannel(outsiderOwnChannel)
  ok(await admin.from('study_participants').update({ status:'inactive' })
    .eq('auth_user_id', users[2].id), 'revoke outsider participant')
  const inactiveChannel = outsider.channel(`duo-v2:${realOtherHosted.sessionId}`, { config:{ private:true } })
  await waitForSubscription(inactiveChannel, 'DENIED')
  await outsider.removeChannel(inactiveChannel)

  const visitorSession = (await visitor.auth.getSession()).data.session
  ok(await secondVisitor.auth.setSession({
    access_token:visitorSession.access_token,
    refresh_token:visitorSession.refresh_token,
  }), 'copy visitor auth into second context')
  copiedTokenChannel = secondVisitor.channel(topic, { config:{ private:true, presence:{ key:'visitor-copy' } } })
  await waitForSubscription(copiedTokenChannel)
  await secondVisitor.removeChannel(copiedTokenChannel)
  copiedTokenChannel = null

  const oldHostAccessToken = await accessToken(host)
  ok(await host.auth.refreshSession(), 'refresh host Supabase Auth session')
  const refreshedHostAccessToken = await accessToken(host)
  assert.notEqual(refreshedHostAccessToken, oldHostAccessToken, 'refresh rotates the ES256 access token')
  await host.removeChannel(hostChannel)
  hostChannel = host.channel(topic, { config:{ private:true, presence:{ key:'host' } } })
  await waitForSubscription(hostChannel)

  ok(await admin.from('duo_v2_leases').update({ heartbeat_at:new Date(Date.now() - 60_000).toISOString() })
    .eq('session_id', sessionId).eq('auth_user_id', users[1].id), 'make visitor lease stale')
  await visitor.removeChannel(visitorChannel)
  visitorChannel = visitor.channel(topic, { config:{ private:true } })
  await waitForSubscription(visitorChannel, 'DENIED')
  await visitor.removeChannel(visitorChannel)
  visitorChannel = null

  const rejoined = ok(await admin.rpc('join_duo_v2_session_admin', {
    p_auth_user_id:users[1].id, p_client_id:clientIds[1], p_token_hash:tokenHash,
    p_idempotency_key:crypto.randomUUID(), p_request_hash:requestHash(clientIds[1]),
  }), 'visitor rejoins after stale lease')
  assert.equal(rejoined.ok, true)
  ok(await admin.rpc('leave_duo_v2_session_admin', {
    p_auth_user_id:users[1].id, p_session_id:sessionId, p_client_id:clientIds[1],
    p_idempotency_key:crypto.randomUUID(),
  }), 'visitor leave before Realtime retry')
  const leftChannel = visitor.channel(topic, { config:{ private:true } })
  await waitForSubscription(leftChannel, 'DENIED')
  await visitor.removeChannel(leftChannel)

  ok(await admin.rpc('close_duo_v2_session_admin', {
    p_auth_user_id:users[0].id, p_session_id:sessionId, p_idempotency_key:crypto.randomUUID(),
  }), 'close Realtime session')
  await host.removeChannel(hostChannel)
  hostChannel = null
  const revokedChannel = host.channel(topic, { config:{ private:true } })
  await waitForSubscription(revokedChannel, 'DENIED')
  await host.removeChannel(revokedChannel)

  console.log('Duo Session V2 real private WebSocket Presence/Broadcast authorization passed.')
} finally {
  if (hostChannel) await host.removeChannel(hostChannel).catch(() => {})
  if (visitorChannel) await visitor.removeChannel(visitorChannel).catch(() => {})
  if (copiedTokenChannel) await secondVisitor.removeChannel(copiedTokenChannel).catch(() => {})
  if (users.length) {
    await admin.from('duo_v2_operation_results').delete().in('auth_user_id', users.map((user) => user.id))
    await admin.from('duo_v2_sessions').delete().in('host_auth_user_id', users.map((user) => user.id))
  }
  await admin.from('study_participants').delete().in('participant_id', participantIds)
  for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {})
  for (const client of [host, visitor, outsider, secondVisitor, admin]) client.realtime.disconnect()
}
