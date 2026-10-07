import assert from 'node:assert/strict'
import {
  calculateWorldCamera,
  resolveWorldCharacterVisualScale,
  resolveWorldVisualScale,
  worldPointToViewport,
  WORLD_CAMERA_HUD_HEIGHT,
  WORLD_CHARACTER_TARGET_HEIGHT,
  WORLD_DEFAULT_VISUAL_SCALE,
  WORLD_VISUAL_SCALES,
} from '../lib/worldMapCamera.mjs'
import { WORLD_MAP_HEIGHT_PX, WORLD_MAP_WIDTH_PX, WORLD_PLAYER } from '../lib/worldMapGeometry.mjs'

const viewports = [[1280, 720], [1440, 900], [1920, 1080], [390, 844], [844, 390]]
assert.deepEqual(WORLD_VISUAL_SCALES, [1])
assert.equal(WORLD_DEFAULT_VISUAL_SCALE, 1)
for (const value of [undefined, '.8', '.75', '1', 2]) assert.equal(resolveWorldVisualScale(value), 1)

const results = []
for (const [viewportWidth, viewportHeight] of viewports) {
  const camera = calculateWorldCamera({ focusX:0, focusY:0, viewportWidth, viewportHeight })
  const movedFocus = calculateWorldCamera({ focusX:WORLD_MAP_WIDTH_PX, focusY:WORLD_MAP_HEIGHT_PX, viewportWidth, viewportHeight })
  assert.deepEqual(
    { x:camera.x, y:camera.y, width:camera.width, height:camera.height },
    { x:0, y:0, width:WORLD_MAP_WIDTH_PX, height:WORLD_MAP_HEIGHT_PX },
    'camera always shows the full logical map',
  )
  assert.deepEqual(camera, movedFocus, 'player position never moves or zooms the camera')
  assert.ok(camera.contentWidth <= camera.sceneWidth + 1e-9)
  assert.ok(camera.contentHeight <= camera.sceneHeight + 1e-9)
  assert.ok(Math.abs(camera.contentWidth / camera.contentHeight - 4 / 3) < 1e-9, 'contain preserves 4:3')

  const topLeft = worldPointToViewport({ x:0, y:0 }, camera)
  const bottomRight = worldPointToViewport({ x:WORLD_MAP_WIDTH_PX, y:WORLD_MAP_HEIGHT_PX }, camera)
  assert.ok(topLeft.x >= 0 && topLeft.y >= WORLD_CAMERA_HUD_HEIGHT)
  assert.ok(bottomRight.x <= viewportWidth && bottomRight.y <= viewportHeight)
  assert.ok(Math.abs(bottomRight.x - topLeft.x - camera.contentWidth) < 1e-6)
  assert.ok(Math.abs(bottomRight.y - topLeft.y - camera.contentHeight) < 1e-6)

  const character = resolveWorldCharacterVisualScale({ viewportWidth, viewportHeight, logicalCharacterHeight:WORLD_PLAYER.height })
  const expectedTarget = viewportWidth <= 720 || viewportHeight - WORLD_CAMERA_HUD_HEIGHT <= 500
    ? WORLD_CHARACTER_TARGET_HEIGHT.mobile
    : WORLD_CHARACTER_TARGET_HEIGHT.desktop
  assert.equal(character.targetScreenHeight, expectedTarget)
  assert.ok(Math.abs(WORLD_PLAYER.height * camera.contentScale * character.visualScale - expectedTarget) < 1e-9)
  results.push({ viewport:`${viewportWidth}x${viewportHeight}`, mapScreenScale:camera.contentScale, characterHeight:expectedTarget })
}

console.log(JSON.stringify({ status:'PASS', results }, null, 2))
