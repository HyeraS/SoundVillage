import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  QA_SHOP_FIXTURE,
  buyQaOutfit,
  equipQaOutfit,
  loadShopSnapshot,
} from '../../lib/shopReliability.mjs'
import {
  QA_ATTENDANCE_FIXTURE,
  QA_QUEST_FIXTURE,
  createRewardRequestCoordinator,
  panelStateFromResult,
} from '../../lib/rewardReliability.mjs'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('reward QA fixtures are deterministic and failed reads become finite error states', () => {
  assert.equal(QA_QUEST_FIXTURE.length, 3)
  assert.equal(QA_ATTENDANCE_FIXTURE.templates.length, 7)
  assert.deepEqual(panelStateFromResult({ ok:false, code:'network_error' }), {
    status:'error', code:'network_error', data:null,
  })
  assert.deepEqual(panelStateFromResult({ ok:true, data:[] }), {
    status:'empty', code:'empty', data:[],
  })
})

test('Strict Mode-style duplicate reward reads share one in-flight request', async () => {
  let calls = 0
  let resolve
  const pending = new Promise((done) => { resolve = done })
  const coordinator = createRewardRequestCoordinator()
  const task = () => { calls += 1; return pending }
  const first = coordinator.run('quest:participant:legacy', task)
  const second = coordinator.run('quest:participant:legacy', task)
  assert.equal(first, second)
  assert.equal(calls, 0)
  await Promise.resolve()
  assert.equal(calls, 1)
  resolve({ ok:true, data:QA_QUEST_FIXTURE })
  await Promise.all([first, second])
})

test('shop lookup settles partial and total failures without rejecting', async () => {
  const partial = await loadShopSnapshot({
    getCurrencyBalance:async () => 55,
    getOwnedOutfits:async () => { throw new Error('offline') },
    getEquippedOutfit:async () => 'basic',
    getTotalEarned:async () => 80,
  })
  assert.equal(partial.ok, false)
  assert.deepEqual(partial.failedFields, ['ownedOutfits'])
  assert.equal(partial.data.balance, 55)

  const failed = await loadShopSnapshot({
    getCurrencyBalance:async () => { throw new Error('offline') },
    getOwnedOutfits:async () => { throw new Error('offline') },
    getEquippedOutfit:async () => { throw new Error('offline') },
    getTotalEarned:async () => { throw new Error('offline') },
  })
  assert.equal(failed.ok, false)
  assert.equal(failed.failedFields.length, 4)
  assert.deepEqual(failed.data, {})
})

test('shop QA purchase and equip only transform local fixture state', () => {
  const original = { ...QA_SHOP_FIXTURE, ownedOutfits:[...QA_SHOP_FIXTURE.ownedOutfits] }
  const bought = buyQaOutfit(original, 'sailor', 20)
  assert.equal(bought.balance, 80)
  assert.deepEqual(bought.ownedOutfits, ['overalls', 'sailor'])
  assert.equal(bought.equipped, 'sailor')
  assert.deepEqual(original, { balance:100, ownedOutfits:['overalls'], equipped:'basic', totalEarned:80 })
  const equipped = equipQaOutfit(bought, 'overalls')
  assert.equal(equipped.equipped, 'overalls')
  assert.equal(equipQaOutfit(equipped, 'not-owned'), equipped)
})

test('QA mode is passed from the page and bypasses reward and shop persistence', async () => {
  const [page, world, panels, museum, qaStudio] = await Promise.all([
    read('app/page.js'),
    read('components/WorldMap.js'),
    read('components/world-map/WorldMapUI.js'),
    read('components/SoundMuseum.js'),
    read('components/character-studio/QaCharacterStudioPanel.js'),
  ])
  assert.match(page, /<WorldMap[\s\S]*dryRun=\{TEMPORARILY_UNLOCK_ALL_CONTENT \|\| natureQaEnabled \|\| Boolean\(humanQaOptions\)\}/)
  assert.match(page, /<SoundMuseum[\s\S]*dryRun=\{TEMPORARILY_UNLOCK_ALL_CONTENT \|\| natureQaEnabled \|\| Boolean\(humanQaOptions\)\}/)
  assert.match(world, /<WorldQuestPanel[\s\S]*dryRun=\{dryRun\}/)
  assert.match(world, /<WorldAttendancePanel[\s\S]*dryRun/)
  assert.match(panels, /if \(dryRun \|\| !policy\.canRead\) return/)
  assert.match(panels, /dryRun[\s\S]*QA_QUEST_FIXTURE/)
  assert.match(panels, /dryRun[\s\S]*QA_ATTENDANCE_FIXTURE/)

  assert.match(museum, /dryRun[\s\S]*<QaCharacterStudioPanel/)
  assert.match(qaStudio, /applyQaCharacterPurchase/)
  assert.match(qaStudio, /applyQaCharacterEquip/)
  assert.doesNotMatch(qaStudio, /purchaseOutfit|setEquippedOutfit|getCurrencyBalance|economyRequest|fetch\(/)
})

test('real shop failures end loading, expose retry UI, and lock unsafe mutations', async () => {
  const [museum, studio] = await Promise.all([
    read('components/SoundMuseum.js'),
    read('components/character-studio/CharacterStudioPanel.js'),
  ])
  assert.match(museum, /finally \{[\s\S]*setLoading\(false\)/)
  assert.match(studio, /data-testid="studio-load-error"/)
  assert.match(studio, />다시 시도<\/button>/)
  assert.match(studio, /disabled=\{pending \|\| equipped \|\| cannotBuy\}/)
  assert.match(museum, /if \(purchaseInFlightRef\.current \|\| !accountReady\) return/)
  assert.match(museum, /if \(equipInFlightRef\.current \|\| !accountReady\) return/)
  assert.doesNotMatch(museum, /console\.error\('\[SoundMuseum\] (?:구매|장착) 오류:/)
})
