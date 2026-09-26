import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import {
  T, MAP_W, MAP_H, buildVillage, computeBlockGrid, moveWithCollision, spawnAnimalItems,
} from './animalVillage.js'
import {
  WORLD_WIDTH, WORLD_HEIGHT, COLLIDERS, BRIDGES, GATES,
  BASE_MAP_SRC, WALKABLE_MASK_SRC, FOREGROUND_MAP_SRC,
  buildSunflowerVillageModel,
} from './animalVillageSunflowerConfig.mjs'

const metadata = JSON.parse(readFileSync(new URL('../data/sound_metadata.json', import.meta.url), 'utf8'))
const sounds = metadata.sounds.filter((sound) => sound.game_zone === 'Animal' && (!sound.group || sound.group === 'A'))
const publicFile = (src) => new URL(`../public${src}`, import.meta.url)
const sha256 = (url) => createHash('sha256').update(readFileSync(url)).digest('hex')

test('Sunflower Commons uses the exact 48x32 reference dimensions', () => {
  const village = buildVillage()
  assert.equal(T, 32)
  assert.equal(MAP_W, 48)
  assert.equal(MAP_H, 32)
  assert.equal(WORLD_WIDTH, 1536)
  assert.equal(WORLD_HEIGHT, 1024)
  assert.equal(village.terrain.length, MAP_H)
  assert.ok(village.terrain.every((row) => row.length === MAP_W))

  const ids = new Set()
  for (const collider of COLLIDERS) {
    assert.ok(!ids.has(collider.id), `duplicate collider id: ${collider.id}`)
    ids.add(collider.id)
    assert.ok(collider.x >= 0 && collider.y >= 0, `${collider.id} starts inside the map`)
    assert.ok(collider.w > 0 && collider.h > 0, `${collider.id} has positive dimensions`)
    assert.ok(collider.x + collider.w <= WORLD_WIDTH, `${collider.id} fits map width`)
    assert.ok(collider.y + collider.h <= WORLD_HEIGHT, `${collider.id} fits map height`)
  }
})

test('base map is a lossless byte-identical copy and every logical image is 1536x1024', async () => {
  const reference = new URL('../public/design-previews/animal-village-concepts/01-sunflower-commons-v4.png', import.meta.url)
  const base = publicFile(BASE_MAP_SRC)
  assert.equal(sha256(reference), sha256(base), 'reference and base-map SHA-256 match')

  for (const src of [BASE_MAP_SRC, WALKABLE_MASK_SRC, FOREGROUND_MAP_SRC]) {
    const url = publicFile(src)
    assert.ok(existsSync(url), `${src} exists`)
    assert.ok(statSync(url).size > 0, `${src} is non-empty`)
    const image = await sharp(fileURLToPath(url)).metadata()
    assert.equal(image.width, WORLD_WIDTH, `${src} width`)
    assert.equal(image.height, WORLD_HEIGHT, `${src} height`)
  }

  const referenceRgb = await sharp(fileURLToPath(reference)).removeAlpha().raw().toBuffer()
  const baseOnlyRgb = await sharp(fileURLToPath(base)).removeAlpha().raw().toBuffer()
  assert.equal(Buffer.compare(referenceRgb, baseOnlyRgb), 0, 'base-only RGB pixel diff is zero')
})

test('foreground contains only hard-edged, byte-exact reference pixels', async () => {
  const reference = await sharp(fileURLToPath(new URL('../public/design-previews/animal-village-concepts/01-sunflower-commons-v4.png', import.meta.url)))
    .ensureAlpha().raw().toBuffer()
  const foreground = await sharp(fileURLToPath(publicFile(FOREGROUND_MAP_SRC))).ensureAlpha().raw().toBuffer()
  let opaque = 0
  for (let pixel = 0; pixel < WORLD_WIDTH * WORLD_HEIGHT; pixel++) {
    const offset = pixel * 4
    const alpha = foreground[offset + 3]
    if (alpha !== 0 && alpha !== 255) assert.fail(`foreground alpha is not binary at pixel ${pixel}`)
    if (alpha === 0) continue
    opaque++
    assert.equal(foreground[offset], reference[offset], `red channel at pixel ${pixel}`)
    assert.equal(foreground[offset + 1], reference[offset + 1], `green channel at pixel ${pixel}`)
    assert.equal(foreground[offset + 2], reference[offset + 2], `blue channel at pixel ${pixel}`)
  }
  assert.ok(opaque > 0, 'foreground extracts at least one exact reference object')
})

