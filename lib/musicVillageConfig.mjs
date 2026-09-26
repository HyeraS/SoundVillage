export const T = 32
export const MAP_W = 48
export const MAP_H = 36
export const WORLD_W = MAP_W * T
export const WORLD_H = MAP_H * T
// Movement is resolved from a compact box around the character's feet.  The
// visible sprite is intentionally much larger; hair/shoulders must never catch
// on scenery that the feet can walk past.
export const PLAYER_BOX = Object.freeze({ w: 12, h: 8 })
export const INTERACTION_BOX = Object.freeze({ w: 24, h: 24 })
export const INTERACTION_RADIUS = 3.5 * T

// The shared character sheets use 32x32 cells, but their union alpha bounds are
// x=9..22, y=12..31. Music crops that transparent padding and renders the
// visible 14x20 body at a grounded 36x52 world-pixel size.
export const MUSIC_PLAYER_SOURCE = Object.freeze({ x: 9, y: 12, w: 14, h: 20 })
export const MUSIC_PLAYER_W = 36
export const MUSIC_PLAYER_H = 52
export const MUSIC_PLAYER_VISIBLE_H = 52
export const MUSIC_LANDSCAPE_VIEW_TILES = 18
export const MUSIC_PORTRAIT_VIEW_TILES = 20
export const MUSIC_CAMERA_DEADZONE = 0.18
export const MUSIC_CAMERA_FOLLOW = 8
export const MUSIC_CAMERA_LOOK_AHEAD = 24

// Four world pixels keeps rasterisation error below a shoe width while still
// making the terrain mask cheap to inspect and draw in the debug overlay.
export const NAV_CELL = 4
export const NAV_COLS = WORLD_W / NAV_CELL
export const NAV_ROWS = WORLD_H / NAV_CELL
export const NAV_TYPES = Object.freeze({ BLOCKED: 0, ROAD: 1, GRASS: 2, WATER: 3, INTERACTION: 4, VEGETATION: 5 })

const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
const freezeRect = (rect) => Object.freeze(rect)
const tileRect = (x, y, w, h, tag) => freezeRect({ x, y, w, h, tag })
const pixelRect = ({ x, y, w, h, tag }) => freezeRect({ x: x * T, y: y * T, w: w * T, h: h * T, tag })
const overlapsRect = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function getViewport(cssWidth, cssHeight) {
  const width = Math.max(1, Number(cssWidth) || 1)
  const height = Math.max(1, Number(cssHeight) || 1)
  const aspect = width / height
  let viewHeight = (aspect < 1 ? MUSIC_PORTRAIT_VIEW_TILES : MUSIC_LANDSCAPE_VIEW_TILES) * T
  let viewWidth = viewHeight * aspect
  if (viewWidth > 32 * T) {
    viewWidth = 32 * T
    viewHeight = viewWidth / aspect
  }
  if (viewWidth > WORLD_W) {
    viewWidth = WORLD_W
    viewHeight = viewWidth / aspect
  }
  if (viewHeight > WORLD_H) {
    viewHeight = WORLD_H
    viewWidth = viewHeight * aspect
  }
  const scale = Math.min(width / viewWidth, height / viewHeight)
  return {
    viewWidth, viewHeight, scale,
    offsetX: (width - viewWidth * scale) / 2,
    offsetY: (height - viewHeight * scale) / 2,
    maxX: Math.max(0, WORLD_W - viewWidth),
    maxY: Math.max(0, WORLD_H - viewHeight),
  }
}

// Frame-independent dead-zone camera. With no previous camera it initializes
// around the player; later calls keep still until the focus leaves the 18% box.
export function getMusicCamera({
  cssWidth, cssHeight, playerX, playerY, movementX = 0, movementY = 0,
  previousCamera = null, deltaSeconds = 1 / 60, snap = false,
}) {
  const viewport = getViewport(cssWidth, cssHeight)
  const viewportChanged = !previousCamera || Math.abs(previousCamera.viewWidth - viewport.viewWidth) > .01 || Math.abs(previousCamera.viewHeight - viewport.viewHeight) > .01
  let currentX = viewportChanged ? playerX - viewport.viewWidth / 2 : previousCamera.x
  let currentY = viewportChanged ? playerY - viewport.viewHeight / 2 : previousCamera.y
  currentX = clamp(currentX, 0, viewport.maxX)
  currentY = clamp(currentY, 0, viewport.maxY)
  const length = Math.hypot(movementX, movementY)
  const lookX = length ? movementX / length * MUSIC_CAMERA_LOOK_AHEAD : 0
  const lookY = length ? movementY / length * MUSIC_CAMERA_LOOK_AHEAD : 0
  const focusX = playerX + lookX
  const focusY = playerY + lookY
  const deadWidth = viewport.viewWidth * MUSIC_CAMERA_DEADZONE
  const deadHeight = viewport.viewHeight * MUSIC_CAMERA_DEADZONE
  const deadLeft = currentX + (viewport.viewWidth - deadWidth) / 2
  const deadRight = deadLeft + deadWidth
  const deadTop = currentY + (viewport.viewHeight - deadHeight) / 2
  const deadBottom = deadTop + deadHeight
  let targetX = currentX
  let targetY = currentY
  if (focusX < deadLeft) targetX -= deadLeft - focusX
  else if (focusX > deadRight) targetX += focusX - deadRight
  if (focusY < deadTop) targetY -= deadTop - focusY
  else if (focusY > deadBottom) targetY += focusY - deadBottom
  targetX = clamp(targetX, 0, viewport.maxX)
  targetY = clamp(targetY, 0, viewport.maxY)
  const alpha = snap || viewportChanged ? 1 : 1 - Math.exp(-MUSIC_CAMERA_FOLLOW * clamp(deltaSeconds, 0, .1))
  const x = clamp(currentX + (targetX - currentX) * alpha, 0, viewport.maxX)
  const y = clamp(currentY + (targetY - currentY) * alpha, 0, viewport.maxY)
  return Object.freeze({
    ...viewport, x, y,
    deadZone: Object.freeze({ x: x + (viewport.viewWidth - deadWidth) / 2, y: y + (viewport.viewHeight - deadHeight) / 2, w: deadWidth, h: deadHeight }),
    lookAheadX: lookX, lookAheadY: lookY,
  })
}

