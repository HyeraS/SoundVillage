import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { getCharacterRenderMetrics, getVisibleBodyCssBounds } from '../lib/characterRenderMetrics.mjs'
import {
  T, MAP_W, MAP_H, WORLD_W, WORLD_H, PLAYER_BOX, INTERACTION_RADIUS,
  MUSIC_PLAYER_SOURCE, MUSIC_PLAYER_W, MUSIC_PLAYER_H, MUSIC_PLAYER_VISIBLE_H,
  NAV_CELL, NAV_COLS, NAV_ROWS, NAV_TYPES, NAVIGATION_MASK,
  STAGE, GATE, BUILDINGS, PROPS, SCENE_TREES, PROP_COLLIDERS, TREE_TRUNK_COLLIDERS, BLOCKING_PROP_COLLIDERS, SPAWN, EXIT_TRIGGER,
  TERRAIN_FEATURES, PLANTED_LANDSCAPE_FEATURES, TREE_GROVE_FEATURES, PRIORITY_WALKABLE_PATHS, SLOT_GROUPS, PRIMARY_SLOTS, ALL_SAFE_SLOTS, OCCLUSION_OBJECTS,
  SILHOUETTE_ENTER_RATIO, SILHOUETTE_EXIT_RATIO,
  getNavigationTypeAtWorld, getNavigationCellAtWorld, isNavigationWalkable, isWalkableTile, isSafeMarkerSlot,
  spawnMusicItems, distanceToMusicItem, isMusicItemNearby, validateSlotSet,
  buildVillage, collides, moveWithCollision, moveWithCollisionDetailed, overlapsExitTrigger,
  getMusicCamera, worldToMusicScreen, getMusicPlayerPlacement,
  splitOcclusionObjects, measureOcclusionAtPlayer, resolveOcclusionState,
} from '../lib/musicVillageConfig.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sound_metadata.json'), 'utf8'))
const music = metadata.sounds.filter((sound) => sound.game_zone === 'Music')
const expectedBlocks = { 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 8 }
const byBlock = (sounds) => Object.fromEntries([1, 2, 3, 4, 5, 6].map((block) => [block, sounds.filter((sound) => sound.block === block).length]))
const positionMap = (items) => Object.fromEntries(items.map((item) => [item.id, `${item.tx},${item.ty}:${item.place}`]))

// Research metadata and block progression are immutable.
for (const group of ['A', 'B']) {
  const sounds = music.filter((sound) => sound.group === group)
  assert.equal(sounds.length, 83, `Music ${group} count`)
  assert.deepEqual(byBlock(sounds), expectedBlocks, `Music ${group} block distribution`)
  const placed = spawnMusicItems(sounds)
  assert.equal(placed.length, 83, `Music ${group} placement count`)
  assert.equal(new Set(placed.map((item) => `${item.tx},${item.ty}`)).size, 83, `Music ${group} coordinates are unique`)
  assert.ok(placed.every((item) => isSafeMarkerSlot(item.tx, item.ty)), `Music ${group} avoids water and collisions`)
  assert.ok(placed.every((item) => item.place), `Music ${group} markers have landmark ownership`)
  assert.deepEqual(positionMap(placed), positionMap(spawnMusicItems([...sounds].reverse())), `Music ${group} is order-stable`)
}
assert.equal(music.length, 166, 'researcher bypass count')
assert.deepEqual(byBlock(music), { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 16 })
const bypassItems = spawnMusicItems(music)
assert.equal(bypassItems.length, 166, 'researcher bypass is not truncated')
assert.equal(new Set(bypassItems.map((item) => `${item.tx},${item.ty}`)).size, 166, 'researcher bypass coordinates are unique')
assert.equal(PRIMARY_SLOTS.length, 83)
assert.ok(ALL_SAFE_SLOTS.length >= 166, 'safe marker capacity covers researcher bypass')
assert.deepEqual(validateSlotSet(PRIMARY_SLOTS), { pass: true, count: 83, failures: [] })
for (let block = 1; block <= 6; block++) assert.equal(SLOT_GROUPS[block].length, expectedBlocks[block], `block ${block} slot count`)

