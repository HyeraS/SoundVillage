import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DUO_CHARACTER_IDENTITY_CONTRACT_VERSION,
  createDuoCharacterNonceCache,
  normalizeDuoCharacterLoadout,
  resolveCharacterEquipmentAssets,
  validateDuoCharacterInvalidation,
} from '../../lib/duoCharacterIdentityContract.mjs'
import { DEFAULT_CHARACTER_LOADOUT } from '../../lib/characterStudioState.mjs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const migration = read('scripts/security/014_duo_character_identity_sync.sql')

test('Stage 4 invalidation accepts only current peer session signals without appearance data', () => {
  const sessionId = '14000000-0000-4000-8000-000000000014'
  const payload = {
    version:DUO_CHARACTER_IDENTITY_CONTRACT_VERSION,
    sessionId,
    senderRole:'visitor',
    changedAt:1_000_000,
    nonce:'14000000-0000-4000-8000-000000000001',
  }
  assert(validateDuoCharacterInvalidation(payload, { sessionId, peerRole:'visitor' }))
  assert(validateDuoCharacterInvalidation({ ...payload, changedAt:1_000_000 - 600_000 }, { sessionId, peerRole:'visitor' }))
  assert(validateDuoCharacterInvalidation({ ...payload, changedAt:1_000_000 + 600_000 }, { sessionId, peerRole:'visitor' }))
  assert.equal(validateDuoCharacterInvalidation({ ...payload, senderRole:'host' }, { sessionId, peerRole:'visitor' }), null)
  assert.equal(validateDuoCharacterInvalidation({ ...payload, sessionId:'24000000-0000-4000-8000-000000000014' }, { sessionId, peerRole:'visitor' }), null)
  assert.equal(validateDuoCharacterInvalidation({ ...payload, nonce:'14000000-0000-4000-0000-000000000001' }, { sessionId, peerRole:'visitor' }), null)
  assert.equal(validateDuoCharacterInvalidation({ ...payload, skinId:'skin_08' }, { sessionId, peerRole:'visitor' }), null)
})

test('invalidation nonce dedupe is bounded and isolated by peer lifecycle', () => {
  const cache = createDuoCharacterNonceCache(2)
  const first = '14000000-0000-4000-8000-000000000001'
  const second = '14000000-0000-4000-8000-000000000002'
  const third = '14000000-0000-4000-8000-000000000003'
  assert.equal(cache.accept('session-a:client-a:host', first), true)
  assert.equal(cache.accept('session-a:client-a:host', first), false)
  assert.equal(cache.accept('session-a:client-a:host', second), true)
  assert.equal(cache.accept('session-a:client-a:host', third), true)
  assert.equal(cache.size(), 2)
  assert.equal(cache.accept('session-a:client-a:host', first), true, 'oldest bounded nonce should be evicted')
  assert.equal(cache.accept('session-c:client-a:host', first), true, 'old-session nonce must not affect a new lifecycle')
  assert.equal(cache.size(), 1)
  cache.clear()
  assert.equal(cache.size(), 0)
})

test('missing and legacy peer data normalize to the safe six-field default', () => {
  assert.deepEqual(normalizeDuoCharacterLoadout(null), DEFAULT_CHARACTER_LOADOUT)
  assert.deepEqual(normalizeDuoCharacterLoadout({ outfitId:'overalls' }), DEFAULT_CHARACTER_LOADOUT)
  assert.deepEqual(resolveCharacterEquipmentAssets(DEFAULT_CHARACTER_LOADOUT), {
    outfitSrc:'/assets/world/player_clothes.png', accessorySrc:undefined,
  })
  assert.equal(resolveCharacterEquipmentAssets({ ...DEFAULT_CHARACTER_LOADOUT, outfitId:'overalls', accessoryId:'acc_glasses' }).outfitSrc, '/assets/world/outfits/overalls.png')
})

test('014 is forward-only and the snapshot RPC is service-role only', () => {
  assert.match(migration, /PREFLIGHT_REQUIRED: apply and verify migrations 001 through 013 first/)
  assert.match(migration, /MIGRATION_ALREADY_APPLIED: 014/)
  assert.match(migration, /security definer set search_path=''/)
  assert.match(migration, /coalesce\(auth\.role\(\),''\)<>'service_role'/)
  assert.match(migration, /revoke all on function public\.get_duo_v2_character_identity_admin\(uuid,uuid,uuid\) from public,anon,authenticated/)
  assert.match(migration, /grant execute on function public\.get_duo_v2_character_identity_admin\(uuid,uuid,uuid\) to service_role/)
  assert.doesNotMatch(migration, /drop\s+(?:table|column)|disable\s+row\s+level\s+security|grant\s+(?:select|insert|update|delete)/i)
  for (const condition of ["status<>'active'", 'expires_at<=now\(\)', 'left_at is not null', "state<>'active'", "interval '45 seconds'", 'client_id<>p_client_id']) {
    assert.match(migration, new RegExp(condition))
  }
})

