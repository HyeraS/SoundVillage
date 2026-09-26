import { T, MAP_W, MAP_H, BUILDINGS, PROPS } from './urbanVillageConfig.mjs'

const BASE = '/assets/urban-city-v2/'

export const URBAN_ASSET_URLS = Object.freeze({
  ground: `${BASE}ground/ground-map-v1.png`,
  metro: `${BASE}transit/metro-layer-v1.png`,
  north: `${BASE}buildings/north-skyline-v1.png`,
  district: `${BASE}buildings/district-buildings-v1.png`,
  vehicles: `${BASE}transit/vehicles-v1.png`,
  streetscape: `${BASE}props/streetscape-v1.png`,
  orb: `${BASE}props/landmark-orb-v1.png`,
  fountain: `${BASE}props/landmark-fountain-v1.png`,
  antennas: `${BASE}props/antenna-family-v1.png`,
  overlays: `${BASE}overlays/shadow-emissive-foreground-v1.png`,
})

let sharedAssetPromise = null

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Unable to load Urban asset: ${src}`))
  image.src = src
})

export function loadUrbanAssetSet() {
  if (!sharedAssetPromise) {
    sharedAssetPromise = Promise.all(Object.entries(URBAN_ASSET_URLS).map(async ([id, src]) => (
      [id, await loadImage(src)]
    ))).then(Object.fromEntries)
  }
  return sharedAssetPromise
}

const rect = (x, y, w, h) => ({ x, y, w, h })
const tileRect = ({ x, y, w, h }) => rect(x * T, y * T, w * T, h * T)

const STATIC_SPRITES = Object.freeze([
  // North skyline: each destination follows the matching collision footprint.
  { id: 'northwest-tower', image: 'north', s: rect(70, 35, 230, 500), d: tileRect(BUILDINGS[0]) },
  { id: 'north-hotel', image: 'north', s: rect(350, 205, 560, 190), d: tileRect(BUILDINGS[1]) },
  { id: 'media-tower', image: 'north', s: rect(915, 90, 235, 330), d: tileRect(BUILDINGS[2]) },
  { id: 'northeast-tower', image: 'north', s: rect(1225, 70, 255, 530), d: tileRect(BUILDINGS[3]) },

  // Four playable districts. The source crops remain discrete; the concept is never used as a background.
  { id: 'media-office', image: 'district', s: rect(240, 140, 440, 360), d: tileRect(BUILDINGS[4]) },
  { id: 'glass-food-court', image: 'district', s: rect(865, 130, 520, 390), d: tileRect(BUILDINGS[5]) },
  { id: 'culture-office', image: 'district', s: rect(145, 530, 625, 470), d: tileRect(BUILDINGS[6]) },
  { id: 'metro-cinema', image: 'district', s: rect(950, 555, 390, 445), d: tileRect(BUILDINGS[7]) },

  // The generated metro is scaled into the rail/stair footprint after the skyline is placed.
  { id: 'elevated-metro', image: 'metro', s: rect(15, 330, 1510, 420), d: rect(8 * T, 3 * T, 32 * T, 10 * T) },
])

const STREET_SOURCES = Object.freeze({
  tree: rect(42, 18, 160, 330),
  lamp: rect(38, 395, 92, 235),
  planter: rect(1000, 455, 300, 115),
  scooter: rect(1260, 905, 240, 135),
})

const VEHICLE_SOURCES = Object.freeze({
  car: rect(125, 190, 125, 190),
  shuttle: rect(1330, 620, 115, 170),
  busA: rect(1040, 200, 120, 410),
  busB: rect(1175, 200, 120, 410),
})

const propDestination = (prop) => {
  const x = prop.x * T
  const y = prop.y * T
  if (prop.kind === 'tree') return rect(x - 20, y - 88, 72, 124)
  if (prop.kind === 'lamp') return rect(x + 2, y - 50, 28, 76)
  if (prop.kind === 'planter') return rect(x, y - 8, prop.w * T, 45)
  if (prop.kind === 'scooter') return rect(x, y - 12, prop.w * T, 48)
  if (prop.kind === 'shuttle') return rect(x, y, prop.w * T, prop.h * T)
  if (prop.kind === 'bus') return rect(x, y, prop.w * T, prop.h * T)
  return tileRect(prop)
}

const Y_SORT_SPRITES = Object.freeze([
  ...PROPS.filter((prop) => ['tree', 'lamp', 'planter', 'scooter', 'shuttle', 'bus'].includes(prop.kind)).map((prop) => ({
    id: prop.tag,
    image: ['shuttle', 'bus'].includes(prop.kind) ? 'vehicles' : 'streetscape',
    s: prop.kind === 'shuttle'
      ? VEHICLE_SOURCES.shuttle
      : prop.kind === 'bus'
        ? (prop.tag.endsWith('a') ? VEHICLE_SOURCES.busA : VEHICLE_SOURCES.busB)
        : STREET_SOURCES[prop.kind],
    d: propDestination(prop),
    anchorY: (prop.y + prop.h) * T,
  })),
  { id: 'media-orb', image: 'orb', s: rect(0, 0, 190, 205), d: rect(6 * T, 17.2 * T, 96, 104), anchorY: 20 * T },
  { id: 'light-fountain', image: 'fountain', s: rect(0, 0, 190, 300), d: rect(22.5 * T, 16.7 * T, 96, 152), anchorY: 21 * T },
  { id: 'west-parked-car', image: 'vehicles', s: VEHICLE_SOURCES.car, d: rect(15.25 * T, 24.8 * T, 48, 78), anchorY: 27.25 * T },
  { id: 'media-antenna-pair', image: 'antennas', s: rect(0, 0, 240, 280), d: rect(9.4 * T, 11.3 * T, 118, 138), anchorY: 16 * T },
])

const FIXED_FOREGROUND = Object.freeze([
  // Only the platform's front lip is repeated above the player; the train and stairs stay in the static pass.
  { id: 'metro-front-lip', image: 'metro', s: rect(15, 455, 1510, 105), d: rect(8 * T, 6.25 * T, 32 * T, 2.25 * T) },
  // Generated lower rail/tree edge gives the entrance a real foreground frame.
  { id: 'south-rail-west', image: 'overlays', s: rect(125, 1040, 500, 85), d: rect(0, 33.8 * T, 19 * T, 2.2 * T) },
  { id: 'south-rail-east', image: 'overlays', s: rect(835, 1040, 585, 85), d: rect(29 * T, 33.8 * T, 19 * T, 2.2 * T) },
])

export const URBAN_RENDER_SPRITES = Object.freeze({
  static: STATIC_SPRITES,
  ySorted: Y_SORT_SPRITES,
  foreground: FIXED_FOREGROUND,
})

function drawSprite(ctx, assets, sprite) {
  const image = assets[sprite.image]
  if (!image) return
  const { s, d } = sprite
  ctx.drawImage(image, s.x, s.y, s.w, s.h, d.x, d.y, d.w, d.h)
}

export function drawUrbanAssetStatic(ctx, assets) {
  if (!ctx || !assets?.ground) return
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, MAP_W * T, MAP_H * T)
  ctx.drawImage(assets.ground, 0, 0, MAP_W * T, MAP_H * T)
  for (const sprite of STATIC_SPRITES) drawSprite(ctx, assets, sprite)
}

export function drawUrbanAssetYSort(ctx, assets, playerY, pass) {
  if (!ctx || !assets) return
  ctx.imageSmoothingEnabled = false
  for (const sprite of Y_SORT_SPRITES) {
    const isAbovePlayer = sprite.anchorY > playerY
    if ((pass === 'below' && !isAbovePlayer) || (pass === 'above' && isAbovePlayer)) {
      drawSprite(ctx, assets, sprite)
    }
  }
  if (pass === 'above') {
    for (const sprite of FIXED_FOREGROUND) drawSprite(ctx, assets, sprite)
  }
}

export function drawUrbanAssetAll(ctx, assets) {
  drawUrbanAssetStatic(ctx, assets)
  drawUrbanAssetYSort(ctx, assets, Number.POSITIVE_INFINITY, 'below')
  drawUrbanAssetYSort(ctx, assets, Number.POSITIVE_INFINITY, 'above')
}

export const URBAN_ASSET_COUNTS = Object.freeze({
  sourceFamilies: Object.keys(URBAN_ASSET_URLS).length,
  staticObjects: STATIC_SPRITES.length,
  ySortedObjects: Y_SORT_SPRITES.length,
  foregroundObjects: FIXED_FOREGROUND.length,
})