// The 4px terrain mask is generated only from map boundary, water, buildings
// and fixed painted landscaping. Props are kept out of it and resolved once at
// runtime, so small decoration cannot expand to a 16px blocked square.
assert.equal(NAV_CELL, 4)
assert.deepEqual({ columns: NAV_COLS, rows: NAV_ROWS }, { columns: 384, rows: 288 })
assert.equal(NAVIGATION_MASK.length, NAV_COLS * NAV_ROWS)
assert.equal(NAV_COLS * NAV_CELL, WORLD_W)
assert.equal(NAV_ROWS * NAV_CELL, WORLD_H)
for (const type of Object.values(NAV_TYPES)) assert.ok(NAVIGATION_MASK.includes(type), `navigation includes type ${type}`)
const walkableCells = NAVIGATION_MASK.filter(isNavigationWalkable).length
assert.ok(walkableCells / NAVIGATION_MASK.length > .3 && walkableCells / NAVIGATION_MASK.length < .5, 'terrain coverage matches paths around the enclosed painted landscaping')
assert.equal(getNavigationTypeAtWorld(60, 560), NAV_TYPES.WATER, 'painted west pond is water')
assert.equal(getNavigationTypeAtWorld(WORLD_W / 2, 900), NAV_TYPES.ROAD, 'south music staff is road')
assert.deepEqual(getNavigationCellAtWorld(768, 900), { col: 192, row: 225, type: NAV_TYPES.ROAD })
assert.ok(TERRAIN_FEATURES.every((feature) => !feature.id.startsWith('prop:')), 'terrain mask contains no prop collider')
assert.ok(PLANTED_LANDSCAPE_FEATURES.every((feature) => ['vegetation', 'planter'].includes(feature.type)), 'painted thickets and raised planters are explicit terrain')
assert.equal(TREE_GROVE_FEATURES.length, SCENE_TREES.length, 'every visible tree has one grounded terrain footprint')

const village = buildVillage()
assert.deepEqual(PLAYER_BOX, { w: 12, h: 8 })
assert.deepEqual(MUSIC_PLAYER_SOURCE, { x: 0, y: 0, w: 32, h: 32 })
assert.deepEqual({ width: MUSIC_PLAYER_W, height: MUSIC_PLAYER_H }, { width: 72, height: 88 })
assert.equal(MUSIC_PLAYER_VISIBLE_H, 45, 'default idle alpha matches Nature xMidYMid meet height')
const logicalRenderMetrics = getCharacterRenderMetrics({ stageWidth: 768, stageHeight: 576, sceneCameraScale: 1 })
const logicalVisibleBody = getVisibleBodyCssBounds(logicalRenderMetrics, { x: 9, y: 12, w: 14, h: 20 })
assert.deepEqual(
  { width: logicalVisibleBody.width, height: logicalVisibleBody.height, gap: logicalVisibleBody.visibleToWrapperFootGap },
  { width: 31.5, height: MUSIC_PLAYER_VISIBLE_H, gap: 8 },
  'Music diagnostics follow the full-source 72x88 xMidYMid meet layout',
)
assert.equal(collides(village, SPAWN.x, SPAWN.y), null, 'spawn is walkable')
assert.equal(overlapsExitTrigger({ x: SPAWN.x, y: SPAWN.y }), false)
assert.equal(overlapsExitTrigger({ x: EXIT_TRIGGER.x + EXIT_TRIGGER.w / 2, y: EXIT_TRIGGER.y + EXIT_TRIGGER.h }), true)

