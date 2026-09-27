// Build-only legacy authority for World Map v4 objects that have not migrated
// to native WorldObject ownership. Production imports generated projections,
// never this module.

import { WORLD_MAP_V4_ASSETS } from '../../lib/worldMapV4Assets.mjs'

export const LEGACY_WORLD_MAP_V4 = Object.freeze({
  version: 4,
  tileSize: 32,
  widthTiles: 120,
  heightTiles: 90,
  width: 3840,
  height: 2880,
  referenceWidth: 2896,
  referenceHeight: 2172,
  scaleX: 3840 / 2896,
  scaleY: 2880 / 2172,
  chunkSize: 512,
})

const freezeTarget = target => Object.freeze({ ...target, approach: Object.freeze({ ...target.approach }) })

export const LEGACY_WORLD_MAP_V4_DESTINATIONS = Object.freeze({
  Lab: freezeTarget({ tx: 56, ty: 13, w: 8, h: 8, approach: { x: 1918, y: 670 } }),
  Animal: freezeTarget({ tx: 96, ty: 14, w: 10, h: 10, approach: { x: 3214, y: 742 } }),
  Urban: freezeTarget({ tx: 106, ty: 36, w: 10, h: 14, approach: { x: 3414, y: 1554 } }),
  Music: freezeTarget({ tx: 95, ty: 65, w: 11, h: 11, approach: { x: 3166, y: 2470 } }),
  Human: freezeTarget({ tx: 7, ty: 64, w: 13, h: 13, approach: { x: 438, y: 2498 } }),
  Nature: freezeTarget({ tx: 11, ty: 35, w: 12, h: 14, approach: { x: 602, y: 1330 } }),
  Library: freezeTarget({ tx: 54, ty: 37, w: 12, h: 8, approach: { x: 1918, y: 1438 } }),
  Home: freezeTarget({ tx: 48, ty: 46, w: 8, h: 9, approach: { x: 1664, y: 1792 } }),
})

const center = target => ({
  x: target.approach?.x ?? (target.tx + target.w / 2) * LEGACY_WORLD_MAP_V4.tileSize,
  y: target.approach?.y ?? (target.ty + target.h) * LEGACY_WORLD_MAP_V4.tileSize,
})
const C = Object.fromEntries(Object.entries(LEGACY_WORLD_MAP_V4_DESTINATIONS).map(([id, target]) => [id, center(target)]))
const HUB = Object.freeze({ x: 60 * 32, y: 47 * 32 })

export const LEGACY_WORLD_MAP_V4_PATHS = Object.freeze([
  { id: 'spoke-lab', points: [HUB, { x: 1920, y: 1260 }, { x: 1920, y: 940 }, { x: 1920, y: 690 }, C.Lab] },
  { id: 'spoke-animal', points: [HUB, { x: 2270, y: 1270 }, { x: 2580, y: 990 }, { x: 2920, y: 790 }, C.Animal] },
  { id: 'spoke-urban', points: [HUB, { x: 2280, y: 1500 }, { x: 2700, y: 1430 }, { x: 3150, y: 1400 }, C.Urban] },
  { id: 'spoke-music', points: [HUB, { x: 2250, y: 1690 }, { x: 2500, y: 1920 }, { x: 2860, y: 2140 }, C.Music] },
  { id: 'spoke-human', points: [HUB, { x: 1590, y: 1700 }, { x: 1280, y: 1940 }, { x: 870, y: 2180 }, C.Human] },
  { id: 'spoke-nature', points: [HUB, { x: 1540, y: 1500 }, { x: 1230, y: 1430 }, { x: 900, y: 1370 }, C.Nature] },
  { id: 'spoke-home', points: [HUB, { x: 1856, y: 1568 }, { x: 1792, y: 1696 }, C.Home] },
  { id: 'spoke-library', points: [HUB, C.Library] },
])

export const LEGACY_WORLD_MAP_V4_TERRAIN_PANELS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => {
    const row = Math.floor(index / 4)
    const col = index % 4
    return Object.freeze({
      id: `terrain-panel-${row}-${col}`,
      assetId: `terrain-panel-${row}-${col}`,
      x: col * 960,
      y: row * 960,
      width: 960,
      height: 960,
    })
  }),
)

const sx = value => value * LEGACY_WORLD_MAP_V4.scaleX
const sy = value => value * LEGACY_WORLD_MAP_V4.scaleY
const refObject = (id, category, box, options = {}) => Object.freeze({
  id,
  assetId: options.assetId ?? id,
  category,
  x: sx(box[0]),
  y: sy(box[1]),
  width: sx(box[2] - box[0]),
  height: sy(box[3] - box[1]),
  anchorX: 0,
  anchorY: 0,
  sortY: sy(options.sortReferenceY ?? box[3]),
  layer: options.layer ?? 'gameplay',
  interaction: options.interaction ?? null,
  portalId: options.portalId ?? null,
  collision: Object.freeze([]),
})

