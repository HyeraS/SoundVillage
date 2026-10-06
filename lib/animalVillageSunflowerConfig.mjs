import {
  WALKABLE_MASK_METADATA,
  isMaskCellWalkable,
} from './generated/animalWalkableMask.generated.mjs'
import { getVillageRuntimeManifest } from './villageRuntimeManifest.mjs'
import {
  baseRectToCurrent,
  canOccupyMask,
  createWorldTransform,
  findScaledRectCollision,
  playerFootRectAt,
  projectGeometry,
} from './villageWorldTransform.mjs'

export const VILLAGE_ID = 'animal'
export const VILLAGE_MANIFEST = getVillageRuntimeManifest(VILLAGE_ID)
export const T = 32
export const MAP_W = 48
export const MAP_H = 32
export const WORLD_WIDTH = VILLAGE_MANIFEST.baseWorldWidth
export const WORLD_HEIGHT = VILLAGE_MANIFEST.baseWorldHeight
export const PLAYER_BOX = Object.freeze({ w: 20, h: 14 })

// The south bridge is the only production exit. The spawn is 3.4 tiles above
// its trigger so entering Animal never opens the exit modal immediately.
export const SPAWN = Object.freeze({ x: 23.5 * T, y: 27 * T })
export const EXIT = Object.freeze({ x: 23.5 * T, y: 30.4 * T, radius: 24 })

export const BASE_MAP_SRC = VILLAGE_MANIFEST.background.src
export const WALKABLE_MASK_SRC = VILLAGE_MANIFEST.mask.src
export const FOREGROUND_MAP_SRC = VILLAGE_MANIFEST.foreground.src

const rect = (id, x, y, w, h, tag) => Object.freeze({ id, x, y, w, h, tag })

