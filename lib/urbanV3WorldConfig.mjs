import {
  URBAN_V3_WALKABLE_MASK_METADATA,
  isUrbanV3MaskCellWalkable,
  isUrbanV3MaskPointWalkable,
} from './urbanV3WalkableMask.generated.mjs'
import { getVillageRuntimeManifest } from './villageRuntimeManifest.mjs'
import {
  basePointToCurrent,
  baseRectToCurrent,
  createWorldTransform,
  findScaledRectCollision,
  playerFootRectAt as createPlayerFootRect,
  rectsOverlap,
  worldRectToMaskBounds,
} from './villageWorldTransform.mjs'

export const VILLAGE_ID = 'urban-v3'
export const VILLAGE_MANIFEST = getVillageRuntimeManifest(VILLAGE_ID)
export const WORLD_WIDTH = VILLAGE_MANIFEST.baseWorldWidth
export const WORLD_HEIGHT = VILLAGE_MANIFEST.baseWorldHeight
export const PLAYER_FOOT_BOX = Object.freeze({ w: 20, h: 14 })
export const REFERENCE_TRANSFORM = Object.freeze({
  type: 'identity', scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0,
})

const freezeRect = (id, surface, x, y, w, h, extra = {}) => Object.freeze({
  id, surface, x, y, w, h, ...extra,
})

const freezeRects = (rows, surface) => Object.freeze(rows.map(([id, x, y, w, h]) => (
  freezeRect(id, surface, x, y, w, h)
)))

const freezePolygon = (id, surface, points) => Object.freeze({
  id,
  surface,
  points: Object.freeze(points.map(([x, y]) => Object.freeze({ x, y }))),
})

// These are walkable pieces traced in the canonical 1448x1086 art. Separate
// pieces deliberately avoid making roofs, traffic lanes, or the bus bay part
// of a single permissive rectangle.
export const SIDEWALK_REGIONS = Object.freeze([
  ...freezeRects([
  // The elevated metro facade ends at y=290. Keeping this strip below the
  // wall prevents the player's feet from climbing the facade while leaving
  // the pavement in front of it usable.
  ['north-concourse-west', 216, 290, 453, 49],
  ['north-concourse-east', 777, 290, 452, 49],
  ['west-upper-outer-sidewalk', 58, 337, 57, 313],
  ['west-upper-inner-sidewalk', 461, 337, 101, 313],
  ['west-upper-building-front', 176, 533, 386, 117],
  ['east-food-main-front', 884, 526, 234, 124],
  ['east-food-annex-front', 1118, 571, 134, 79],
  ['east-upper-outer-sidewalk', 1320, 337, 69, 313],
  ['southwest-outer-sidewalk', 58, 650, 57, 365],
  ['southwest-inner-sidewalk', 528, 650, 34, 365],
  ['southwest-building-front', 178, 969, 436, 46],
  ['southeast-inner-sidewalk', 876, 650, 22, 365],
  ['southeast-cinema-front', 898, 971, 224, 44],
  ['southeast-bus-stop-sidewalk', 1320, 650, 69, 170],
  ['southeast-food-sidewalk', 1119, 820, 270, 195],
  ], 'sidewalk'),
  // Curved curb returns are polygons so the visible corner pavement stays
  // traversable without turning the adjacent vehicle lane into a sidewalk.
  freezePolygon('northwest-curved-sidewalk', 'sidewalk', [
    [115, 337], [216, 337], [204, 349], [192, 363], [183, 380], [178, 400], [178, 423], [115, 423],
  ]),
  freezePolygon('northeast-curved-sidewalk', 'sidewalk', [
    [1229, 337], [1320, 337], [1320, 423], [1270, 423], [1268, 395], [1262, 375], [1250, 357], [1236, 345],
  ]),
])

export const PLAZA_REGIONS = freezeRects([
  ['central-plaza', 615, 337, 218, 678],
  ['west-media-plaza', 176, 533, 386, 117],
  ['east-food-main-plaza', 884, 526, 234, 124],
  ['east-food-annex-plaza', 1118, 571, 134, 79],
  ['southwest-entry-plaza', 528, 818, 34, 151],
  ['southeast-transit-plaza', 1119, 820, 270, 195],
], 'plaza')

