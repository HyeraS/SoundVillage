import { createWorldTransform } from './villageWorldTransform.mjs'

const freezeManifest = (manifest) => Object.freeze({
  ...manifest,
  background: Object.freeze({ ...manifest.background }),
  foreground: manifest.foreground ? Object.freeze({ ...manifest.foreground }) : null,
  mask: Object.freeze({ ...manifest.mask }),
  playerFootBox: Object.freeze({ ...manifest.playerFootBox }),
})

export const VILLAGE_RUNTIME_MANIFESTS = Object.freeze({
  'urban-v3': freezeManifest({
    villageId: 'urban-v3',
    baseWorldWidth: 1448,
    baseWorldHeight: 1086,
    background: { src: '/assets/urban-city-v3/reference/canonical-map-art-runtime.png' },
    foreground: null,
    mask: {
      src: '/assets/urban-city-v3/collision/urban-walkable-mask.png',
      width: 724,
      height: 543,
      baseCellSize: 2,
      generatedModule: './generated/urbanV3WalkableMask.generated.mjs',
    },
    playerFootBox: { w: 20, h: 14 },
  }),
  lab: freezeManifest({
    villageId: 'lab',
    baseWorldWidth: 1536,
    baseWorldHeight: 1152,
    background: { src: '/assets/lab-witch/environment-master-v2.png' },
    foreground: null,
    mask: {
      src: '/assets/lab-witch/collision/lab-walkable-mask.png',
      width: 384,
      height: 288,
      baseCellSize: 4,
      generatedModule: './generated/labWalkableMask.generated.mjs',
    },
    playerFootBox: { w: 20, h: 14 },
  }),
  human: freezeManifest({
    villageId: 'human',
    baseWorldWidth: 1536,
    baseWorldHeight: 1152,
    background: { src: '/assets/human-village/community-map-master-1536x1152-v2.png' },
    foreground: { src: '/assets/human-village/community-map-foreground-1536x1152-v2.png' },
    mask: {
      src: '/assets/human-village/collision/human-walkable-mask.png',
      width: 384,
      height: 288,
      baseCellSize: 4,
      generatedModule: './generated/humanWalkableMask.generated.mjs',
    },
    playerFootBox: { w: 20, h: 14 },
  }),
  animal: freezeManifest({
    villageId: 'animal',
    baseWorldWidth: 1536,
    baseWorldHeight: 1024,
    background: { src: '/assets/animal-village-sunflower/base-map.png' },
    foreground: { src: '/assets/animal-village-sunflower/foreground-map.png' },
    mask: {
      src: '/assets/animal-village-sunflower/walkable-mask.png',
      width: 384,
      height: 256,
      baseCellSize: 4,
      generatedModule: './generated/animalWalkableMask.generated.mjs',
    },
    playerFootBox: { w: 20, h: 14 },
  }),
  nature: freezeManifest({
    villageId: 'nature',
    baseWorldWidth: 1536,
    baseWorldHeight: 1152,
    background: { src: '/assets/world/nature-farm-v2/brookside-bloom-map-v3.png' },
    foreground: null,
    mask: {
      src: '/assets/world/nature-farm-v2/collision/nature-walkable-mask.png',
      width: 384,
      height: 288,
      baseCellSize: 4,
      generatedModule: './generated/natureWalkableMask.generated.mjs',
    },
    playerFootBox: { w: 18, h: 10 },
  }),
})

export function getVillageRuntimeManifest(villageId) {
  const manifest = VILLAGE_RUNTIME_MANIFESTS[villageId]
  if (!manifest) throw new Error(`Unknown villageId: ${villageId}`)
  return manifest
}

export function createVillageWorldTransform(villageId, currentWorldWidth, currentWorldHeight) {
  const manifest = getVillageRuntimeManifest(villageId)
  return createWorldTransform({
    baseWorldWidth: manifest.baseWorldWidth,
    baseWorldHeight: manifest.baseWorldHeight,
    currentWorldWidth: currentWorldWidth ?? manifest.baseWorldWidth,
    currentWorldHeight: currentWorldHeight ?? manifest.baseWorldHeight,
  })
}
