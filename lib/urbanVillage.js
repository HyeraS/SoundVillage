import {
  T, MAP_W, MAP_H, PLAYER_BOX, INTERACTION_BOX,
  SPAWN, EXIT_TRIGGER, METRO, BUILDINGS, ROAD_LANES, CROSSWALKS, PROPS,
  COLLIDERS, BLOCK_REGIONS, LOCK_FOG_REGIONS, SAFE_SLOTS_BY_BLOCK,
  isRoadLaneTile, isRailTile, isWaterTile, isSolidTile, isWalkableTile,
  isAccessibleTile, isSafeUrbanSlot, distanceFromSolid, blockForTile,
  buildUrbanVillage, spawnUrbanItems, markerStateFor, collides,
  moveWithCollision, overlapsExitTrigger, reachableTileKeys,
} from './urbanVillageConfig.mjs'

export {
  T, MAP_W, MAP_H, PLAYER_BOX, INTERACTION_BOX,
  SPAWN, EXIT_TRIGGER, METRO, BUILDINGS, ROAD_LANES, CROSSWALKS, PROPS,
  COLLIDERS, BLOCK_REGIONS, LOCK_FOG_REGIONS, SAFE_SLOTS_BY_BLOCK,
  isRoadLaneTile, isRailTile, isWaterTile, isSolidTile, isWalkableTile,
  isAccessibleTile, isSafeUrbanSlot, distanceFromSolid, blockForTile,
  buildUrbanVillage, spawnUrbanItems, markerStateFor, collides,
  moveWithCollision, overlapsExitTrigger, reachableTileKeys,
}

const px = (tiles) => tiles * T
const rectPx = (rect) => ({ x: px(rect.x), y: px(rect.y), w: px(rect.w), h: px(rect.h) })

const PALETTE = Object.freeze({
  void: '#070d22', paving: '#34415f', pavingAlt: '#3b4969', seam: '#536483',
  road: '#111a31', roadEdge: '#22304b', lane: '#7c89a5', crosswalk: '#a9d7df',
  roof: '#111a35', roofHi: '#27375b', facade: '#182544', glass: '#36749a',
  cyan: '#69e8ff', white: '#eafcff', violet: '#8d72ef', warm: '#ffd58a',
  green: '#214b4b', leaf: '#286663', planter: '#293954', shadow: 'rgba(2,6,18,.45)',
})

function drawWetReflections(ctx) {
  ctx.save()
  for (const road of ROAD_LANES) {
    const r = rectPx(road)
    ctx.fillStyle = 'rgba(71,211,242,.1)'
    if (road.w > road.h) {
      for (let x = r.x + 22; x < r.x + r.w - 12; x += 94) {
        ctx.fillRect(x, r.y + 8, 34, 3)
        ctx.fillRect(x + 9, r.y + r.h - 13, 52, 2)
      }
    } else {
      for (let y = r.y + 18; y < r.y + r.h - 12; y += 88) {
        ctx.fillRect(r.x + 8, y, 3, 40)
        ctx.fillRect(r.x + r.w - 13, y + 13, 2, 54)
      }
    }
    ctx.fillStyle = 'rgba(141,114,239,.09)'
    if (road.w > road.h) ctx.fillRect(r.x + 10, r.y + r.h - 7, r.w - 20, 2)
    else ctx.fillRect(r.x + r.w - 7, r.y + 10, 2, r.h - 20)
  }
  ctx.restore()
}

function fillPixelPaving(ctx) {
  ctx.fillStyle = PALETTE.paving
  ctx.fillRect(0, 0, MAP_W * T, MAP_H * T)
  ctx.fillStyle = PALETTE.pavingAlt
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(tx * T, ty * T, T, T)
    }
  }
  ctx.strokeStyle = PALETTE.seam
  ctx.lineWidth = 1
  for (let x = 0; x <= MAP_W; x++) {
    ctx.beginPath(); ctx.moveTo(x * T + .5, 0); ctx.lineTo(x * T + .5, MAP_H * T); ctx.stroke()
  }
  for (let y = 0; y <= MAP_H; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * T + .5); ctx.lineTo(MAP_W * T, y * T + .5); ctx.stroke()
  }
}

