import {
  T, MAP_W, MAP_H, WORLD_W, WORLD_H, PLAYER_BOX, INTERACTION_BOX, INTERACTION_RADIUS,
  MUSIC_PLAYER_SOURCE, MUSIC_PLAYER_W, MUSIC_PLAYER_H, MUSIC_PLAYER_VISIBLE_H,
  NAV_CELL, NAV_COLS, NAV_ROWS, NAV_TYPES, NAVIGATION_MASK,
  STAGE, GATE, BUILDINGS, PROPS, SCENE_TREES, PROP_COLLIDERS, TREE_TRUNK_COLLIDERS, BLOCKING_PROP_COLLIDERS, SPAWN, EXIT_TRIGGER,
  COLLIDERS, TERRAIN_FEATURES, PLANTED_LANDSCAPE_FEATURES, TREE_GROVE_FEATURES, TREE_TRUNK_CORE_FEATURES, ROAD_POLYGONS, PRIORITY_WALKABLE_PATHS, SLOT_GROUPS, PRIMARY_SLOTS, RESERVE_SLOTS, ALL_SAFE_SLOTS,
  OCCLUSION_OBJECTS, SILHOUETTE_ENTER_RATIO, SILHOUETTE_EXIT_RATIO,
  splitOcclusionObjects, occludingObjectsAtPlayer, measureOcclusionAtPlayer, resolveOcclusionState,
  getNavigationTypeAtWorld, getNavigationCellAtWorld, isNavigationWalkable, terrainSpeedAt, getPlayerFootRect,
  isWalkableTile, isSafeMarkerSlot, spawnMusicItems, distanceToMusicItem, isMusicItemNearby, markerStateFor, validateSlotSet,
  buildVillage, collides, moveWithCollision, moveWithCollisionDetailed, overlapsExitTrigger,
  getMusicCamera, worldToMusicScreen, getMusicPlayerPlacement,
} from './musicVillageConfig.mjs'

export {
  T, MAP_W, MAP_H, WORLD_W, WORLD_H, PLAYER_BOX, INTERACTION_BOX, INTERACTION_RADIUS,
  MUSIC_PLAYER_SOURCE, MUSIC_PLAYER_W, MUSIC_PLAYER_H, MUSIC_PLAYER_VISIBLE_H,
  NAV_CELL, NAV_COLS, NAV_ROWS, NAV_TYPES, NAVIGATION_MASK,
  STAGE, GATE, BUILDINGS, PROPS, SCENE_TREES, PROP_COLLIDERS, TREE_TRUNK_COLLIDERS, BLOCKING_PROP_COLLIDERS, SPAWN, EXIT_TRIGGER,
  COLLIDERS, TERRAIN_FEATURES, PLANTED_LANDSCAPE_FEATURES, TREE_GROVE_FEATURES, TREE_TRUNK_CORE_FEATURES, ROAD_POLYGONS, PRIORITY_WALKABLE_PATHS, SLOT_GROUPS, PRIMARY_SLOTS, RESERVE_SLOTS, ALL_SAFE_SLOTS,
  OCCLUSION_OBJECTS, SILHOUETTE_ENTER_RATIO, SILHOUETTE_EXIT_RATIO,
  splitOcclusionObjects, occludingObjectsAtPlayer, measureOcclusionAtPlayer, resolveOcclusionState,
  getNavigationTypeAtWorld, getNavigationCellAtWorld, isNavigationWalkable, terrainSpeedAt, getPlayerFootRect,
  isWalkableTile, isSafeMarkerSlot, spawnMusicItems, distanceToMusicItem, isMusicItemNearby, markerStateFor, validateSlotSet,
  buildVillage, collides, moveWithCollision, moveWithCollisionDetailed, overlapsExitTrigger,
  getMusicCamera, worldToMusicScreen, getMusicPlayerPlacement,
}

export const MUSIC_ASSET_ROOT = '/assets/music-village-moonlit-v3'
const GROUND_CHUNKS = Object.freeze([
  { id: 'nw', x: 0, y: 0 }, { id: 'ne', x: MAP_W * T / 2, y: 0 },
  { id: 'sw', x: 0, y: MAP_H * T / 2 }, { id: 'se', x: MAP_W * T / 2, y: MAP_H * T / 2 },
])