export const CROSSWALK_REGIONS = freezeRects([
  ['crosswalk-west-north', 552, 466, 63, 50],
  ['crosswalk-east-north', 833, 468, 52, 50],
  ['crosswalk-west-middle', 552, 617, 63, 39],
  ['crosswalk-east-middle', 833, 617, 52, 39],
  ['crosswalk-west-south', 552, 774, 63, 48],
  ['crosswalk-east-south', 833, 774, 65, 48],
  ['crosswalk-west-outer', 72, 617, 106, 40],
  ['crosswalk-east-outer', 1281, 617, 108, 40],
], 'crosswalk')

export const STAIR_REGIONS = freezeRects([
  ['metro-central-stairs', 669, 206, 108, 131],
], 'stairs')

export const ENTRANCE_REGIONS = freezeRects([
  ['south-entrance', 615, 1015, 218, 71],
], 'entrance')

export const CENTRAL_PEDESTRIAN_SPINE = Object.freeze(
  freezeRect('central-pedestrian-spine', 'plaza', 615, 337, 218, 678),
)

// Road shapes are used for semantic classification and the debug overlay.
// Walkable regions have priority over these shapes, so the named crosswalks
// cut clean openings through the lanes.
export const BLOCKED_ROAD_REGIONS = freezeRects([
  ['road-west-outer', 115, 337, 63, 678],
  ['road-west-inner', 562, 337, 53, 678],
  ['road-east-inner', 833, 337, 43, 678],
  ['road-east-outer', 1252, 337, 68, 678],
  ['road-cross-town-west', 178, 650, 384, 20],
  ['road-cross-town-east', 884, 650, 368, 20],
  ['road-east-bus-bay', 1118, 550, 202, 270],
], 'road')