export function worldToMusicScreen(camera, worldX, worldY) {
  return { x: camera.offsetX + (worldX - camera.x) * camera.scale, y: camera.offsetY + (worldY - camera.y) * camera.scale }
}

export function getMusicPlayerPlacement(camera, playerX, playerY) {
  const foot = worldToMusicScreen(camera, playerX, playerY)
  return { left: foot.x - MUSIC_PLAYER_W * camera.scale / 2, top: foot.y - MUSIC_PLAYER_H * camera.scale, footX: foot.x, footY: foot.y }
}

export const STAGE = Object.freeze({
  x: 18, y: 3, w: 12, h: 7,
  collision: tileRect(18, 3, 12, 5, 'stage-rear'),
  approach: tileRect(23, 8, 3, 5, 'stage-approach'),
})

export const GATE = Object.freeze({
  x: 22, y: 32, w: 4, h: 3,
  opening: tileRect(23, 32, 2, 4, 'gate-opening'),
  colliders: Object.freeze([tileRect(21, 32, 2, 4, 'gate-left-post'), tileRect(25, 32, 2, 4, 'gate-right-post')]),
})

export const BUILDINGS = Object.freeze([
  Object.freeze({ id: 'record-archive', label: 'Record Archive', x: 3, y: 3, w: 10, h: 7, entrance: 'south', clearance: tileRect(6, 10, 3, 3, 'record-archive-entrance') }),
  Object.freeze({ id: 'listening-cafe', label: 'Listening Cafe', x: 35, y: 4, w: 11, h: 6, entrance: 'south', clearance: tileRect(38, 10, 3, 3, 'listening-cafe-entrance') }),
  Object.freeze({ id: 'community-studio', label: 'Community Studio', x: 2, y: 27, w: 11, h: 6, entrance: 'east', clearance: tileRect(12, 29, 4, 3, 'community-studio-entrance') }),
  Object.freeze({ id: 'sound-workshop', label: 'Sound Workshop', x: 36, y: 27, w: 10, h: 6, entrance: 'west', clearance: tileRect(33, 29, 4, 3, 'sound-workshop-entrance') }),
])

export const PROP_SPECS = Object.freeze({
  'flowerbed-low-a': Object.freeze({ category: 'flowerbeds', movementBlocking: false, w: 3, h: 1, collision: { x: .08, y: .38, w: 2.84, h: .54 } }),
  'bench-low-a': Object.freeze({ category: 'benches', movementBlocking: false, w: 3, h: 1, collision: { x: .1, y: .56, w: 2.8, h: .36 } }),
  'planter-low-a': Object.freeze({ category: 'planters', movementBlocking: false, w: 1, h: 1, collision: { x: .18, y: .48, w: .64, h: .44 } }),
  'lamp-low-a': Object.freeze({ category: 'lamps', movementBlocking: false, w: 1, h: 2, collision: { x: .32, y: 1.62, w: .36, h: .3 } }),
  'shrub-low-a': Object.freeze({ category: 'vegetation', movementBlocking: false, w: 1, h: 1, collision: { x: .14, y: .5, w: .72, h: .42 } }),
  'tree-low-a': Object.freeze({ category: 'vegetation', movementBlocking: false, w: 3, h: 4, collision: { x: 1.22, y: 3.35, w: .56, h: .48 } }),
  // The central planted garden is terrain and is represented in the terrain
  // polygons below.  Keeping this non-blocking avoids a second, coarser test.
  'garden-resonance-low': Object.freeze({ category: 'garden', movementBlocking: false, w: 10, h: 7, collision: { x: .5, y: 1.45, w: 9, h: 5.35 } }),
  'gate-vegetation-low': Object.freeze({ category: 'gate-vegetation', movementBlocking: false, w: 2, h: 1, collision: { x: .08, y: .5, w: 1.84, h: .42 } }),
  'stage-vegetation-low': Object.freeze({ category: 'stage-vegetation', movementBlocking: false, w: 2, h: 1, collision: { x: .08, y: .5, w: 1.84, h: .42 } }),
  'fence-low-a': Object.freeze({ category: 'fences', movementBlocking: false, w: 3, h: 1, collision: { x: 0, y: .58, w: 3, h: .32 } }),
  'cafe-table-low-a': Object.freeze({ category: 'lifestyle', movementBlocking: false, w: 2, h: 2, collision: { x: .28, y: 1.35, w: 1.44, h: .48 } }),
  'record-crates-low-a': Object.freeze({ category: 'lifestyle', movementBlocking: false, w: 2, h: 1, collision: { x: .1, y: .46, w: 1.8, h: .42 } }),
  'repair-bench-low-a': Object.freeze({ category: 'lifestyle', movementBlocking: false, w: 3, h: 1, collision: { x: .08, y: .45, w: 2.84, h: .4 } }),
  'instrument-case-low-a': Object.freeze({ category: 'lifestyle', movementBlocking: false, w: 1, h: 2, collision: { x: .24, y: 1.35, w: .52, h: .48 } }),
  'laundry-bike-low-a': Object.freeze({ category: 'lifestyle', movementBlocking: false, w: 3, h: 2, collision: { x: .22, y: 1.5, w: 2.56, h: .34 } }),
  'mailbox-low-a': Object.freeze({ category: 'lifestyle', movementBlocking: false, w: 1, h: 2, collision: { x: .32, y: 1.62, w: .36, h: .3 } }),
  'foreground-edge-cluster': Object.freeze({ category: 'foreground', movementBlocking: false, w: 3, h: 2, foreground: true, collision: { x: .05, y: 1.58, w: 2.9, h: .34 } }),
})

