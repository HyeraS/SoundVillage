import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  CHARACTER_RENDER_SIZE,
  CHARACTER_RENDER_SOURCE,
  getCharacterRenderMetrics,
  getMeetLayout,
  getNatureReferenceScale,
  getVisibleBodyCssBounds,
  placeCharacterAtScreenFoot,
} from '../lib/characterRenderMetrics.mjs'
import { calculateWorldCameraView } from '../lib/worldMapCamera.mjs'
import { WORLD_PLAYER, WORLD_SPAWN } from '../lib/worldMapGeometry.mjs'
import {
  getMusicCamera,
  MUSIC_PLAYER_H,
  MUSIC_PLAYER_SOURCE,
  MUSIC_PLAYER_W,
  PLAYER_BOX as MUSIC_PLAYER_BOX,
  INTERACTION_RADIUS as MUSIC_INTERACTION_RADIUS,
  SPAWN as MUSIC_SPAWN,
} from '../lib/musicVillageConfig.mjs'
import { labCamera, PLAYER_BOX as LAB_PLAYER_BOX, SPAWN as LAB_SPAWN } from '../lib/labVillageConfig.mjs'
import { PLAYER_BOX as NATURE_PLAYER_BOX } from '../lib/natureFarmLayout.mjs'
import { PLAYER_BOX as ANIMAL_PLAYER_BOX } from '../lib/animalVillageSunflowerConfig.mjs'
import { PLAYER_BOX as HUMAN_PLAYER_BOX, INTERACTION_BOX as HUMAN_INTERACTION_BOX } from '../lib/humanVillageConfig.mjs'
import { PLAYER_BOX as URBAN_PLAYER_BOX, INTERACTION_BOX as URBAN_INTERACTION_BOX } from '../lib/urbanVillageConfig.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HUD_HEIGHT = 56
const FRAME_SIZE = 32
const VIEWPORTS = Object.freeze([
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
const ROWS = Object.freeze({ down: 0, up: 1, right: 2, left: 3 })

const LOADOUTS = Object.freeze({
  default: [
    'public/assets/world/player_body.png',
    'public/assets/world/player_clothes.png',
    'public/assets/world/player_hair.png',
  ],
  layeredV2: [
    'public/assets/character-v2/skin/skin-02-walk.png',
    'public/assets/character-v2/eyes/red-walk.png',
    'public/assets/character-v2/outfits/skirt-walk.png',
    'public/assets/character-v2/hair/bob/black-walk.png',
    'public/assets/character-v2/accessories/hat_cowboy-walk.png',
  ],
})

async function loadAlpha(file) {
  const { data, info } = await sharp(path.join(ROOT, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

function frameUnionBounds(images, row, frame) {
  let minX = FRAME_SIZE
  let minY = FRAME_SIZE
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const sourceX = frame * FRAME_SIZE + x
      const sourceY = row * FRAME_SIZE + y
      const visible = images.some((image) => image.data[(sourceY * image.width + sourceX) * image.channels + 3] > 0)
      if (!visible) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  assert.ok(maxX >= minX && maxY >= minY, `frame ${frame}, row ${row} has visible alpha`)
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function sceneCameraScales(stageWidth, stageHeight) {
  const nature = getNatureReferenceScale(stageWidth, stageHeight)
  const animal = Math.min(stageWidth / (24 * 32), stageHeight / (18 * 32))
  const humanViewHeight = 18 * 32
  const humanViewWidth = Math.min(24 * 32, humanViewHeight * stageWidth / stageHeight)
  const human = Math.min(stageWidth / humanViewWidth, stageHeight / humanViewHeight)
  const urban = stageHeight / (18 * 32)
  const music = getMusicCamera({ cssWidth: stageWidth, cssHeight: stageHeight, playerX: 24 * 32, playerY: 18 * 32 }).scale
  const lab = labCamera(stageWidth, stageHeight, LAB_SPAWN).zoom
  const worldView = calculateWorldCameraView({ viewportWidth: stageWidth, viewportHeight: stageHeight + HUD_HEIGHT, hudHeight: HUD_HEIGHT })
  const world = worldView.sceneWidth / worldView.viewW
  return { World: world, Nature: nature, Animal: animal, Human: human, Urban: urban, Music: music, Lab: lab }
}

const alphaBounds = {}
for (const [loadout, files] of Object.entries(LOADOUTS)) {
  const images = await Promise.all(files.map(loadAlpha))
  alphaBounds[loadout] = {}
  for (const [direction, row] of Object.entries(ROWS)) {
    alphaBounds[loadout][direction] = Array.from({ length: 8 }, (_, frame) => frameUnionBounds(images, row, frame))
  }
}

assert.deepEqual(alphaBounds.default.down[0], { x: 9, y: 12, w: 14, h: 20 })
assert.deepEqual(alphaBounds.layeredV2.down[0], { x: 8, y: 9, w: 16, h: 23 })
assert.deepEqual(MUSIC_PLAYER_SOURCE, CHARACTER_RENDER_SOURCE, 'Music no longer clips Character V2 alpha')
assert.deepEqual({ width: MUSIC_PLAYER_W, height: MUSIC_PLAYER_H }, CHARACTER_RENDER_SIZE)

const logicalMetrics = getCharacterRenderMetrics({ stageWidth: 768, stageHeight: 576, sceneCameraScale: 1 })
const logicalDefault = getVisibleBodyCssBounds(logicalMetrics, alphaBounds.default.down[0])
const logicalV2 = getVisibleBodyCssBounds(logicalMetrics, alphaBounds.layeredV2.down[0])
assert.deepEqual(
  { width: logicalDefault.width, height: logicalDefault.height, bottom: logicalDefault.bottom, gap: logicalDefault.visibleToWrapperFootGap },
  { width: 31.5, height: 45, bottom: 80, gap: 8 },
  'default idle uses the real 72x72 xMidYMid meet content box',
)
assert.deepEqual(
  { width: logicalV2.width, height: logicalV2.height, bottom: logicalV2.bottom, gap: logicalV2.visibleToWrapperFootGap },
  { width: 36, height: 51.75, bottom: 80, gap: 8 },
  'Character V2 representative frame uses the same meet layout and foot gap',
)
assert.deepEqual(getMeetLayout({ sourceViewBox: CHARACTER_RENDER_SOURCE, screenWidth: 72, screenHeight: 88 }), {
  sourceX: 0,
  sourceY: 0,
  sourceWidth: 32,
  sourceHeight: 32,
  viewportWidth: 72,
  viewportHeight: 88,
  contentScale: 2.25,
  contentWidth: 72,
  contentHeight: 72,
  contentOffsetX: 0,
  contentOffsetY: 8,
})

const audit = { viewports: [], alphaBounds }
for (const viewport of VIEWPORTS) {
  const stageWidth = viewport.width
  const stageHeight = viewport.height - HUD_HEIGHT
  const cameraScales = sceneCameraScales(stageWidth, stageHeight)
  const natureScale = cameraScales.Nature
  const normalizedFoot = { x: stageWidth / 2, y: stageHeight / 2 }
  const natureBounds = alphaBounds.default.down[0]
  const natureMetrics = getCharacterRenderMetrics({ stageWidth, stageHeight, sceneCameraScale: natureScale })
  const natureBody = getVisibleBodyCssBounds(natureMetrics, natureBounds)

  for (const [scene, cameraScale] of Object.entries(cameraScales)) {
    const metrics = getCharacterRenderMetrics({ stageWidth, stageHeight, sceneCameraScale: cameraScale })
    const body = getVisibleBodyCssBounds(metrics, natureBounds)
    const placement = placeCharacterAtScreenFoot(normalizedFoot.x, normalizedFoot.y, metrics)
    assert.ok(Math.abs(body.width - natureBody.width) <= Math.max(1, natureBody.width * .02), `${scene} width matches Nature at ${viewport.width}x${viewport.height}`)
    assert.ok(Math.abs(body.height - natureBody.height) <= Math.max(1, natureBody.height * .02), `${scene} height matches Nature at ${viewport.width}x${viewport.height}`)
    assert.ok(Math.abs(body.visibleToWrapperFootGap - natureBody.visibleToWrapperFootGap) <= 1, `${scene} visible-to-gameplay-foot gap matches Nature`)
    assert.ok(Math.abs(placement.left + metrics.screenWidth / 2 - normalizedFoot.x) <= 1, `${scene} foot X is anchored`)
    assert.ok(Math.abs(placement.top + metrics.screenHeight - normalizedFoot.y) <= 1, `${scene} foot Y is anchored`)
    assert.ok(Math.abs(metrics.worldScale * cameraScale - natureScale) < 1e-9, `${scene} render scale is independent of its camera`)
    audit.viewports.push({
      viewport: `${viewport.width}x${viewport.height}`,
      scene,
      logical: `${metrics.wrapperWidth}x${metrics.wrapperHeight}`,
      source: `${metrics.sourceViewBox.x},${metrics.sourceViewBox.y},${metrics.sourceViewBox.w},${metrics.sourceViewBox.h}`,
      cameraScale,
      renderScale: metrics.worldScale,
      wrapperCss: `${metrics.screenWidth}x${metrics.screenHeight}`,
      visibleCss: `${body.width}x${body.height}`,
      visibleBottomGap: body.visibleToWrapperFootGap,
      foot: `${normalizedFoot.x},${normalizedFoot.y}`,
      ratio: `${body.width / natureBody.width}x${body.height / natureBody.height}`,
    })
  }

  for (const loadout of Object.values(alphaBounds)) {
    for (const frames of Object.values(loadout)) {
      for (const bounds of frames) {
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.w <= 32 && bounds.y + bounds.h <= 32, 'full frame does not clip any tested layer alpha')
        const baseline = getVisibleBodyCssBounds(getCharacterRenderMetrics({ stageWidth, stageHeight, sceneCameraScale: natureScale }), bounds)
        for (const cameraScale of Object.values(cameraScales)) {
          const actual = getVisibleBodyCssBounds(getCharacterRenderMetrics({ stageWidth, stageHeight, sceneCameraScale: cameraScale }), bounds)
          assert.equal(actual.width, baseline.width, 'idle/walk direction width remains scene-independent')
          assert.equal(actual.height, baseline.height, 'idle/walk direction height remains scene-independent')
          assert.equal(actual.visibleToWrapperFootGap, baseline.visibleToWrapperFootGap, 'frame foot gap remains scene-independent')
        }
      }
    }
  }
}

for (const input of [
  {},
  { stageWidth: 0, stageHeight: 0, sceneCameraScale: 0 },
  { stageWidth: Number.NaN, stageHeight: Number.POSITIVE_INFINITY, sceneCameraScale: Number.NaN },
  { stageWidth: -1, stageHeight: -1, sceneCameraScale: -1 },
]) {
  const metrics = getCharacterRenderMetrics(input)
  const body = getVisibleBodyCssBounds(metrics, { x: 9, y: 12, w: 14, h: 20 })
  assert.ok(Object.values(metrics).filter((value) => typeof value === 'number').every(Number.isFinite), 'invalid metrics input stays finite')
  assert.ok(Object.values(body).every(Number.isFinite), 'invalid visible bounds stay finite')
}

// Gameplay geometry remains on its original contracts; render metrics do not
// participate in collision, speed, interaction, spawn or auto-walk math.
assert.deepEqual(WORLD_PLAYER, { width: 72, height: 88, footWidth: 28, footHeight: 16 })
assert.deepEqual(WORLD_SPAWN, { tx: 60, ty: 47 })
assert.deepEqual(NATURE_PLAYER_BOX, { w: 18, h: 10 })
assert.deepEqual(ANIMAL_PLAYER_BOX, { w: 20, h: 14 })
assert.deepEqual(HUMAN_PLAYER_BOX, { w: 20, h: 14 })
assert.deepEqual(HUMAN_INTERACTION_BOX, { w: 28, h: 28 })
assert.deepEqual(URBAN_PLAYER_BOX, { w: 20, h: 14 })
assert.deepEqual(URBAN_INTERACTION_BOX, { w: 28, h: 28 })
assert.deepEqual(MUSIC_PLAYER_BOX, { w: 12, h: 8 })
assert.equal(MUSIC_INTERACTION_RADIUS, 112)
assert.deepEqual(MUSIC_SPAWN, { x: 784, y: 948, tx: 24, ty: 29 })
assert.deepEqual(LAB_PLAYER_BOX, { w: 20, h: 14 })
assert.deepEqual(LAB_SPAWN, { x: 768, y: 1008 })

console.log(JSON.stringify({ pass: true, alphaBounds, audit }, null, 2))