const FOOTPRINT_ROWS = Object.freeze([
  // Buildings: narrow ground-contact strips, never roof/reference bounds.
  ['building-northwest-helipad-tower', 'building', 8, 389, 200, 34],
  ['building-west-edge-north-facade', 'building', 8, 543, 50, 34],
  ['building-west-edge-south-facade', 'building', 8, 951, 42, 34],
  ['building-north-skyline-west-01', 'building', 224, 115, 120, 34],
  ['building-north-skyline-west-02', 'building', 358, 115, 87, 34],
  ['building-north-skyline-west-03', 'building', 459, 115, 85, 34],
  ['building-north-media-screen', 'building', 560, 115, 246, 34],
  ['building-north-skyline-east-01', 'building', 820, 115, 131, 34],
  ['building-north-skyline-east-02', 'building', 965, 115, 112, 34],
  ['building-north-skyline-east-03', 'building', 1091, 115, 110, 34],
  ['building-northeast-curved-tower', 'building', 1215, 373, 174, 34],
  ['building-east-edge-north-facade', 'building', 1402, 540, 38, 34],
  ['building-east-edge-south-facade', 'building', 1389, 954, 51, 34],
  ['building-west-media-office', 'building', 188, 499, 273, 34],
  ['building-east-glass-food-court', 'building', 883, 508, 225, 18],
  ['building-east-food-annex', 'building', 1118, 545, 133, 26],
  ['building-southwest-culture-office', 'building', 178, 935, 358, 34],
  ['building-southeast-cinema', 'building', 898, 937, 221, 34],

  // The elevated metro is split around the playable central stair mouth.
  ['metro-deck-west', 'metro', 209, 209, 460, 21],
  ['metro-deck-east', 'metro', 777, 209, 453, 21],
  // These are the opaque wall bands under the elevated deck. The previous
  // broad sidewalk rectangle included them, which let the player's foot
  // anchor move onto the facade and made the sprite appear airborne.
  ['metro-underpass-west-wall', 'architecture', 216, 230, 399, 59],
  ['metro-underpass-east-wall', 'architecture', 833, 230, 397, 59],
  ['metro-support-west-01', 'metro', 226, 311, 24, 26],
  ['metro-support-west-02', 'metro', 468, 311, 22, 26],
  ['metro-support-east-01', 'metro', 956, 311, 22, 26],
  ['metro-support-east-02', 'metro', 1188, 311, 24, 26],

  ['landmark-west-hologram-orb', 'landmark', 387, 585, 31, 23],
  ['landmark-central-light-fountain', 'landmark', 704, 612, 31, 30],
  ['landmark-west-satellite-dish', 'landmark', 285, 378, 27, 11],
  ['landmark-cinema-film-reel', 'landmark', 997, 841, 22, 12],
  ['media-sign-west-office', 'landmark', 373, 443, 38, 13],
  ['media-sign-north-center', 'landmark', 687, 108, 69, 13],
  ['media-sign-northeast', 'landmark', 1307, 297, 33, 19],
  ['media-sign-food-north', 'landmark', 1029, 251, 56, 13],
  ['media-sign-southwest', 'landmark', 300, 796, 38, 20],

  ['vehicle-west-road-car', 'vehicle', 123, 523, 30, 64],
  ['vehicle-northeast-road-car', 'vehicle', 1277, 433, 39, 56],
  ['vehicle-southwest-car', 'vehicle', 488, 843, 33, 66],
  ['vehicle-east-electric-bus-01', 'vehicle', 1157, 571, 43, 180],
  ['vehicle-east-electric-bus-02', 'vehicle', 1213, 572, 47, 182],
  ['vehicle-southeast-blue-shuttle', 'vehicle', 1262, 870, 58, 56],
  ['vehicle-southeast-orange-shuttle', 'vehicle', 1326, 879, 48, 54],
  ['mobility-southwest-scooter-dock', 'vehicle', 389, 906, 71, 40],
  ['mobility-electric-charger-west', 'vehicle', 373, 894, 12, 44],
  ['mobility-traffic-controller-east', 'vehicle', 1266, 764, 19, 58],

  // Trees collide only at their trunks, never at canopy/reference bounds.
  ['tree-01', 'tree-trunk', 361, 144, 14, 18], ['tree-02', 'tree-trunk', 490, 144, 15, 18],
  ['tree-03', 'tree-trunk', 890, 148, 15, 18], ['tree-04', 'tree-trunk', 1165, 288, 15, 18],
  ['tree-05', 'tree-trunk', 361, 304, 16, 18], ['tree-06', 'tree-trunk', 526, 293, 16, 18],
  ['tree-07', 'tree-trunk', 862, 290, 15, 18], ['tree-08', 'tree-trunk', 1153, 290, 15, 18],
  ['tree-09', 'tree-trunk', 1339, 414, 14, 18], ['tree-10', 'tree-trunk', 236, 564, 15, 18],
  ['tree-11', 'tree-trunk', 500, 565, 15, 18], ['tree-12', 'tree-trunk', 649, 574, 15, 18],
  ['tree-13', 'tree-trunk', 776, 571, 15, 18], ['tree-14', 'tree-trunk', 916, 578, 15, 18],
  ['tree-15', 'tree-trunk', 1367, 593, 13, 18], ['tree-16', 'tree-trunk', 653, 751, 15, 18],
  ['tree-17', 'tree-trunk', 786, 752, 16, 18], ['tree-18', 'tree-trunk', 562, 937, 17, 18],
  ['tree-19', 'tree-trunk', 827, 937, 16, 18], ['tree-20', 'tree-trunk', 1125, 876, 15, 18],
  ['tree-21', 'tree-trunk', 87, 1048, 18, 18], ['tree-22', 'tree-trunk', 158, 1048, 18, 18],
  ['tree-23', 'tree-trunk', 231, 1048, 19, 18], ['tree-24', 'tree-trunk', 305, 1048, 19, 18],
  ['tree-25', 'tree-trunk', 379, 1048, 19, 18], ['tree-26', 'tree-trunk', 1139, 1044, 18, 18],
  ['tree-27', 'tree-trunk', 1213, 1044, 18, 18], ['tree-28', 'tree-trunk', 1284, 1045, 19, 18],
  ['tree-29', 'tree-trunk', 1357, 1045, 18, 18], ['tree-30', 'tree-trunk', 1420, 1044, 14, 18],

  ['street-light-01', 'street-light-base', 401, 302, 6, 10], ['street-light-02', 'street-light-base', 630, 301, 10, 10],
  ['street-light-03', 'street-light-base', 794, 301, 9, 10], ['street-light-04', 'street-light-base', 933, 300, 9, 10],
  ['street-light-05', 'street-light-base', 82, 486, 9, 10], ['street-light-06', 'street-light-base', 107, 494, 6, 10],
  ['street-light-07', 'street-light-base', 549, 446, 8, 10], ['street-light-08', 'street-light-base', 645, 448, 8, 10],
  ['street-light-09', 'street-light-base', 794, 447, 9, 10], ['street-light-10', 'street-light-base', 870, 449, 9, 10],
  ['street-light-11', 'street-light-base', 1339, 472, 7, 10], ['street-light-12', 'street-light-base', 78, 646, 6, 10],
  ['street-light-13', 'street-light-base', 552, 635, 8, 10], ['street-light-14', 'street-light-base', 645, 635, 8, 10],
  ['street-light-15', 'street-light-base', 791, 634, 9, 10], ['street-light-16', 'street-light-base', 869, 636, 9, 10],
  ['street-light-17', 'street-light-base', 1138, 611, 8, 10], ['street-light-18', 'street-light-base', 1329, 630, 7, 10],
  ['street-light-19', 'street-light-base', 77, 813, 7, 10], ['street-light-20', 'street-light-base', 554, 813, 7, 10],
  ['street-light-21', 'street-light-base', 640, 813, 8, 10], ['street-light-22', 'street-light-base', 790, 812, 8, 10],
  ['street-light-23', 'street-light-base', 873, 813, 4, 8], ['street-light-24', 'street-light-base', 1293, 835, 9, 10],
  ['street-light-25', 'street-light-base', 1377, 745, 7, 10], ['street-light-26', 'street-light-base', 594, 980, 8, 10],
  ['street-light-27', 'street-light-base', 828, 981, 8, 10], ['street-light-28', 'street-light-base', 1388, 965, 7, 10],

  ['digital-kiosk-01', 'kiosk', 305, 300, 23, 10], ['digital-kiosk-02', 'kiosk', 590, 296, 11, 10],
  ['digital-kiosk-03', 'kiosk', 646, 319, 12, 10], ['digital-kiosk-04', 'kiosk', 790, 316, 11, 10],
  ['digital-kiosk-05', 'kiosk', 1122, 297, 12, 10], ['digital-kiosk-06', 'kiosk', 102, 411, 12, 10],
  ['digital-kiosk-07', 'kiosk', 152, 428, 14, 10], ['digital-kiosk-08', 'kiosk', 534, 432, 11, 10],
  ['digital-kiosk-09', 'kiosk', 641, 433, 11, 10], ['digital-kiosk-10', 'kiosk', 790, 432, 11, 10],
  ['digital-kiosk-11', 'kiosk', 1125, 433, 11, 10], ['digital-kiosk-12', 'kiosk', 1338, 424, 13, 10],
  ['digital-kiosk-13', 'kiosk', 104, 762, 12, 10], ['digital-kiosk-14', 'kiosk', 562, 750, 12, 10],
  ['digital-kiosk-15', 'kiosk', 644, 888, 12, 10], ['digital-kiosk-16', 'kiosk', 787, 888, 12, 10],
  ['digital-kiosk-17', 'kiosk', 1098, 836, 12, 10], ['digital-kiosk-18', 'kiosk', 1292, 828, 12, 10],
  ['digital-kiosk-19', 'kiosk', 1376, 760, 12, 10],

  ['planter-01', 'planter', 333, 291, 51, 12], ['planter-02', 'planter', 512, 290, 48, 12],
  ['planter-03', 'planter', 844, 289, 43, 12], ['planter-04', 'planter', 1119, 292, 53, 12],
  ['planter-05', 'planter', 1160, 329, 36, 12], ['planter-06', 'planter', 1204, 334, 28, 12],
  ['planter-07', 'planter', 208, 565, 41, 12], ['planter-08', 'planter', 473, 564, 45, 12],
  ['planter-09', 'planter', 627, 600, 55, 12], ['planter-10', 'planter', 769, 600, 53, 12],
  ['planter-11', 'planter', 896, 601, 71, 12], ['planter-12', 'planter', 997, 601, 57, 12],
  ['planter-13', 'planter', 201, 931, 50, 12], ['planter-14', 'planter', 506, 941, 36, 12],
  ['planter-15', 'planter', 889, 950, 44, 12], ['planter-16', 'planter', 1072, 950, 50, 12],
  ['bench-01', 'bench', 269, 541, 48, 12], ['bench-02', 'bench', 1110, 538, 48, 12],
  ['bench-03', 'bench', 230, 604, 47, 12], ['bench-04', 'bench', 1134, 799, 47, 12],
  ['outdoor-table-01', 'outdoor-table', 1124, 882, 38, 12], ['outdoor-table-02', 'outdoor-table', 1168, 881, 38, 12],
  ['outdoor-table-03', 'outdoor-table', 1212, 889, 38, 12], ['outdoor-table-04', 'outdoor-table', 1287, 943, 40, 12],
  ['outdoor-table-05', 'outdoor-table', 1340, 943, 40, 12],
  ['bollard-01', 'bollard', 367, 628, 12, 12], ['bollard-02', 'bollard', 424, 626, 12, 12],
  ['bollard-03', 'bollard', 642, 646, 11, 12], ['bollard-04', 'bollard', 788, 647, 11, 12],
  ['bollard-05', 'bollard', 1090, 630, 12, 12],
  ['control-box-01', 'control-box', 513, 296, 14, 12], ['control-box-02', 'control-box', 917, 296, 14, 12],
  ['control-box-03', 'control-box', 342, 521, 16, 12], ['control-box-04', 'control-box', 884, 499, 17, 12],
  ['control-box-05', 'control-box', 1067, 654, 18, 12], ['control-box-06', 'control-box', 1299, 642, 17, 12],

  // South rails stop the player everywhere except the 218px entrance gap.
  ['south-rail-west', 'south-rail', 0, 1014, 615, 72],
  ['south-rail-east', 'south-rail', 833, 1015, 615, 71],
])