const assetUrl = (path) => `${MUSIC_ASSET_ROOT}/${path}`
const chunkUrl = (id) => assetUrl(`ground/chunk-${id}.png`)
const foregroundUrl = assetUrl('foreground/occlusion.png')

export const MUSIC_ASSET_URLS = Object.freeze([
  ...GROUND_CHUNKS.map(({ id }) => chunkUrl(id)),
  foregroundUrl,
])

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve({ url, image, ok: true })
    image.onerror = () => resolve({ url, image: null, ok: false })
    image.src = url
  })
}

export async function preloadMusicAssets() {
  const results = await Promise.all(MUSIC_ASSET_URLS.map(loadImage))
  const assets = {
    images: new Map(results.filter((result) => result.ok).map((result) => [result.url, result.image])),
    failed: results.filter((result) => !result.ok).map((result) => result.url),
  }
  const foreground = assets.images.get(foregroundUrl)
  if (foreground) {
    const canvas = document.createElement('canvas')
    canvas.width = WORLD_W
    canvas.height = WORLD_H
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(foreground, 0, 0)
    assets.foregroundAlpha = context.getImageData(0, 0, WORLD_W, WORLD_H).data
  }
  return assets
}

export function foregroundAlphaAt(assets, x, y) {
  const px = Math.floor(x)
  const py = Math.floor(y)
  if (!assets?.foregroundAlpha || px < 0 || py < 0 || px >= WORLD_W || py >= WORLD_H) return 0
  return assets.foregroundAlpha[(py * WORLD_W + px) * 4 + 3]
}

export function getOcclusionState(assets, playerX, playerY, wasActive = false) {
  const measurement = measureOcclusionAtPlayer(playerX, playerY, (x, y) => foregroundAlphaAt(assets, x, y))
  return resolveOcclusionState(measurement, wasActive)
}

const drawImage = (ctx, assets, url, x, y) => {
  const image = assets?.images?.get(url)
  if (image) ctx.drawImage(image, x, y)
}

export function drawStatic(ctx, _village, assets) {
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#07152f'
  ctx.fillRect(0, 0, MAP_W * T, MAP_H * T)
  for (const chunk of GROUND_CHUNKS) drawImage(ctx, assets, chunkUrl(chunk.id), chunk.x, chunk.y)
}

export function drawOcclusionObject(ctx, assets, object) {
  const image = assets?.images?.get(foregroundUrl)
  if (!image) return
  const source = object.source
  const display = object.display
  ctx.drawImage(image, source.x, source.y, source.w, source.h, display.x, display.y, display.w, display.h)
}

export function drawDepthLayer(ctx, assets, objects, markerEntries, now) {
  const entries = [
    ...objects.map((object) => ({ sortY: object.sortY, type: 'occlusion', object })),
    ...markerEntries.map((entry) => ({ sortY: (entry.item.ty + .5) * T, type: 'marker', ...entry })),
  ].sort((a, b) => a.sortY - b.sortY)
  for (const entry of entries) {
    if (entry.type === 'occlusion') drawOcclusionObject(ctx, assets, entry.object)
    else drawMarker(ctx, entry.item, entry.state, now)
  }
}

const MARKER_COLORS = Object.freeze({
  active: '#65d4df', nearby: '#ffe18a', interacting: '#c4a8e8', completed: '#7f8996', distant: '#8fb9c6',
})

export function drawMarker(ctx, item, state, now) {
  if (state === 'unavailable' || state === 'hidden') return
  const color = MARKER_COLORS[state] || MARKER_COLORS.active
  const pulse = state === 'nearby' ? 1 + Math.sin(now / 170 + item.phase) * 0.08 : 1
  const x = item.tx * T + T / 2
  const y = item.ty * T + T / 2
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(pulse, pulse)
  ctx.globalAlpha = state === 'completed' ? .38 : state === 'distant' ? .2 : 1
  ctx.fillStyle = 'rgba(25,34,54,.88)'
  ctx.strokeStyle = color
  ctx.lineWidth = state === 'nearby' ? 3 : 2
  ctx.beginPath()
  ctx.moveTo(0, -12); ctx.lineTo(10, -3); ctx.lineTo(6, 9); ctx.lineTo(0, 13)
  ctx.lineTo(-6, 9); ctx.lineTo(-10, -3); ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  if (state === 'completed') {
    ctx.moveTo(-4, 0); ctx.lineTo(-1, 4); ctx.lineTo(5, -4)
  } else if (state === 'interacting') {
    ctx.moveTo(-3, -4); ctx.lineTo(-3, 4); ctx.moveTo(3, -4); ctx.lineTo(3, 4)
  } else {
    ctx.moveTo(1, -6); ctx.lineTo(1, 5)
    ctx.quadraticCurveTo(-5, 2, -5, 7)
    ctx.quadraticCurveTo(-5, 11, -1, 9)
  }
  ctx.stroke()
  ctx.restore()
}

