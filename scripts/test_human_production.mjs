import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'
import {
  T, MAP_W, MAP_H, PLAYER_BOX, HUMAN_LAYER_Z, SPAWN, EXIT_TRIGGER, EXIT_GATE,
  BLOCK_REGIONS, PATH_RECTS, OBJECTS, COLLIDER_TILE_RECTS, DOOR_CLEARANCES,
  SAFE_SLOTS_BY_BLOCK, LANDMARKS, buildHumanVillage, spawnHumanItems,
  isWalkableTile, isSafeHumanSlot, blockForTile,
  reachableTileKeys, reachableMaskTileKeys, collides, moveWithCollision, overlapsExitTrigger, markerStateFor,
} from '../lib/humanVillageConfig.mjs'

const repoFile = (path) => new URL(`../${path}`, import.meta.url)
const manifest = JSON.parse(await readFile(repoFile('public/assets/human-village/manifest.json'), 'utf8'))

function decodeRgbaPng(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG')
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  assert.equal(buffer[24], 8, 'runtime atlas must be 8-bit')
  assert.equal(buffer[25], 6, 'runtime atlas must be RGBA')
  const idat = []
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    if (type === 'IDAT') idat.push(buffer.subarray(offset + 8, offset + 8 + length))
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  let source = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[source++]
    for (let x = 0; x < stride; x++) {
      const value = raw[source++]
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0
      const up = y ? pixels[(y - 1) * stride + x] : 0
      const upperLeft = y && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0
      const decoded = filter === 0 ? value
        : filter === 1 ? value + left
          : filter === 2 ? value + up
            : filter === 3 ? value + Math.floor((left + up) / 2)
              : value + paeth(left, up, upperLeft)
      pixels[y * stride + x] = decoded & 255
    }
  }
  return { width, height, pixels }
}

assert.equal(manifest.version, 2)
assert.deepEqual(manifest.world, { tiles: { width: 48, height: 36 }, tilePixels: 32, pixels: { width: 1536, height: 1152 } })
assert.equal(manifest.source.runtime, false, 'checker source atlas must never be a runtime asset')
assert.equal(manifest.runtimeAtlas.alpha, true)
const atlas = decodeRgbaPng(await readFile(repoFile(`public/assets/human-village/${manifest.runtimeAtlas.file}`)))
assert.deepEqual({ width: atlas.width, height: atlas.height }, manifest.runtimeAtlas.pixels)
let transparent = 0
let opaque = 0
let cream = 0
for (let index = 0; index < atlas.pixels.length; index += 4) {
  const [r, g, b, a] = atlas.pixels.subarray(index, index + 4)
  if (a === 0) transparent++
  if (a >= 250) opaque++
  if (a >= 250 && r >= 232 && g >= 210 && g <= 244 && b >= 175 && b <= 224) cream++
}
assert.ok(transparent > atlas.width * atlas.height * .55, 'checker field must be genuinely transparent')
assert.ok(opaque > atlas.width * atlas.height * .2, 'sprite pixels must remain opaque')
assert.ok(cream > 10000, 'cream stucco pixels appear to have been removed')
for (const [name, [x, y, w, h]] of Object.entries(manifest.sprites)) {
  assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0, `${name} crop is invalid`)
  assert.ok(x + w <= atlas.width && y + h <= atlas.height, `${name} crop exceeds the atlas`)
  let alphaPixels = 0
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    if (atlas.pixels[(py * atlas.width + px) * 4 + 3] > 0) alphaPixels++
  }
  assert.ok(alphaPixels > 40, `${name} crop is empty`)
}

const pngHeader = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
  bitDepth: buffer[24],
  colorType: buffer[25],
})
const cleanMaster = await readFile(repoFile(`public/assets/human-village/${manifest.cleanMaster.file}`))
const runtimeMaster = await readFile(repoFile(`public/assets/human-village/${manifest.runtimeMaster.file}`))
const runtimeForeground = await readFile(repoFile(`public/assets/human-village/${manifest.runtimeForeground.file}`))
assert.deepEqual(pngHeader(cleanMaster), { width: 1448, height: 1086, bitDepth: 8, colorType: 2 })
assert.deepEqual(pngHeader(runtimeMaster), { width: 1536, height: 1152, bitDepth: 8, colorType: 2 })
assert.deepEqual(pngHeader(runtimeForeground), { width: 1536, height: 1152, bitDepth: 8, colorType: 6 })
assert.equal(manifest.cleanMaster.outsideMaskChangedPixels, 0)