test('production renderer uses only the base PNG for static art and disables smoothing', () => {
  const engine = readFileSync(new URL('./animalVillage.js', import.meta.url), 'utf8')
  const component = readFileSync(new URL('../components/AnimalZoneMap.js', import.meta.url), 'utf8')
  assert.match(engine, /ctx\.drawImage\(IMG\.baseMap, 0, 0, WORLD_WIDTH, WORLD_HEIGHT\)/)
  assert.doesNotMatch(engine, /drawAnimatedWater|drawWindmill|drawGrassTile|drawPathTile|drawPond/)
  assert.match(engine, /imageSmoothingEnabled = false/)
  assert.match(component, /imageSmoothingEnabled = false/)
  assert.match(component, /data-testid="animal-base-map"/)
})

test('bridges and gates pass while water, cliffs, buildings, crops and trunks block feet', () => {
  const village = buildSunflowerVillageModel()
  for (const gate of GATES) {
    assert.equal(village.canStand(gate.x, gate.y), true, `${gate.id} is passable`)
  }
  for (const bridge of BRIDGES) {
    const x = (bridge.x + bridge.w / 2) * T
    const y = (bridge.y + bridge.h / 2) * T
    assert.equal(village.canStand(x, y), true, `${bridge.id} center lane is passable`)
  }
  assert.equal(village.canStand(32.5 * T, 17.5 * T), false, 'pond water blocks feet')
  assert.equal(village.canStand(10.5 * T, 30.5 * T), false, 'south cliff blocks feet')
  assert.equal(village.canStand(7 * T, 4 * T), false, 'barn blocks feet')
  assert.equal(village.canStand(39.5 * T, 4.5 * T), false, 'crop row blocks feet')
  assert.equal(village.canStand(39.5 * T, 169), true, 'field furrow remains passable')
  assert.equal(village.canStand(95, 388), false, 'orchard trunk blocks feet')
})

test('spawn reaches the exit and every configured sound slot', () => {
  const village = buildSunflowerVillageModel()
  const exitKey = `${Math.floor(village.exit.x / T)},${Math.floor(village.exit.y / T)}`
  assert.ok(village.reachable.has(exitKey), 'spawn reaches the south exit')
  assert.ok(Math.hypot(village.spawn.x - village.exit.x, village.spawn.y - village.exit.y) >= T * 2.5,
    'spawn is at least 2.5 tiles from the exit')
  assert.ok(village.spawnSlots.length >= sounds.length)
  for (const slot of village.spawnSlots) {
    assert.ok(village.reachable.has(`${slot.tx},${slot.ty}`), `${slot.tx},${slot.ty} is reachable`)
  }
})

test('all 83 Animal sounds get unique deterministic reachable positions across six blocks', () => {
  const village = buildVillage()
  const first = spawnAnimalItems(sounds, village)
  const second = spawnAnimalItems([...sounds].reverse(), buildVillage())
  assert.equal(sounds.length, 83)
  assert.equal(computeBlockGrid(sounds).blockNums.length, 6)
  assert.equal(first.length, sounds.length)
  assert.equal(new Set(first.map((item) => item.id)).size, sounds.length)
  assert.equal(new Set(first.map((item) => `${item.tx},${item.ty}`)).size, sounds.length)
  assert.deepEqual(
    first.map((item) => [item.id, item.tx, item.ty]).sort(),
    second.map((item) => [item.id, item.tx, item.ty]).sort(),
  )
  for (const item of first) assert.ok(village.reachable.has(`${item.tx},${item.ty}`), item.id)
})

test('axis-separated substeps stop at obstacles and preserve corner sliding', () => {
  const village = buildVillage()
  const start = { x: 18 * T, y: 7 * T }
  assert.equal(village.canStand(start.x, start.y), true)
  const moved = moveWithCollision(village, start, 6 * T, 10 * T)
  assert.ok(moved.x > start.x, 'free x axis advances')
  assert.ok(moved.y > start.y, 'free y axis advances until an obstacle')
  assert.equal(village.canStand(moved.x, moved.y), true)
})