export function drawEnvironment(ctx, now, { reducedMotion = false, player = null, terrain = NAV_TYPES.ROAD, moving = false } = {}) {
  const phase = reducedMotion ? 0 : now / 1000
  ctx.save()
  // Equalizer fountain: a restrained halo and water rings on a tiny overlay.
  const fountainX = 24 * T
  const fountainY = 20 * T
  const glow = reducedMotion ? .11 : .10 + Math.sin(phase * 1.4) * .025
  const fountainGradient = ctx.createRadialGradient(fountainX, fountainY, 12, fountainX, fountainY, 116)
  fountainGradient.addColorStop(0, `rgba(101,220,255,${glow + .06})`)
  fountainGradient.addColorStop(1, 'rgba(93,99,231,0)')
  ctx.fillStyle = fountainGradient
  ctx.beginPath(); ctx.arc(fountainX, fountainY, 116, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = `rgba(146,236,255,${glow + .08})`
  ctx.lineWidth = 2
  for (let index = 0; index < 3; index++) {
    const radius = 27 + index * 18 + (reducedMotion ? 0 : (phase * 8) % 16)
    ctx.beginPath(); ctx.ellipse(fountainX, fountainY + 6, radius, radius * .38, 0, 0, Math.PI * 2); ctx.stroke()
  }
  // Stage light breath and lamp halos reuse the static painting underneath.
  ctx.fillStyle = `rgba(199,128,255,${reducedMotion ? .035 : .035 + Math.sin(phase * .65) * .012})`
  ctx.fillRect(18 * T, 4 * T, 12 * T, 4 * T)
  for (const lamp of PROPS.filter((item) => item.id === 'lamp-low-a')) {
    const x = (lamp.x + .5) * T
    const y = (lamp.top + .48) * T
    const alpha = reducedMotion ? .08 : .075 + Math.sin(phase * 1.2 + x) * .012
    const light = ctx.createRadialGradient(x, y, 1, x, y, 34)
    light.addColorStop(0, `rgba(255,218,116,${alpha})`)
    light.addColorStop(1, 'rgba(255,190,80,0)')
    ctx.fillStyle = light; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill()
  }
  // A short-lived foot response communicates road versus grass without a
  // world-sized animation layer.
  if (player && moving && !reducedMotion) {
    const dust = terrain === NAV_TYPES.GRASS ? 'rgba(113,191,135,.42)' : 'rgba(223,190,153,.3)'
    ctx.fillStyle = dust
    for (let index = 0; index < 3; index++) {
      const sway = Math.sin(phase * 8 + index * 2.1)
      ctx.beginPath(); ctx.arc(player.x + sway * (5 + index * 2), player.y + 1 - index * 3, 1.4 + index * .35, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}

const DEBUG_COLORS = Object.freeze({
  [NAV_TYPES.BLOCKED]: 'rgba(239,68,68,.28)',
  [NAV_TYPES.ROAD]: 'rgba(96,165,250,.16)',
  [NAV_TYPES.GRASS]: 'rgba(74,222,128,.16)',
  [NAV_TYPES.WATER]: 'rgba(14,165,233,.3)',
  [NAV_TYPES.INTERACTION]: 'rgba(250,204,21,.34)',
  [NAV_TYPES.VEGETATION]: 'rgba(168,85,247,.3)',
})

const NAV_TYPE_NAMES = Object.freeze({
  [NAV_TYPES.BLOCKED]: 'blocked', [NAV_TYPES.ROAD]: 'road', [NAV_TYPES.GRASS]: 'grass',
  [NAV_TYPES.WATER]: 'water', [NAV_TYPES.INTERACTION]: 'interaction',
  [NAV_TYPES.VEGETATION]: 'vegetation',
})

function strokePolygon(ctx, points) {
  if (!points.length) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y)
  ctx.closePath()
  ctx.stroke()
}

export function drawNavigationDebug(ctx, { player = null, collision = null, occlusion = null } = {}) {
  ctx.save()
  const stride = Math.max(1, Math.round(16 / NAV_CELL))
  for (let row = 0; row < NAV_ROWS; row += stride) {
    for (let col = 0; col < NAV_COLS; col += stride) {
      ctx.fillStyle = DEBUG_COLORS[NAVIGATION_MASK[row * NAV_COLS + col]]
      ctx.fillRect(col * NAV_CELL, row * NAV_CELL, NAV_CELL * stride, NAV_CELL * stride)
    }
  }
  ctx.lineWidth = 1.5
  ctx.font = '700 8px ui-monospace, monospace'
  ctx.textBaseline = 'bottom'
  for (const feature of TERRAIN_FEATURES) {
    ctx.strokeStyle = feature.type === 'water' ? '#38bdf8' : ['vegetation', 'tree', 'planter'].includes(feature.type) ? '#d8b4fe' : '#fb7185'
    strokePolygon(ctx, feature.points)
  }
  ctx.strokeStyle = '#67e8f9'
  ctx.setLineDash([6, 4])
  for (const path of PRIORITY_WALKABLE_PATHS) strokePolygon(ctx, path.points)
  ctx.setLineDash([])
  for (const rect of PROP_COLLIDERS) {
    ctx.strokeStyle = rect.movementBlocking ? '#fbbf24' : '#94a3b8'
    ctx.setLineDash(rect.movementBlocking ? [] : [3, 3])
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    if (player && Math.hypot(rect.x + rect.w / 2 - player.x, rect.y + rect.h / 2 - player.y) < 150) {
      ctx.fillStyle = rect.movementBlocking ? '#fef3c7' : '#cbd5e1'
      ctx.fillText(rect.id, rect.x, rect.y - 2)
    }
  }
  ctx.setLineDash([])
  if (player) {
    for (const object of OCCLUSION_OBJECTS.filter((candidate) => Math.hypot(candidate.display.x + candidate.display.w / 2 - player.x, candidate.sortY - player.y) < 180)) {
      ctx.strokeStyle = '#c084fc'
      strokePolygon(ctx, object.maskPoints)
      ctx.fillStyle = '#f3e8ff'
      ctx.fillText(`${object.id} y=${object.sortY.toFixed(0)}`, object.display.x, object.sortY - 2)
      ctx.beginPath(); ctx.moveTo(object.display.x, object.sortY); ctx.lineTo(object.display.x + object.display.w, object.sortY); ctx.stroke()
    }
    const foot = getPlayerFootRect(player.x, player.y)
    ctx.fillStyle = 'rgba(255,255,255,.18)'
    ctx.strokeStyle = collision?.blockedAxes?.length ? '#ef4444' : '#ffffff'
    ctx.lineWidth = 2
    ctx.fillRect(foot.x, foot.y, foot.w, foot.h)
    ctx.strokeRect(foot.x, foot.y, foot.w, foot.h)
    const cell = getNavigationCellAtWorld(player.x, player.y - PLAYER_BOX.h / 2)
    ctx.strokeStyle = '#22d3ee'
    ctx.strokeRect(cell.col * NAV_CELL, cell.row * NAV_CELL, NAV_CELL, NAV_CELL)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${cell.col},${cell.row} ${NAV_TYPE_NAMES[cell.type]}`, foot.x - 2, foot.y - 3)
  }
  if (occlusion?.objects?.length) {
    ctx.fillStyle = '#e9d5ff'
    ctx.fillText(`alpha ${(occlusion.ratio * 100).toFixed(1)}%`, player.x + 10, player.y - 48)
  }
  ctx.restore()
}

export function drawExitCue(ctx) {
  const x = EXIT_TRIGGER.x + EXIT_TRIGGER.w / 2
  const y = EXIT_TRIGGER.y + 8
  ctx.save()
  ctx.font = '700 11px Nunito, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(63,67,88,.82)'
  ctx.fillRect(x - 30, y - 10, 60, 20)
  ctx.strokeStyle = '#668f8a'
  ctx.lineWidth = 2
  ctx.strokeRect(x - 30, y - 10, 60, 20)
  ctx.fillStyle = '#f7f1e7'
  ctx.fillText('↓ 나가기', x, y)
  ctx.restore()
}
