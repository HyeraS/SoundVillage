import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { BUILDINGS, MAP_H, MAP_W, SPAWN, T, buildVillage, isWalkableTile, moveWithCollision } from '../lib/musicVillageConfig.mjs'
import { requireLoopbackSupabaseUrl } from './security/local-supabase-guard.mjs'

const baseUrl = process.env.MUSIC_NAVIGATION_BASE_URL || 'http://127.0.0.1:3107'
const outputDir = path.resolve(process.env.MUSIC_NAVIGATION_OUTPUT_DIR || '_review/music-png-navigation-mask')
await requireLoopbackSupabaseUrl(baseUrl, 'MUSIC_NAVIGATION_BASE_URL')
await fs.mkdir(outputDir, { recursive: true })

const directions = Object.freeze({
  '1,0': { key: 'ArrowRight', axis: 'x', sign: 1 },
  '-1,0': { key: 'ArrowLeft', axis: 'x', sign: -1 },
  '0,1': { key: 'ArrowDown', axis: 'y', sign: 1 },
  '0,-1': { key: 'ArrowUp', axis: 'y', sign: -1 },
})
const village = buildVillage()
// Music's authored spawn uses a foot anchor 20px below each tile origin. Keep
// that anchor throughout the browser route so turns do not drift vertically.
const tileWorldPosition = ([tx, ty], offsetX = 0, offsetY = 0) => ({ x: (tx + .5) * T + offsetX, y: ty * T + 20 + offsetY })

function isRobustRouteEdge(from, to) {
  for (const offsetX of [-2, 0, 2]) {
    for (const offsetY of [-2, 0, 2]) {
      const start = tileWorldPosition(from, offsetX, offsetY)
      const target = tileWorldPosition(to, offsetX, offsetY)
      const result = moveWithCollision(village, start, target.x - start.x, target.y - start.y)
      if (Math.hypot(result.x - target.x, result.y - target.y) > .01) return false
    }
  }
  return true
}

function findRoute(start, target) {
  const queue = [start]
  const parents = new Map([[start.join(','), null]])
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    if (current[0] === target[0] && current[1] === target[1]) {
      const route = []
      let cursor = current
      while (cursor) {
        route.push(cursor)
        cursor = parents.get(cursor.join(','))
      }
      return route.reverse()
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [current[0] + dx, current[1] + dy]
      const key = next.join(',')
      if (next[0] >= 0 && next[1] >= 0 && next[0] < MAP_W && next[1] < MAP_H && !parents.has(key) && isRobustRouteEdge(current, next)) {
        parents.set(key, current)
        queue.push(next)
      }
    }
  }
  assert.fail(`no static route from ${start} to ${target}`)
}

const entranceTarget = (id, preferred) => {
  const building = BUILDINGS.find((candidate) => candidate.id === id)
  assert.ok(building, `${id} exists`)
  assert.ok(isWalkableTile(...preferred), `${id} preferred entrance tile is walkable`)
  return preferred
}

const checkpoints = Object.freeze([
  { name: 'community-studio', tile: entranceTarget('community-studio', [14, 30]) },
  { name: 'record-archive', tile: entranceTarget('record-archive', [7, 10]) },
  { name: 'stage-spine', tile: [24, 11] },
  { name: 'listening-cafe', tile: entranceTarget('listening-cafe', [38, 11]) },
  { name: 'sound-workshop', tile: entranceTarget('sound-workshop', [34, 30]) },
  { name: 'south-gate', tile: [24, 33] },
])

const playerSelector = '[data-testid="music-player"]'

async function playerPosition(page) {
  return page.locator(playerSelector).evaluate((node) => ({ x: Number(node.dataset.worldX), y: Number(node.dataset.worldY) }))
}

async function walkStep(page, from, to) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const direction = directions[`${dx},${dy}`]
  assert.ok(direction, `route edge ${from} -> ${to} is cardinal`)
  const target = tileWorldPosition(to)[direction.axis]
  await page.keyboard.down(direction.key)
  try {
    await page.waitForFunction(
      ({ selector, axis, sign, targetValue }) => {
        const node = document.querySelector(selector)
        const value = Number(axis === 'x' ? node?.dataset.worldX : node?.dataset.worldY)
        return Number.isFinite(value) && (sign > 0 ? value >= targetValue - 2 : value <= targetValue + 2)
      },
      { selector: playerSelector, axis: direction.axis, sign: direction.sign, targetValue: target },
      { timeout: 5_000 },
    )
  } catch (error) {
    const diagnostic = await page.locator(playerSelector).evaluate((node) => ({
      x: node.dataset.worldX,
      y: node.dataset.worldY,
      blocked: node.dataset.movementBlocked,
      collision: node.dataset.collisionId,
    }))
    throw new Error(`browser route stalled at ${from} -> ${to}: ${JSON.stringify(diagnostic)}`, { cause: error })
  } finally {
    await page.keyboard.up(direction.key)
  }
  const actual = await playerPosition(page)
  assert.ok(Math.abs(actual[direction.axis] - target) <= 7, `${from} -> ${to} reached ${direction.axis}=${target}, actual=${actual[direction.axis]}`)
}

let browser
try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })

  await page.goto(new URL('/music-test', baseUrl).href, { waitUntil: 'domcontentloaded' })
  await page.locator(`${playerSelector} [data-pixel-character]`).waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1_000)
  await page.screenshot({ path: path.join(outputDir, 'after-runtime.png') })
  await page.locator('[data-testid="music-debug-toggle"]').click()
  await page.screenshot({ path: path.join(outputDir, 'after-debug.png') })
  await page.locator('[data-testid="music-debug-toggle"]').click()

  let current = [SPAWN.tx, SPAWN.ty]
  const results = []
  for (const checkpoint of checkpoints) {
    const route = findRoute(current, checkpoint.tile)
    console.log(`[music-navigation] walking ${checkpoint.name}: ${route.length - 1} tile steps`)
    for (let index = 1; index < route.length; index++) await walkStep(page, route[index - 1], route[index])
    const position = await playerPosition(page)
    const expected = tileWorldPosition(checkpoint.tile)
    assert.ok(Math.hypot(position.x - expected.x, position.y - expected.y) <= 10, `${checkpoint.name} reached in the real browser`)
    results.push({ name: checkpoint.name, tile: checkpoint.tile, steps: route.length - 1, position })
    current = checkpoint.tile
  }

  await page.keyboard.down('ArrowDown')
  try {
    await page.getByText('월드맵으로 돌아갈까요?').waitFor({ timeout: 5_000 })
  } finally {
    await page.keyboard.up('ArrowDown')
  }
  results.push({ name: 'south-exit-trigger', position: await playerPosition(page), modal: true })

  assert.deepEqual(browserErrors, [], `browser errors: ${JSON.stringify(browserErrors)}`)
  console.log(JSON.stringify({ ok: true, checkpoints: results }, null, 2))
} finally {
  await browser?.close().catch(() => {})
}