function drawRoads(ctx) {
  for (const road of ROAD_LANES) {
    const r = rectPx(road)
    ctx.fillStyle = PALETTE.roadEdge
    ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8)
    ctx.fillStyle = PALETTE.road
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = PALETTE.lane
    if (road.w > road.h) {
      const y = r.y + Math.floor(r.h / 2) - 2
      for (let x = r.x + 18; x < r.x + r.w - 12; x += 48) ctx.fillRect(x, y, 24, 4)
    } else {
      const x = r.x + Math.floor(r.w / 2) - 2
      for (let y = r.y + 18; y < r.y + r.h - 12; y += 48) ctx.fillRect(x, y, 4, 24)
    }
  }

  for (const crossing of CROSSWALKS) {
    const r = rectPx(crossing)
    ctx.fillStyle = PALETTE.road
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = PALETTE.crosswalk
    if (crossing.w >= crossing.h) {
      for (let x = r.x + 8; x < r.x + r.w - 4; x += 16) ctx.fillRect(x, r.y + 5, 8, r.h - 10)
    } else {
      for (let y = r.y + 8; y < r.y + r.h - 4; y += 16) ctx.fillRect(r.x + 5, y, r.w - 10, 8)
    }
  }

  drawWetReflections(ctx)

  ctx.fillStyle = 'rgba(105,232,255,.28)'
  ctx.fillRect(21 * T, 12 * T, 1, 13 * T)
  ctx.fillRect(26 * T + 28, 12 * T, 4, 13 * T)
  ctx.fillRect(19 * T, 17 * T, 10 * T, 3)
  ctx.fillRect(19 * T, 20 * T - 3, 10 * T, 3)
}

function drawWindowGrid(ctx, r, accent, columns, rows, inset = 12) {
  const gap = 5
  const cellW = Math.max(6, Math.floor((r.w - inset * 2 - gap * (columns - 1)) / columns))
  const cellH = Math.max(5, Math.floor((r.h - inset * 2 - gap * (rows - 1)) / rows))
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const warm = (row * columns + col) % 11 === 3
      ctx.fillStyle = warm ? PALETTE.warm : accent
      ctx.globalAlpha = warm ? .78 : .5 + ((row + col) % 3) * .12
      ctx.fillRect(r.x + inset + col * (cellW + gap), r.y + inset + row * (cellH + gap), cellW, cellH)
      ctx.fillStyle = '#d9f8ff'
      ctx.globalAlpha = .18
      ctx.fillRect(r.x + inset + col * (cellW + gap) + 2, r.y + inset + row * (cellH + gap) + 1, 2, Math.max(2, cellH - 2))
    }
  }
  ctx.globalAlpha = 1
}

function drawRooftopHardware(ctx, r, index) {
  ctx.fillStyle = '#0a122a'
  ctx.fillRect(r.x + 12, r.y + 10, 24, 16)
  ctx.fillStyle = '#53698b'
  ctx.fillRect(r.x + 15, r.y + 13, 18, 3)
  ctx.fillRect(r.x + 15, r.y + 20, 18, 3)
  const solarX = r.x + r.w - 54
  ctx.fillStyle = '#173f68'
  ctx.fillRect(solarX, r.y + 10, 42, 20)
  ctx.strokeStyle = '#63b9d4'
  ctx.lineWidth = 2
  ctx.strokeRect(solarX, r.y + 10, 42, 20)
  ctx.beginPath(); ctx.moveTo(solarX + 14, r.y + 10); ctx.lineTo(solarX + 14, r.y + 30); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(solarX + 28, r.y + 10); ctx.lineTo(solarX + 28, r.y + 30); ctx.stroke()
  if (index % 2 === 0) {
    ctx.fillStyle = PALETTE.cyan
    ctx.fillRect(r.x + Math.floor(r.w / 2), r.y + 4, 3, 22)
    ctx.fillRect(r.x + Math.floor(r.w / 2) - 4, r.y + 4, 11, 3)
  }
}

