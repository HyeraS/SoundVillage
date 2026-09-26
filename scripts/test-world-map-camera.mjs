import assert from 'node:assert/strict'
import { calculateWorldCamera, worldPointToViewport, WORLD_CAMERA_HUD_HEIGHT } from '../lib/worldMapCamera.mjs'
import { WORLD_DESTINATIONS, WORLD_MAP_HEIGHT_PX, WORLD_MAP_WIDTH_PX, WORLD_PLAYER, worldDestinationInteractionPoint } from '../lib/worldMapGeometry.mjs'

const viewports = [[1280, 720], [1440, 900], [390, 844], [844, 390]]
const samples = [
  { id: 'center', x: WORLD_MAP_WIDTH_PX / 2, y: WORLD_MAP_HEIGHT_PX / 2 },
  { id: 'northwest', x: WORLD_PLAYER.width / 2, y: WORLD_PLAYER.height / 2 },
  { id: 'northeast', x: WORLD_MAP_WIDTH_PX - WORLD_PLAYER.width / 2, y: WORLD_PLAYER.height / 2 },
  { id: 'southwest', x: WORLD_PLAYER.width / 2, y: WORLD_MAP_HEIGHT_PX - WORLD_PLAYER.height / 2 },
  { id: 'southeast', x: WORLD_MAP_WIDTH_PX - WORLD_PLAYER.width / 2, y: WORLD_MAP_HEIGHT_PX - WORLD_PLAYER.height / 2 },
  ...WORLD_DESTINATIONS.map(destination => ({ id: destination.id, ...worldDestinationInteractionPoint(destination.target) })),
]

const results = []
for (const [viewportWidth, viewportHeight] of viewports) {
  let expectedFov = null
  for (const sample of samples) {
    const camera = calculateWorldCamera({ focusX: sample.x, focusY: sample.y, viewportWidth, viewportHeight })
    const screen = worldPointToViewport(sample, camera)
    assert.ok(screen.x >= 0 && screen.x <= viewportWidth, `${viewportWidth}x${viewportHeight} ${sample.id} is horizontally visible`)
    assert.ok(screen.y >= WORLD_CAMERA_HUD_HEIGHT && screen.y <= viewportHeight, `${viewportWidth}x${viewportHeight} ${sample.id} is vertically visible`)
    assert.ok(Math.abs(camera.width / camera.height - viewportWidth / (viewportHeight - WORLD_CAMERA_HUD_HEIGHT)) < 1e-9, 'camera and scene aspect ratios match')
    assert.ok(camera.x >= 0 && camera.y >= 0 && camera.x + camera.width <= WORLD_MAP_WIDTH_PX + 1e-6 && camera.y + camera.height <= WORLD_MAP_HEIGHT_PX + 1e-6, 'camera clamps to world')
    const fov = [camera.width / 32, camera.height / 32]
    if (!expectedFov) expectedFov = fov
    else assert.deepEqual(fov, expectedFov, 'focus position does not change FOV')
  }
  results.push({ viewport: `${viewportWidth}x${viewportHeight}`, viewTiles: expectedFov })
}

console.log(JSON.stringify({ status: 'PASS', results }, null, 2))

