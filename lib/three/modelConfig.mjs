export const ZONE_LINEAR_SCALE = Math.SQRT2
export const PLAYER_RADIUS = 0.42
export const PLAYER_MOVE_SPEED = 4.1
export const SOUND_INTERACTION_RADIUS = 1.62

export const SOUND_ORB_VISUAL_SCALE = Object.freeze({ default: 0.68, nearby: 0.8, completed: 0.54 })

export function scaleZonePosition(position, scale = ZONE_LINEAR_SCALE) {
  if (position.length === 3) return [position[0] * scale, position[1], position[2] * scale]
  return [position[0] * scale, position[1] * scale]
}

export const BASE_WORLD_BOUNDS = Object.freeze({ minX: -11.4, maxX: 11.4, minZ: -7.7, maxZ: 7.7 })
export const WORLD_BOUNDS = Object.freeze({
  minX: BASE_WORLD_BOUNDS.minX * ZONE_LINEAR_SCALE,
  maxX: BASE_WORLD_BOUNDS.maxX * ZONE_LINEAR_SCALE,
  minZ: BASE_WORLD_BOUNDS.minZ * ZONE_LINEAR_SCALE,
  maxZ: BASE_WORLD_BOUNDS.maxZ * ZONE_LINEAR_SCALE,
})

export const BASE_PLAYER_START = Object.freeze([0, 0, 6.8])
export const PLAYER_START = Object.freeze(scaleZonePosition(BASE_PLAYER_START))

export const MUSIC_EXIT_TARGET = Object.freeze({
  id: 'music-village-exit',
  kind: 'music-exit',
  label: '중앙 광장 출구',
  position: Object.freeze(scaleZonePosition([3.9, 0, 6.7])),
  interactionRadius: 1.9,
})

const BASE_WORLD_COLLIDERS = [
  { id: 'music-house', position: [-5.2, -2.7], size: [4.2, 3.3], height: 3.8 },
  { id: 'sound-museum', position: [5.2, -2.7], size: [4.5, 3.3], height: 4.2 },
  { id: 'tree-west', position: [-9.2, -1.8], size: [1.4, 1.4], height: 3.2 },
  { id: 'tree-east', position: [9.1, -1.2], size: [1.4, 1.4], height: 3.2 },
  { id: 'tree-north-west', position: [-9.4, 5.8], size: [1.3, 1.3], height: 3.1 },
  { id: 'tree-north-east', position: [9.4, 5.8], size: [1.3, 1.3], height: 3.1 },
  { id: 'fence-west', position: [-10.6, 2], size: [0.35, 4.6], height: 0.9 },
  { id: 'fence-east', position: [10.6, 2], size: [0.35, 4.6], height: 0.9 },
  { id: 'fence-south', position: [0, -7.1], size: [6.8, 0.35], height: 0.9 },
]

export const WORLD_COLLIDERS = Object.freeze(BASE_WORLD_COLLIDERS.map(collider => Object.freeze({
  ...collider,
  position: Object.freeze(scaleZonePosition(collider.position)),
  size: Object.freeze([...collider.size]),
})))

const BASE_DECORATION_POSITIONS = {
  trees: [
    [-9.2, -1.8], [9.1, -1.2], [-9.4, 5.8], [9.4, 5.8],
    [-7.9, 7], [7.9, 7], [-10, -5.2], [10, -5.2],
  ],
  flowers: [
    [-7.8, 3.3], [-7.2, 2.8], [-6.6, 3.5], [6.8, 3.1], [7.5, 3.5],
    [8, 2.7], [-3.4, -6.6], [-2.8, -6.3], [3.1, -6.4], [3.8, -6.5],
  ],
  benches: [[-2.7, -2.1], [2.5, -2.1]],
  lamps: [[-1.5, 3.2], [1.5, 3.2], [-1.5, -3.8], [1.5, -3.8]],
  fences: [[-6.5, -7.1], [-4.3, -7.1], [-2.1, -7.1], [2.1, -7.1], [4.3, -7.1], [6.5, -7.1]],
}

export const DECORATION_POSITIONS = Object.freeze(Object.fromEntries(
  Object.entries(BASE_DECORATION_POSITIONS).map(([key, positions]) => [key, Object.freeze(positions.map(position => Object.freeze(scaleZonePosition(position))))]),
))

export const MUSIC_ENVIRONMENT_CONFIG = Object.freeze({
  groundTopRadius: 13.2 * ZONE_LINEAR_SCALE,
  groundBottomRadius: 12.7 * ZONE_LINEAR_SCALE,
  northSouthPath: Object.freeze({ width: 3.2, length: 15.5 * ZONE_LINEAR_SCALE, position: Object.freeze([0, 0]) }),
  eastWestPath: Object.freeze({ width: 2.4, length: 18.5 * ZONE_LINEAR_SCALE, position: Object.freeze(scaleZonePosition([0, 4.9])) }),
  housePosition: Object.freeze(scaleZonePosition([-5.2, -2.7])),
  museumPosition: Object.freeze(scaleZonePosition([5.2, -2.7])),
  signPosition: Object.freeze(scaleZonePosition([2.9, 1.9])),
})