const prop = (id, x, y) => {
  const spec = PROP_SPECS[id]
  return Object.freeze({ id, x, y, ...spec, top: y - (spec.h - 1) })
}

export const PROPS = Object.freeze([
  prop('flowerbed-low-a', 18, 14), prop('flowerbed-low-a', 27, 14),
  prop('flowerbed-low-a', 18, 21), prop('flowerbed-low-a', 27, 21),
  prop('bench-low-a', 14, 13), prop('bench-low-a', 31, 13), prop('bench-low-a', 15, 16), prop('bench-low-a', 30, 16),
  prop('bench-low-a', 14, 23), prop('bench-low-a', 31, 23), prop('bench-low-a', 2, 14), prop('bench-low-a', 43, 14),
  prop('bench-low-a', 2, 23), prop('bench-low-a', 43, 23),
  prop('planter-low-a', 17, 9), prop('planter-low-a', 30, 9), prop('planter-low-a', 20, 11), prop('planter-low-a', 27, 11),
  prop('planter-low-a', 20, 22), prop('planter-low-a', 27, 22), prop('planter-low-a', 20, 29), prop('planter-low-a', 27, 29),
  prop('lamp-low-a', 14, 9), prop('lamp-low-a', 33, 9), prop('lamp-low-a', 17, 13), prop('lamp-low-a', 30, 13),
  prop('lamp-low-a', 14, 19), prop('lamp-low-a', 33, 19), prop('lamp-low-a', 15, 26), prop('lamp-low-a', 32, 26),
  prop('lamp-low-a', 20, 30), prop('lamp-low-a', 27, 30),
  prop('shrub-low-a', 6, 11), prop('shrub-low-a', 41, 11), prop('shrub-low-a', 7, 24), prop('shrub-low-a', 40, 24),
  prop('tree-low-a', 3, 13), prop('tree-low-a', 8, 15), prop('tree-low-a', 13, 18), prop('tree-low-a', 32, 18),
  prop('tree-low-a', 37, 15), prop('tree-low-a', 42, 13), prop('tree-low-a', 4, 22), prop('tree-low-a', 9, 24),
  prop('tree-low-a', 36, 24), prop('tree-low-a', 41, 22), prop('tree-low-a', 7, 29), prop('tree-low-a', 38, 29),
  prop('garden-resonance-low', 19, 20),
  prop('gate-vegetation-low', 19, 34), prop('gate-vegetation-low', 27, 34), prop('stage-vegetation-low', 15, 8), prop('stage-vegetation-low', 31, 8),
  prop('fence-low-a', 0, 3), prop('fence-low-a', 12, 2), prop('fence-low-a', 33, 2), prop('fence-low-a', 45, 3),
  prop('fence-low-a', 0, 34), prop('fence-low-a', 45, 34), prop('record-crates-low-a', 2, 9), prop('cafe-table-low-a', 44, 11),
  prop('instrument-case-low-a', 1, 31), prop('repair-bench-low-a', 44, 30), prop('laundry-bike-low-a', 14, 32), prop('mailbox-low-a', 32, 31),
  prop('foreground-edge-cluster', 0, 32), prop('foreground-edge-cluster', 45, 31),
])

// These anchors were measured from the production master itself (not from the
// older decorative tile plan above).  They drive both trunk collision and
// foreground depth, so a visible tree and its gameplay footprint cannot drift.
const sceneTree = (cx, cy, rx, ry) => Object.freeze({ cx, cy, rx, ry, sortY: cy + ry, movementBlocking: true })
export const SCENE_TREES = Object.freeze([
  sceneTree(155, 350, 82, 82), sceneTree(270, 405, 70, 78), sceneTree(392, 500, 64, 84), sceneTree(535, 560, 76, 100),
  sceneTree(1380, 350, 82, 82), sceneTree(1270, 405, 70, 78), sceneTree(1146, 500, 64, 84), sceneTree(1004, 560, 76, 100),
  sceneTree(165, 720, 78, 84), sceneTree(292, 742, 64, 76), sceneTree(456, 750, 62, 78), sceneTree(1080, 750, 62, 78),
  sceneTree(1245, 742, 64, 76), sceneTree(1374, 720, 78, 84), sceneTree(80, 1000, 88, 80), sceneTree(245, 1040, 76, 72),
  sceneTree(430, 1008, 70, 76), sceneTree(1100, 1008, 70, 76), sceneTree(1285, 1040, 76, 72), sceneTree(1455, 1000, 88, 80),
  sceneTree(515, 446, 58, 82), sceneTree(1018, 446, 58, 82), sceneTree(418, 590, 48, 68), sceneTree(1120, 590, 48, 68),
])

export const SPAWN = Object.freeze({ x: 24 * T + 16, y: 29 * T + 20, tx: 24, ty: 29 })
export const EXIT_TRIGGER = Object.freeze({ x: 23 * T, y: 34 * T + 8, w: 2 * T, h: 24 })
export const PROP_COLLIDERS = Object.freeze(PROPS.map((item, index) => freezeRect({
  x: (item.x + item.collision.x) * T, y: (item.top + item.collision.y) * T,
  w: item.collision.w * T, h: item.collision.h * T,
  id: `prop:${item.id}:${index}`, tag: `prop:${item.id}:${index}`, type: 'prop',
  movementBlocking: item.movementBlocking,
})))
const polygon = (id, type, points) => Object.freeze({
  id, tag: id, type, points: Object.freeze(points.map(([x, y]) => Object.freeze({ x, y }))),
})
const rectFeature = (id, type, rect) => polygon(id, type, [
  [rect.x, rect.y], [rect.x + rect.w, rect.y],
  [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h],
])
const mirrorPoints = (points) => points.map(([x, y]) => [WORLD_W - x, y])
const ellipseFeature = (id, type, cx, cy, rx, ry) => polygon(id, type,
  Array.from({ length: 12 }, (_, index) => {
    const angle = index / 12 * Math.PI * 2
    return [Math.round(cx + Math.cos(angle) * rx), Math.round(cy + Math.sin(angle) * ry)]
  }))