export const OBJECT_FOOTPRINTS = Object.freeze(FOOTPRINT_ROWS.map(([id, category, x, y, w, h]) => (
  freezeRect(id, 'object-footprint', x, y, w, h, { category })
)))

// Some art instances share one physical base (a tree set in a planter, a
// facade-mounted control box, or foliage behind the south rail). Their
// individual footprints remain available for audit/debug metadata, while the
// enclosing object exclusively owns collision so runtime colliders never
// overlap.
const COMPOSITE_CHILD_IDS = new Set([
  'digital-kiosk-06', 'tree-01', 'tree-02', 'tree-03', 'media-sign-north-center',
  'street-light-28', 'control-box-03', 'bench-02',
  'building-southwest-culture-office', 'building-southeast-cinema',
  'metro-support-east-02', 'tree-04', 'tree-06', 'tree-07', 'tree-08',
  'tree-09', 'tree-10', 'tree-11', 'tree-20',
  'tree-21', 'tree-22', 'tree-23', 'tree-24', 'tree-25',
  'tree-26', 'tree-27', 'tree-28', 'tree-29', 'tree-30',
  'street-light-24', 'digital-kiosk-05', 'control-box-01', 'control-box-04',
  'media-sign-food-north',
])

export const OBJECT_COLLIDERS = Object.freeze(
  OBJECT_FOOTPRINTS.filter((rect) => !COMPOSITE_CHILD_IDS.has(rect.id)),
)

