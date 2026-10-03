import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CHARACTER_IDENTITY_CATALOG_VERSION,
  __testing as identityContract,
  hasCompleteCharacterLoadout,
  validateCharacterIdentity,
} from '../../lib/characterIdentityContract.mjs'
import { DEFAULT_CHARACTER_LOADOUT } from '../../lib/characterStudioState.mjs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const migration = read('scripts/security/013_character_identity_loadout.sql')

function sqlArrayFollowing(marker) {
  const tail = migration.slice(migration.indexOf(marker))
  const match = tail.match(/array\[([\s\S]*?)\]::text\[\]/)
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
}

test('the Stage 3 identity contract validates complete six-field loadouts', () => {
  assert.equal(CHARACTER_IDENTITY_CATALOG_VERSION, 1)
  assert.equal(validateCharacterIdentity(DEFAULT_CHARACTER_LOADOUT).ok, true)
  assert.equal(hasCompleteCharacterLoadout(DEFAULT_CHARACTER_LOADOUT), true)
  assert.equal(validateCharacterIdentity({ ...DEFAULT_CHARACTER_LOADOUT, skinId:'skin_99' }).code, 'invalid_skin_id')
  assert.equal(hasCompleteCharacterLoadout({ outfitId:'basic', accessoryId:null }), false)
})

test('SQL constraints and RPC allow-lists exactly match the generated Character V2 catalog', () => {
  const markers = {
    skinId:['character_loadout_skin_allowed', 'if p_skin_id is null'],
    eyesId:['character_loadout_eyes_allowed', 'if p_eyes_id is null'],
    hairStyleId:['character_loadout_hair_style_allowed', 'if p_hair_style_id is null'],
    hairColorId:['character_loadout_hair_color_allowed', 'if p_hair_color_id is null'],
  }
  for (const [field, [constraintMarker, rpcMarker]] of Object.entries(markers)) {
    const constraintValues = sqlArrayFollowing(constraintMarker)
    const rpcValues = sqlArrayFollowing(rpcMarker)
    const expected = [...identityContract.allowed[field]]
    assert.deepEqual(constraintValues, expected, `${field} SQL constraint drift`)
    assert.deepEqual(rpcValues, expected, `${field} RPC allow-list drift`)
  }
})

test('013 is forward-only, preserves own-select RLS, and exposes only the service RPC', () => {
  assert.match(migration, /MIGRATION_PARTIAL_OR_ALREADY_APPLIED/)
  assert.doesNotMatch(migration, /drop\s+(table|column)|alter\s+policy|disable\s+row\s+level\s+security/i)
  assert.match(migration, /revoke insert,update,delete on public\.participant_multi_village_character_loadouts from public,anon,authenticated/i)
  assert.match(migration, /revoke all on function public\.save_multi_village_character_identity_admin[\s\S]*from public,anon,authenticated/i)
  assert.match(migration, /grant execute on function public\.save_multi_village_character_identity_admin[\s\S]*to service_role/i)
  assert.match(migration, /set search_path=''/i)
})

test('the identity API accepts only the five-field authenticated cutover request', () => {
  const route = read('app/api/economy-v1/character-identity/route.js')
  assert.match(route, /REQUEST_FIELDS = new Set\(\[\.\.\.CHARACTER_IDENTITY_FIELDS, 'idempotencyKey'\]\)/)
  for (const forbidden of ['participantId','authUserId','outfitId','accessoryId','balance','ownedItemIds']) {
    assert.doesNotMatch(route, new RegExp(`body\\.${forbidden}`))
  }
  assert.match(route, /auth\.mode !== 'cutover'/)
  assert.match(route, /Cache-Control':'private, no-store'/)
})

test('bootstrap capability, provider retry policy, and current-player render propagation are wired', () => {
  const bootstrap = read('app/api/economy-v1/bootstrap/route.js')
  const provider = read('components/economy-v1/EconomyRuntimeProvider.js')
  const page = read('app/page.js')
  assert.match(bootstrap, /characterIdentityCustomization:hasCompleteCharacterLoadout/)
  assert.match(provider, /saveIdentity/)
  assert.match(provider, /identityOperation/)
  assert.match(provider, /idempotency_key_reused/)
  assert.match(provider, /saveCharacterIdentity\(validated, operation\.key\)/)
  assert.match(page, /runtimeCharacterLoadout = economy\.mode === 'cutover' \? economy\.savedLoadout : undefined/)
  assert.equal((page.match(/characterLoadout=\{runtimeCharacterLoadout\}/g) || []).length, 11)
  const interior = read('components/InteriorRoom.js')
  assert.match(interior, /resolveWorldCharacterLayers\(\{ outfitSrc, accessorySrc, \.\.\.characterLoadout \}\)/)
  assert.match(interior, /data-testid="interior-player"/)
  assert.match(interior, /data-interior-character-layer/)
})

test('QA stays local and live identity visibility is capability gated', () => {
  const qa = read('components/character-studio/QaCharacterStudioPanel.js')
  const live = read('components/economy-v1/CharacterShopPanel.js')
  const studio = read('components/character-studio/CharacterStudioPanel.js')
  assert.match(qa, /applyQaCharacterIdentity/)
  assert.doesNotMatch(qa, /saveCharacterIdentity|economyRequest/)
  assert.match(live, /characterIdentityCustomization === true/)
  assert.match(live, /identityCatalogVersion === CHARACTER_IDENTITY_CATALOG\.version/)
  assert.match(live, /hasCompleteCharacterLoadout/)
  assert.match(studio, /environment === 'qa'/)
  assert.match(studio, /같은 요청 재시도/)
})