export function pointInPolygon(x, y, points) {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index]
    const b = points[previous]
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

// This outline follows the inner fence/vegetation edge of the painted map.  It
// is the terrain authority; props are intentionally absent and remain precise
// runtime colliders.  The south indentation is the visible gate/brick path.
export const WALKABLE_BOUNDARY = polygon('terrain:map-boundary', 'boundary', [
  [42, 70], [1494, 70], [1494, 1068], [895, 1068], [895, 1152],
  [640, 1152], [640, 1068], [42, 1068],
])

const buildingFeatures = [
  rectFeature('terrain:stage', 'building', pixelRect(STAGE.collision)),
  ...BUILDINGS.map((building) => rectFeature(`terrain:${building.id}`, 'building', pixelRect(building))),
  ...GATE.colliders.map((rect) => rectFeature(`terrain:${rect.tag}`, 'building', pixelRect(rect))),
]
// Dense planted islands are permanent parts of the painted terrain. Their
// boundaries follow the visible lawn/flower edge, leaving the brick loops on
// either side open. Treating these as terrain prevents the player from walking
// through an entire thicket while avoiding a second runtime prop collision.
const WEST_INNER_GROVE = [
  [350, 348], [483, 347], [548, 397], [526, 467], [505, 520], [515, 614],
  [530, 696], [612, 756], [681, 788], [668, 826], [581, 814], [493, 766],
  [421, 699], [395, 620], [365, 530], [348, 432],
]
const WEST_POND_BANK = [
  [42, 322], [180, 322], [225, 365], [230, 425], [205, 475], [188, 548],
  [195, 632], [245, 719], [292, 768], [275, 807], [210, 778], [119, 752], [42, 744],
]
export const PLANTED_LANDSCAPE_FEATURES = Object.freeze([
  polygon('terrain:west-inner-grove', 'vegetation', WEST_INNER_GROVE),
  polygon('terrain:east-inner-grove', 'vegetation', mirrorPoints(WEST_INNER_GROVE)),
  polygon('terrain:west-pond-bank', 'vegetation', WEST_POND_BANK),
  polygon('terrain:east-pond-bank', 'vegetation', mirrorPoints(WEST_POND_BANK)),
  polygon('terrain:stage-west-planter', 'planter', [[590, 246], [681, 243], [723, 270], [718, 321], [602, 318]]),
  polygon('terrain:stage-east-planter', 'planter', mirrorPoints([[590, 246], [681, 243], [723, 270], [718, 321], [602, 318]])),
  polygon('terrain:garden-southwest-planter', 'planter', [[680, 716], [735, 720], [735, 815], [680, 807]]),
  polygon('terrain:garden-southeast-planter', 'planter', mirrorPoints([[680, 716], [735, 720], [735, 815], [680, 807]])),
])

// A tree's blocking footprint is its grounded trunk/root planting, not its
// transparent canopy crop. These measured ellipses are rasterised into the
// 4px terrain mask, so approach direction cannot change the collision result.
export const TREE_GROVE_FEATURES = Object.freeze(SCENE_TREES.map((tree, index) => {
  const rx = clamp(tree.rx * .58, 34, 50)
  const ry = clamp(tree.ry * .25, 18, 28)
  return ellipseFeature(`terrain:scene-tree:${index}`, 'vegetation', tree.cx, tree.sortY - ry * .55, rx, ry)
}))
export const TREE_TRUNK_CORE_FEATURES = Object.freeze(SCENE_TREES.map((tree, index) =>
  ellipseFeature(`terrain:scene-tree-core:${index}`, 'tree', tree.cx, tree.sortY - 6, 8, 6)))

const fixedLandscapeFeatures = [
  polygon('terrain:north-pond', 'water', [[510, 0], [1028, 0], [1012, 92], [925, 116], [610, 112], [520, 82]]),
  polygon('terrain:west-pond', 'water', [[0, 476], [62, 476], [142, 494], [199, 548], [207, 633], [171, 694], [91, 720], [0, 713]]),
  polygon('terrain:east-pond', 'water', [[1536, 476], [1474, 476], [1394, 494], [1337, 548], [1329, 633], [1365, 694], [1445, 720], [1536, 713]]),
  // The planted fountain garden is fixed terrain, traced around the stone bed.
  polygon('terrain:resonance-garden', 'landscape', [
    [565, 430], [680, 405], [768, 430], [856, 405], [971, 430],
    [1020, 505], [1013, 625], [947, 697], [846, 726], [768, 704],
    [690, 726], [589, 697], [523, 625], [516, 505],
  ]),
  ...TREE_TRUNK_CORE_FEATURES,
  ...TREE_GROVE_FEATURES,
  ...PLANTED_LANDSCAPE_FEATURES,
]
export const TERRAIN_FEATURES = Object.freeze([...buildingFeatures, ...fixedLandscapeFeatures])

// Kept as compact bounds for diagnostics and compatibility. These colliders
// are navigation-baked and therefore deliberately absent from COLLIDERS.
export const TREE_TRUNK_COLLIDERS = Object.freeze(TREE_TRUNK_CORE_FEATURES.map((feature) => {
  const xs = feature.points.map((point) => point.x)
  const ys = feature.points.map((point) => point.y)
  return freezeRect({
    x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
    id: feature.id, tag: feature.tag, type: feature.type, movementBlocking: true, navigationBaked: true,
  })
}))

// Decorative props remain precise runtime data but are not duplicated in the
// navigation mask. At present every such prop is intentionally pass-through;
// permanent trees, flower beds and thickets are represented above as terrain.
export const BLOCKING_PROP_COLLIDERS = Object.freeze(PROP_COLLIDERS.filter((rect) => rect.movementBlocking))
export const COLLIDERS = BLOCKING_PROP_COLLIDERS