export const ALLOWED_SURFACES = Object.freeze([
  ...SIDEWALK_REGIONS,
  ...PLAZA_REGIONS,
  ...CROSSWALK_REGIONS,
  ...STAIR_REGIONS,
  ...ENTRANCE_REGIONS,
])

export const WORLD_BOUNDARY = Object.freeze({
  id: 'world-boundary', x: 0, y: 0, w: WORLD_WIDTH, h: WORLD_HEIGHT,
})

export const SPAWN_POINTS = Object.freeze({
  entrance: Object.freeze({ id: 'entrance', x: 720, y: 958 }),
  midcity: Object.freeze({ id: 'midcity', x: 752, y: 568 }),
  metro: Object.freeze({ id: 'metro', x: 720, y: 335 }),
})

export const EXIT_TRIGGER = Object.freeze(
  freezeRect('south-exit', 'entrance', 674, 1016, 104, 70),
)

export const ACCESSIBILITY_TARGETS = Object.freeze({
  'central-plaza': Object.freeze({ id: 'central-plaza', x: 752, y: 568 }),
  southwest: Object.freeze({ id: 'southwest', x: 548, y: 850 }),
  southeast: Object.freeze({ id: 'southeast', x: 887, y: 850 }),
  'west-media-plaza': Object.freeze({ id: 'west-media-plaza', x: 520, y: 620 }),
  'east-food-court': Object.freeze({ id: 'east-food-court', x: 980, y: 630 }),
  'metro-stairs': Object.freeze({ id: 'metro-stairs', x: 720, y: 300 }),
  'south-exit': Object.freeze({ id: 'south-exit', x: 720, y: 1060 }),
})