// Invisible collision geometry measured against the 1536x1024 reference.
// These rectangles never participate in production rendering.
export const COLLIDERS = Object.freeze([
  // Outer forest, cliff and water. Gaps are left at all three wooden bridges.
  rect('edge-north', 0, 0, 1536, 54, 'forest'),
  rect('edge-south-west', 0, 918, 674, 106, 'cliff'),
  rect('edge-south-east', 802, 918, 734, 106, 'cliff'),
  rect('edge-west-north', 0, 54, 44, 534, 'forest'),
  rect('edge-west-south', 0, 684, 44, 234, 'cliff'),
  rect('edge-east-north', 1492, 54, 44, 534, 'forest'),
  rect('edge-east-south', 1492, 684, 44, 234, 'cliff'),
  rect('west-water-north', 0, 370, 30, 218, 'water'),
  rect('west-water-south', 0, 684, 30, 178, 'water'),
  rect('east-water-north', 1506, 370, 30, 218, 'water'),
  rect('east-water-south', 1506, 684, 30, 178, 'water'),

  // Buildings and large fixed landmarks.
  rect('silo', 50, 72, 78, 132, 'building'),
  rect('barn', 126, 70, 218, 139, 'building'),
  rect('farmhouse', 663, 65, 190, 137, 'building'),
  rect('greenhouse', 1038, 67, 151, 188, 'building'),
  rect('pond-house', 1275, 463, 171, 132, 'building'),
  rect('cottage-blue', 82, 704, 130, 139, 'building'),
  rect('cottage-red', 214, 701, 151, 142, 'building'),
  rect('chicken-coop', 1300, 754, 70, 78, 'building'),
  rect('windmill-base', 688, 382, 139, 119, 'building'),
  rect('well', 829, 714, 102, 103, 'well'),
  rect('produce-cart', 1160, 292, 75, 70, 'cart'),

  // Pond water, split around the wooden dock so the dock stays walkable.
  rect('pond-west', 931, 501, 178, 160, 'water'),
  rect('pond-north', 1000, 470, 214, 55, 'water'),
  rect('pond-south', 1002, 621, 212, 47, 'water'),
  rect('pond-east-water', 1204, 500, 34, 168, 'water'),

  // Benches, barrels, rocks and sign bases that visibly stop the feet.
  rect('bench-farmhouse', 613, 220, 65, 28, 'bench'),
  rect('bench-pond', 1058, 395, 77, 31, 'bench'),
  rect('bench-orchard', 211, 536, 77, 31, 'bench'),
  rect('pond-rock', 925, 563, 54, 37, 'rock'),
  rect('pond-barrels', 927, 615, 61, 45, 'barrel'),
  rect('barn-barrels', 331, 111, 41, 116, 'barrel'),
  rect('field-barrels', 1178, 55, 42, 48, 'barrel'),
  rect('pond-sign', 1010, 390, 31, 52, 'sign'),

  // Orchard and prominent free-standing tree trunks.
  ...[
    [95, 388], [205, 388], [309, 388], [95, 495], [205, 495], [309, 495],
    [440, 295], [471, 532], [899, 546], [1130, 365], [1416, 433],
    [963, 90], [1465, 258], [1390, 676], [1097, 820], [926, 749],
    [137, 686], [276, 862], [1415, 797],
  ].map(([x, y], index) => rect(`tree-${index + 1}`, x - 13, y - 12, 26, 24, 'tree')),

  // Crop rows are blocked but the visible furrows between them remain open.
  ...[126, 179, 232, 285].flatMap((y, row) => [
    rect(`wheat-west-${row}`, 1220, y, 94, 22, 'crop'),
    rect(`wheat-east-${row}`, 1334, y, 101, 22, 'crop'),
  ]),
  rect('vegetable-west-a', 1220, 316, 94, 20, 'crop'),
  rect('vegetable-west-b', 1220, 352, 94, 20, 'crop'),
  rect('vegetable-east-a', 1334, 316, 101, 20, 'crop'),
  rect('vegetable-east-b', 1334, 352, 101, 20, 'crop'),

  // Fence rails with explicit gate gaps.
  rect('cattle-fence-left', 50, 168, 12, 141, 'fence'),
  rect('cattle-fence-bottom-west', 50, 289, 323, 14, 'fence'),
  rect('cattle-fence-bottom-east', 404, 289, 105, 14, 'fence'),
  rect('orchard-fence-top-west', 38, 316, 205, 14, 'fence'),
  rect('orchard-fence-top-east', 272, 316, 101, 14, 'fence'),
  rect('orchard-fence-left', 38, 316, 12, 171, 'fence'),
  rect('orchard-fence-right', 365, 316, 12, 143, 'fence'),
  rect('field-fence-top', 1199, 52, 251, 13, 'fence'),
  rect('field-fence-right', 1442, 52, 13, 338, 'fence'),
  rect('field-fence-bottom', 1199, 378, 256, 13, 'fence'),
  rect('field-fence-left-north', 1199, 52, 13, 224, 'fence'),
  rect('field-fence-left-south', 1199, 321, 13, 70, 'fence'),
  rect('chicken-fence-top', 1130, 697, 240, 13, 'fence'),
  rect('chicken-fence-left', 1130, 697, 13, 174, 'fence'),
  rect('chicken-fence-right', 1360, 697, 13, 174, 'fence'),
  rect('chicken-fence-bottom-west', 1130, 858, 88, 13, 'fence'),
  rect('chicken-fence-bottom-east', 1260, 858, 113, 13, 'fence'),
])

export const BRIDGES = Object.freeze([
  { id: 'west-waterfall-bridge', x: 0, y: 18, w: 3, h: 3, dir: 'h' },
  { id: 'east-waterfall-bridge', x: 45, y: 18, w: 3, h: 3, dir: 'h' },
  { id: 'south-entry-bridge', x: 21, y: 28, w: 4, h: 4, dir: 'v' },
])

