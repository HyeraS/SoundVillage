// Build-only source asset authority. Production clients consume the generated
// lib/worldMapV4Assets.mjs registry and never import this module.

const sourceAsset = ({ id, sourcePath, width, height, sha256 }) => Object.freeze({
  id,
  sourcePath,
  width,
  height,
  sha256,
  hasAlpha: true,
  category: 'landmark',
})

export const WORLD_MAP_V4_HOME_BUILDING_SOURCE_ASSET = sourceAsset({
  id: 'landmark-home-player-building',
  sourcePath: 'design/world-map-v4/source-assets/landmark-home-player-building.png',
  width: 352,
  height: 301,
  sha256: '197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8',
})

export const WORLD_MAP_V4_HOME_SITE_GROUND_SOURCE_ASSET = sourceAsset({
  id: 'landmark-home-player-site-ground',
  sourcePath: 'design/world-map-v4/source-assets/landmark-home-player-site-ground.png',
  width: 512,
  height: 480,
  sha256: '4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b',
})

export const WORLD_MAP_V4_ADDITIVE_SOURCE_ASSETS = Object.freeze([
  WORLD_MAP_V4_HOME_BUILDING_SOURCE_ASSET,
  WORLD_MAP_V4_HOME_SITE_GROUND_SOURCE_ASSET,
])