const environment = [
  ['environment-north-forest', [0, 0, 2896, 430]],
  ['environment-west-stream-forest', [0, 380, 720, 1480]],
  ['environment-east-forest', [2180, 300, 2896, 1510]],
  ['environment-central-gardens', [650, 430, 2250, 1640]],
  ['environment-southwest-garden', [0, 1320, 1150, 2172]],
  ['environment-southeast-garden', [1800, 1280, 2896, 2172]],
  ['environment-south-center-garden', [1050, 1580, 1850, 1900]],
  ['environment-south-forest', [720, 1780, 2180, 2172]],
].map(([id, box]) => refObject(id, 'environment-cluster', box, { layer: 'environment', sortReferenceY: 0 }))

const landmarks = [
  ['landmark-lab', 'Lab', [1010, 0, 1950, 535], 430],
  ['landmark-animal', 'Animal', [2210, 65, 2896, 565], 475],
  ['landmark-nature', 'Nature', [0, 425, 725, 1465], 1110],
  ['landmark-library', 'Library', [865, 625, 2030, 1165], 1010],
  ['landmark-urban', 'Urban', [2310, 620, 2896, 1345], 1210],
  ['landmark-human', 'Human', [0, 1375, 900, 2110], 1890],
  ['landmark-music', 'Music', [2160, 1360, 2896, 2115], 1910],
].map(([id, destination, box, sortReferenceY]) => refObject(id, 'landmark', box, {
  sortReferenceY,
  portalId: destination === 'Library' ? 'Sound Library' : destination,
  interaction: { type: destination === 'Library' ? 'museum' : 'zone', id: destination },
}))

const guesthouse = refObject('landmark-guesthouse', 'landmark', [285, 70, 900, 520], {
  assetId: 'landmark-home',
  layer: 'inspection',
  sortReferenceY: 430,
})

const playerHome = Object.freeze({
  id: 'landmark-home',
  assetId: 'landmark-home-hub',
  category: 'landmark',
  x: 1440,
  y: 1368,
  width: 448,
  height: 384,
  anchorX: 0,
  anchorY: 0,
  sortY: 1752,
  layer: 'gameplay',
  interaction: Object.freeze({ type: 'home', id: 'Home' }),
  portalId: 'Home',
  collision: Object.freeze([]),
})

export const LEGACY_WORLD_MAP_V4_OBJECTS = Object.freeze([...environment, guesthouse, ...landmarks, playerHome])
export const LEGACY_WORLD_MAP_V4_FOREGROUND = Object.freeze([
  refObject('foreground-south-gate', 'foreground', [1100, 1840, 1835, 2172], { layer: 'foreground', sortReferenceY: 999999 }),
])

const portalIds = ['Lab', 'Animal', 'Urban', 'Music', 'Human', 'Nature']
export const LEGACY_WORLD_MAP_V4_LOGICAL_DESTINATIONS = Object.freeze([
  ...portalIds.map(zone => Object.freeze({
    id: zone,
    kind: 'zone',
    zone,
    target: Object.freeze({ zone, ...LEGACY_WORLD_MAP_V4_DESTINATIONS[zone] }),
  })),
  Object.freeze({ id: 'Sound Library', kind: 'museum', target: LEGACY_WORLD_MAP_V4_DESTINATIONS.Library }),
  Object.freeze({ id: 'Home', kind: 'home', target: LEGACY_WORLD_MAP_V4_DESTINATIONS.Home }),
])

export const LEGACY_WORLD_MAP_V4_MINIMAP_DESTINATIONS = Object.freeze(
  LEGACY_WORLD_MAP_V4_LOGICAL_DESTINATIONS.map(destination => Object.freeze({
    id: destination.id,
    kind: destination.kind,
    zone: destination.zone ?? null,
    worldPoint: Object.freeze({ ...destination.target.approach }),
  })),
)

// Build-only rollback authority for landmark presentation. The projection
// compiler selects this value only while the owning object remains legacy.
export const LEGACY_WORLD_MAP_V4_DESTINATION_PRESENTATIONS = Object.freeze({
  'Sound Library': Object.freeze({
    label: 'Sound Museum',
    icon: '🏛',
    color: '#C8A96E',
  }),
})

export const LEGACY_WORLD_MAP_V4_ASSET_MANIFEST = WORLD_MAP_V4_ASSETS