function drawBuilding(ctx, building, index) {
  const r = rectPx(building)
  ctx.fillStyle = PALETTE.shadow
  ctx.fillRect(r.x + 12, r.y + 15, r.w, r.h)

  if (building.kind === 'cinema') {
    ctx.fillStyle = '#080f25'
    ctx.fillRect(r.x + 8, r.y + 8, r.w, r.h)
    ctx.fillStyle = '#101a36'
    ctx.beginPath()
    ctx.moveTo(r.x + 12, r.y); ctx.lineTo(r.x + r.w - 12, r.y)
    ctx.lineTo(r.x + r.w, r.y + 12); ctx.lineTo(r.x + r.w, r.y + r.h)
    ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x, r.y + 12); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#254c75'
    ctx.fillRect(r.x + 12, r.y + 18, r.w - 24, r.h - 40)
    ctx.fillStyle = '#07142b'
    for (let x = r.x + 18; x < r.x + r.w - 18; x += 20) ctx.fillRect(x, r.y + 24, 12, r.h - 52)
    ctx.fillStyle = '#6a5be1'
    ctx.fillRect(r.x + 12, r.y + 14, r.w - 24, 7)
    ctx.fillStyle = building.accent
    ctx.fillRect(r.x + 12, r.y + r.h - 25, r.w - 24, 6)
    ctx.fillStyle = 'rgba(105,232,255,.18)'
    ctx.fillRect(r.x + 22, r.y + r.h - 18, r.w - 44, 18)
    ctx.fillStyle = '#0a1128'
    ctx.fillRect(r.x + Math.floor(r.w / 2) - 30, r.y + r.h - 36, 60, 36)
    ctx.fillStyle = '#dffaff'
    ctx.fillRect(r.x + Math.floor(r.w / 2) - 23, r.y + r.h - 31, 18, 26)
    ctx.fillRect(r.x + Math.floor(r.w / 2) + 5, r.y + r.h - 31, 18, 26)
    ctx.fillStyle = '#4e74a1'
    ctx.fillRect(r.x + 18, r.y + r.h - 48, 34, 26)
    ctx.fillRect(r.x + r.w - 52, r.y + r.h - 48, 34, 26)
    ctx.fillStyle = PALETTE.white
    ctx.globalAlpha = .7
    ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 34, 18, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#10244b'; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 34, 10, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    return
  }

  ctx.fillStyle = PALETTE.facade
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.fillStyle = '#0b142d'
  ctx.fillRect(r.x, r.y, 8, r.h)
  ctx.fillStyle = '#26385c'
  ctx.fillRect(r.x + r.w - 8, r.y + 8, 8, r.h - 8)
  ctx.fillStyle = PALETTE.roof
  ctx.fillRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10)
  ctx.strokeStyle = PALETTE.roofHi
  ctx.lineWidth = 4
  ctx.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8)

  if (building.kind === 'glass') {
    ctx.fillStyle = '#102b50'
    ctx.fillRect(r.x + 8, r.y + 32, r.w - 16, r.h - 42)
    ctx.fillStyle = '#1e4b70'
    ctx.fillRect(r.x + 10, r.y + 38, r.w - 20, r.h - 52)
    ctx.strokeStyle = building.accent
    ctx.lineWidth = 3
    for (let x = r.x + 12; x < r.x + r.w - 10; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, r.y + 38); ctx.lineTo(x, r.y + r.h - 14); ctx.stroke()
    }
    for (let y = r.y + 62; y < r.y + r.h - 12; y += 24) {
      ctx.beginPath(); ctx.moveTo(r.x + 10, y); ctx.lineTo(r.x + r.w - 10, y); ctx.stroke()
    }
    ctx.fillStyle = PALETTE.warm
    ctx.globalAlpha = .6
    for (let y = r.y + 72; y < r.y + r.h - 22; y += 42) {
      for (let x = r.x + 24; x < r.x + r.w - 24; x += 48) ctx.fillRect(x, y, 10, 10)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(218,250,255,.34)'
    ctx.fillRect(r.x + 16, r.y + 43, r.w - 32, 4)
    ctx.fillStyle = '#6aeaff'
    ctx.fillRect(r.x + 9, r.y + r.h - 18, r.w - 18, 5)
    ctx.fillStyle = '#0a1730'
    ctx.fillRect(r.x + r.w / 2 - 22, r.y + r.h - 32, 44, 32)
    ctx.fillStyle = '#dffaff'
    ctx.fillRect(r.x + r.w / 2 - 16, r.y + r.h - 26, 13, 24)
    ctx.fillRect(r.x + r.w / 2 + 3, r.y + r.h - 26, 13, 24)
  } else {
    drawWindowGrid(ctx, { ...r, y: r.y + 30, h: r.h - 38 }, building.accent, Math.max(3, Math.floor(building.w / 2)), Math.max(2, Math.floor(building.h / 2)), 12)
  }

  if (building.kind === 'media') {
    ctx.fillStyle = '#0b1230'
    ctx.fillRect(r.x + 28, r.y + 28, r.w - 56, 62)
    ctx.fillStyle = PALETTE.violet
    ctx.fillRect(r.x + 36, r.y + 36, 52, 18)
    ctx.fillStyle = PALETTE.cyan
    ctx.fillRect(r.x + 94, r.y + 36, r.w - 138, 18)
    ctx.fillRect(r.x + 36, r.y + 60, 92, 18)
    ctx.fillStyle = '#566ee7'
    ctx.fillRect(r.x + 134, r.y + 60, r.w - 178, 18)
    ctx.fillStyle = 'rgba(105,232,255,.24)'
    ctx.fillRect(r.x + 18, r.y + r.h - 24, r.w - 36, 18)
    ctx.fillStyle = '#d9faff'
    for (let x = r.x + 28; x < r.x + r.w - 20; x += 36) ctx.fillRect(x, r.y + r.h - 19, 22, 3)
  }

  if (building.kind === 'tower') {
    ctx.fillStyle = 'rgba(102,224,246,.16)'
    for (let x = r.x + 18; x < r.x + r.w - 12; x += 34) ctx.fillRect(x, r.y + 34, 6, r.h - 46)
    ctx.fillStyle = building.accent
    ctx.globalAlpha = .5
    ctx.fillRect(r.x + 8, r.y + r.h - 15, r.w - 16, 4)
    ctx.globalAlpha = 1
  }

  if (building.kind === 'culture') {
    ctx.fillStyle = '#173862'
    ctx.fillRect(r.x + 18, r.y + 34, r.w - 36, r.h - 48)
    ctx.fillStyle = '#6378de'
    for (let x = r.x + 24; x < r.x + r.w - 20; x += 40) ctx.fillRect(x, r.y + 40, 24, r.h - 64)
    ctx.fillStyle = '#e1fbff'
    ctx.fillRect(r.x + r.w / 2 - 24, r.y + r.h - 29, 48, 29)
    ctx.fillStyle = '#254872'
    ctx.fillRect(r.x + r.w / 2 - 18, r.y + r.h - 23, 15, 21)
    ctx.fillRect(r.x + r.w / 2 + 3, r.y + r.h - 23, 15, 21)
  }

  drawRooftopHardware(ctx, r, index)
  ctx.fillStyle = building.accent
  ctx.globalAlpha = .72
  ctx.fillRect(r.x + 5, r.y + r.h - 9, r.w - 10, 4)
  ctx.globalAlpha = 1
}

