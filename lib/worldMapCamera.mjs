export const WORLD_CAMERA_HUD_HEIGHT = 56

const DESKTOP_FOV = Object.freeze({ width: 30 * 32, height: 22 * 32 })
const MOBILE_PORTRAIT_FOV = Object.freeze({ width: 20 * 32, height: 22 * 32 })
const MOBILE_LANDSCAPE_FOV = Object.freeze({ width: 30 * 32, height: 18 * 32 })
const MAX_FOV = Object.freeze({ width: 48 * 32, height: 48 * 32 })

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/**
 * Match the viewBox to the playable area's aspect ratio. One baseline axis is
 * retained and the other is expanded, avoiding both SVG `slice` cropping and
 * non-uniform image scaling.
 */
export function calculateWorldCameraView({ viewportWidth, viewportHeight, hudHeight = WORLD_CAMERA_HUD_HEIGHT, overview = false }) {
  const width = Math.max(1, Number(viewportWidth) || 1)
  const height = Math.max(1, (Number(viewportHeight) || 1) - (overview ? 0 : hudHeight))
  if (overview) return { viewW: 3840, viewH: 2880, sceneWidth: width, sceneHeight: height, aspect: width / height }

  const aspect = width / height
  const compact = width < 720 || height < 500
  const base = compact
    ? (aspect < 1 ? MOBILE_PORTRAIT_FOV : MOBILE_LANDSCAPE_FOV)
    : DESKTOP_FOV

  let viewW = base.width
  let viewH = base.height
  if (aspect >= base.width / base.height) viewW = viewH * aspect
  else viewH = viewW / aspect

  if (viewW > MAX_FOV.width) {
    viewW = MAX_FOV.width
    viewH = viewW / aspect
  }
  if (viewH > MAX_FOV.height) {
    viewH = MAX_FOV.height
    viewW = viewH * aspect
  }

  return { viewW, viewH, sceneWidth: width, sceneHeight: height, aspect }
}

export function calculateWorldCamera({ focusX, focusY, worldWidth = 3840, worldHeight = 2880, ...viewOptions }) {
  const view = calculateWorldCameraView(viewOptions)
  if (viewOptions.overview) return { x: 0, y: 0, width: worldWidth, height: worldHeight, ...view }
  return {
    x: clamp(focusX - view.viewW / 2, 0, Math.max(0, worldWidth - view.viewW)),
    y: clamp(focusY - view.viewH / 2, 0, Math.max(0, worldHeight - view.viewH)),
    width: view.viewW,
    height: view.viewH,
    ...view,
  }
}

export function worldPointToViewport(point, camera, { hudHeight = WORLD_CAMERA_HUD_HEIGHT, overview = false } = {}) {
  return {
    x: (point.x - camera.x) / camera.width * camera.sceneWidth,
    y: (overview ? 0 : hudHeight) + (point.y - camera.y) / camera.height * camera.sceneHeight,
  }
}

