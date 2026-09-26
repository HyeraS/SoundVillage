import { WORLD_MAP_V3_ASSETS } from './worldMapV3Assets.mjs'

export const WORLD_MAP_V3 = Object.freeze({
  version: 3,
  tileSize: 32,
  widthTiles: 120,
  heightTiles: 90,
  width: 3840,
  height: 2880,
  chunkSize: 512,
})

const centerOf = target => ({
  x: (target.tx + target.w / 2) * WORLD_MAP_V3.tileSize,
  y: (target.ty + target.h) * WORLD_MAP_V3.tileSize,
})

export const WORLD_MAP_V3_DESTINATIONS = Object.freeze({
  Lab: Object.freeze({ tx: 56, ty: 13, w: 8, h: 8 }),
  Animal: Object.freeze({ tx: 96, ty: 14, w: 10, h: 10 }),
  Urban: Object.freeze({ tx: 106, ty: 36, w: 10, h: 14 }),
  Music: Object.freeze({ tx: 95, ty: 65, w: 11, h: 11 }),
  Human: Object.freeze({ tx: 7, ty: 64, w: 13, h: 13 }),
  Nature: Object.freeze({ tx: 11, ty: 35, w: 12, h: 14 }),
  Library: Object.freeze({ tx: 54, ty: 37, w: 12, h: 8 }),
  Home: Object.freeze({ tx: 18, ty: 12, w: 8, h: 10 }),
})

const C = Object.fromEntries(Object.entries(WORLD_MAP_V3_DESTINATIONS).map(([id, target]) => [id, centerOf(target)]))
const A = Object.fromEntries(Object.entries(C).map(([id, point]) => [id, { x: point.x, y: point.y + (id === 'Library' ? 96 : 160) }]))
const HUB = Object.freeze({ x: 60 * 32, y: 47 * 32 })

// These centerlines are the source of both the painted path strokes and the
// generated clearance mask.  Keeping them in one module prevents the visual
// road and collision road from drifting apart.
export const WORLD_MAP_V3_PATHS = Object.freeze([
  { id: 'spoke-lab', width: 224, points: [HUB, { x: 1920, y: 1130 }, A.Lab, C.Lab] },
  { id: 'spoke-animal', width: 224, points: [HUB, { x: 2240, y: 1504 }, { x: 2430, y: 1120 }, A.Animal, C.Animal] },
  { id: 'spoke-urban', width: 224, points: [HUB, { x: 2250, y: 1504 }, { x: 2720, y: 1400 }, { x: C.Urban.x, y: A.Urban.y + 80 }, A.Urban, C.Urban] },
  { id: 'spoke-music', width: 224, points: [HUB, { x: 2240, y: 1600 }, { x: 2500, y: 1810 }, { x: C.Music.x, y: A.Music.y + 120 }, A.Music, C.Music] },
  { id: 'spoke-human', width: 224, points: [HUB, { x: 1600, y: 1600 }, { x: 1320, y: 1840 }, A.Human, C.Human] },
  { id: 'spoke-nature', width: 224, points: [HUB, { x: 1590, y: 1504 }, { x: 1110, y: 1410 }, A.Nature, C.Nature] },
  { id: 'spoke-home', width: 144, points: [HUB, { x: 1600, y: 1504 }, { x: 1270, y: 1050 }, A.Home, C.Home] },
  { id: 'ring-north-east', width: 216, points: [A.Lab, { x: 2530, y: 720 }, A.Animal] },
  { id: 'ring-east', width: 216, points: [A.Animal, { x: 3370, y: 950 }, { x: 3370, y: A.Urban.y + 80 }, { x: C.Urban.x, y: A.Urban.y + 80 }, A.Urban] },
  { id: 'ring-south-east', width: 216, points: [A.Urban, { x: 3300, y: 1870 }, A.Music] },
  { id: 'ring-south', width: 216, points: [A.Music, { x: 1940, y: 2400 }, A.Human] },
  { id: 'ring-west', width: 216, points: [A.Human, { x: 500, y: 1820 }, A.Nature] },
  { id: 'ring-north-west', width: 216, points: [A.Nature, { x: 730, y: 850 }, A.Lab] },
])

