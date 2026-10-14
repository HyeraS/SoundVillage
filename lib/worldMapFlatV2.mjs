export const WORLD_MAP_FLAT_V2_ASSET = Object.freeze({
  id: 'world-map-flat-v2',
  src: '/assets/world/spring-sound-archive-garden-flat-v2/world-map-flat-v2.webp',
  pngSrc: '/assets/world/spring-sound-archive-garden-flat-v2/world-map-flat-v2.png',
  width: 1448,
  height: 1086,
  logicalWidth: 3840,
  logicalHeight: 2880,
  bytes: 726704,
  decodedRGBA: 6290112,
})

const worldPointFromArtwork = (x, y) => Object.freeze({
  x: Math.round(x * WORLD_MAP_FLAT_V2_ASSET.logicalWidth / WORLD_MAP_FLAT_V2_ASSET.width),
  y: Math.round(y * WORLD_MAP_FLAT_V2_ASSET.logicalHeight / WORLD_MAP_FLAT_V2_ASSET.height),
})

// Door-front interaction points measured against the approved 1448x1086 flat
// artwork. These replace the old road-label hotspots without changing the
// modular-v4 rollback geometry.
export const WORLD_MAP_FLAT_V2_ZONE_APPROACHES = Object.freeze({
  Lab: worldPointFromArtwork(723, 181),
  Animal: worldPointFromArtwork(1210, 193),
  Urban: worldPointFromArtwork(1384, 501),
  Music: worldPointFromArtwork(1208, 866),
  Human: worldPointFromArtwork(145, 900),
  Nature: worldPointFromArtwork(269, 205),
})

// Registered against the south-facing door in the approved flat artwork.
// The modular-v4 Home data remains unchanged for environment rollback.
export const WORLD_MAP_FLAT_V2_HOME = Object.freeze({
  id: 'Home',
  kind: 'home',
  target: Object.freeze({
    tx: 37,
    ty: 46,
    w: 9,
    h: 8,
    approach: Object.freeze({ x: 1288, y: 1744 }),
  }),
  visualBounds: Object.freeze({ left: 1098, top: 1369, right: 1467, bottom: 1719 }),
  collision: Object.freeze({ left: 1155, top: 1470, right: 1405, bottom: 1705 }),
  guidePath: Object.freeze([
    Object.freeze({ x: 1920, y: 1504 }),
    Object.freeze({ x: 1664, y: 1568 }),
    Object.freeze({ x: 1472, y: 1696 }),
    Object.freeze({ x: 1288, y: 1744 }),
  ]),
})

export const WORLD_MAP_FLAT_V2_COLLISION_HOME = Object.freeze({
  objectId: 'landmark-home',
  colliderId: 'home-body',
  collisionRole: 'building-body',
  shapes: Object.freeze([Object.freeze({
    type: 'rect',
    ...WORLD_MAP_FLAT_V2_HOME.collision,
  })]),
})