function drawMetro(ctx) {
  const full = rectPx(METRO.rail)
  ctx.fillStyle = 'rgba(2,6,18,.62)'
  ctx.fillRect(full.x + 12, full.y + full.h + 8, full.w - 24, 18)
  for (const x of [9, 14, 19, 28, 33, 38]) {
    ctx.fillStyle = '#101a32'; ctx.fillRect(x * T + 10, 8 * T, 12, 4 * T)
    ctx.fillStyle = '#415779'; ctx.fillRect(x * T + 13, 8 * T, 6, 4 * T)
  }
  for (const piece of METRO.railPieces) {
    const r = rectPx(piece)
    ctx.fillStyle = '#10182f'; ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = '#53637d'; ctx.fillRect(r.x, r.y + 7, r.w, 6)
    ctx.fillStyle = '#17223f'; ctx.fillRect(r.x, r.y + 16, r.w, r.h - 25)
    ctx.fillStyle = '#8fa5b9'; ctx.fillRect(r.x, r.y + r.h - 9, r.w, 5)

    const carCount = Math.floor(piece.w / 4)
    for (let car = 0; car < carCount; car++) {
      const x = r.x + 8 + car * 4 * T
      const w = Math.min(4 * T - 12, r.x + r.w - x - 8)
      ctx.fillStyle = '#c4d2dc'; ctx.fillRect(x, r.y + 24, w, 42)
      ctx.fillStyle = '#304363'; ctx.fillRect(x + 5, r.y + 29, w - 10, 21)
      ctx.fillStyle = PALETTE.cyan
      for (let wx = x + 10; wx < x + w - 8; wx += 24) ctx.fillRect(wx, r.y + 33, 15, 12)
      ctx.fillStyle = '#17213d'; ctx.fillRect(x, r.y + 58, w, 8)
      ctx.fillStyle = PALETTE.cyan; ctx.fillRect(x + 5, r.y + 63, w - 10, 3)
    }

    // 유리 캐노피와 구조 보강재를 열차 위에 얹어 플랫폼의 깊이와 현대성을 만든다.
    ctx.fillStyle = 'rgba(75,168,207,.3)'
    ctx.fillRect(r.x + 6, r.y + 4, r.w - 12, 18)
    ctx.fillStyle = '#9ceeff'
    ctx.fillRect(r.x + 6, r.y + 4, r.w - 12, 3)
    ctx.fillRect(r.x + 6, r.y + 19, r.w - 12, 3)
    ctx.fillStyle = '#405879'
    for (let x = r.x + 12; x < r.x + r.w - 8; x += 64) ctx.fillRect(x, r.y + 2, 5, 23)
  }

  const stairs = rectPx(METRO.stairs)
  ctx.fillStyle = '#40506e'; ctx.fillRect(stairs.x, stairs.y, stairs.w, stairs.h)
  ctx.fillStyle = '#687995'
  for (let y = stairs.y + 12; y < stairs.y + stairs.h; y += 12) ctx.fillRect(stairs.x + 8, y, stairs.w - 16, 5)
  ctx.fillStyle = PALETTE.cyan
  ctx.fillRect(stairs.x + 4, stairs.y, 4, stairs.h)
  ctx.fillRect(stairs.x + stairs.w - 8, stairs.y, 4, stairs.h)
  ctx.fillStyle = 'rgba(105,232,255,.13)'
  ctx.fillRect(stairs.x + 8, stairs.y, stairs.w - 16, stairs.h)
}