const pointInRect = (x, y, rect) => (
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
)

const pointInPolygon = (x, y, points) => {
  let inside = false
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
    const a = points[current]
    const b = points[previous]
    const crosses = (a.y > y) !== (b.y > y)
      && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

export const pointInRegion = (x, y, region) => (
  region.points ? pointInPolygon(x, y, region.points) : pointInRect(x, y, region)
)

const transformFor = (worldSize = {}) => createWorldTransform({
  baseWorldWidth: WORLD_WIDTH,
  baseWorldHeight: WORLD_HEIGHT,
  currentWorldWidth: worldSize.currentWorldWidth ?? WORLD_WIDTH,
  currentWorldHeight: worldSize.currentWorldHeight ?? WORLD_HEIGHT,
})

export function playerFootRectAt(x, y, worldSize = {}) {
  return createPlayerFootRect({ x, y }, PLAYER_FOOT_BOX, transformFor(worldSize))
}

// Semantic/debug classification only. Final terrain walkability comes from
// the generated PNG mask below and can intentionally disagree with this.
export function surfaceAt(x, y, worldSize = {}) {
  const transform = transformFor(worldSize)
  const baseX = x / transform.scaleX
  const baseY = y / transform.scaleY
  if (baseX < 0 || baseY < 0 || baseX >= WORLD_WIDTH || baseY >= WORLD_HEIGHT) return 'blocked'
  if (OBJECT_COLLIDERS.some((rect) => pointInRect(baseX, baseY, rect))) return 'object-footprint'
  const priority = [ENTRANCE_REGIONS, STAIR_REGIONS, CROSSWALK_REGIONS, PLAZA_REGIONS, SIDEWALK_REGIONS]
  for (const regions of priority) {
    const match = regions.find((region) => pointInRegion(baseX, baseY, region))
    if (match) return match.surface
  }
  if (BLOCKED_ROAD_REGIONS.some((rect) => pointInRect(baseX, baseY, rect))) return 'road'
  return 'blocked'
}

export function isWalkablePoint(x, y, worldSize = {}) {
  const transform = transformFor(worldSize)
  return isUrbanV3MaskPointWalkable(x, y, transform.currentWorldWidth, transform.currentWorldHeight)
}

// Visit every 2px mask cell intersected by the real 20x14 foot rectangle.
// This applies the foot box once at runtime; the source mask is not eroded.
export function collidesPlayerAt(x, y, worldSize = {}) {
  const transform = transformFor(worldSize)
  const player = playerFootRectAt(x, y, worldSize)
  if (player.x < 0 || player.y < 0 || player.x + player.w > transform.currentWorldWidth || player.y + player.h > transform.currentWorldHeight) {
    return Object.freeze({ id: 'world-boundary', surface: 'blocked' })
  }
  const object = findScaledRectCollision(OBJECT_COLLIDERS, player, transform)
  if (object) return Object.freeze(baseRectToCurrent(object, transform))
  const bounds = worldRectToMaskBounds(player, transform, URBAN_V3_WALKABLE_MASK_METADATA.width, URBAN_V3_WALKABLE_MASK_METADATA.height)
  if (!bounds) return Object.freeze({ id: 'world-boundary', surface: 'blocked' })
  for (let row = bounds.firstRow; row <= bounds.lastRow; row += 1) {
    for (let column = bounds.firstColumn; column <= bounds.lastColumn; column += 1) {
      if (isUrbanV3MaskCellWalkable(column, row)) continue
      const sample = basePointToCurrent({
        x: column * VILLAGE_MANIFEST.mask.baseCellSize + VILLAGE_MANIFEST.mask.baseCellSize / 2,
        y: row * VILLAGE_MANIFEST.mask.baseCellSize + VILLAGE_MANIFEST.mask.baseCellSize / 2,
      }, transform)
      const surface = surfaceAt(sample.x, sample.y, worldSize)
      return Object.freeze({
        id: surface === 'road' ? 'blocked-road-lane' : 'blocked-non-walkable',
        surface,
        maskCell: Object.freeze({ column, row }),
      })
    }
  }
  return null
}

function moveAxis(position, amount, axis, collisionEnabled, worldSize) {
  if (!amount) return position
  const transform = transformFor(worldSize)
  const footWidth = PLAYER_FOOT_BOX.w * transform.scaleX
  const footHeight = PLAYER_FOOT_BOX.h * transform.scaleY
  let next = { ...position }
  const direction = Math.sign(amount)
  let remaining = Math.abs(amount)
  while (remaining > 0) {
    const distance = Math.min(4, remaining)
    const candidate = { ...next, [axis]: next[axis] + direction * distance }
    const bounded = {
      x: Math.max(footWidth / 2, Math.min(transform.currentWorldWidth - footWidth / 2, candidate.x)),
      y: Math.max(footHeight, Math.min(transform.currentWorldHeight, candidate.y)),
    }
    if (collisionEnabled && collidesPlayerAt(bounded.x, bounded.y, worldSize)) break
    next = bounded
    remaining -= distance
  }
  return next
}

export function moveUrbanV3Player(position, dx, dy, { collisionEnabled = true, ...worldSize } = {}) {
  let next = moveAxis(position, dx, 'x', collisionEnabled, worldSize)
  next = moveAxis(next, dy, 'y', collisionEnabled, worldSize)
  return next
}

export function colliderAtPlayerPosition(position) {
  return collidesPlayerAt(position.x, position.y)
}

export function overlapsExitTrigger(position, worldSize = {}) {
  const transform = transformFor(worldSize)
  return rectsOverlap(playerFootRectAt(position.x, position.y, worldSize), baseRectToCurrent(EXIT_TRIGGER, transform))
}

export function reachableGridKeys(from = SPAWN_POINTS.entrance, gridSize = 8) {
  if (collidesPlayerAt(from.x, from.y)) return new Set()
  const key = (x, y) => `${Math.round(x)},${Math.round(y)}`
  const snap = (value) => Math.round(value / gridSize) * gridSize
  const start = { x: snap(from.x), y: snap(from.y) }
  const queue = [start]
  const visited = new Set([key(start.x, start.y)])
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    for (const [dx, dy] of [[gridSize, 0], [-gridSize, 0], [0, gridSize], [0, -gridSize]]) {
      const next = { x: current.x + dx, y: current.y + dy }
      const nextKey = key(next.x, next.y)
      if (visited.has(nextKey) || collidesPlayerAt(next.x, next.y)) continue
      visited.add(nextKey)
      queue.push(next)
    }
  }
  return visited
}