assert.equal(T, 32)
assert.equal(MAP_W, 48)
assert.equal(MAP_H, 36)
assert.ok(HUMAN_LAYER_Z.player > HUMAN_LAYER_Z.foreground, 'map foreground must never hide the player')
assert.ok(HUMAN_LAYER_Z.player > HUMAN_LAYER_Z.markers, 'sound markers must never hide the player')
assert.ok(HUMAN_LAYER_Z.prompt > HUMAN_LAYER_Z.player, 'interaction prompt must remain readable above the player')
assert.equal(isWalkableTile(SPAWN.tx, SPAWN.ty), true, 'spawn must be walkable')
assert.equal(overlapsExitTrigger(SPAWN), false, 'spawn must not trigger exit immediately')
assert.equal(isWalkableTile(EXIT_GATE.x + 2, EXIT_GATE.y), true, 'south exit gate must be walkable')
assert.equal(overlapsExitTrigger({ x: 24 * T + T / 2, y: 35 * T + 20 }), true, 'exit trigger must overlap the gate')

// Visible entrances and the community-hall stair axis must remain traversable.
// These cells used to be swallowed by coarse full-width building footprints.
for (const [label, tiles] of Object.entries({
  communityHallSteps: [[23, 10], [24, 10], [25, 10], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15]],
  bakeryDoor: [[6, 11], [7, 11], [8, 11]],
  northEastHomeDoor: [[38, 10], [39, 10], [40, 10]],
  clinicDoor: [[39, 16], [40, 16], [41, 16]],
  westHomeDoor: [[7, 21], [8, 21], [9, 21]],
  southWestDoor: [[4, 29], [5, 29], [6, 29]],
  cafeDoorBetweenTables: [[13, 29]],
  laundryDoor: [[38, 23], [39, 23], [40, 23]],
})) {
  for (const [tx, ty] of tiles) assert.equal(isWalkableTile(tx, ty), true, `${label} tile ${tx},${ty} must be walkable`)
}

for (const r of [...Object.values(BLOCK_REGIONS), ...PATH_RECTS]) {
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= MAP_W && r.y + r.h <= MAP_H, `${r.tag} exceeds the map`)
}
for (const path of PATH_RECTS) assert.ok(Math.min(path.w, path.h) >= 3, `${path.tag} creates a one-tile path`)
for (const object of OBJECTS) {
  assert.ok(object.d.x >= 0 && object.d.y >= 0 && object.d.x + object.d.w <= MAP_W && object.d.y + object.d.h <= MAP_H, `${object.id} art exceeds the map`)
}

const allReachable = reachableTileKeys(6)
for (const [name, point] of Object.entries(LANDMARKS)) assert.ok(allReachable.has(`${point.tx},${point.ty}`), `${name} is unreachable`)
assert.ok(allReachable.has(`${EXIT_GATE.x + 2},${EXIT_GATE.y}`), 'exit is unreachable')
let allWalkable = 0
for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) if (isWalkableTile(tx, ty)) allWalkable++
assert.equal(allReachable.size, allWalkable, 'walkable island detected')

for (let block = 1; block <= 6; block++) {
  const reachable = reachableMaskTileKeys(block)
  assert.ok(reachable.size > 0, `block ${block} needs a spawn-connected mask area`)
  assert.ok(SAFE_SLOTS_BY_BLOCK[block].length >= 15, `block ${block} needs at least 15 safe candidates`)
  for (const slot of SAFE_SLOTS_BY_BLOCK[block]) {
    assert.ok(reachable.has(`${slot.tx},${slot.ty}`), `block ${block} candidate ${slot.tx},${slot.ty} is unreachable`)
    assert.ok(isSafeHumanSlot(slot.tx, slot.ty, block), `block ${block} candidate is unsafe`)
    assert.ok(blockForTile(slot.tx, slot.ty) <= block)
    assert.equal(COLLIDER_TILE_RECTS.some((r) => slot.tx >= r.x && slot.tx < r.x + r.w && slot.ty >= r.y && slot.ty < r.y + r.h), false)
    assert.equal(DOOR_CLEARANCES.some((r) => slot.tx >= r.x && slot.tx < r.x + r.w && slot.ty >= r.y && slot.ty < r.y + r.h), false)
    assert.equal(slot.tx >= EXIT_TRIGGER.x / T && slot.tx < (EXIT_TRIGGER.x + EXIT_TRIGGER.w) / T && slot.ty >= Math.floor(EXIT_TRIGGER.y / T), false)
  }
}