test('Duo appearance API derives identity from auth and exposes only six-field snapshots', () => {
  const route = read('app/api/duo-v2/character-identity/route.js')
  const server = read('lib/duoSession.server.js')
  assert.match(route, /requireDuoUser\(request\)/)
  assert.match(route, /entries\.length !== 2/)
  assert.match(route, /Cache-Control':'private, no-store'/)
  assert.match(route, /normalizeDuoCharacterLoadout\(data\.self\)/)
  assert.match(route, /normalizeDuoCharacterLoadout\(data\.peer\)/)
  assert.doesNotMatch(route, /participantId|authUserId|wallet|inventory|service_role/i)
  assert.match(server, /p_auth_user_id:authUserId/)
})

test('Realtime is invalidation-only, coalesced, refetched, and cleared on loss', () => {
  const hook = read('lib/duoSession.js')
  const provider = read('components/economy-v1/EconomyRuntimeProvider.js')
  assert.match(hook, /event:DUO_CHARACTER_INVALIDATION_EVENT/)
  assert.match(hook, /validateDuoCharacterInvalidation/)
  assert.match(hook, /getDuoCharacterIdentity\(sessionId, clientId\)/)
  assert.match(hook, /DUO_CHARACTER_REFRESH_COALESCE_MS/)
  assert.match(hook, /characterNonceCacheRef\.current\.accept\(peerLifecycleKey, invalidation\.nonce\)/)
  assert.match(hook, /peerStateLifecycleKey === peerLifecycleKey/)
  assert.match(hook, /characterRequestSequenceRef\.current/)
  assert.match(hook, /setPeerCharacterLoadout\(null\)/)
  assert.doesNotMatch(hook, /payload:\{[^}]*?(?:skinId|eyesId|hairStyleId|hairColorId|outfitId|accessoryId)/s)
  assert.match(provider, /announceCharacterSaved\(\)/)
  assert.match(provider, /if \(result\.ok && hasCompleteCharacterLoadout/)
})

test('world and interior peers reuse Character V2 layers and no fixed partner avatar remains', () => {
  const world = read('components/WorldMap.js')
  const interior = read('components/InteriorRoom.js')
  const decor = read('components/InteriorDecorRoom.js')
  assert.match(world, /data-testid="duo-partner"/)
  assert.match(world, /characterLoadout=\{partnerCharacterLoadout\}/)
  assert.match(interior, /data-testid="interior-duo-partner"/)
  assert.match(interior, /<InteriorCharacter[\s\S]*characterLoadout=\{normalizedPartnerLoadout\}/)
  const peerBlock = interior.slice(interior.indexOf('{partnerPos &&'), interior.indexOf('})()}', interior.indexOf('{partnerPos &&')))
  assert.doesNotMatch(peerBlock, /assets\/interior\/avatar\.png/)
  assert.match(decor, /\['ready','active'\]\.includes\(liveInviteState\?\.status\)[\s\S]*?실시간 세션 종료/)
})

test('a connected visitor is not pinned to the host world after leaving the shared interior', () => {
  const page = read('app/page.js')
  assert.match(page, /resolveDuoVisitorFollowAction\(\{[\s\S]*?role:duoSession\.role[\s\S]*?peerScreen:duo\.partnerPos\.screen[\s\S]*?visiting:Boolean\(visiting\)[\s\S]*?hasSharedRoom:Boolean\(duoVisitRoom\)/)
  assert.match(page, /action === DUO_VISITOR_FOLLOW_ACTIONS\.LEAVE_SHARED_INTERIOR[\s\S]*?setVisiting\(null\)[\s\S]*?setScreen\('world'\)/)
  assert.match(page, /action === DUO_VISITOR_FOLLOW_ACTIONS\.ENTER_SHARED_INTERIOR[\s\S]*?setVisiting\(\{ sessionId:duoSession\.sessionId, room:duoVisitRoom, fallback:false \}\)/)
  assert.match(page, /setDuoVisitRoom\(roomResult\.room\)[\s\S]*?setVisiting\(null\)[\s\S]*?setScreen\('world'\)/)
  assert.match(page, /INTERNAL_BROWSER_QA[\s\S]*?stage4DuoQa[\s\S]*?data-testid="stage4-enter-library"/)
})

test('onboarding is versioned, non-blocking, keyboard dismissible, and cutover capability gated', () => {
  const onboarding = read('components/character-studio/CharacterStudioOnboarding.js')
  const styles = read('components/character-studio/characterStudioOnboarding.module.css')
  const shop = read('components/economy-v1/CharacterShopPanel.js')
  assert.match(onboarding, /ONBOARDING_VERSION = 1/)
  assert.match(onboarding, /window\.localStorage/)
  assert.match(onboarding, /event\.key !== 'Escape'/)
  assert.match(onboarding, /cardRef\.current\?\.contains\(document\.activeElement\)/)
  assert.match(onboarding, /event\.stopImmediatePropagation\(\)/)
  assert.match(onboarding, /aria-modal="false"/)
  assert.match(styles, /orientation: portrait/)
  assert.match(styles, /orientation: landscape/)
  assert.match(shop, /showOnboarding=\{identityEnabled\}/)
  assert.match(shop, /economy\.runtimeState === 'cutover'/)
})