export function isReachableTarget(targetId, fromSpawnId = 'entrance', gridSize = 8) {
  const target = ACCESSIBILITY_TARGETS[targetId]
  const spawn = SPAWN_POINTS[fromSpawnId]
  if (!target || !spawn || collidesPlayerAt(target.x, target.y)) return false
  const visited = reachableGridKeys(spawn, gridSize)
  const radius = gridSize
  for (let x = target.x - radius; x <= target.x + radius; x += gridSize) {
    for (let y = target.y - radius; y <= target.y + radius; y += gridSize) {
      const snappedX = Math.round(x / gridSize) * gridSize
      const snappedY = Math.round(y / gridSize) * gridSize
      if (visited.has(`${snappedX},${snappedY}`)) return true
    }
  }
  return false
}

export const URBAN_V3_WORLD = Object.freeze({
  villageId: VILLAGE_ID,
  manifest: VILLAGE_MANIFEST,
  baseWorldWidth: WORLD_WIDTH,
  baseWorldHeight: WORLD_HEIGHT,
  currentWorldWidth: WORLD_WIDTH,
  currentWorldHeight: WORLD_HEIGHT,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  playerFootBox: PLAYER_FOOT_BOX,
  walkableMask: URBAN_V3_WALKABLE_MASK_METADATA,
  referenceTransform: REFERENCE_TRANSFORM,
  boundary: WORLD_BOUNDARY,
  sidewalks: SIDEWALK_REGIONS,
  plazas: PLAZA_REGIONS,
  crosswalks: CROSSWALK_REGIONS,
  stairs: STAIR_REGIONS,
  entrances: ENTRANCE_REGIONS,
  blockedRoads: BLOCKED_ROAD_REGIONS,
  objectColliders: OBJECT_COLLIDERS,
  objectFootprints: OBJECT_FOOTPRINTS,
  spawns: SPAWN_POINTS,
  targets: ACCESSIBILITY_TARGETS,
  exitTrigger: EXIT_TRIGGER,
})
