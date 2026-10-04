// Build-only legacy collision authority for objects that have not migrated to
// native WorldObject ownership. Production imports only the generated output.

const rect = (left, top, right, bottom) => Object.freeze({ type: 'rect', left, top, right, bottom })
const collisionObject = (objectId, colliderId, collisionRole, shapes) => Object.freeze({
  objectId,
  colliderId,
  collisionRole,
  shapes: Object.freeze(shapes),
})

export const LEGACY_WORLD_MAP_V4_COLLISION_OBJECTS = Object.freeze([
  collisionObject('landmark-lab', 'lab-body', 'building-body', [rect(1792, 416, 2048, 630)]),
  collisionObject('landmark-animal', 'animal-body', 'building-body', [rect(3072, 448, 3392, 702)]),
  collisionObject('landmark-urban', 'urban-body', 'building-body', [rect(3392, 1152, 3712, 1514)]),
  collisionObject('landmark-music', 'music-body', 'building-body', [rect(3040, 2080, 3392, 2430)]),
  collisionObject('landmark-human', 'human-body', 'building-body', [rect(224, 2048, 640, 2458)]),
  collisionObject('landmark-nature', 'nature-body', 'building-body', [rect(352, 1120, 736, 1290)]),
  collisionObject('landmark-library', 'library-body', 'building-body', [rect(1728, 1184, 2112, 1398)]),
  collisionObject('landmark-home', 'home-body', 'building-body', [rect(1536, 1472, 1792, 1752)]),
])