const village = buildHumanVillage()
assert.equal(collides(village, SPAWN.x, SPAWN.y, 1), null)
for (const collider of COLLIDER_TILE_RECTS) {
  const cx = (collider.x + collider.w / 2) * T
  const cy = (collider.y + collider.h / 2) * T
  assert.ok(collides(village, cx, cy, 6), `${collider.tag} must block movement`)
}
const diagonal = moveWithCollision(village, SPAWN, 5, 5, 6)
assert.equal(collides(village, diagonal.x, diagonal.y, 6), null, 'axis-separated movement must end on an accessible mask cell')

const metadata = JSON.parse(await readFile(repoFile('data/sound_metadata.json'), 'utf8'))
const humanSounds = metadata.sounds.filter((sound) => sound.game_zone === 'Human')
const expectedCounts = { A: 85, B: 84 }
for (const group of ['A', 'B']) {
  const sounds = humanSounds.filter((sound) => sound.group === group)
  assert.equal(sounds.length, expectedCounts[group], `Human ${group} production count changed`)
  const items = spawnHumanItems(sounds)
  const reversed = spawnHumanItems([...sounds].reverse())
  const signature = (list) => list.map((item) => `${item.id}:${item.block}:${item.tx},${item.ty}`)
  assert.deepEqual(signature(items), signature(reversed), `${group} placement must ignore input order`)
  assert.equal(items.length, sounds.length)
  assert.equal(new Set(items.map((item) => `${item.tx},${item.ty}`)).size, items.length, `${group} item overlap`)
  for (const item of items) {
    assert.ok(isSafeHumanSlot(item.tx, item.ty, item.block), `${group} ${item.id} used an unsafe slot`)
    assert.ok(reachableMaskTileKeys(item.block).has(`${item.tx},${item.ty}`), `${group} ${item.id} is unreachable at unlock`)
  }
  for (let block = 1; block <= 6; block++) {
    const blockItems = items.filter((item) => item.block === block)
    const expected = block < 6 ? 15 : group === 'A' ? 10 : 9
    assert.equal(blockItems.length, expected, `${group} block ${block} count changed`)
    for (let a = 0; a < blockItems.length; a++) for (let b = a + 1; b < blockItems.length; b++) {
      const distance = Math.hypot((blockItems[a].tx - blockItems[b].tx) * T, (blockItems[a].ty - blockItems[b].ty) * T)
      assert.ok(distance >= T, `${group} block ${block} marker discs visually overlap`)
    }
  }
  const first = items[0]
  assert.equal(markerStateFor(first, { blockNum: 1, collectedIds: new Set(), nearbyId: null, interactingId: null }), 'active')
  assert.equal(markerStateFor(first, { blockNum: 1, collectedIds: new Set([first.id]), nearbyId: null, interactingId: null }), 'completed')
  const last = items.find((item) => item.block === 6)
  assert.equal(markerStateFor(last, { blockNum: 1, collectedIds: new Set(), nearbyId: null, interactingId: null }), 'unavailable')
}

console.log('Human production validation passed:', {
  atlas: `${atlas.width}x${atlas.height} RGBA`, master: `${manifest.runtimeMaster.pixels.width}x${manifest.runtimeMaster.pixels.height}`,
  transparent, opaque, cream,
  walkable: allWalkable,
  safeSlots: Object.fromEntries(Object.entries(SAFE_SLOTS_BY_BLOCK).map(([block, slots]) => [block, slots.length])),
  sounds: expectedCounts,
})
