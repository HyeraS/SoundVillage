/**
 * Brookside Bloom v2 visual target guide.
 *
 * Reference measurements exclude the 47 px concept HUD and normalize the
 * remaining 1448×1039 map image to the runtime's 48×36 logical grid. These
 * values are an art-direction target, not collision data; natureFarmLayout
 * owns the final walkability model.
 */
export const REFERENCE_MAP = {
  sourceWidth: 1448,
  sourceHeight: 1086,
  hudCropY: 47,
  mapWidth: 1448,
  mapHeight: 1039,
  worldTiles: { w: 48, h: 36 },
}

export const NATURE_V2_PALETTE = {
  grass: { base: '#B4CC26', light: '#C7D429', mid: '#A9C920', shadow: '#97AF27' },
  path: { base: '#FCD46F', light: '#EECF54', edge: '#D8A357' },
  water: { base: '#1EC5D3', shallow: '#21AEB7', deep: '#35788C', glint: '#9DEBF0' },
  foliage: { bright: '#71AA2A', mid: '#50912B', dark: '#256730', forest: '#3F5545' },
  wood: { light: '#D8A357', mid: '#9C6929', dark: '#5F5C26' },
  plaster: { warm: '#DDD3AD', highlight: '#F4E8C5' },
  roof: { slate: '#3F5545', terracotta: '#AD6F41' },
  flower: { white: '#FFF8DF', pink: '#F49A9B', yellow: '#DFDC28', purple: '#9A72C7' },
}

export const LANDMARK_GUIDE = {
  watermill: {
    referenceBox: { x: 0.131, y: 0.060, w: 0.239, h: 0.213 },
    targetTiles: { x: 6, y: 2, w: 12, h: 8 },
    footprintTiles: { x: 9, y: 7, w: 8, h: 3 },
  },
  northCottage: {
    referenceBox: { x: 0.587, y: 0.059, w: 0.180, h: 0.205 },
    targetTiles: { x: 28, y: 2, w: 9, h: 8 },
    footprintTiles: { x: 29, y: 7, w: 7, h: 3 },
  },
  greenhouse: {
    referenceBox: { x: 0.785, y: 0.089, w: 0.165, h: 0.173 },
    targetTiles: { x: 38, y: 3, w: 8, h: 6 },
    footprintTiles: { x: 38, y: 7, w: 8, h: 2 },
  },
  southCottage: {
    referenceBox: { x: 0.050, y: 0.667, w: 0.109, h: 0.175 },
    targetTiles: { x: 2, y: 24, w: 6, h: 7 },
    footprintTiles: { x: 3, y: 28, w: 5, h: 3 },
  },
  upperBridge: {
    referenceBox: { x: 0.405, y: 0.236, w: 0.166, h: 0.123 },
    targetTiles: { x: 19, y: 9, w: 9, h: 4 },
    walkLaneTiles: { x: 19, y: 10, w: 9, h: 2 },
  },
  lowerBridge: {
    referenceBox: { x: 0.462, y: 0.717, w: 0.175, h: 0.117 },
    targetTiles: { x: 22, y: 26, w: 9, h: 4 },
    walkLaneTiles: { x: 22, y: 27, w: 9, h: 2 },
  },
  wheatField: {
    referenceBox: { x: 0.055, y: 0.314, w: 0.152, h: 0.157 },
    targetTiles: { x: 3, y: 12, w: 7, h: 6 },
  },
  vegetableField: {
    referenceBox: { x: 0.165, y: 0.511, w: 0.182, h: 0.131 },
    targetTiles: { x: 8, y: 19, w: 9, h: 5 },
  },
  cornField: {
    referenceBox: { x: 0.220, y: 0.688, w: 0.159, h: 0.136 },
    targetTiles: { x: 11, y: 25, w: 8, h: 5 },
  },
  orchard: {
    referenceBox: { x: 0.604, y: 0.367, w: 0.198, h: 0.287 },
    targetTiles: { x: 29, y: 14, w: 10, h: 10 },
    treeCount: 6,
  },
}

export const CREEK_GUIDE = [
  [0, 23], [5, 23], [10, 23], [15, 20], [20, 21], [25, 24], [30, 28], [35, 35],
]