export const WORLD_MAP_V3_TERRAIN = Object.freeze({
  grassAssetId: 'terrain-grass',
  pathAssetId: 'terrain-path',
  plazaAssetId: 'terrain-plaza',
  waterAssetId: 'terrain-water',
  plaza: Object.freeze({ id: 'central-plaza', cx: HUB.x, cy: HUB.y - 32, rx: 390, ry: 310 }),
  water: Object.freeze([
    Object.freeze({ id: 'nature-stream', cx: 410, cy: 1390, rx: 190, ry: 410 }),
  ]),
})

const instance = (id, assetId, category, x, y, width, height, options = {}) => Object.freeze({
  id, assetId, category, x, y, width, height,
  anchorX: options.anchorX ?? 0.5,
  anchorY: options.anchorY ?? 0.94,
  sortY: options.sortY ?? y,
  layer: options.layer ?? 'gameplay',
  collision: options.collision ?? [],
  interaction: options.interaction ?? null,
  portalId: options.portalId ?? null,
  foregroundAssetId: options.foregroundAssetId ?? null,
  shadowAssetId: options.shadowAssetId ?? null,
  variant: options.variant ?? null,
  flipX: options.flipX ?? false,
  rotation: options.rotation ?? 0,
  note: options.note ?? '',
})

const buildingCollision = (width, height) => {
  const top = -Math.min(74, height * 0.28)
  const sideWidth = Math.max(38, width * 0.32)
  return [
    { x: -width / 2, y: top, w: sideWidth, h: -top + 4 },
    { x: width / 2 - sideWidth, y: top, w: sideWidth, h: -top + 4 },
  ]
}

const BUILDING_SPECS = {
  Library: { assetId: 'building-library', width: 380, height: 250, portalId: 'Sound Library' },
  Home: { assetId: 'building-home', width: 272, height: 185, portalId: 'Home' },
  Lab: { assetId: 'building-lab', width: 336, height: 222, portalId: 'Lab' },
  Animal: { assetId: 'building-animal', width: 352, height: 233, portalId: 'Animal' },
  Urban: { assetId: 'building-urban', width: 326, height: 241, portalId: 'Urban' },
  Music: { assetId: 'building-music', width: 352, height: 231, portalId: 'Music' },
  Human: { assetId: 'building-human', width: 352, height: 227, portalId: 'Human' },
  Nature: { assetId: 'building-nature', width: 352, height: 236, portalId: 'Nature' },
}

const buildings = Object.entries(BUILDING_SPECS).map(([id, spec]) => instance(
  `landmark-${id.toLowerCase()}`,
  spec.assetId,
  'building',
  C[id].x,
  C[id].y - 18,
  spec.width,
  spec.height,
  {
    portalId: spec.portalId,
    interaction: { type: id === 'Library' ? 'museum' : id === 'Home' ? 'home' : 'zone', id: spec.portalId },
    collision: buildingCollision(spec.width, spec.height),
    note: 'Unique ImageGen landmark; entrance center remains open.',
  },
))

const natureAssets = ['tree-broadleaf-a', 'tree-broadleaf-b', 'tree-broadleaf-c', 'tree-pine-a', 'tree-pine-b', 'tree-flowering']
const edgeTrees = []
let treeIndex = 0
for (let x = 80; x <= 3760; x += 128) {
  for (const y of [100 + (treeIndex % 3) * 22, 2780 - (treeIndex % 4) * 18]) {
    const assetId = natureAssets[treeIndex % natureAssets.length]
    edgeTrees.push(instance(`edge-tree-${treeIndex}`, assetId, 'tree', x, y, 82, 110, {
      collision: [{ x: -17, y: -18, w: 34, h: 25 }],
      flipX: treeIndex % 2 === 1,
      variant: treeIndex % natureAssets.length,
    }))
    treeIndex += 1
  }
}
for (let y = 300; y <= 2580; y += 150) {
  for (const x of [90 + (treeIndex % 3) * 18, 3750 - (treeIndex % 4) * 17]) {
    const assetId = natureAssets[treeIndex % natureAssets.length]
    edgeTrees.push(instance(`edge-tree-${treeIndex}`, assetId, 'tree', x, y, 82, 110, {
      collision: [{ x: -17, y: -18, w: 34, h: 25 }],
      flipX: treeIndex % 2 === 1,
      variant: treeIndex % natureAssets.length,
    }))
    treeIndex += 1
  }
}

