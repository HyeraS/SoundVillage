import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URBAN_ASSET_URLS, URBAN_RENDER_SPRITES } from '../lib/urbanAssetArt.js'
import {
  T, MAP_W, MAP_H, SPAWN, EXIT_TRIGGER, METRO, BUILDINGS, ROAD_LANES,
  CROSSWALKS, PROPS, SAFE_SLOTS_BY_BLOCK, PLAYER_BOX,
  MARKER_OUTER_RADIUS, MARKER_MIN_CENTER_DISTANCE,
  buildUrbanVillage, spawnUrbanItems, isWalkableTile, isAccessibleTile,
  isSafeUrbanSlot, isRoadLaneTile, isRailTile, isWaterTile, isSolidTile,
  distanceFromSolid, reachableTileKeys, collides, overlapsExitTrigger,
} from '../lib/urbanVillageConfig.mjs'

const repoFile = (path) => new URL(`../${path}`, import.meta.url)

function pngHeader(buffer, label) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${label} must have a PNG signature`)
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', `${label} must start with IHDR`)
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
    hasAlpha: buffer[25] === 4 || buffer[25] === 6,
  }
}

const manifest = JSON.parse(await readFile(repoFile('public/assets/urban-city-v2/manifest.json'), 'utf8'))
assert.equal(manifest.version, 2)
assert.deepEqual(manifest.worldPixels, { width: MAP_W * T, height: MAP_H * T })

const runtimeByLoaderKey = new Map(manifest.runtimeAssets.map((asset) => [asset.loaderKey, asset]))
assert.equal(runtimeByLoaderKey.size, manifest.runtimeAssets.length, 'runtime manifest loader keys must be unique')
assert.deepEqual([...runtimeByLoaderKey.keys()].sort(), Object.keys(URBAN_ASSET_URLS).sort(), 'runtime loader keys must match the renderer')

for (const [loaderKey, url] of Object.entries(URBAN_ASSET_URLS)) {
  const asset = runtimeByLoaderKey.get(loaderKey)
  assert.equal(url, `${manifest.runtimeBaseUrl}${asset.file}`, `${loaderKey} loader URL must match manifest`)
  const header = pngHeader(await readFile(repoFile(`public/assets/urban-city-v2/${asset.file}`)), asset.file)
  assert.deepEqual({ width: header.width, height: header.height }, asset.runtimePixels, `${asset.file} runtime dimensions changed`)
  assert.equal(header.hasAlpha, asset.alphaRole === 'transparent', `${asset.file} alpha role changed`)

  const sourceHeader = pngHeader(await readFile(repoFile(`public/assets/urban-city-v2/${asset.generation.sourceFile}`)), asset.generation.sourceFile)
  assert.deepEqual({ width: sourceHeader.width, height: sourceHeader.height }, asset.generation.sourcePixels, `${asset.generation.sourceFile} source dimensions changed`)
  await readFile(repoFile(`public/assets/urban-city-v2/${asset.generation.prompt}`), 'utf8')
  assert.notEqual(asset.review.status, 'planned', `${asset.id} must have a completed Gate 1 review state`)
}

for (const archive of manifest.archives) {
  assert.equal(archive.runtime, false, `${archive.id} must remain explicitly non-runtime`)
  assert.ok(archive.status.startsWith('archival-'), `${archive.id} needs an archival status`)
  const header = pngHeader(await readFile(repoFile(`public/assets/urban-city-v2/${archive.file}`)), archive.file)
  assert.deepEqual({ width: header.width, height: header.height }, archive.pixels, `${archive.file} archive dimensions changed`)
  assert.ok(!Object.values(URBAN_ASSET_URLS).includes(`${manifest.runtimeBaseUrl}${archive.file}`), `${archive.file} must never be loaded at runtime`)
}

for (const [pass, sprites] of Object.entries(URBAN_RENDER_SPRITES)) {
  for (const sprite of sprites) {
    const asset = runtimeByLoaderKey.get(sprite.image)
    assert.ok(asset, `${pass}:${sprite.id} references unknown loader key ${sprite.image}`)
    assert.ok(sprite.s.x >= 0 && sprite.s.y >= 0 && sprite.s.w > 0 && sprite.s.h > 0, `${pass}:${sprite.id} has an invalid source crop`)
    assert.ok(sprite.s.x + sprite.s.w <= asset.runtimePixels.width, `${pass}:${sprite.id} source crop exceeds ${asset.file}`)
    assert.ok(sprite.s.y + sprite.s.h <= asset.runtimePixels.height, `${pass}:${sprite.id} source crop exceeds ${asset.file}`)
    assert.ok(sprite.d.x >= 0 && sprite.d.y >= 0 && sprite.d.w > 0 && sprite.d.h > 0, `${pass}:${sprite.id} has an invalid destination`)
    assert.ok(sprite.d.x + sprite.d.w <= MAP_W * T, `${pass}:${sprite.id} exceeds the world width`)
    assert.ok(sprite.d.y + sprite.d.h <= MAP_H * T, `${pass}:${sprite.id} exceeds the world height`)
  }
}

const urbanComponentSource = await readFile(repoFile('components/UrbanV3ZoneMap.js'), 'utf8')
const rootPageSource = await readFile(repoFile('app/page.js'), 'utf8')
const artPreviewSource = await readFile(repoFile('app/urban-art-preview/page.js'), 'utf8')
assert.match(urbanComponentSource, /urbanV3WorldConfig/)
assert.match(urbanComponentSource, /spawnUrbanV3SoundItems/)
assert.match(urbanComponentSource, /VILLAGE_MANIFEST\.background\.src/)
assert.match(urbanComponentSource, /currentWorldWidth/)
assert.doesNotMatch(urbanComponentSource, /urbanVillageConfig|buildUrbanVillage/, 'production Urban must not use the legacy Urban model')
assert.match(rootPageSource, /activeZone === 'Urban'[\s\S]*?<UrbanV3ZoneMap/)
assert.match(artPreviewSource, /UrbanArtPreview/)
assert.doesNotMatch(artPreviewSource, /UrbanV3ZoneMap/, 'art preview must not mount the gameplay HUD/player component')

const metadata = JSON.parse(await readFile(new URL('../data/sound_metadata.json', import.meta.url), 'utf8'))
const urbanSounds = (metadata.sounds || []).filter((sound) => sound.game_zone === 'Urban')
const groups = Object.freeze({
  A: urbanSounds.filter((sound) => sound.group === 'A'),
  B: urbanSounds.filter((sound) => sound.group === 'B'),
})

const rects = [METRO.rail, METRO.stairs, ...BUILDINGS, ...ROAD_LANES, ...CROSSWALKS, ...PROPS]
for (const rect of rects) {
  assert.ok(rect.x >= 0 && rect.y >= 0, `${rect.tag} starts outside the map`)
  assert.ok(rect.x + rect.w <= MAP_W && rect.y + rect.h <= MAP_H, `${rect.tag} exceeds the map boundary`)
}

assert.equal(MAP_W, 48)
assert.equal(MAP_H, 36)
assert.equal(T, 32)
assert.equal(overlapsExitTrigger(SPAWN), false, 'spawn must not immediately trigger exit')
assert.equal(collides(buildUrbanVillage(), SPAWN.x, SPAWN.y, 1), null, 'spawn must be walkable in block 1')

for (let block = 1; block <= 6; block++) {
  const expectedCapacity = block === 6 ? 8 : 15
  assert.ok(SAFE_SLOTS_BY_BLOCK[block].length >= expectedCapacity,
    `block ${block} needs ${expectedCapacity} safe item slots, found ${SAFE_SLOTS_BY_BLOCK[block].length}`)
  const reachable = reachableTileKeys(block)
  let walkableCount = 0
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (isAccessibleTile(tx, ty, block)) walkableCount++
    }
  }
  assert.equal(reachable.size, walkableCount, `all block-${block} pedestrian tiles must connect to the south entrance`)
  for (const slot of SAFE_SLOTS_BY_BLOCK[block]) {
    const key = `${slot.tx},${slot.ty}`
    assert.ok(reachable.has(key), `block ${block} safe slot ${key} is unreachable when that block unlocks`)
    assert.ok(isSafeUrbanSlot(slot.tx, slot.ty, block), `block ${block} slot ${key} is unsafe`)
  }
}

const village = buildUrbanVillage()
for (const solid of [...BUILDINGS, ...METRO.railPieces, ...PROPS]) {
  const cx = (solid.x + solid.w / 2) * T
  const cy = (solid.y + solid.h / 2) * T
  assert.ok(collides(village, cx, cy, 6), `${solid.tag} must block the player`)
}

for (const [tx, ty, block, label] of [
  [24, 16, 4, 'central plaza'],
  [16, 18, 4, 'media crosswalk'],
  [30, 18, 5, 'food-court crosswalk'],
  [23, 22, 4, 'central road crosswalk'],
  [23, 10, 6, 'open metro stairs'],
]) {
  assert.ok(isWalkableTile(tx, ty), `${label} must be walkable`)
  assert.equal(collides(village, tx * T + T / 2, ty * T + T / 2 + PLAYER_BOX.h / 2, block), null,
    `${label} must allow player movement`)
}

const lockedSlot = SAFE_SLOTS_BY_BLOCK[2][0]
assert.ok(collides(village, lockedSlot.tx * T + T / 2, lockedSlot.ty * T + T / 2, 1), 'block 2 must reject entry while locked')
assert.equal(collides(village, lockedSlot.tx * T + T / 2, lockedSlot.ty * T + T / 2, 2), null, 'block 2 must open at unlock 2')

for (const [group, sounds] of Object.entries(groups)) {
  assert.equal(sounds.length, 83, `Urban ${group} must contain all 83 production sounds`)
  const counts = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index + 1, 0]))
  for (const sound of sounds) counts[Number(sound.block) || 1]++
  assert.deepEqual(counts, { 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 8 }, `Urban ${group} block counts changed`)

  const first = spawnUrbanItems(sounds)
  const second = spawnUrbanItems([...sounds].reverse())
  const coordinates = (items) => items.map((item) => `${item.id}:${item.block}:${item.tx},${item.ty}`)
  assert.deepEqual(coordinates(first), coordinates(second), `Urban ${group} placement must ignore input ordering`)
  assert.equal(first.length, sounds.length, `Urban ${group} dropped sounds during placement`)
  assert.equal(new Set(first.map((item) => `${item.tx},${item.ty}`)).size, first.length, `Urban ${group} overlaps item coordinates`)

  for (let block = 1; block <= 6; block++) {
    const blockItems = first.filter((item) => item.block === block)
    let minimum = Infinity
    for (let left = 0; left < blockItems.length; left++) {
      for (let right = left + 1; right < blockItems.length; right++) {
        const dx = (blockItems[left].tx - blockItems[right].tx) * T
        const dy = (blockItems[left].ty - blockItems[right].ty) * T
        minimum = Math.min(minimum, Math.hypot(dx, dy))
      }
    }
    assert.ok(minimum >= MARKER_MIN_CENTER_DISTANCE,
      `Urban ${group} block ${block} marker centers are only ${minimum}px apart`)
    assert.ok(minimum >= MARKER_OUTER_RADIUS * 2 + 8,
      `Urban ${group} block ${block} marker glow discs visually collide (${minimum}px)`)
    const xs = blockItems.map((item) => item.tx)
    const ys = blockItems.map((item) => item.ty)
    assert.ok(Math.max(...xs) - Math.min(...xs) >= 4, `Urban ${group} block ${block} markers are too vertically concentrated`)
    assert.ok(Math.max(...ys) - Math.min(...ys) >= 3, `Urban ${group} block ${block} markers are too horizontally concentrated`)
    const maxOnOneAxis = (values) => Math.max(...[...new Set(values)].map((value) => values.filter((entry) => entry === value).length))
    const axisLimit = Math.ceil(blockItems.length / 3)
    assert.ok(maxOnOneAxis(xs) <= axisLimit, `Urban ${group} block ${block} stacks too many markers in one column`)
    assert.ok(maxOnOneAxis(ys) <= axisLimit, `Urban ${group} block ${block} stacks too many markers in one row`)
  }

  for (const item of first) {
    const key = `${item.tx},${item.ty}`
    assert.ok(item.tx >= 0 && item.tx < MAP_W && item.ty >= 0 && item.ty < MAP_H, `${group} ${item.id} is outside the map`)
    assert.ok(isWalkableTile(item.tx, item.ty), `${group} ${item.id} is not on walkable paving`)
    assert.equal(isRoadLaneTile(item.tx, item.ty), false, `${group} ${item.id} is in a road lane`)
    assert.equal(isRailTile(item.tx, item.ty), false, `${group} ${item.id} is on rail`)
    assert.equal(isWaterTile(item.tx, item.ty), false, `${group} ${item.id} is in water`)
    assert.equal(isSolidTile(item.tx, item.ty), false, `${group} ${item.id} overlaps a solid`)
    assert.ok(distanceFromSolid(item.tx, item.ty) >= 1, `${group} ${item.id} is too close to a solid`)
    assert.ok(reachableTileKeys(item.block).has(key), `${group} ${item.id} is unreachable when block ${item.block} unlocks`)
  }
}

console.log('Urban production validation passed')
console.log(`  world: ${MAP_W}x${MAP_H} tiles · ${BUILDINGS.length} buildings · elevated metro + ${PROPS.length} props`)
console.log(`  safe slot capacity: ${Object.entries(SAFE_SLOTS_BY_BLOCK).map(([block, slots]) => `${block}:${slots.length}`).join(' / ')}`)
console.log(`  production sounds: A ${groups.A.length} / B ${groups.B.length} · deterministic, unique, reachable`)