// Road polygons are sampled from the painted brick paths.  They only select
// terrain speed/type; collision is controlled by the boundary/features above.
export const ROAD_POLYGONS = Object.freeze([
  polygon('road:center-south', 'road', [[680, 690], [856, 690], [872, 1152], [662, 1152]]),
  polygon('road:north-plaza', 'road', [[58, 244], [1478, 244], [1490, 345], [46, 345]]),
  polygon('road:west-arc', 'road', [[46, 326], [235, 300], [365, 430], [408, 650], [360, 830], [615, 1034], [520, 1070], [280, 905], [184, 704], [182, 495]]),
  polygon('road:east-arc', 'road', [[1490, 326], [1301, 300], [1171, 430], [1128, 650], [1176, 830], [921, 1034], [1016, 1070], [1256, 905], [1352, 704], [1354, 495]]),
  polygon('road:garden-ring', 'road', [[430, 408], [1106, 408], [1160, 510], [1155, 680], [1060, 782], [922, 844], [614, 844], [476, 782], [381, 680], [376, 510]]),
])

// These narrow polygons trace only the visibly paved corridors. They are the
// authority where painted paths cross the broader landscaping polygons above:
// water/buildings still win, while foliage and lawn edges may never create an
// invisible wall over a brick path or its painted clefs/notes.
const WEST_GARDEN_RING_PATH = [
  [535, 374], [455, 390], [410, 440], [390, 520], [405, 620], [440, 690], [500, 740], [610, 795], [690, 810],
  [700, 710], [590, 688], [529, 620], [522, 510], [565, 436], [650, 398],
]
const WEST_OUTER_PATH = [
  [178, 318], [240, 352], [278, 420], [246, 486], [226, 560], [238, 640], [286, 710], [350, 775], [488, 842], [620, 970],
  [670, 884], [590, 804], [500, 750], [430, 688], [404, 610], [386, 520], [372, 430], [350, 350], [286, 318],
]
export const PRIORITY_WALKABLE_PATHS = Object.freeze([
  polygon('path:center-spine', 'road', [[704, 238], [832, 238], [838, 700], [875, 1152], [660, 1152], [694, 700]]),
  polygon('path:north-plaza', 'road', [[46, 244], [1490, 244], [1490, 348], [46, 348]]),
  polygon('path:west-garden-ring', 'road', WEST_GARDEN_RING_PATH),
  polygon('path:east-garden-ring', 'road', mirrorPoints(WEST_GARDEN_RING_PATH)),
  polygon('path:west-outer-arc', 'road', WEST_OUTER_PATH),
  polygon('path:east-outer-arc', 'road', mirrorPoints(WEST_OUTER_PATH)),
])

const INTERACTION_AREAS = Object.freeze([
  freezeRect({ x: 23 * T, y: 8 * T, w: 3 * T, h: 4 * T, tag: 'interaction:stage' }),
  ...BUILDINGS.map((building) => pixelRect({ ...building.clearance, tag: `interaction:${building.id}` })),
  freezeRect({ ...EXIT_TRIGGER, tag: 'interaction:exit' }),
])

export function getTerrainFeatureAtWorld(x, y) {
  if (!pointInPolygon(x, y, WALKABLE_BOUNDARY.points)) return WALKABLE_BOUNDARY
  return TERRAIN_FEATURES.find((feature) => pointInPolygon(x, y, feature.points)) || null
}

function paintedBaseType(x, y) {
  const feature = getTerrainFeatureAtWorld(x, y)
  if (feature?.type === 'water') return NAV_TYPES.WATER
  if (feature?.type === 'tree' || feature?.type === 'planter') return NAV_TYPES.VEGETATION
  if (feature && feature.type !== 'vegetation' && feature.type !== 'landscape') return NAV_TYPES.BLOCKED
  if (PRIORITY_WALKABLE_PATHS.some((path) => pointInPolygon(x, y, path.points))) return NAV_TYPES.ROAD
  if (feature?.type === 'vegetation' || feature?.type === 'landscape') return NAV_TYPES.VEGETATION
  if (ROAD_POLYGONS.some((road) => pointInPolygon(x, y, road.points))) return NAV_TYPES.ROAD
  return NAV_TYPES.GRASS
}

function buildNavigationMask() {
  const cells = new Uint8Array(NAV_COLS * NAV_ROWS)
  for (let row = 0; row < NAV_ROWS; row++) {
    for (let col = 0; col < NAV_COLS; col++) {
      const x = col * NAV_CELL + NAV_CELL / 2
      const y = row * NAV_CELL + NAV_CELL / 2
      let type = paintedBaseType(x, y)
      if (INTERACTION_AREAS.some((rect) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) && (type === NAV_TYPES.ROAD || type === NAV_TYPES.GRASS)) type = NAV_TYPES.INTERACTION
      cells[row * NAV_COLS + col] = type
    }
  }
  return Object.freeze(Array.from(cells))
}

export const NAVIGATION_MASK = buildNavigationMask()
export function getNavigationTypeAtWorld(x, y) {
  const col = Math.floor(x / NAV_CELL)
  const row = Math.floor(y / NAV_CELL)
  if (col < 0 || row < 0 || col >= NAV_COLS || row >= NAV_ROWS) return NAV_TYPES.BLOCKED
  return NAVIGATION_MASK[row * NAV_COLS + col]
}
export function getNavigationCellAtWorld(x, y) {
  const col = Math.floor(x / NAV_CELL)
  const row = Math.floor(y / NAV_CELL)
  return Object.freeze({ col, row, type: getNavigationTypeAtWorld(x, y) })
}
export function isNavigationWalkable(type) {
  return type === NAV_TYPES.ROAD || type === NAV_TYPES.GRASS || type === NAV_TYPES.INTERACTION
}
export function terrainSpeedAt(position) {
  return getNavigationTypeAtWorld(position.x, position.y - PLAYER_BOX.h / 2) === NAV_TYPES.GRASS ? .82 : 1
}

