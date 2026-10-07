export const WORLD_CAMERA_HUD_HEIGHT = 56
export const WORLD_LOGICAL_WIDTH = 3840
export const WORLD_LOGICAL_HEIGHT = 2880
export const WORLD_DEFAULT_VISUAL_SCALE = 1
export const WORLD_VISUAL_SCALES = Object.freeze([1])
export const WORLD_CHARACTER_TARGET_HEIGHT = Object.freeze({ desktop: 52, mobile: 40 })

// Compatibility export for older QA callers. The released world map has one
// fixed full-map camera and no URL-controlled zoom levels.
export function resolveWorldVisualScale() {
  return WORLD_DEFAULT_VISUAL_SCALE
}

export function calculateWorldCameraView({
  viewportWidth,
  viewportHeight,
  hudHeight = WORLD_CAMERA_HUD_HEIGHT,
  overview = false,
  worldWidth = WORLD_LOGICAL_WIDTH,
  worldHeight = WORLD_LOGICAL_HEIGHT,
} = {}) {
  const sceneWidth = Math.max(1, Number(viewportWidth) || 1)
  const sceneHeight = Math.max(1, (Number(viewportHeight) || 1) - (overview ? 0 : hudHeight))
  const viewW = Math.max(1, Number(worldWidth) || WORLD_LOGICAL_WIDTH)
  const viewH = Math.max(1, Number(worldHeight) || WORLD_LOGICAL_HEIGHT)
  const contentScale = Math.min(sceneWidth / viewW, sceneHeight / viewH)
  const contentWidth = viewW * contentScale
  const contentHeight = viewH * contentScale
  return Object.freeze({
    viewW,
    viewH,
    sceneWidth,
    sceneHeight,
    aspect: sceneWidth / sceneHeight,
    contentScale,
    contentWidth,
    contentHeight,
    contentOffsetX: (sceneWidth - contentWidth) / 2,
    contentOffsetY: (sceneHeight - contentHeight) / 2,
    visualScale: WORLD_DEFAULT_VISUAL_SCALE,
  })
}

export function calculateWorldCamera({ worldWidth = WORLD_LOGICAL_WIDTH, worldHeight = WORLD_LOGICAL_HEIGHT, ...viewOptions } = {}) {
  const view = calculateWorldCameraView({ ...viewOptions, worldWidth, worldHeight })
  return Object.freeze({ x:0, y:0, width:worldWidth, height:worldHeight, ...view })
}

export function resolveWorldCharacterVisualScale({
  viewportWidth,
  viewportHeight,
  hudHeight = WORLD_CAMERA_HUD_HEIGHT,
  logicalCharacterHeight = 88,
  overview = false,
} = {}) {
  const view = calculateWorldCameraView({ viewportWidth, viewportHeight, hudHeight, overview })
  const compact = view.sceneWidth <= 720 || view.sceneHeight <= 500
  const targetScreenHeight = compact
    ? WORLD_CHARACTER_TARGET_HEIGHT.mobile
    : WORLD_CHARACTER_TARGET_HEIGHT.desktop
  const visualScale = targetScreenHeight / (logicalCharacterHeight * view.contentScale)
  return Object.freeze({ visualScale, targetScreenHeight, mapScreenScale:view.contentScale })
}

export function worldPointToViewport(point, camera, { hudHeight = WORLD_CAMERA_HUD_HEIGHT, overview = false } = {}) {
  return {
    x: camera.contentOffsetX + (point.x - camera.x) * camera.contentScale,
    y: (overview ? 0 : hudHeight) + camera.contentOffsetY + (point.y - camera.y) * camera.contentScale,
  }
}