function drawPlanter(ctx, r) {
  ctx.fillStyle = PALETTE.shadow; ctx.fillRect(r.x + 4, r.y + r.h - 2, r.w, 6)
  ctx.fillStyle = PALETTE.planter; ctx.fillRect(r.x, r.y + 8, r.w, r.h - 8)
  ctx.fillStyle = '#60718e'; ctx.fillRect(r.x + 3, r.y + 5, r.w - 6, 7)
  ctx.fillStyle = PALETTE.green; ctx.fillRect(r.x + 8, r.y, r.w - 16, 10)
  ctx.fillStyle = '#3a8680'; for (let x = r.x + 12; x < r.x + r.w - 8; x += 15) ctx.fillRect(x, r.y - 4, 7, 9)
}

function drawTreeBase(ctx, r) {
  ctx.fillStyle = PALETTE.shadow; ctx.fillRect(r.x + 3, r.y + 22, 28, 9)
  ctx.fillStyle = '#172942'; ctx.fillRect(r.x + 2, r.y + 6, 28, 24)
  ctx.fillStyle = '#566986'; ctx.fillRect(r.x + 5, r.y + 9, 22, 18)
  ctx.fillStyle = '#6d829a'; ctx.fillRect(r.x + 14, r.y - 10, 5, 28)
}

function drawLamp(ctx, r) {
  ctx.fillStyle = '#0b1428'; ctx.fillRect(r.x + 12, r.y + 15, 8, 19)
  ctx.fillStyle = '#526b86'; ctx.fillRect(r.x + 14, r.y - 17, 4, 34)
  ctx.fillStyle = PALETTE.white; ctx.fillRect(r.x + 9, r.y - 19, 14, 8)
  ctx.fillStyle = PALETTE.cyan; ctx.globalAlpha = .26; ctx.fillRect(r.x + 5, r.y - 23, 22, 16); ctx.globalAlpha = 1
}