const collisionVillage = { colliders: COLLIDERS }
export function buildVillage() {
  return Object.freeze({
    label: 'Music Village · Moonlit Concert Garden v3', colliders: COLLIDERS,
    stage: STAGE, gate: GATE, buildings: BUILDINGS, props: PROPS, spawn: SPAWN,
    exitTrigger: EXIT_TRIGGER, navigation: NAVIGATION_MASK, walkable: isWalkableTile,
  })
}
export function getPlayerFootRect(cx, cy) {
  return freezeRect({ x: cx - PLAYER_BOX.w / 2, y: cy - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h })
}
function navigationCollision(cx, cy) {
  const x0 = cx - PLAYER_BOX.w / 2
  const x1 = cx + PLAYER_BOX.w / 2
  const y0 = cy - PLAYER_BOX.h
  const y1 = cy
  for (let y = y0; y <= y1; y += NAV_CELL) {
    for (let x = x0; x <= x1; x += NAV_CELL) {
      const type = getNavigationTypeAtWorld(Math.min(x, x1 - .01), Math.min(y, y1 - .01))
      if (!isNavigationWalkable(type)) {
        const sampleX = Math.min(x, x1 - .01)
        const sampleY = Math.min(y, y1 - .01)
        const cell = getNavigationCellAtWorld(sampleX, sampleY)
        const feature = getTerrainFeatureAtWorld((cell.col + .5) * NAV_CELL, (cell.row + .5) * NAV_CELL)
        return freezeRect({
          ...getPlayerFootRect(cx, cy), id: feature?.id || 'terrain:blocked-cell',
          tag: feature?.tag || 'terrain:blocked-cell', type: feature?.type || (type === NAV_TYPES.WATER ? 'water' : 'terrain'),
          navigationType: type,
        })
      }
    }
  }
  return null
}
export function collides(village, cx, cy) {
  const x0 = cx - PLAYER_BOX.w / 2
  const x1 = cx + PLAYER_BOX.w / 2
  const y0 = cy - PLAYER_BOX.h
  const y1 = cy
  const rect = village.colliders.find((candidate) => x1 > candidate.x && x0 < candidate.x + candidate.w && y1 > candidate.y && y0 < candidate.y + candidate.h)
  if (rect) return rect
  return navigationCollision(cx, cy)
}
export function moveWithCollisionDetailed(village, position, dx, dy) {
  let x = position.x
  let y = position.y
  const collisions = []
  const blockedAxes = new Set()
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2))
  const sx = dx / steps
  const sy = dy / steps
  for (let index = 0; index < steps; index++) {
    if (sx) {
      const hit = collides(village, x + sx, y)
      if (hit) { blockedAxes.add('x'); collisions.push(hit) } else x += sx
    }
    if (sy) {
      const hit = collides(village, x, y + sy)
      if (hit) { blockedAxes.add('y'); collisions.push(hit) } else y += sy
    }
  }
  const unique = [...new Map(collisions.map((hit) => [hit.id || hit.tag, hit])).values()]
  return Object.freeze({
    position: Object.freeze({ x, y }),
    blockedAxes: Object.freeze([...blockedAxes]),
    collisions: Object.freeze(unique),
  })
}
export function moveWithCollision(village, position, dx, dy) {
  return moveWithCollisionDetailed(village, position, dx, dy).position
}
export function overlapsExitTrigger(position) {
  return overlapsRect({ x: position.x - PLAYER_BOX.w / 2, y: position.y - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h }, EXIT_TRIGGER)
}

export const CLEARANCE_TILES = Object.freeze([
  STAGE.approach, ...BUILDINGS.map((building) => building.clearance),
  tileRect(21, 29, 7, 7, 'gate-approach'), tileRect(22, 27, 5, 5, 'spawn-clearance'),
])
const overlapsTileRect = (tx, ty, rect, padding = 0) => tx + .5 > rect.x - padding && tx + .5 < rect.x + rect.w + padding && ty + .5 > rect.y - padding && ty + .5 < rect.y + rect.h + padding
export function isWalkableTile(tx, ty) {
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false
  return !collides(collisionVillage, (tx + .5) * T, (ty + .72) * T)
}
function buildReachableTileKeys() {
  const queue = [[SPAWN.tx, SPAWN.ty]]
  const seen = new Set(queue.map(([tx, ty]) => `${tx},${ty}`))
  for (let index = 0; index < queue.length; index++) {
    const [tx, ty] = queue[index]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [tx + dx, ty + dy]
      const key = `${next[0]},${next[1]}`
      if (!seen.has(key) && isWalkableTile(next[0], next[1])) {
        seen.add(key)
        queue.push(next)
      }
    }
  }
  return seen
}
export const REACHABLE_TILE_KEYS = buildReachableTileKeys()
export function isSafeMarkerSlot(tx, ty) {
  if (tx < 1 || ty < 1 || tx > MAP_W - 2 || ty > MAP_H - 2 || !REACHABLE_TILE_KEYS.has(`${tx},${ty}`)) return false
  const markerRect = { x: (tx - .2) * T, y: (ty - .2) * T, w: 1.4 * T, h: 1.4 * T }
  if (PROP_COLLIDERS.some((rect) => overlapsRect(markerRect, rect))) return false
  if (CLEARANCE_TILES.some((rect) => overlapsTileRect(tx, ty, rect))) return false
  return true
}

