export const WORLD_BOUNDS = { minX: -11.4, maxX: 11.4, minZ: -7.7, maxZ: 7.7 }
export const PLAYER_RADIUS = 0.42
export const PLAYER_START = [0, 0, 6.8]

export const MUSIC_EXIT_TARGET = Object.freeze({
  id: 'music-village-exit',
  kind: 'music-exit',
  label: '중앙 광장 출구',
  position: Object.freeze([3.9, 0, 6.7]),
  interactionRadius: 1.9,
})

export const WORLD_COLLIDERS = [
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

export const DECORATION_POSITIONS = {
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
}
