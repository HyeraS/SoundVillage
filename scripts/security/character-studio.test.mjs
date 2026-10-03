import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  applyQaCharacterEquip,
  applyQaCharacterIdentity,
  applyQaCharacterPurchase,
  characterLoadoutsEqual,
  characterStudioAction,
  effectiveCharacterLoadout,
  previewCharacterItem,
} from '../../lib/characterStudioState.mjs'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('saved, preview, and effective loadouts stay separate', () => {
  const saved = { outfitId:'overalls', accessoryId:'acc_glasses' }
  const preview = previewCharacterItem(saved, null, 'outfit', 'witch')
  assert.deepEqual(saved, { outfitId:'overalls', accessoryId:'acc_glasses' })
  assert.deepEqual(preview, {
    skinId:'skin_01', eyesId:'eyes_green_light', hairStyleId:'hair_buzzcut', hairColorId:'black',
    outfitId:'witch', accessoryId:'acc_glasses',
  })
  assert.deepEqual(effectiveCharacterLoadout(saved, preview), preview)
  assert.deepEqual(effectiveCharacterLoadout(saved, null), {
    skinId:'skin_01', eyesId:'eyes_green_light', hairStyleId:'hair_buzzcut', hairColorId:'black',
    outfitId:'overalls', accessoryId:'acc_glasses',
  })
  assert.equal(characterLoadoutsEqual(saved, preview), false)
})

test('extended loadout normalization is backwards compatible and identity previews preserve commerce slots', () => {
  const saved = { outfitId:'overalls', accessoryId:'acc_glasses' }
  const skin = previewCharacterItem(saved, null, 'skin', 'skin_08')
  const color = previewCharacterItem(saved, skin, 'hairColor', 'turquoise')
  const hair = previewCharacterItem(saved, color, 'hairStyle', 'hair_wavy')
  const eyes = previewCharacterItem(saved, hair, 'eyes', 'eyes_red')
  assert.equal(hair.hairColorId, 'turquoise', 'changing the hair style must preserve the selected color')
  assert.deepEqual(eyes, {
    skinId:'skin_08', eyesId:'eyes_red', hairStyleId:'hair_wavy', hairColorId:'turquoise',
    outfitId:'overalls', accessoryId:'acc_glasses',
  })
  const outfit = previewCharacterItem(saved, eyes, 'outfit', 'sailor')
  assert.equal(outfit.skinId, 'skin_08')
  assert.equal(outfit.eyesId, 'eyes_red')
  assert.equal(outfit.hairStyleId, 'hair_wavy')
  assert.equal(outfit.hairColorId, 'turquoise')
})

test('owned and unowned products select distinct persistence actions', () => {
  assert.equal(characterStudioAction({ owned:false, equipped:false }), 'purchase')
  assert.equal(characterStudioAction({ owned:true, equipped:false }), 'equip')
  assert.equal(characterStudioAction({ owned:true, equipped:true }), 'equipped')
})

test('QA purchase, equip, and accessory removal only transform passed local state', () => {
  const original = {
    balances:{ Animal:20, Human:20, Nature:20, Urban:20, Music:20, Lab:20 },
    ownedItemIds:['overalls', 'acc_glasses'],
    savedLoadout:{ outfitId:'overalls', accessoryId:'acc_glasses' },
  }
  const purchased = applyQaCharacterPurchase(original, {
    id:'sailor', productGroup:'outfit', cost:{ Human:5, Nature:5, Urban:5, Music:5 },
  })
  assert.equal(purchased.ok, true)
  assert.equal(purchased.state.savedLoadout.outfitId, 'sailor')
  assert.equal(purchased.state.balances.Human, 15)
  assert.equal(original.balances.Human, 20)
  assert.equal(original.ownedItemIds.includes('sailor'), false)

  const equipped = applyQaCharacterEquip(purchased.state, 'outfit', 'overalls')
  assert.equal(equipped.ok, true)
  assert.equal(equipped.state.savedLoadout.outfitId, 'overalls')
  const removed = applyQaCharacterEquip(equipped.state, 'accessory', null)
  assert.equal(removed.ok, true)
  assert.equal(removed.state.savedLoadout.accessoryId, null)

  const identity = applyQaCharacterIdentity(removed.state, {
    ...removed.state.savedLoadout,
    skinId:'skin_04', eyesId:'eyes_blue', hairStyleId:'hair_braids', hairColorId:'pink',
  })
  assert.equal(identity.state.savedLoadout.skinId, 'skin_04')
  assert.equal(identity.state.savedLoadout.outfitId, 'overalls')
  assert.equal(identity.state.savedLoadout.accessoryId, null)
})