function drawBus(ctx, r) {
  ctx.fillStyle = PALETTE.shadow; ctx.fillRect(r.x + 5, r.y + 8, r.w, r.h)
  ctx.fillStyle = '#d4e0e6'; ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.fillStyle = '#263856'; ctx.fillRect(r.x + 7, r.y + 10, r.w - 14, r.h - 20)
  ctx.fillStyle = PALETTE.cyan; ctx.fillRect(r.x + 5, r.y + 12, 5, r.h - 24)
  ctx.fillStyle = '#5ed8ee';
  for (let y = r.y + 18; y < r.y + r.h - 18; y += 25) ctx.fillRect(r.x + 15, y, r.w - 29, 14)
  ctx.fillStyle = '#081126'; ctx.fillRect(r.x - 2, r.y + 12, 5, 16); ctx.fillRect(r.x + r.w - 3, r.y + r.h - 28, 5, 16)
}

function drawShuttle(ctx, r) {
  ctx.fillStyle = PALETTE.shadow; ctx.fillRect(r.x + 7, r.y + 9, r.w, r.h)
  ctx.fillStyle = '#d9e7ec'; ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.fillStyle = '#173654'; ctx.fillRect(r.x + 7, r.y + 9, r.w - 14, r.h - 18)
  ctx.fillStyle = PALETTE.cyan; ctx.fillRect(r.x + 4, r.y + 5, 5, r.h - 10)
  ctx.fillStyle = '#61d8ef'
  for (let y = r.y + 16; y < r.y + r.h - 12; y += 23) ctx.fillRect(r.x + 15, y, r.w - 28, 12)
  ctx.fillStyle = '#0a1428'; ctx.fillRect(r.x - 3, r.y + 12, 5, 14); ctx.fillRect(r.x + r.w - 2, r.y + r.h - 27, 5, 14)
  ctx.fillStyle = '#f5fdff'; ctx.fillRect(r.x + 16, r.y + 3, r.w - 30, 4)
}