const grovePoints = [
  [1030, 560], [1180, 620], [2850, 560], [3010, 670], [610, 1120], [720, 1570],
  [3200, 1200], [3180, 1200], [920, 2240], [1190, 2350], [2710, 2320], [2960, 2180],
  [1420, 940], [2360, 850], [1430, 2050], [2380, 2070],
]
const groves = grovePoints.map(([x, y], index) => instance(
  `grove-${index}`,
  natureAssets[(index + 2) % natureAssets.length],
  'tree', x, y, index % 3 === 0 ? 92 : 78, index % 3 === 0 ? 124 : 106,
  { collision: [{ x: -16, y: -17, w: 32, h: 23 }], flipX: index % 2 === 0, variant: index },
))

const propPoints = [
  ['bench-nw', 'prop-bench', 1670, 1325, 88, 70], ['bench-ne', 'prop-bench', 2170, 1325, 88, 70],
  ['bench-sw', 'prop-bench', 1680, 1690, 88, 70], ['bench-se', 'prop-bench', 2160, 1690, 88, 70],
  ['lamp-nw', 'prop-lamp', 1580, 1260, 52, 96], ['lamp-ne', 'prop-lamp', 2260, 1260, 52, 96],
  ['lamp-sw', 'prop-lamp', 1580, 1740, 52, 96], ['lamp-se', 'prop-lamp', 2260, 1740, 52, 96],
  ['sign-nature', 'prop-sign', 740, 1460, 58, 82], ['sign-animal', 'prop-sign', 3020, 850, 58, 82],
  ['bridge-nature', 'bridge-wood', 470, 1420, 150, 92], ['reeds-nature', 'water-cattails', 300, 1580, 82, 105],
  ['gate-nature', 'fence-gate', 544, 1730, 90, 80],
  ['flowers-home', 'shrub-flower', 770, 730, 82, 92], ['rocks-lab', 'rock-flower', 1750, 520, 74, 86],
  ['flowers-home-path', 'flower-cluster', 940, 720, 86, 68],
  ['mushrooms-nature', 'mushroom-cluster', 680, 1250, 86, 76],
  ['plant-pot-urban', 'prop-plant-pot', 3350, 1280, 72, 90],
  ['banner-music', 'prop-banner', 3120, 2050, 70, 108],
  ['market-human', 'prop-market-crates', 560, 2200, 106, 94],
  ['research-lab', 'prop-research-apparatus', 1870, 620, 92, 104],
  ['lilies-nature', 'water-lilies', 390, 1330, 96, 66],
  ['cliff-nature', 'cliff-mossy', 260, 1150, 108, 104],
]
const props = propPoints.map(([id, assetId, x, y, width, height]) => instance(
  id, assetId, assetId.startsWith('bridge') || assetId.startsWith('water') ? 'water-prop' : 'prop',
  x, y, width, height,
  { collision:
    assetId === 'prop-lamp' || assetId === 'prop-banner' ? [{ x: -10, y: -12, w: 20, h: 18 }]
      : assetId === 'prop-bench' ? [{ x: -width * 0.36, y: -12, w: width * 0.72, h: 18 }]
        : ['prop-market-crates', 'prop-research-apparatus', 'cliff-mossy'].includes(assetId)
          ? [{ x: -width * 0.38, y: -height * 0.2, w: width * 0.76, h: height * 0.25 }]
          : [] },
))

const fencePoints = [
  [785, 1120, 0], [860, 1080, 0], [960, 1040, 0], [2870, 1050, 0], [2980, 1090, 0],
  [650, 2040, 0], [760, 2100, 0], [3050, 2040, 0], [3160, 1970, 0],
]
const fences = fencePoints.map(([x, y], index) => instance(
  `fence-${index}`, index % 4 === 0 ? 'fence-corner' : 'fence-straight', 'fence',
  x, y, 92, 76,
  { collision: [{ x: -42, y: -13, w: 84, h: 19 }], flipX: index % 2 === 1, variant: index % 2 },
))

