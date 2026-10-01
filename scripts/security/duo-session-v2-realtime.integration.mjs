import assert from 'node:assert/strict'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireLoopbackSupabaseUrl } from './local-supabase-guard.mjs'

const url = process.env.SECURITY_TEST_SUPABASE_URL
const anonKey = process.env.SECURITY_TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
const jwtSecret = process.env.SUPABASE_JWT_SECRET
if (!url || !anonKey || !serviceKey || !jwtSecret) throw new Error('Local Duo Realtime environment is incomplete')
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

function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message || ''}`)
  return result.data
}

function realtimeToken(userId, clientId, role) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const header = part({ alg:'HS256', typ:'JWT' })
  const payload = part({
    iss:'supabase', aud:'authenticated', role:'authenticated', sub:userId, iat:now, exp:now + 60,
    duo_session_id:sessionId, duo_client_id:clientId, duo_role:role,
  })
  return `${header}.${payload}.${createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url')}`
}

function waitForSubscription(channel, expected = 'SUBSCRIBED', timeout = 12_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Realtime subscribe timeout; expected ${expected}`)), timeout)
    channel.subscribe((status) => {
      if (status === expected || (expected === 'DENIED' && ['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))) {
        clearTimeout(timer)
        resolve(status)
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
  for (const client of [host, visitor, outsider]) users.push(ok(await client.auth.signInAnonymously(), 'Realtime sign in').user)
  ok(await admin.from('study_participants').insert(users.map((user, index) => ({
    participant_id:participantIds[index], auth_user_id:user.id, group_id:index % 2 ? 'B' : 'A', status:'active',
  }))), 'create Realtime participants')
  const itemIds = ['plant_tall','plant_bush','books','fruitbowl']
  ok(await admin.from('participant_catalog_items').insert(itemIds.map((itemId) => ({
    participant_id:participantIds[0], item_id:itemId, acquisition_source:'individual_purchase',
  }))), 'seed Realtime host ownership')
  ok(await admin.from('participant_economy_v1_rooms').insert({
    participant_id:participantIds[0], revision:1, invite_unique_item_count:4,
    room:{ wallpaper:'starter_wall_neutral', floor:'starter_floor_beige', items:itemIds.map((itemId, index) => ({
      uid:index + 1, itemId, layer:'floor', col:index, row:0, flip:false,
    })) },
  }), 'seed Realtime host room')
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

  const topic = `duo-v2:${sessionId}`
  await Promise.all([
    host.realtime.setAuth(realtimeToken(users[0].id, clientIds[0], 'host')),
    visitor.realtime.setAuth(realtimeToken(users[1].id, clientIds[1], 'visitor')),
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

  ok(await secondVisitor.auth.setSession({
    access_token:(await visitor.auth.getSession()).data.session.access_token,
    refresh_token:(await visitor.auth.getSession()).data.session.refresh_token,
  }), 'copy visitor auth into second context')
  const secondTabChannel = secondVisitor.channel(topic, { config:{ private:true, presence:{ key:'visitor' } } })
  await waitForSubscription(secondTabChannel, 'DENIED')
  await secondVisitor.removeChannel(secondTabChannel)

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
  if (users.length) {
    await admin.from('duo_v2_operation_results').delete().in('auth_user_id', users.map((user) => user.id))
    await admin.from('duo_v2_sessions').delete().in('host_auth_user_id', users.map((user) => user.id))
  }
  await admin.from('study_participants').delete().in('participant_id', participantIds)
  for (const user of users) await admin.auth.admin.deleteUser(user.id).catch(() => {})
}