function drawMediaOrb(ctx, r) {
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  ctx.fillStyle = PALETTE.shadow; ctx.beginPath(); ctx.ellipse(cx, r.y + r.h + 4, 25, 7, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#17233f'; ctx.fillRect(cx - 17, cy + 8, 34, 18)
  ctx.fillStyle = '#506686'; ctx.fillRect(cx - 22, cy + 23, 44, 7)
  ctx.fillStyle = 'rgba(141,114,239,.28)'; ctx.beginPath(); ctx.arc(cx, cy - 8, 25, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#745ee2'; ctx.beginPath(); ctx.arc(cx, cy - 8, 18, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = PALETTE.cyan; ctx.fillRect(cx - 11, cy - 12, 22, 6); ctx.fillRect(cx - 4, cy - 22, 8, 28)
  ctx.fillStyle = '#eefcff'; ctx.fillRect(cx - 3, cy - 18, 4, 16)
}

function drawProps(ctx) {
  for (const prop of PROPS) {
    const r = rectPx(prop)
    if (prop.kind === 'planter') drawPlanter(ctx, r)
    else if (prop.kind === 'tree') drawTreeBase(ctx, r)
    else if (prop.kind === 'lamp') drawLamp(ctx, r)
    else if (prop.kind === 'bus') drawBus(ctx, r)
    else if (prop.kind === 'shuttle') drawShuttle(ctx, r)
    else if (prop.kind === 'media-orb') drawMediaOrb(ctx, r)
    else if (prop.kind === 'scooter') {
      ctx.fillStyle = '#0d1730'; ctx.fillRect(r.x, r.y + 16, r.w, 14)
      ctx.fillStyle = PALETTE.cyan
      for (let x = r.x + 8; x < r.x + r.w - 5; x += 16) {
        ctx.fillRect(x, r.y + 3, 4, 19); ctx.fillRect(x, r.y + 3, 10, 4)
      }
    } else if (prop.kind === 'fountain') {
      ctx.fillStyle = PALETTE.shadow; ctx.fillRect(r.x - 8, r.y + r.h - 5, r.w + 16, 12)
      ctx.fillStyle = '#1a3153'; ctx.fillRect(r.x, r.y + 12, r.w, r.h - 12)
      ctx.fillStyle = '#4d7896'; ctx.fillRect(r.x + 6, r.y + 18, r.w - 12, r.h - 24)
      ctx.fillStyle = PALETTE.cyan; ctx.globalAlpha = .7
      ctx.fillRect(r.x + r.w / 2 - 5, r.y - 20, 10, r.h + 20)
      ctx.fillStyle = PALETTE.white; ctx.fillRect(r.x + r.w / 2 - 2, r.y - 25, 4, r.h + 22)
      ctx.globalAlpha = 1
    }
  }
}

function drawCityEdge(ctx) {
  ctx.fillStyle = '#071027'
  ctx.fillRect(0, 0, MAP_W * T, T)
  ctx.fillRect(0, 35 * T, MAP_W * T, T)
  ctx.fillRect(0, 0, T, MAP_H * T)
  ctx.fillRect(47 * T, 0, T, MAP_H * T)
  ctx.fillStyle = '#203453'
  for (let x = 0; x < MAP_W * T; x += 32) {
    ctx.fillRect(x, 35 * T + 4, 24, 5)
    ctx.fillStyle = '#69e8ff'; ctx.fillRect(x + 10, 35 * T + 10, 4, 4); ctx.fillStyle = '#203453'
  }
}

export function drawUrbanStatic(ctx, village = buildUrbanVillage()) {
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, MAP_W * T, MAP_H * T)
  fillPixelPaving(ctx)
  drawRoads(ctx)
  BUILDINGS.forEach((building, index) => drawBuilding(ctx, building, index))
  drawMetro(ctx)
  drawProps(ctx)
  drawCityEdge(ctx)

  ctx.fillStyle = 'rgba(105,232,255,.6)'
  for (let y = 14 * T; y < 34 * T; y += 2 * T) {
    ctx.fillRect(20 * T + 8, y, 4, 12)
    ctx.fillRect(27 * T - 12, y, 4, 12)
  }
  ctx.fillStyle = 'rgba(141,114,239,.16)'
  ctx.fillRect(2 * T, 19 * T - 3, 11 * T, 3)
  ctx.fillStyle = 'rgba(105,232,255,.16)'
  ctx.fillRect(37 * T, 21 * T - 4, 10 * T, 4)
  return village
}

export function drawUrbanForeground(ctx) {
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, MAP_W * T, MAP_H * T)
  for (const building of BUILDINGS) {
    const r = rectPx(building)
    ctx.fillStyle = 'rgba(3,9,25,.75)'
    ctx.fillRect(r.x + 4, r.y + r.h - 9, r.w - 8, 9)
    ctx.fillStyle = building.accent
    ctx.globalAlpha = .7
    ctx.fillRect(r.x + 9, r.y + r.h - 9, r.w - 18, 3)
    ctx.globalAlpha = 1
  }
  for (const prop of PROPS.filter((item) => item.kind === 'tree')) {
    const r = rectPx(prop)
    ctx.fillStyle = 'rgba(3,8,20,.38)'; ctx.fillRect(r.x - 12, r.y - 54, 56, 58)
    ctx.fillStyle = '#173d45'; ctx.fillRect(r.x - 8, r.y - 50, 48, 42)
    ctx.fillStyle = '#245a5a'; ctx.fillRect(r.x - 13, r.y - 38, 58, 25)
    ctx.fillStyle = '#33706a'; ctx.fillRect(r.x - 4, r.y - 56, 40, 23)
    ctx.fillStyle = '#58a49a'; ctx.fillRect(r.x + 4, r.y - 48, 10, 9)
  }
  for (const piece of METRO.railPieces) {
    const r = rectPx(piece)
    ctx.fillStyle = '#0a1126'; ctx.fillRect(r.x, r.y + r.h - 8, r.w, 11)
    ctx.fillStyle = PALETTE.cyan
    for (let x = r.x + 12; x < r.x + r.w - 8; x += 32) ctx.fillRect(x, r.y + r.h - 12, 4, 12)
  }
}