export const WORLD_MAP_V3_OBJECTS = Object.freeze([...buildings, ...edgeTrees, ...groves, ...props, ...fences])

export const WORLD_MAP_V3_FOREGROUND = Object.freeze([
  instance('south-garden-arch', 'foreground-arch', 'foreground', 1920, 2820, 380, 252, {
    layer: 'foreground', sortY: 99999, collision: [{ x: -150, y: -22, w: 105, h: 28 }, { x: 45, y: -22, w: 105, h: 28 }],
    note: 'Foreground occlusion arch; opening remains walkable.',
  }),
])

export const WORLD_MAP_V3_ASSET_MANIFEST = WORLD_MAP_V3_ASSETS

function pointSegmentDistanceSquared(px, py, a, b) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const lengthSquared = vx * vx + vy * vy || 1
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / lengthSquared))
  const dx = px - (a.x + vx * t)
  const dy = py - (a.y + vy * t)
  return dx * dx + dy * dy
}

export function isWorldMapV3PaintedWalkable(x, y) {
  const plaza = WORLD_MAP_V3_TERRAIN.plaza
  const nx = (x - plaza.cx) / plaza.rx
  const ny = (y - plaza.cy) / plaza.ry
  if (nx * nx + ny * ny <= 1) return true
  return WORLD_MAP_V3_PATHS.some(route => {
    for (let index = 1; index < route.points.length; index += 1) {
      if (pointSegmentDistanceSquared(x, y, route.points[index - 1], route.points[index]) <= (route.width / 2) ** 2) return true
    }
    return false
  })
}

export function worldMapV3BlockingReasonAt(x, y) {
  for (const object of [...WORLD_MAP_V3_OBJECTS, ...WORLD_MAP_V3_FOREGROUND]) {
    for (const collider of object.collision) {
      if (x >= object.x + collider.x && x <= object.x + collider.x + collider.w && y >= object.y + collider.y && y <= object.y + collider.y + collider.h) {
        return `object:${object.id}`
      }
    }
  }
  return isWorldMapV3PaintedWalkable(x, y) ? 'terrain:clearance-edge' : 'terrain:off-path'
}

export function objectBounds(object) {
  const left = object.x - object.width * object.anchorX
  const top = object.y - object.height * object.anchorY
  return { left, top, right: left + object.width, bottom: top + object.height }
}

export function createWorldMapSpatialIndex(objects = WORLD_MAP_V3_OBJECTS, chunkSize = WORLD_MAP_V3.chunkSize) {
  const chunks = new Map()
  for (const object of objects) {
    const bounds = objectBounds(object)
    const minX = Math.floor(bounds.left / chunkSize)
    const maxX = Math.floor(bounds.right / chunkSize)
    const minY = Math.floor(bounds.top / chunkSize)
    const maxY = Math.floor(bounds.bottom / chunkSize)
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        const key = `${cx},${cy}`
        if (!chunks.has(key)) chunks.set(key, [])
        chunks.get(key).push(object)
      }
    }
  }
  return chunks
}

export const WORLD_MAP_V3_SPATIAL_INDEX = createWorldMapSpatialIndex()

export function queryWorldMapObjects(view, margin = 180) {
  const chunkSize = WORLD_MAP_V3.chunkSize
  const minX = Math.floor((view.x - margin) / chunkSize)
  const maxX = Math.floor((view.x + view.width + margin) / chunkSize)
  const minY = Math.floor((view.y - margin) / chunkSize)
  const maxY = Math.floor((view.y + view.height + margin) / chunkSize)
  const seen = new Set()
  const objects = []
  const chunks = []
  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      const key = `${cx},${cy}`
      chunks.push(key)
      for (const object of WORLD_MAP_V3_SPATIAL_INDEX.get(key) || []) {
        if (seen.has(object.id)) continue
        seen.add(object.id)
        const bounds = objectBounds(object)
        if (bounds.right < view.x - margin || bounds.left > view.x + view.width + margin || bounds.bottom < view.y - margin || bounds.top > view.y + view.height + margin) continue
        objects.push(object)
      }
    }
  }
  return { objects, chunks }
}