test('catalog and adapters feed one shared studio without QA persistence imports', async () => {
  const [catalogText, studio, qa, legacy, cutover] = await Promise.all([
    read('data/economy/catalog-v1.json'),
    read('components/character-studio/CharacterStudioPanel.js'),
    read('components/character-studio/QaCharacterStudioPanel.js'),
    read('components/SoundMuseum.js'),
    read('components/economy-v1/CharacterShopPanel.js'),
  ])
  const catalog = JSON.parse(catalogText)
  const approved = catalog.items.filter((item) => ['outfit', 'accessory'].includes(item.productGroup)
    && item.officialStoreStatus === 'approved' && item.existingGameConnected === true)
  assert.equal(approved.filter((item) => item.productGroup === 'outfit').length, 18)
  assert.equal(approved.filter((item) => item.productGroup === 'accessory').length, 8)
  assert.match(qa, /<CharacterStudioPanel/)
  assert.match(qa, /identityPreviewEnabled/)
  assert.match(qa, /onSaveIdentity=\{saveIdentity\}/)
  assert.match(legacy, /return <CharacterStudioPanel/)
  assert.match(cutover, /return <CharacterStudioPanel/)
  assert.doesNotMatch(qa, /purchaseOutfit|setEquippedOutfit|purchaseCharacterItem|equipCharacterItem|fetch\(/)
  assert.match(studio, /setPreviewLoadout\(\(current\) => previewCharacterItem/)
  assert.match(studio, /const resetPreview = \(\) => \{[\s\S]*setPreviewLoadout\(null\)/)
  assert.match(studio, /role="tablist"[\s\S]*role="tab"[\s\S]*role="tabpanel"/)
  assert.match(studio, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*handleDialogKeyDown/)
  assert.match(studio, /\['qa', 'cutover'\]\.includes\(environment\) && identityPreviewEnabled/)
})

test('only capability-gated cutover and local QA can enable identity customization', async () => {
  const [qa, legacy, cutover, projection] = await Promise.all([
    read('components/character-studio/QaCharacterStudioPanel.js'),
    read('components/SoundMuseum.js'),
    read('components/economy-v1/CharacterShopPanel.js'),
    import('../../lib/generated/characterIdentityCatalog.mjs'),
  ])
  assert.match(qa, /identityPreviewEnabled/)
  assert.doesNotMatch(legacy, /identityPreviewEnabled/)
  assert.match(cutover, /characterIdentityCustomization === true/)
  assert.match(cutover, /identityCatalogVersion === CHARACTER_IDENTITY_CATALOG\.version/)
  assert.match(cutover, /hasCompleteCharacterLoadout/)
  assert.match(cutover, /identityPreviewEnabled=\{identityEnabled\}/)
  assert.equal(projection.CHARACTER_IDENTITY_CATALOG.skins.length, 8)
  assert.equal(projection.CHARACTER_IDENTITY_CATALOG.hairStyles.length, 13)
  assert.equal(projection.CHARACTER_IDENTITY_CATALOG.hairColors.length, 14)
  assert.equal(projection.CHARACTER_IDENTITY_CATALOG.eyes.length, 14)
  assert.equal('cost' in projection.CHARACTER_IDENTITY_CATALOG.skins[0], false)
  assert.equal('sourceAsset' in projection.CHARACTER_IDENTITY_CATALOG.skins[0], false)
})

test('loading and pending paths always settle and unmount guards state updates', async () => {
  const [studio, qa, legacy] = await Promise.all([
    read('components/character-studio/CharacterStudioPanel.js'),
    read('components/character-studio/QaCharacterStudioPanel.js'),
    read('components/SoundMuseum.js'),
  ])
  assert.match(studio, /finally \{[\s\S]*actionInFlightRef\.current = false[\s\S]*setPending\(false\)/)
  assert.match(studio, /if \(!mountedRef\.current\) return/)
  assert.match(qa, /setStatus\(simulateError \? 'error' : 'ready'\)/)
  assert.match(qa, /onRetry=\{\(\) => setStatus\('ready'\)\}/)
  assert.match(legacy, /finally \{[\s\S]*setLoading\(false\)/)
})