function drawPixelLock(ctx, x, y) {
  ctx.fillStyle = 'rgba(7,13,34,.82)'; ctx.fillRect(x - 12, y - 8, 24, 20)
  ctx.strokeStyle = 'rgba(122,211,238,.5)'; ctx.lineWidth = 3
  ctx.strokeRect(x - 12, y - 8, 24, 20)
  ctx.beginPath(); ctx.moveTo(x - 7, y - 8); ctx.lineTo(x - 7, y - 15); ctx.lineTo(x + 7, y - 15); ctx.lineTo(x + 7, y - 8); ctx.stroke()
  ctx.fillStyle = '#bceeff'; ctx.fillRect(x - 2, y - 1, 4, 7)
}

export function drawUrbanLockFog(ctx, blockNum, now = 0) {
  ctx.save()
  for (let block = 2; block <= 6; block++) {
    if (block <= blockNum) continue
    const r = rectPx(LOCK_FOG_REGIONS[block])
    ctx.fillStyle = `rgba(5,10,29,${block === blockNum + 1 ? .42 : .62})`
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = 'rgba(91,162,197,.09)'
    const shift = Math.floor(now / 80) % 32
    for (let x = r.x - r.h + shift; x < r.x + r.w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.lineTo(x + r.h + 5, r.y); ctx.lineTo(x + 5, r.y + r.h); ctx.closePath(); ctx.fill()
    }
    drawPixelLock(ctx, r.x + r.w / 2, r.y + r.h / 2)
  }
  ctx.restore()
}

export function drawUrbanMarker(ctx, item, state, now) {
  const floatY = Math.round(Math.sin(now / 320 + item.phase) * 3)
  const x = item.tx * T + T / 2
  const y = item.ty * T + T / 2 + floatY
  const nearby = state === 'nearby'
  const completed = state === 'completed'
  const interacting = state === 'interacting'
  const unavailable = state === 'unavailable'
  const emphasized = nearby || interacting
  const radius = emphasized ? 8 : unavailable ? 3 : 4

  ctx.save()
  ctx.globalAlpha = unavailable ? .1 : completed ? .3 : emphasized ? 1 : .5
  ctx.fillStyle = 'rgba(1,6,20,.45)'
  ctx.beginPath(); ctx.ellipse(x, y + radius + 3 - floatY, radius - 1, 2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = interacting ? 'rgba(141,114,239,.28)' : 'rgba(105,232,255,.22)'
  if (emphasized) {
    ctx.beginPath(); ctx.arc(x, y, radius + 3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = unavailable ? '#7890a5' : nearby ? '#ffffff' : '#a7f3ff'
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = unavailable ? '#53657a' : interacting ? PALETTE.violet : PALETTE.cyan
  ctx.lineWidth = unavailable ? 1 : nearby ? 3 : 2
  ctx.beginPath(); ctx.arc(x, y, radius + 1, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#173456'
  ctx.lineWidth = 2
  const heights = emphasized ? [3, 6, 9, 5, 7] : unavailable ? [1, 2, 3, 2, 2] : [2, 4, 6, 3, 4]
  heights.forEach((height, index) => {
    const wx = x - 5 + index * 2.5
    ctx.beginPath(); ctx.moveTo(wx, y - height / 2); ctx.lineTo(wx, y + height / 2); ctx.stroke()
  })
  if (completed) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y + 3); ctx.lineTo(x + 5, y - 4); ctx.stroke()
  }
  ctx.restore()
}

export function drawUrbanExitCue(ctx) {
  const x = EXIT_TRIGGER.x + EXIT_TRIGGER.w / 2
  const y = 34 * T + 22
  ctx.save()
  ctx.fillStyle = 'rgba(9,17,40,.88)'
  ctx.fillRect(x - 37, y - 11, 74, 22)
  ctx.strokeStyle = PALETTE.cyan
  ctx.lineWidth = 2
  ctx.strokeRect(x - 37, y - 11, 74, 22)
  ctx.fillStyle = PALETTE.white
  ctx.font = '700 11px Nunito, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('↓ 입구', x, y)
  ctx.restore()
}
