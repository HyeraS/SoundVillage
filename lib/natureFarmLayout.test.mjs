import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  T, BRIDGES, BUILDINGS, ORCHARD, TREE_CENTERS,
  buildNatureFarmModel, createNatureFlowerDecor, isolatedWalkableTiles,
  reachableTileKeys, spawnNatureItemsForModel,
  moveWithCollisionModel,
} from './natureFarmLayout.mjs'

const metadata = JSON.parse(readFileSync(new URL('../data/sound_metadata.json', import.meta.url), 'utf8'))

function natureSounds(group) {
  return metadata.sounds.filter((sound) => sound.game_zone === 'Nature' && (!sound.group || sound.group === group))
}

test('Brookside layout keeps its two bridges and reports the authored mask connectivity', () => {
  const model = buildNatureFarmModel()
  const reachable = reachableTileKeys(model)
  assert.equal(BRIDGES.length, 2)
  assert.equal(isolatedWalkableTiles(model).length, 4)

  for (const bridge of BRIDGES) {
    const y = bridge.y + 1
    for (let x = bridge.x0; x <= bridge.x1; x++) {
      assert.equal(model.collision[y][x], false, `${bridge.id} legacy deck geometry remains open`)
    }
  }

  const exitTile = `${Math.floor(model.exit.x / T)},${Math.floor(model.exit.y / T)}`
  assert.ok(reachable.has(exitTile), 'spawn reaches exit without triggering it immediately')
  const entryDistance = Math.hypot(model.spawn.x - model.exit.x, model.spawn.y - model.exit.y)
  assert.ok(entryDistance > T * 5)
})

test('water, buildings, crop footprints, tree trunks and bridge rails collide at the feet', () => {
  const model = buildNatureFarmModel()
  assert.equal(model.canStand(23 * T + 16, 4 * T + 16), false, 'creek water blocks feet')
  const mill = BUILDINGS.find((building) => building.id === 'watermill').footprint
  assert.equal(model.canStand(mill.x + mill.w / 2, mill.y + mill.h / 2), false, 'mill footprint blocks feet')
  const [treeX, treeY] = TREE_CENTERS[0]
  assert.equal(model.canStand(treeX * T + 16, treeY * T + 16), false, 'forest trunk blocks feet')
  const [orchardX, orchardY] = ORCHARD.trees[0]
  assert.equal(model.canStand(orchardX * T + 16, orchardY * T + 16), false, 'orchard trunk blocks feet')

  const bridge = BRIDGES[0]
  const centerX = (bridge.x0 + bridge.x1 + 1) * T / 2
  assert.equal(model.canStand(centerX, bridge.laneY0 * T + 5), false, 'upper rail blocks feet')
  assert.equal(model.canStand(centerX, (bridge.laneY0 + 1) * T + 16), true, 'bridge deck remains open')
})

test('large dt movement cannot tunnel through creek and blocked axes still slide', () => {
  const model = buildNatureFarmModel()
  const start = { ...model.spawn }
  assert.equal(model.canStand(start.x, start.y), true)
  const after = moveWithCollisionModel(model, start, 100 * T, -2 * T)
  assert.ok(after.x < start.x + 100 * T, 'x movement stops at a black mask or world boundary')
  assert.ok(after.y < start.y, 'unblocked y axis continues to slide')
  assert.equal(model.canStand(after.x, after.y), true)
})

for (const group of ['A', 'B']) {
  test(`Nature group ${group} items are complete, unique, deterministic and reachable by block`, () => {
    const sounds = natureSounds(group)
    const model = buildNatureFarmModel()
    const flowers = createNatureFlowerDecor(model)
    const decorTiles = new Set(flowers.map((flower) => `${flower.tx},${flower.ty}`))
    const first = spawnNatureItemsForModel(sounds, model, decorTiles)
    const second = spawnNatureItemsForModel([...sounds].reverse(), model, decorTiles)
    const reachable = reachableTileKeys(model)

    assert.equal(first.length, sounds.length)
    assert.equal(new Set(first.map((item) => item.id)).size, sounds.length)
    assert.equal(new Set(first.map((item) => `${item.tx},${item.ty}`)).size, sounds.length)
    assert.deepEqual(
      first.map((item) => [item.id, item.tx, item.ty]).sort(),
      second.map((item) => [item.id, item.tx, item.ty]).sort(),
      'same sound list reproduces positions independent of input order',
    )

    const maxBlock = Math.max(...sounds.map((sound) => sound.block || 1))
    for (let stage = 1; stage <= maxBlock; stage++) {
      for (const item of first.filter((candidate) => candidate.block <= stage)) {
        const key = `${item.tx},${item.ty}`
        assert.ok(reachable.has(key), `stage ${stage} reaches ${item.id}`)
        assert.equal(model.canStand(item.tx * T + 16, item.ty * T + 16), true, `${item.id} is on an accessible white cell`)
        assert.equal(model.explicitCollision[item.ty][item.tx], false)
        assert.equal(decorTiles.has(key), false)
      }
    }
  })
}

test('group-bypass A+B research list still gets unique reachable positions', () => {
  const sounds = natureSounds('A').concat(natureSounds('B'))
  const model = buildNatureFarmModel()
  const flowers = createNatureFlowerDecor(model)
  const decorTiles = new Set(flowers.map((flower) => `${flower.tx},${flower.ty}`))
  const items = spawnNatureItemsForModel(sounds, model, decorTiles)
  const reachable = reachableTileKeys(model)
  assert.equal(items.length, sounds.length)
  assert.equal(new Set(items.map((item) => item.id)).size, sounds.length)
  assert.equal(new Set(items.map((item) => `${item.tx},${item.ty}`)).size, sounds.length)
  for (const item of items) {
    const key = `${item.tx},${item.ty}`
    assert.ok(reachable.has(key))
    assert.equal(model.explicitCollision[item.ty][item.tx], false)
    assert.equal(decorTiles.has(key), false)
  }
})