// Buildings, water and the fixed landscape come from terrain; explicitly solid
// props use tuned foot insets. Decorative flowers/shrubs/foreground do not.
const tileCenter = (rect) => ({ x: (rect.x + rect.w / 2) * T, y: (rect.y + rect.h / 2) * T })
assert.equal(collides(village, tileCenter(STAGE.collision).x, tileCenter(STAGE.collision).y)?.id, 'terrain:stage')
for (const building of BUILDINGS) {
  assert.equal(collides(village, (building.x + building.w / 2) * T, (building.y + building.h / 2) * T)?.id, `terrain:${building.id}`)
}
assert.equal(BLOCKING_PROP_COLLIDERS.length, 0, 'navigation-baked vegetation is not tested again as a runtime prop')
assert.ok(PROPS.filter((prop) => prop.id === 'flowerbed-low-a').every((prop) => !prop.movementBlocking), 'decorative flowers are non-blocking')
assert.ok(PROPS.filter((prop) => prop.id === 'foreground-edge-cluster').every((prop) => !prop.movementBlocking), 'visual foreground is non-blocking')
for (const rect of TREE_TRUNK_COLLIDERS) {
  const foot = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 + PLAYER_BOX.h / 2 }
  const hit = collides(village, foot.x, foot.y)
  assert.ok(hit && ['tree', 'vegetation', 'landscape', 'boundary'].includes(hit.type), `${rect.id} blocks at the visible trunk`) 
}
assert.equal(collides(village, 380, 400)?.id, 'terrain:west-inner-grove', 'dense inner planting cannot be crossed')
assert.equal(collides(village, 1156, 400)?.id, 'terrain:east-inner-grove', 'mirrored dense planting cannot be crossed')
assert.equal(collides(village, 620, 286)?.id, 'terrain:stage-west-planter', 'raised flower bed cannot be crossed')
assert.equal(getNavigationTypeAtWorld(380, 400), NAV_TYPES.VEGETATION, 'debug cell identifies vegetation distinctly')
assert.equal(collides(village, 60, 570)?.id, 'terrain:west-pond', 'painted water cannot be crossed')
const flowerIndex = PROPS.findIndex((prop) => prop.id === 'flowerbed-low-a')
assert.ok(!BLOCKING_PROP_COLLIDERS.includes(PROP_COLLIDERS[flowerIndex]), 'flower collider is marker avoidance only')
for (const id of ['bench-low-a', 'tree-low-a', 'lamp-low-a']) {
  const candidates = PROPS.map((prop, index) => ({ prop, rect: PROP_COLLIDERS[index] })).filter(({ prop }) => prop.id === id)
  assert.ok(candidates.some(({ rect }) => [
    { x: rect.x - 26, y: rect.y + rect.h + PLAYER_BOX.h },
    { x: rect.x + rect.w + 26, y: rect.y + rect.h + PLAYER_BOX.h },
    { x: rect.x + rect.w / 2, y: rect.y - 26 },
    { x: rect.x + rect.w / 2, y: rect.y + rect.h + PLAYER_BOX.h + 26 },
  ].some((point) => !collides(village, point.x, point.y))), `${id} leaves a real adjacent passage`)
}

function reachableFrom(start) {
  const queue = [start]
  const seen = new Set([start.join(',')])
  const parents = new Map()
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, y + dy]
      const key = next.join(',')
      if (!seen.has(key) && isWalkableTile(...next)) {
        seen.add(key)
        parents.set(key, [x, y])
        queue.push(next)
      }
    }
  }
  return { seen, parents }
}
const { seen: reachable, parents } = reachableFrom([SPAWN.tx, SPAWN.ty])
assert.ok(reachable.has('23,34') && reachable.has('24,34'), 'spawn connects to both exit lanes')
for (const building of BUILDINGS) {
  const cells = []
  for (let y = building.clearance.y; y < building.clearance.y + building.clearance.h; y++) {
    for (let x = building.clearance.x; x < building.clearance.x + building.clearance.w; x++) cells.push(`${x},${y}`)
  }
  assert.ok(cells.some((cell) => reachable.has(cell)), `${building.id} entrance connects to spawn`)
}
assert.ok(Array.from({ length: STAGE.approach.h }, (_, row) => Array.from({ length: STAGE.approach.w }, (_, col) => `${STAGE.approach.x + col},${STAGE.approach.y + row}`)).flat().some((cell) => reachable.has(cell)), 'stage approach connects to spawn')
for (const group of ['A', 'B']) {
  const placed = spawnMusicItems(music.filter((sound) => sound.group === group))
  assert.ok(placed.every((item) => reachable.has(`${item.tx},${item.ty}`)), `all active ${group} markers connect to spawn`)
}
assert.ok(bypassItems.every((item) => reachable.has(`${item.tx},${item.ty}`)), 'all researcher markers connect to spawn')

// A BFS edge can be traversed in both directions by the same collision function.
for (const [child, parent] of parents.entries()) {
  const [cx, cy] = child.split(',').map(Number)
  const [px, py] = parent
  if (Math.abs(cx - px) + Math.abs(cy - py) !== 1) continue
  assert.ok(isWalkableTile(cx, cy) && isWalkableTile(px, py), 'major route edge is bidirectional')
}
let routePosition = { x: SPAWN.x, y: SPAWN.y }
const movedPosition = moveWithCollision(village, routePosition, 4, 0)
assert.notDeepEqual(movedPosition, routePosition, 'fine-grained movement remains possible on the spawn road')

