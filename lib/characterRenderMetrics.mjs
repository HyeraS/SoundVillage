export const CHARACTER_RENDER_SOURCE = Object.freeze({ x: 0, y: 0, w: 32, h: 32 })
export const CHARACTER_RENDER_SIZE = Object.freeze({ width: 72, height: 88 })

export const NATURE_CHARACTER_FOV = Object.freeze({ width: 24 * 32, height: 18 * 32 })

const finitePositive = (value, fallback = 1) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/**
 * Nature is the visual authority for player size. These branches intentionally
 * mirror NatureZoneMap's existing camera policy without changing that scene.
 */
export function getNatureReferenceScale(stageWidth, stageHeight) {
  const width = finitePositive(stageWidth)
  const height = finitePositive(stageHeight)
  const portraitPlay = width <= 600 && height > width
  const landscapePlay = width <= 900 && height <= 600
  if (portraitPlay) return height / NATURE_CHARACTER_FOV.height
  if (landscapePlay) return width / NATURE_CHARACTER_FOV.width
  return Math.min(width / NATURE_CHARACTER_FOV.width, height / NATURE_CHARACTER_FOV.height)
}

/**
 * Rendering metrics only: no collision, movement, interaction, spawn or camera
 * geometry is represented here. `worldScale` is for content already inside a
 * scene transform; `screenScale` is for screen-positioned DOM sprites.
 */
export function getCharacterRenderMetrics({ stageWidth, stageHeight, sceneCameraScale = 1 } = {}) {
  const screenScale = getNatureReferenceScale(stageWidth, stageHeight)
  const cameraScale = finitePositive(sceneCameraScale)
  return Object.freeze({
    sourceViewBox: CHARACTER_RENDER_SOURCE,
    wrapperWidth: CHARACTER_RENDER_SIZE.width,
    wrapperHeight: CHARACTER_RENDER_SIZE.height,
    screenScale,
    worldScale: screenScale / cameraScale,
    screenWidth: CHARACTER_RENDER_SIZE.width * screenScale,
    screenHeight: CHARACTER_RENDER_SIZE.height * screenScale,
  })
}

export function placeCharacterAtScreenFoot(footX, footY, metrics) {
  return Object.freeze({
    left: footX - metrics.screenWidth / 2,
    top: footY - metrics.screenHeight,
    footX,
    footY,
  })
}

/**
 * Layout a source viewBox in a viewport using SVG's default
 * preserveAspectRatio="xMidYMid meet" behavior.
 */
export function getMeetLayout({ sourceViewBox = CHARACTER_RENDER_SOURCE, screenWidth, screenHeight } = {}) {
  const sourceX = finiteNumber(sourceViewBox?.x)
  const sourceY = finiteNumber(sourceViewBox?.y)
  const sourceWidth = finitePositive(sourceViewBox?.w)
  const sourceHeight = finitePositive(sourceViewBox?.h)
  const viewportWidth = finitePositive(screenWidth)
  const viewportHeight = finitePositive(screenHeight)
  const contentScale = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight)
  const contentWidth = sourceWidth * contentScale
  const contentHeight = sourceHeight * contentScale
  return Object.freeze({
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    contentScale,
    contentWidth,
    contentHeight,
    contentOffsetX: (viewportWidth - contentWidth) / 2,
    contentOffsetY: (viewportHeight - contentHeight) / 2,
  })
}

/**
 * Convert source alpha bounds to CSS pixels using the same xMidYMid meet
 * mapping as PixelChar's SVG. The wrapper foot remains its bottom center;
 * transparent letterboxing is intentionally preserved.
 */
export function getVisibleBodyCssBounds(metrics, sourceBounds) {
  const source = metrics.sourceViewBox
  const layout = getMeetLayout({
    sourceViewBox: source,
    screenWidth: metrics.screenWidth,
    screenHeight: metrics.screenHeight,
  })
  const boundsX = finiteNumber(sourceBounds?.x, source.x)
  const boundsY = finiteNumber(sourceBounds?.y, source.y)
  const boundsWidth = Math.max(0, finiteNumber(sourceBounds?.w))
  const boundsHeight = Math.max(0, finiteNumber(sourceBounds?.h))
  const x = layout.contentOffsetX + (boundsX - layout.sourceX) * layout.contentScale
  const y = layout.contentOffsetY + (boundsY - layout.sourceY) * layout.contentScale
  const width = boundsWidth * layout.contentScale
  const height = boundsHeight * layout.contentScale
  const right = x + width
  const bottom = y + height
  const wrapperFootX = metrics.screenWidth / 2
  const wrapperFootY = metrics.screenHeight
  return Object.freeze({
    x,
    y,
    width,
    height,
    right,
    bottom,
    contentScale: layout.contentScale,
    contentOffsetX: layout.contentOffsetX,
    contentOffsetY: layout.contentOffsetY,
    wrapperFootX,
    wrapperFootY,
    visibleToWrapperFootGap: wrapperFootY - bottom,
  })
}
