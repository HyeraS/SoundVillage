export const THREE_ASSET_ROOT = '/models/3d'

export const ASSET_MANIFEST = {
  player: {
    url: `${THREE_ASSET_ROOT}/player.glb`, placeholderType: 'player', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: false,
    collider: { type: 'circle', size: [0.84, 0.84] }, animations: { idle: 'Idle', walk: 'Walk', interact: 'Interact' }, fallbackColor: '#F4B183',
  },
  musicVillageHouse: {
    url: `${THREE_ASSET_ROOT}/music-village-house.glb`, placeholderType: 'musicHouse', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: true,
    collider: { type: 'aabb', size: [4.2, 3.3] }, animations: {}, fallbackColor: '#E9A6C3',
  },
  soundMuseum: {
    url: `${THREE_ASSET_ROOT}/sound-museum.glb`, placeholderType: 'museum', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: true,
    collider: { type: 'aabb', size: [4.5, 3.3] }, animations: {}, fallbackColor: '#E8D6A8',
  },
  appleTree: {
    url: `${THREE_ASSET_ROOT}/apple-tree.glb`, placeholderType: 'tree', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: true,
    collider: { type: 'aabb', size: [1.4, 1.4] }, animations: {}, fallbackColor: '#80B77B',
  },
  flowerPink: {
    url: `${THREE_ASSET_ROOT}/flower-pink.glb`, placeholderType: 'flowerPink', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: false, receiveShadow: false,
    collider: { type: 'none', size: [0, 0] }, animations: {}, fallbackColor: '#F0A7C4',
  },
  flowerWhite: {
    url: `${THREE_ASSET_ROOT}/flower-white.glb`, placeholderType: 'flowerWhite', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: false, receiveShadow: false,
    collider: { type: 'none', size: [0, 0] }, animations: {}, fallbackColor: '#FFF5DF',
  },
  woodenFence: {
    url: `${THREE_ASSET_ROOT}/wooden-fence.glb`, placeholderType: 'fence', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: true,
    collider: { type: 'aabb', size: [2, 0.35] }, animations: {}, fallbackColor: '#B98559',
  },
  bench: {
    url: `${THREE_ASSET_ROOT}/bench.glb`, placeholderType: 'bench', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: true,
    collider: { type: 'none', size: [0, 0] }, animations: {}, fallbackColor: '#A66F4A',
  },
  soundOrb: {
    url: `${THREE_ASSET_ROOT}/sound-orb.glb`, placeholderType: 'soundOrb', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: false,
    collider: { type: 'interaction', size: [1.6, 1.6] }, animations: { interact: 'Interact' }, fallbackColor: '#B89BE8',
  },
  lampPost: {
    url: `${THREE_ASSET_ROOT}/lamp-post.glb`, placeholderType: 'lamp', enabled: false,
    scale: 1, rotation: [0, 0, 0], positionOffset: [0, 0, 0], castShadow: true, receiveShadow: false,
    collider: { type: 'none', size: [0, 0] }, animations: {}, fallbackColor: '#F8D985',
  },
}