// The screenshot's straight south brick road is traversable end-to-end in both
// directions, including its visibly open edge.
const southRoadTop = { x: 768, y: 770 }
const southRoadBottom = { x: 768, y: 1138 }
assert.ok(Math.abs(moveWithCollision(village, southRoadBottom, 0, -368).y - southRoadTop.y) < .01, 'straight road traverses northbound')
assert.ok(Math.abs(moveWithCollision(village, southRoadTop, 0, 368).y - southRoadBottom.y) < .01, 'straight road traverses southbound')
assert.equal(collides(village, 680, 900), null, 'visible road edge remains walkable')
assert.equal(collides(village, 620, 600)?.id, 'terrain:resonance-garden', 'fixed landscaped garden remains blocked outside the painted center path')

// Painted clefs and notes are decoration on top of traversable brick. The
// narrow priority paths cut the central spine and both rings back out of the
// broader garden/vegetation polygons without weakening water or buildings.
assert.ok(PRIORITY_WALKABLE_PATHS.length >= 6, 'visible paved corridors have explicit clearance polygons')
const paintedMusicPathPoints = [
  [768, 365], [768, 520], [768, 680], [768, 790], [768, 930],
  [440, 425], [448, 620], [1096, 425], [1088, 620], [470, 805], [1066, 805],
]
for (const [x, y] of paintedMusicPathPoints) {
  assert.equal(collides(village, x, y), null, `painted music path remains walkable at ${x},${y}`)
  assert.ok(isNavigationWalkable(getNavigationTypeAtWorld(x, y)), `painted music path is walkable at ${x},${y}`)
}
const fullCenterRoadTop = { x: 768, y: 350 }
const fullCenterRoadBottom = { x: 768, y: 1138 }
assert.ok(Math.abs(moveWithCollision(village, fullCenterRoadBottom, 0, -788).y - fullCenterRoadTop.y) < .01, 'clef road traverses northbound end-to-end')
assert.ok(Math.abs(moveWithCollision(village, fullCenterRoadTop, 0, 788).y - fullCenterRoadBottom.y) < .01, 'clef road traverses southbound end-to-end')

// A representative tree trunk reports the same collider from every cardinal
// approach and fine substeps prevent tunnelling at fast frame deltas.
const treeRect = TREE_TRUNK_COLLIDERS[10]
const approaches = [
  [{ x: treeRect.x - 24, y: treeRect.y + treeRect.h }, 48, 0, 'x'],
  [{ x: treeRect.x + treeRect.w + 24, y: treeRect.y + treeRect.h }, -48, 0, 'x'],
  [{ x: treeRect.x + treeRect.w / 2, y: treeRect.y - 16 }, 0, 40, 'y'],
  [{ x: treeRect.x + treeRect.w / 2, y: treeRect.y + treeRect.h + PLAYER_BOX.h + 16 }, 0, -40, 'y'],
]
for (const [start, dx, dy, axis] of approaches) {
  const result = moveWithCollisionDetailed(village, start, dx, dy)
  assert.ok(result.blockedAxes.includes(axis), `tree blocks ${axis} approach`)
  assert.ok(result.collisions.some((hit) => hit.id === treeRect.id || ['tree', 'vegetation'].includes(hit.type)), 'tree collision id/type is direction-independent')
}