export const GATES = Object.freeze([
  { id: 'cattle-south-gate', x: 389, y: 296 },
  { id: 'orchard-north-gate', x: 257, y: 323 },
  { id: 'field-west-gate', x: 1205, y: 290 },
  { id: 'chicken-south-gate', x: 1239, y: 865 },
])

export const CLEARINGS = Object.freeze([
  { id: 'northwest-clearing', cx: 17.2, cy: 11.9, rx: 2.7, ry: 2.2 },
  { id: 'northeast-clearing', cx: 29.0, cy: 11.9, rx: 2.8, ry: 2.2 },
  { id: 'southwest-clearing', cx: 16.0, cy: 18.1, rx: 3.1, ry: 2.5 },
  { id: 'southeast-clearing', cx: 27.1, cy: 19.2, rx: 2.7, ry: 2.3 },
])

const transformFor = (worldSize = {}) => createWorldTransform({
  baseWorldWidth: WORLD_WIDTH,
  baseWorldHeight: WORLD_HEIGHT,
  currentWorldWidth: worldSize.currentWorldWidth ?? WORLD_WIDTH,
  currentWorldHeight: worldSize.currentWorldHeight ?? WORLD_HEIGHT,
})

export function collidesAt(colliders, x, y, worldSize = {}) {
  const transform = transformFor(worldSize)
  const foot = playerFootRectAt({ x, y }, PLAYER_BOX, transform)
  const hard = findScaledRectCollision(colliders, foot, transform)
  if (hard) return baseRectToCurrent(hard, transform)
  if (!canOccupyMask(isMaskCellWalkable, WALKABLE_MASK_METADATA, { x, y }, PLAYER_BOX, transform)) {
    return { id: 'walkable-mask', tag: 'blocked-mask', ...foot }
  }
  return null
}

export function createAnimalRuntimeGeometry(worldSize = {}) {
  const transform = transformFor(worldSize)
  return Object.freeze({
    villageId: VILLAGE_ID,
    manifest: VILLAGE_MANIFEST,
    transform,
    spawn: Object.freeze(projectGeometry(SPAWN, transform)),
    exit: Object.freeze(projectGeometry(EXIT, transform)),
    colliders: Object.freeze(COLLIDERS.map((collider) => Object.freeze(baseRectToCurrent(collider, transform)))),
    bridges: Object.freeze(BRIDGES.map((bridge) => Object.freeze(baseRectToCurrent({
      ...bridge, x: bridge.x * T, y: bridge.y * T, w: bridge.w * T, h: bridge.h * T,
    }, transform)))),
    gates: Object.freeze(projectGeometry(GATES, transform)),
  })
}

function canTraverse(colliders, ax, ay, bx, by) {
  for (let step = 1; step <= 4; step++) {
    const t = step / 4
    if (collidesAt(colliders, ax + (bx - ax) * t, ay + (by - ay) * t)) return false
  }
  return true
}

export function reachableTileKeys(model) {
  const start = [Math.floor(model.spawn.x / T), Math.floor(model.spawn.y / T)]
  const seen = new Set()
  const queue = [start]
  while (queue.length) {
    const [tx, ty] = queue.shift()
    const key = `${tx},${ty}`
    const x = tx * T + 16
    const y = ty * T + 22
    if (seen.has(key) || tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || collidesAt(model.colliders, x, y)) continue
    seen.add(key)
    for (const [nx, ny] of [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]]) {
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue
      if (canTraverse(model.colliders, x, y, nx * T + 16, ny * T + 22)) queue.push([nx, ny])
    }
  }
  return seen
}

// Open grass, broad dirt lanes, the four sound clearings and crop furrows.
// Regions cover the whole island so the six progression blocks remain spatial.
export const SOUND_SLOT_REGIONS = Object.freeze([
  { id: 'northwest', x: 2, y: 2, w: 15, h: 14 },
  { id: 'north-center', x: 17, y: 2, w: 14, h: 14 },
  { id: 'northeast', x: 31, y: 2, w: 7, h: 14 },
  { id: 'southwest', x: 2, y: 16, w: 15, h: 10 },
  { id: 'south-center', x: 17, y: 16, w: 14, h: 10 },
  { id: 'southeast', x: 31, y: 16, w: 15, h: 10 },
])