export const PLACE_ANCHORS = Object.freeze({
  stage: Object.freeze([[19, 11], [22, 12], [26, 12], [29, 11], [17, 13], [31, 13]]),
  archive: Object.freeze([[6, 11], [9, 12], [12, 13], [14, 11]]),
  plaza: Object.freeze([[24, 14], [20, 14], [28, 14], [17, 17], [31, 17], [15, 21], [33, 21]]),
  fountain: Object.freeze([[18, 19], [30, 19], [18, 23], [30, 23], [21, 26], [27, 26]]),
  studio: Object.freeze([[13, 27], [15, 26], [17, 28], [14, 31]]),
  workshop: Object.freeze([[34, 27], [32, 26], [30, 28], [34, 31]]),
})
const BLOCK_COUNTS = Object.freeze({ 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 8 })
const PLACE_SEQUENCE = Object.freeze(['stage', 'archive', 'plaza', 'fountain', 'studio', 'workshop', 'stage', 'plaza', 'archive', 'workshop', 'fountain', 'studio', 'plaza', 'stage', 'fountain'])
function searchOffsets(radius = 16) {
  const result = [[0, 0]]
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) result.push([dx, -r])
    for (let dy = -r + 1; dy <= r; dy++) result.push([r, dy])
    for (let dx = r - 1; dx >= -r; dx--) result.push([dx, r])
    for (let dy = r - 1; dy > -r; dy--) result.push([-r, dy])
  }
  return result
}
const SEARCH_OFFSETS = Object.freeze(searchOffsets())
const slotKey = (slot) => `${slot.tx},${slot.ty}`
function chooseNear(tx, ty, used) {
  for (const [dx, dy] of SEARCH_OFFSETS) {
    const candidate = { tx: tx + dx, ty: ty + dy }
    if (isSafeMarkerSlot(candidate.tx, candidate.ty) && !used.has(slotKey(candidate))) return Object.freeze(candidate)
  }
  throw new Error(`No safe Music marker slot near ${tx},${ty}`)
}
function buildPrimarySlotGroups() {
  const used = new Set()
  const groups = {}
  for (let block = 1; block <= 6; block++) {
    groups[block] = Object.freeze(Array.from({ length: BLOCK_COUNTS[block] }, (_, index) => {
      const place = PLACE_SEQUENCE[(index + block - 1) % PLACE_SEQUENCE.length]
      const anchors = PLACE_ANCHORS[place]
      const [x, y] = anchors[(index + block) % anchors.length]
      const slot = chooseNear(x, y, used)
      used.add(slotKey(slot))
      return Object.freeze({ ...slot, place })
    }))
  }
  return Object.freeze(groups)
}
export const SLOT_GROUPS = buildPrimarySlotGroups()
export const PRIMARY_SLOTS = Object.freeze(Object.values(SLOT_GROUPS).flat())
const primaryKeys = new Set(PRIMARY_SLOTS.map(slotKey))
export const RESERVE_SLOTS = Object.freeze(Array.from({ length: MAP_H }, (_, ty) => Array.from({ length: MAP_W }, (_, tx) => ({ tx, ty }))).flat()
  .filter(({ tx, ty }) => isSafeMarkerSlot(tx, ty)).filter((slot) => !primaryKeys.has(slotKey(slot)))
  .sort((a, b) => Math.hypot(a.tx - 24, a.ty - 20) - Math.hypot(b.tx - 24, b.ty - 20) || a.ty - b.ty || a.tx - b.tx).map(Object.freeze))
export const ALL_SAFE_SLOTS = Object.freeze([...PRIMARY_SLOTS, ...RESERVE_SLOTS])

function placeForSound(sound) {
  const label = `${sound?.sub_category || ''} ${sound?.audioset_class || ''}`.toLowerCase()
  if (/sing|crowd|choir|vocal/.test(label)) return 'plaza'
  if (/drum|percussion|tabla|gong|rattle|marimba|xylophone/.test(label)) return Number(sound?.block) % 2 ? 'workshop' : 'studio'
  if (/electronic|synth|sample/.test(label)) return 'fountain'
  if (/record|phonograph|organ|piano|keyboard/.test(label)) return 'archive'
  if (/guitar|brass|trumpet|wind|string|accordion|instrument|strum/.test(label)) return 'stage'
  return 'fountain'
}
function findSemanticSlot(place, used, seedIndex) {
  const anchors = PLACE_ANCHORS[place] || PLACE_ANCHORS.plaza
  for (let attempt = 0; attempt < anchors.length; attempt++) {
    const [x, y] = anchors[(seedIndex + attempt) % anchors.length]
    try { return chooseNear(x, y, used) } catch { /* try the next landmark */ }
  }
  return null
}
export function spawnMusicItems(sounds) {
  const byBlock = new Map()
  for (const sound of sounds || []) {
    const block = Number(sound.block) || 1
    if (!byBlock.has(block)) byBlock.set(block, [])
    byBlock.get(block).push(sound)
  }
  const used = new Set()
  let reserveIndex = 0
  const items = []
  for (const block of [...byBlock.keys()].sort((a, b) => a - b)) {
    const list = byBlock.get(block).slice().sort((a, b) => String(a.sound_id).localeCompare(String(b.sound_id)))
    for (let index = 0; index < list.length; index++) {
      const sound = list[index]
      const place = placeForSound(sound)
      let slot = findSemanticSlot(place, used, index + block)
      while (!slot || used.has(slotKey(slot))) {
        slot = RESERVE_SLOTS[reserveIndex++]
        if (!slot) throw new Error(`Music marker capacity exceeded (${ALL_SAFE_SLOTS.length} safe slots)`)
      }
      used.add(slotKey(slot))
      items.push(Object.freeze({ id: sound.sound_id, sound, block, place, tx: slot.tx, ty: slot.ty, phase: (items.length * 2.399963229728653) % (Math.PI * 2) }))
    }
  }
  return items
}
export function distanceToMusicItem(position, item) {
  return Math.hypot(position.x - (item.tx + .5) * T, position.y - (item.ty + .5) * T)
}
export function isMusicItemNearby(position, item) {
  return distanceToMusicItem(position, item) <= INTERACTION_RADIUS
}
export function markerStateFor(item, { blockNum, collectedIds, nearbyId, interactingId, distance = 0 }) {
  if (item.id === interactingId) return 'interacting'
  if (collectedIds?.has(item.id)) return 'completed'
  if (item.block > blockNum) return 'unavailable'
  if (item.id === nearbyId) return 'nearby'
  if (distance > 14 * T) return 'hidden'
  if (distance > 4 * T) return 'distant'
  return 'active'
}
export function validateSlotSet(slots) {
  const seen = new Set()
  const failures = []
  for (const slot of slots) {
    const key = slotKey(slot)
    if (seen.has(key)) failures.push(`duplicate:${key}`)
    seen.add(key)
    if (!isSafeMarkerSlot(slot.tx, slot.ty)) failures.push(`unsafe:${key}`)
  }
  return { pass: failures.length === 0, count: slots.length, failures }
}