// Foot anchor, viewport sizing, dead zone, smoothing, look-ahead and clamps.
const initialCamera = getMusicCamera({ cssWidth: 1440, cssHeight: 788, playerX: 768, playerY: 576 })
assert.ok(initialCamera.viewWidth / T >= 30 && initialCamera.viewWidth / T <= 32)
assert.ok(initialCamera.viewHeight / T >= 17 && initialCamera.viewHeight / T <= 20)
const landscapeCamera = getMusicCamera({ cssWidth: 844, cssHeight: 334, playerX: 768, playerY: 576 })
assert.ok(landscapeCamera.viewWidth / T <= 32, 'mobile landscape caps at 32 horizontal tiles')
const landscapeRenderMetrics = getCharacterRenderMetrics({
  stageWidth: 844,
  stageHeight: 334,
  sceneCameraScale: landscapeCamera.scale,
})
const landscapeVisibleBody = getVisibleBodyCssBounds(landscapeRenderMetrics, { x: 9, y: 12, w: 14, h: 20 })
assert.ok(landscapeVisibleBody.height >= 40, 'mobile landscape body remains at least 40 CSS px')
assert.ok(Math.abs(landscapeVisibleBody.height - MUSIC_PLAYER_VISIBLE_H * landscapeRenderMetrics.screenScale) < 1e-9)
assert.ok(Math.abs(landscapeVisibleBody.visibleToWrapperFootGap - 8 * landscapeRenderMetrics.screenScale) < 1e-9)
const insideCamera = getMusicCamera({
  cssWidth: 1440, cssHeight: 788,
  playerX: 768 + initialCamera.deadZone.w * .25, playerY: 576,
  previousCamera: initialCamera, deltaSeconds: 1 / 60,
})
assert.equal(insideCamera.x, initialCamera.x, 'camera stays still inside dead zone')
assert.equal(insideCamera.y, initialCamera.y, 'camera stays still inside dead zone vertically')
const outsidePlayerX = initialCamera.deadZone.x + initialCamera.deadZone.w + 180
const outsideCamera = getMusicCamera({
  cssWidth: 1440, cssHeight: 788, playerX: outsidePlayerX, playerY: 576,
  movementX: 1, previousCamera: initialCamera, deltaSeconds: 1 / 60,
})
assert.ok(outsideCamera.x > initialCamera.x, 'camera follows outside dead zone')
assert.ok(outsideCamera.x < outsidePlayerX - initialCamera.viewWidth / 2 + initialCamera.viewWidth, 'camera follow is smoothed, not snapped')
assert.ok(outsideCamera.lookAheadX > 0, 'camera adds movement look-ahead')
const northwestCamera = getMusicCamera({ cssWidth: 1440, cssHeight: 788, playerX: 0, playerY: 0 })
const southeastCamera = getMusicCamera({ cssWidth: 1440, cssHeight: 788, playerX: WORLD_W, playerY: WORLD_H })
assert.deepEqual({ x: northwestCamera.x, y: northwestCamera.y }, { x: 0, y: 0 })
assert.deepEqual({ x: southeastCamera.x, y: southeastCamera.y }, { x: southeastCamera.maxX, y: southeastCamera.maxY })
for (const camera of [initialCamera, northwestCamera, southeastCamera]) {
  const foot = worldToMusicScreen(camera, SPAWN.x, SPAWN.y)
  const placement = getMusicPlayerPlacement(camera, SPAWN.x, SPAWN.y)
  assert.equal(placement.left + MUSIC_PLAYER_W * camera.scale / 2, foot.x)
  assert.equal(placement.top + MUSIC_PLAYER_H * camera.scale, foot.y)
}

// Every foreground component has an independent ground-contact sort point and
// a tight polygon-backed alpha mask.
assert.ok(OCCLUSION_OBJECTS.length >= 24)
for (const object of OCCLUSION_OBJECTS) {
  assert.ok(object.source && object.display && object.maskPoints.length >= 4 && Number.isFinite(object.sortY) && Number.isFinite(object.occlusionHeight))
  const before = splitOcclusionObjects(object.sortY - 1)
  const after = splitOcclusionObjects(object.sortY + 1)
  assert.ok(before.front.includes(object), `${object.id} is in front of a player behind it`)
  assert.ok(after.behind.includes(object), `${object.id} is behind a player in front of it`)
}
const assetRoot = path.join(ROOT, 'public/assets/music-village-moonlit-v3')
const foregroundPath = path.join(assetRoot, 'foreground/occlusion.png')
const { data: foregroundPixels, info: foregroundInfo } = await sharp(foregroundPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const alphaAt = (x, y) => {
  const px = Math.floor(x)
  const py = Math.floor(y)
  if (px < 0 || py < 0 || px >= foregroundInfo.width || py >= foregroundInfo.height) return 0
  return foregroundPixels[(py * foregroundInfo.width + px) * 4 + 3]
}
const silhouetteObject = OCCLUSION_OBJECTS.find((object) => object.id === 'depth:scene-tree:1')
const behindTree = measureOcclusionAtPlayer(silhouetteObject.display.x + silhouetteObject.display.w / 2, silhouetteObject.sortY - 10, alphaAt)
const inFrontOfTree = measureOcclusionAtPlayer(silhouetteObject.display.x + silhouetteObject.display.w / 2, silhouetteObject.sortY + 10, alphaAt)
const transparentEdge = measureOcclusionAtPlayer(silhouetteObject.display.x + 2, silhouetteObject.sortY - 10, alphaAt)
assert.ok(behindTree.ratio >= SILHOUETTE_ENTER_RATIO, 'tree alpha meaningfully overlaps a body behind it')
assert.equal(inFrontOfTree.ratio, 0, 'tree is rendered behind a player in front of its root')
assert.ok(transparentEdge.ratio < SILHOUETTE_EXIT_RATIO, 'transparent crop pixels do not activate silhouette')
assert.equal(resolveOcclusionState(behindTree, false).active, true, 'sufficient body coverage activates silhouette')
assert.equal(resolveOcclusionState(transparentEdge, false).active, false, 'small leaf-edge overlap stays below enter threshold')
const betweenThresholds = { ratio: (SILHOUETTE_ENTER_RATIO + SILHOUETTE_EXIT_RATIO) / 2, objects: [] }
assert.equal(resolveOcclusionState(betweenThresholds, true).active, true, 'one-pixel retreat does not immediately clear active occlusion')
assert.equal(resolveOcclusionState(betweenThresholds, false).active, false, 'one-pixel advance does not immediately activate occlusion')

// Interaction radius allows local approach while rejecting remote clicks.
const sampleItem = spawnMusicItems(music.filter((sound) => sound.group === 'A'))[0]
const markerPosition = { x: (sampleItem.tx + .5) * T, y: (sampleItem.ty + .5) * T }
assert.ok(INTERACTION_RADIUS >= 3 * T && INTERACTION_RADIUS <= 4 * T)
assert.equal(distanceToMusicItem(markerPosition, sampleItem), 0)
assert.equal(isMusicItemNearby(markerPosition, sampleItem), true)
assert.equal(isMusicItemNearby({ x: markerPosition.x + 5 * T, y: markerPosition.y }, sampleItem), false)

// Existing PNGs remain byte-identical to the production manifest.
const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'))
assert.deepEqual(manifest.geometry, { width: 1536, height: 1152, tiles: { width: 48, height: 36 }, tileSize: 32 })
for (const file of manifest.files) {
  const data = fs.readFileSync(path.join(assetRoot, file.path))
  assert.equal(data.length, file.bytes, `${file.path} byte size`)
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), file.sha256, `${file.path} hash`)
}

