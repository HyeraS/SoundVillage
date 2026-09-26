export const ASSET_ROOT = '/assets/animal-village-sunflower/'

export const ASSET_FILES = Object.freeze({
  accents: 'generated-accent-atlas.png',
  terrain: 'terrain-farm.png',
  townTerrain: 'terrain-town.png',
  items: 'farm-items.png',
  nature: 'nature-props.png',
  barn: 'barn.png',
  greenhouse: 'greenhouse.png',
  coop: 'coop.png',
  farmhouse: 'farmhouse-red.png',
  cottageBlue: 'cottage-blue.png',
  cottageRed: 'cottage-red.png',
  forestTrees: 'forest-trees.png',
  appleTrees: 'apple-trees.png',
  silo: 'silo.png',
  windmillBody: 'windmill-body.png',
  fenceRail: 'fence-rail.png',
  fencePost: 'fence-post.png',
  fenceCorner: 'fence-corner.png',
  fenceGate: 'fence-gate.png',
  treeBroadleaf: 'tree-broadleaf.png',
  treePine: 'tree-pine.png',
  cow: 'cow.png',
  cowBlack: 'cow-black.png',
  sheep: 'sheep.png',
  chicken: 'chicken.png',
  chickenBrown: 'chicken-brown.png',
})

const frame = (sheet, x, y, width, height, anchorX = 0.5, anchorY = 1) =>
  Object.freeze({ sheet, x, y, width, height, anchorX, anchorY })

export const SPRITES = Object.freeze({
  barn: frame('barn', 0, 0, 80, 80),
  greenhouse: frame('greenhouse', 0, 0, 112, 80),
  coop: frame('coop', 0, 0, 64, 64),
  farmhouse: frame('farmhouse', 0, 0, 58, 72),
  cottageBlue: frame('cottageBlue', 0, 0, 192, 224),
  cottageRed: frame('cottageRed', 0, 0, 74, 83),
  silo: frame('silo', 0, 0, 42, 68),
  windmillBody: frame('windmillBody', 0, 0, 90, 57),
  forestTreeA: frame('forestTrees', 0, 0, 112, 128),
  forestTreeB: frame('forestTrees', 112, 0, 112, 128),
  appleTreeA: frame('appleTrees', 0, 0, 112, 128),
  appleTreeB: frame('appleTrees', 112, 0, 112, 128),
  appleTreeC: frame('appleTrees', 224, 0, 112, 128),
  fenceRail: frame('fenceRail', 0, 0, 32, 32),
  fencePost: frame('fencePost', 0, 0, 16, 32),
  fenceCorner: frame('fenceCorner', 0, 0, 32, 32),
  fenceGate: frame('fenceGate', 0, 0, 32, 32),
  treeBroadleaf: frame('treeBroadleaf', 0, 0, 32, 64),
  treePine: frame('treePine', 0, 0, 32, 64),
  cow: frame('cow', 0, 0, 24, 24),
  cowBlack: frame('cowBlack', 0, 0, 24, 24),
  sheep: frame('sheep', 0, 0, 17, 17),
  chicken: frame('chicken', 0, 0, 16, 16),
  chickenBrown: frame('chickenBrown', 0, 0, 16, 16),

  // ImageGen atlas frames. The source and cleaned atlas are kept together in
  // public/assets/animal-village-sunflower for provenance and repeatability.
  sunflowers: frame('accents', 47, 82, 197, 189),
  mixedFlowers: frame('accents', 284, 117, 181, 151),
  grassTall: frame('accents', 521, 142, 103, 111),
  grassMedium: frame('accents', 661, 165, 101, 88),
  grassShort: frame('accents', 800, 163, 98, 90),
  cattails: frame('accents', 937, 77, 153, 189),
  lilyLarge: frame('accents', 1147, 155, 130, 89),
  lilyMedium: frame('accents', 1300, 170, 101, 74),
  lilySmall: frame('accents', 1422, 186, 73, 54),
  rock: frame('accents', 59, 414, 133, 105),
  sign: frame('accents', 255, 341, 129, 175),
  barrel: frame('accents', 442, 371, 115, 150),
  hay: frame('accents', 620, 374, 177, 147),
  produceCart: frame('accents', 830, 356, 252, 184),
  bench: frame('accents', 1134, 373, 224, 154),
  lamp: frame('accents', 1405, 279, 78, 253),
  boat: frame('accents', 57, 615, 219, 146),
  duck: frame('accents', 340, 617, 137, 137),
  cowGenerated: frame('accents', 551, 595, 242, 171),
  sheepGenerated: frame('accents', 847, 612, 206, 149),
  henGenerated: frame('accents', 1138, 617, 123, 141),
  chickGenerated: frame('accents', 1352, 648, 87, 106),
  waterSparkle0: frame('accents', 314, 816, 134, 127, 0.5, 0.5),
  waterSparkle1: frame('accents', 569, 841, 133, 102, 0.5, 0.5),
  waterSparkle2: frame('accents', 808, 863, 165, 80, 0.5, 0.5),
  waterSparkle3: frame('accents', 1078, 875, 142, 68, 0.5, 0.5),
})

export function assetUrl(key) {
  return ASSET_ROOT + ASSET_FILES[key]
}

export const ALL_ASSET_URLS = Object.freeze(
  Object.fromEntries(Object.keys(ASSET_FILES).map((key) => [key, assetUrl(key)])),
)