const occlusion = (id, x, y, w, h, sortY, kind, points, collision = null) => Object.freeze({
  id, source: Object.freeze({ x, y, w, h }), display: Object.freeze({ x, y, w, h }),
  sortY, occlusionHeight: Math.max(0, sortY - y), kind, collision,
  maskPoints: Object.freeze(points.map(([px, py]) => Object.freeze({ x: x + px, y: y + py }))),
})
const landmarkDepthObjects = [
  occlusion('record-archive', 42, 70, 390, 250, 318, 'building', [[0, 20], [75, 0], [330, 0], [390, 35], [386, 245], [4, 245]]),
  occlusion('concert-stage', 550, 76, 436, 205, 276, 'stage', [[0, 48], [55, 5], [380, 5], [436, 48], [430, 200], [6, 200]]),
  occlusion('listening-cafe', 1080, 88, 410, 240, 326, 'building', [[0, 40], [58, 0], [350, 0], [410, 42], [404, 235], [6, 235]]),
  occlusion('community-studio', 48, 790, 430, 250, 1034, 'building', [[0, 60], [70, 20], [365, 20], [430, 62], [424, 245], [6, 245]]),
  occlusion('sound-workshop', 1080, 770, 406, 270, 1034, 'building', [[0, 78], [65, 25], [350, 25], [406, 74], [400, 265], [6, 265]]),
]
const sceneTreeDepthObjects = SCENE_TREES.map((tree, index) => {
  const { cx, cy, rx, ry, sortY } = tree
  const w = rx * 2
  const h = ry * 2
  const points = [
    [rx, 0], [rx * 1.38, ry * .08], [rx * 1.72, ry * .24], [rx * 1.95, ry * .55],
    [rx * 1.82, ry * .92], [rx * 1.45, ry * 1.18], [rx * 1.16, ry * 1.22],
    [rx * 1.14, ry * 1.55], [rx * 1.28, ry * 1.78], [rx * 1.14, h],
    [rx * .86, h], [rx * .72, ry * 1.78], [rx * .86, ry * 1.55], [rx * .84, ry * 1.22],
    [rx * .55, ry * 1.18], [rx * .18, ry * .92], [rx * .05, ry * .55], [rx * .28, ry * .24], [rx * .62, ry * .08],
  ]
  return occlusion(`depth:scene-tree:${index}`, cx - rx, cy - ry, w, h, sortY, 'vegetation', points, TREE_TRUNK_COLLIDERS[index])
})

// Every entry has its own ground-contact sortY and tight alpha polygon.  No
// road-sized grove rectangle or shared sort point remains.
export const OCCLUSION_OBJECTS = Object.freeze([...landmarkDepthObjects, ...sceneTreeDepthObjects])
export const SILHOUETTE_ENTER_RATIO = .28
export const SILHOUETTE_EXIT_RATIO = .18
export function splitOcclusionObjects(playerY) {
  return Object.freeze({
    behind: Object.freeze(OCCLUSION_OBJECTS.filter((object) => object.sortY <= playerY)),
    front: Object.freeze(OCCLUSION_OBJECTS.filter((object) => object.sortY > playerY)),
  })
}
function playerBodySamples(playerX, playerY) {
  const points = []
  for (let oy = -44; oy <= -6; oy += 2) {
    const halfWidth = oy < -34 ? 10 : 12
    for (let ox = -halfWidth; ox <= halfWidth; ox += 2) points.push({ x: playerX + ox, y: playerY + oy })
  }
  return points
}
export function measureOcclusionAtPlayer(playerX, playerY, alphaAt) {
  const samples = playerBodySamples(playerX, playerY)
  const candidates = OCCLUSION_OBJECTS.filter((object) => object.sortY > playerY)
  const covered = new Set()
  const objectRatios = []
  for (const object of candidates) {
    const display = object.display
    let objectCovered = 0
    for (let index = 0; index < samples.length; index++) {
      const point = samples[index]
      if (point.x < display.x || point.x >= display.x + display.w || point.y < display.y || point.y >= display.y + display.h) continue
      const alpha = alphaAt ? alphaAt(point.x, point.y) : (pointInPolygon(point.x, point.y, object.maskPoints) ? 255 : 0)
      if (alpha >= 32) { objectCovered++; covered.add(index) }
    }
    const ratio = objectCovered / samples.length
    if (ratio > 0) objectRatios.push(Object.freeze({ id: object.id, ratio, object }))
  }
  objectRatios.sort((a, b) => b.ratio - a.ratio)
  return Object.freeze({ ratio: covered.size / samples.length, objects: Object.freeze(objectRatios) })
}
export function resolveOcclusionState(measurement, wasActive = false) {
  const threshold = wasActive ? SILHOUETTE_EXIT_RATIO : SILHOUETTE_ENTER_RATIO
  return Object.freeze({ active: measurement.ratio >= threshold, threshold, ...measurement })
}
export function occludingObjectsAtPlayer(playerX, playerY, alphaAt = null) {
  return measureOcclusionAtPlayer(playerX, playerY, alphaAt).objects.map((entry) => entry.object)
}