const SOUND_EXCLUSIONS = Object.freeze([
  rect('sound-exclusion-orchard', 28, 300, 365, 235, 'sound-exclusion'),
  rect('sound-exclusion-fields', 1188, 38, 286, 367, 'sound-exclusion'),
  rect('sound-exclusion-pond', 900, 448, 350, 242, 'sound-exclusion'),
  rect('sound-exclusion-chicken-pen', 1110, 680, 286, 218, 'sound-exclusion'),
  rect('sound-exclusion-cottages', 60, 665, 335, 220, 'sound-exclusion'),
  rect('sound-exclusion-pond-house', 1250, 415, 220, 215, 'sound-exclusion'),
  rect('sound-exclusion-south-cliff', 0, 840, WORLD_WIDTH, 184, 'sound-exclusion'),
])

function overlapsRect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function isSoundSlotClear(colliders, x, y) {
  const iconBox = { x: x - 18, y: y - 22, w: 36, h: 42 }
  return !colliders.some((collider) => overlapsRect(iconBox, collider))
    && !SOUND_EXCLUSIONS.some((exclusion) => overlapsRect(iconBox, exclusion))
}

export function createTerrain() {
  return Array.from({ length: MAP_H }, (_, ty) => Array.from({ length: MAP_W }, (_, tx) =>
    collidesAt(COLLIDERS, tx * T + 16, ty * T + 22) ? 1 : 0))
}

export function buildColliders() {
  return COLLIDERS.map((collider) => ({ ...collider }))
}

export function buildSunflowerVillageModel(worldSize = {}) {
  const transform = transformFor(worldSize)
  const model = {
    id: 'sunflower-commons-v4',
    label: '해바라기 공동농장',
    villageId: VILLAGE_ID,
    manifest: VILLAGE_MANIFEST,
    transform,
    baseWorldWidth: WORLD_WIDTH,
    baseWorldHeight: WORLD_HEIGHT,
    currentWorldWidth: transform.currentWorldWidth,
    currentWorldHeight: transform.currentWorldHeight,
    spawn: projectGeometry(SPAWN, transform),
    exit: projectGeometry(EXIT, transform),
    colliders: buildColliders(),
    bridges: BRIDGES,
    gates: GATES,
    clearings: CLEARINGS,
    terrain: createTerrain(),
    objects: [],
    renderObjects: [],
  }
  model.canStand = (x, y) => !collidesAt(model.colliders, x, y, worldSize)
  // Slot authoring stays in base tile coordinates; production positions are
  // projected by the shared transform at the component boundary.
  const baseReachabilityModel = transform.scaleX === 1 && transform.scaleY === 1
    ? model
    : { ...model, spawn: { ...SPAWN }, exit: { ...EXIT }, canStand: (x, y) => !collidesAt(model.colliders, x, y) }
  model.reachable = reachableTileKeys(baseReachabilityModel)
  model.spawnSlots = SOUND_SLOT_REGIONS.flatMap((region, blockIndex) => {
    const slots = []
    for (let ty = region.y; ty < region.y + region.h; ty++) {
      for (let tx = region.x; tx < region.x + region.w; tx++) {
        const key = `${tx},${ty}`
        const x = tx * T + 16
        const y = ty * T + 22
        const exitDistance = Math.hypot(x - EXIT.x, y - EXIT.y)
        if (model.reachable.has(key) && baseReachabilityModel.canStand(x, y) && isSoundSlotClear(model.colliders, x, y) && exitDistance > 112) {
          slots.push({ tx, ty, region: region.id, blockHint: blockIndex + 1 })
        }
      }
    }
    return slots
  })
  return model
}
