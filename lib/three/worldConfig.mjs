export const HUB_SCENE_ID = 'hub'

export const HUB_BOUNDS = Object.freeze({ minX: -12.6, maxX: 12.6, minZ: -9.8, maxZ: 10.2 })
export const HUB_PLAYER_START = Object.freeze([0, 0, 8.4])
export const HUB_LANDMARK = Object.freeze({
  id: 'hub-landmark-orb',
  label: '중앙 광장 랜드마크',
  position: Object.freeze([0, 0.92, 0]),
  interactionRadius: 2.35,
})

export const HUB_BUILDINGS = Object.freeze([
  Object.freeze({ id: 'player-home', type: 'home', label: '플레이어 집', position: Object.freeze([-6.8, 0, -3.9]), rotation: Object.freeze([0, 0.08, 0]), colliderSize: Object.freeze([4.2, 3.5]) }),
  Object.freeze({ id: 'listening-pavilion', type: 'pavilion', label: '소리 공방', position: Object.freeze([0.2, 0, -7.1]), rotation: Object.freeze([0, 0, 0]), colliderSize: Object.freeze([4.8, 2.8]) }),
  Object.freeze({ id: 'sound-museum', type: 'museum', label: 'Sound Museum', position: Object.freeze([7.1, 0, -3.8]), rotation: Object.freeze([0, -0.08, 0]), colliderSize: Object.freeze([4.8, 3.6]) }),
])

export function getGatewayYaw(position, center = [0, 0, 0]) {
  return Math.atan2(position[0] - center[0], position[2] - center[2])
}

function createExit(id, label, color, position) {
  const frozenPosition = Object.freeze(position)
  return Object.freeze({ id, label, color, position: frozenPosition, rotationY: getGatewayYaw(frozenPosition) })
}

export const HUB_EXITS = Object.freeze([
  createExit('animal', 'Animal', '#F0A17D', [-10.3, 0, 5.7]),
  createExit('human', 'Human', '#F2B68D', [-10.8, 0, 0.9]),
  createExit('nature', 'Nature', '#74B978', [-9.8, 0, -6.9]),
  createExit('urban', 'Urban', '#63AFA5', [10.4, 0, 5.6]),
  createExit('music', 'Music', '#E88C72', [10.9, 0, 0.8]),
  createExit('unknown', 'Unknown', '#8AAE8D', [10, 0, -7]),
])

export const HUB_MUSEUM_PATH = Object.freeze({
  id: 'sound-museum-path',
  label: 'Sound Museum 연결 길',
  width: 1.45,
  points: Object.freeze([
    Object.freeze([3.85, 0, -0.45]),
    Object.freeze([6.85, 0, -0.72]),
    Object.freeze([6.98, 0, -1.55]),
  ]),
})

export const HUB_DECORATIONS = Object.freeze({
  trees: Object.freeze([
    [-11.2, -4.2], [-10.6, 8.3], [-8.8, 8.8], [-8.9, 3.2],
    [11.2, -4.4], [10.8, 8.2], [8.8, 8.9], [9.1, 3.1],
  ].map(Object.freeze)),
  flowersPink: Object.freeze([
    [-4.8, 3.7], [-4.3, 3.25], [-3.8, 3.7], [4.1, 3.55], [4.6, 3.2], [5.1, 3.65],
    [-4.8, -7.7], [-4.2, -7.9], [4.5, -7.8], [5.1, -7.5],
  ].map(Object.freeze)),
  flowersWhite: Object.freeze([
    [-5.25, 3.2], [-3.55, 3.2], [3.7, 3.1], [5.4, 3.2],
    [-5.3, -7.35], [-3.85, -7.5], [4.05, -7.45], [5.55, -7.25],
  ].map(Object.freeze)),
  fences: Object.freeze([
    [-7.1, 7.9, 0], [-5.2, 8.25, -0.18], [5.3, 8.25, 0.18], [7.2, 7.9, 0],
    [-11.65, -1.8, Math.PI / 2], [11.65, -1.8, Math.PI / 2],
  ].map(Object.freeze)),
  benches: Object.freeze([[-3.7, 1.3, -0.45], [3.8, 1.2, 0.45]].map(Object.freeze)),
  lamps: Object.freeze([[-2.4, 4.1], [2.4, 4.1], [-3.5, -1.7], [3.5, -1.7]].map(Object.freeze)),
  pots: Object.freeze([[-5.4, -2.0], [-8.2, -2.2], [5.6, -1.9], [8.5, -2.1], [-1.7, -6.05], [2.1, -6.05]].map(Object.freeze)),
})

const treeColliders = HUB_DECORATIONS.trees.map((position, index) => ({
  id: `hub-tree-${index}`,
  position,
  size: [1.25, 1.25],
  height: 3.2,
}))

const fenceColliders = HUB_DECORATIONS.fences.map((position, index) => ({
  id: `hub-fence-${index}`,
  position: [position[0], position[1]],
  size: Math.abs(position[2]) > 1 ? [0.35, 2] : [2, 0.35],
  height: 0.9,
}))

export const HUB_COLLIDERS = Object.freeze([
  ...HUB_BUILDINGS.map(building => ({ id: building.id, position: [building.position[0], building.position[2]], size: building.colliderSize, height: 4.3 })),
  ...treeColliders,
  ...fenceColliders,
].map(Object.freeze))

export function getPrototypeScene(searchParams) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '')
  return params.get('scene') === HUB_SCENE_ID ? HUB_SCENE_ID : 'music'
}

export function getHubVillage(villageId) {
  const exit = HUB_EXITS.find(candidate => candidate.id === String(villageId || '').toLowerCase())
  if (!exit) return null
  return {
    id: `village-exit-${exit.id}`,
    kind: 'village-exit',
    villageId: exit.id,
    label: `${exit.label} 마을 입구`,
    color: exit.color,
    position: [...exit.position],
  }
}

export function getHubReturnPose(villageId, inwardDistance = 2.1) {
  const exit = HUB_EXITS.find(candidate => candidate.id === villageId)
  if (!exit) return { position: [...HUB_PLAYER_START], yaw: 0 }
  const length = Math.hypot(exit.position[0], exit.position[2]) || 1
  const position = [
    exit.position[0] - (exit.position[0] / length) * inwardDistance,
    0,
    exit.position[2] - (exit.position[2] / length) * inwardDistance,
  ]
  const inward = { x: -exit.position[0] / length, z: -exit.position[2] / length }
  return { position, yaw: Math.atan2(inward.x, -inward.z) }
}

export function resolveHubInteraction(target) {
  if (target?.kind === 'village-exit' && target.villageId) return { type: 'enter-village', village: target }
  if (target?.kind === 'landmark') return { type: 'show-landmark' }
  return { type: 'none' }
}

export function createHubInteractionTargets() {
  return [
    { ...HUB_LANDMARK, kind: 'landmark', position: [...HUB_LANDMARK.position] },
    ...HUB_EXITS.map(exit => getHubVillage(exit.id)),
  ]
}

export function getLandmarkOrbMotion(elapsedTime, reducedMotion) {
  if (reducedMotion) return { yOffset: 0, rotationY: 0 }
  return {
    yOffset: Math.sin(elapsedTime * 0.55) * 0.045,
    rotationY: elapsedTime * 0.12,
  }
}