const runtimeSource = fs.readFileSync(path.join(ROOT, 'lib/musicVillage.js'), 'utf8')
const mapSource = fs.readFileSync(path.join(ROOT, 'components/MusicZoneMap.js'), 'utf8')
const testSource = fs.readFileSync(path.join(ROOT, 'app/music-test/page.js'), 'utf8')
assert.match(runtimeSource, /drawDepthLayer/)
assert.match(runtimeSource, /drawNavigationDebug/)
assert.match(runtimeSource, /foregroundAlphaAt/)
assert.doesNotMatch(mapSource, /drawForeground\(/, 'single fixed foreground layer was removed')
assert.match(mapSource, /applyWorldTransform\(background\)/)
assert.match(mapSource, /applyWorldTransform\(context\)/, 'background, depth objects and markers share a transform')
assert.match(mapSource, /data-testid="music-player-silhouette"/)
assert.match(mapSource, /opacity: \.22/)
assert.match(mapSource, /data-testid="music-debug-panel"/)
assert.match(mapSource, /moveWithCollisionDetailed/)
assert.match(mapSource, /dataset\.collisionId/)
assert.match(mapSource, /dataset\.occlusionRatio/)
assert.match(mapSource, /sourceViewBox=\{MUSIC_PLAYER_SOURCE\}/)
assert.match(mapSource, /nearbyMarkerButtonRef/)
assert.match(mapSource, /onClick=\{confirmCollect\}/, 'nearby click uses beginCollect path')
assert.doesNotMatch(mapSource, /onClick=.*drawMarker/, 'marker canvas has no remote click path')
assert.match(testSource, /<AnnotationPanel/)
assert.match(testSource, /\bdryRun\b/)
assert.match(testSource, /onClose=\{\(\) => setActiveSound\(null\)\}/)
assert.match(testSource, /onComplete=\{finishAnnotation\}/)
assert.match(testSource, /music-debug-toggle/)

console.log(JSON.stringify({
  pass: true,
  metadata: { groupA: 83, groupB: 83, bypass: 166, blocks: expectedBlocks },
  navigation: { cells: `${NAV_COLS}x${NAV_ROWS}`, walkableCells, walkableTiles: reachable.size },
  collision: { buildings: BUILDINGS.length, blockingProps: BLOCKING_PROP_COLLIDERS.length, foot: PLAYER_BOX },
  depth: { objects: OCCLUSION_OBJECTS.length, silhouette: true, enter: SILHOUETTE_ENTER_RATIO, exit: SILHOUETTE_EXIT_RATIO },
  assets: manifest.files.length,
}, null, 2))
