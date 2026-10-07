const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '../../..')
const OUT = path.join(ROOT, 'design/2d-map-redesign/previews/2c-r-music-quality-recovery')
const CURRENT = path.join(ROOT, 'design/2d-map-redesign/previews/2c-c-music-production/production-overview.png')
const CURRENT_VIEW = path.join(ROOT, 'design/2d-map-redesign/previews/2c-c-music-production/desktop-start-group-a-block-1.png')
const LEGACY_VIEW = path.join(ROOT, 'design/2d-map-redesign/baseline/music-village.png')
const TILE = 32
const WORLD = { width: 1536, height: 1152 }
const FOV = { width: 768, height: 576 }

const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>`)

async function actualCharacter() {
  const layerNames = ['player_body.png', 'player_clothes.png', 'player_hair.png']
  const layers = []
  for (const name of layerNames) {
    layers.push({ input: await sharp(path.join(ROOT, 'public/assets/world', name)).extract({ left: 0, top: 0, width: 32, height: 32 }).png().toBuffer() })
  }
  const frame = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer()
  const display = await sharp(frame).resize(72, 72, { kernel: 'nearest' }).png().toBuffer()
  return sharp({ create: { width: 72, height: 88, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: display, left: 0, top: 8 }]).png().toBuffer()
}

function markerSvg(items, cam) {
  return svg(FOV.width, FOV.height, items.map(({ tx, ty }, index) => {
    const x = tx * TILE + 16 - cam.left
    const y = ty * TILE + 16 - cam.top
    if (x < -16 || y < -16 || x > FOV.width + 16 || y > FOV.height + 16) return ''
    const nearby = index === 0
    const color = nearby ? '#FFE18A' : '#61C8D4'
    return `<g transform="translate(${x} ${y})"><circle r="10" fill="#232B37" fill-opacity=".88" stroke="${color}" stroke-width="${nearby ? 3 : 2}"/><path d="M-4 1A4 4 0 0 0 4 1M-4-1A4 4 0 0 1 4-1" fill="none" stroke="${color}" stroke-width="2"/></g>`
  }).join(''))
}

async function gameplayView(environment, config, cam, foot) {
  const character = await actualCharacter()
  return sharp(environment).extract({ left: cam.left, top: cam.top, width: FOV.width, height: FOV.height })
    .composite([
      { input: character, left: Math.round(foot.x - 36 - cam.left), top: Math.round(foot.y - 88 - cam.top) },
      { input: markerSvg(config.SLOT_GROUPS[1], cam), left: 0, top: 0 },
    ]).png().toBuffer()
}

async function labeledBoard(filename, cells, { cols = 2, cellW = 640, cellH = 480, header = 46, gap = 22 } = {}) {
  const rows = Math.ceil(cells.length / cols)
  const width = gap + cols * (cellW + gap)
  const height = gap + rows * (cellH + header + gap)
  const labels = cells.map((cell, index) => {
    const x = gap + (index % cols) * (cellW + gap)
    const y = gap + Math.floor(index / cols) * (cellH + header + gap)
    return `<text x="${x}" y="${y + 28}" fill="#F7F1E7" font-family="Arial" font-size="18" font-weight="700">${cell.label}</text>`
  }).join('')
  const base = svg(width, height, `<rect width="100%" height="100%" fill="#292E3B"/>${labels}`)
  const composites = []
  for (let index = 0; index < cells.length; index++) {
    const input = await sharp(cells[index].input).resize(cellW, cellH, { fit: 'cover', kernel: 'nearest' }).png().toBuffer()
    composites.push({ input, left: gap + (index % cols) * (cellW + gap), top: gap + header + Math.floor(index / cols) * (cellH + header + gap) })
  }
  await sharp(base).composite(composites).png().toFile(path.join(OUT, filename))
}

async function detailSheet(key, environment) {
  const crops = [
    ['STAGE · canopy / rear / foundation', 16, 1, 16, 11],
    ['WORLD GATE · open center lane', 18, 27, 12, 9],
    ['RECORD ARCHIVE · roof / south entry', 1, 1, 15, 13],
    ['LISTENING CAFE · curved roof / entry', 32, 2, 15, 12],
    ['COMMUNITY STUDIO · east entry / yard', 0, 24, 17, 12],
    ['SOUND WORKSHOP · west entry / traces', 31, 23, 17, 13],
  ]
  const cells = []
  for (const [label, x, y, w, h] of crops) {
    const left = Math.max(0, x * TILE)
    const top = Math.max(0, y * TILE)
    const width = Math.min(WORLD.width - left, w * TILE)
    const height = Math.min(WORLD.height - top, h * TILE)
    cells.push({ label, input: await sharp(environment).extract({ left, top, width, height }).png().toBuffer() })
  }
  await labeledBoard(`${key}-detail-sheet.png`, cells, { cols: 2, cellW: 560, cellH: 350, header: 42, gap: 18 })
}

async function mobileLandscape(key, view) {
  const content = await sharp(view).resize(445, 334, { kernel: 'nearest' }).png().toBuffer()
  const hud = svg(720, 56, '<rect width="720" height="56" fill="#F4ECD8"/><rect y="53" width="720" height="3" fill="#C69A45"/><text x="22" y="34" font-family="Arial" font-size="18" font-weight="700" fill="#3F4358">MUSIC VILLAGE · BLOCK 1/6</text><text x="550" y="34" font-family="Arial" font-size="15" fill="#3F4358">0 / 83</text>')
  const dpad = svg(150, 92, '<g fill="#F4ECD8" stroke="#C69A45" stroke-width="2"><rect x="52" y="2" width="42" height="40" rx="8"/><rect x="4" y="48" width="42" height="40" rx="8"/><rect x="52" y="48" width="42" height="40" rx="8"/><rect x="100" y="48" width="42" height="40" rx="8"/></g><g fill="#3F4358" font-family="Arial" font-size="18" font-weight="700"><text x="65" y="28">▲</text><text x="17" y="75">◀</text><text x="65" y="75">▼</text><text x="113" y="75">▶</text></g>')
  await sharp({ create: { width: 720, height: 390, channels: 4, background: '#6F7865' } }).composite([
    { input: hud, left: 0, top: 0 },
    { input: content, left: 138, top: 56 },
    { input: dpad, left: 12, top: 286 },
  ]).png().toFile(path.join(OUT, `${key}-mobile-landscape.png`))
}

async function main() {
  const config = await import(path.join(ROOT, 'lib/musicVillageConfig.mjs'))
  fs.mkdirSync(OUT, { recursive: true })
  const directions = [
    ['r1-a', path.join(OUT, 'r1-a-imagegen-original.png')],
    ['r1-b', path.join(OUT, 'r1-b-imagegen-original.png')],
  ]
  const normalized = {}
  const views = {}
  const cameras = {
    gate: { left: 400, top: 576 },
    garden: { left: 384, top: 288 },
    stage: { left: 384, top: 64 },
  }
  const feet = {
    gate: { x: 784, y: 948 },
    garden: { x: 768, y: 640 },
    stage: { x: 784, y: 416 },
  }

  for (const [key, source] of directions) {
    const environment = await sharp(source).resize(WORLD.width, WORLD.height, { kernel: 'nearest' }).png().toBuffer()
    normalized[key] = environment
    await sharp(environment).toFile(path.join(OUT, `${key}-full-map.png`))
    views[key] = {
      gate: await gameplayView(environment, config, cameras.gate, feet.gate),
      garden: await gameplayView(environment, config, cameras.garden, feet.garden),
      stage: await gameplayView(environment, config, cameras.stage, feet.stage),
    }
    await sharp(views[key].garden).toFile(path.join(OUT, `${key}-desktop-gameplay.png`))
    await sharp(views[key].gate).toFile(path.join(OUT, `${key}-world-gate-start.png`))
    await sharp(views[key].stage).toFile(path.join(OUT, `${key}-garden-stage-approach.png`))
    await sharp(views[key].garden).extract({ left: 192, top: 144, width: 384, height: 288 }).resize(768, 576, { kernel: 'nearest' }).png().toFile(path.join(OUT, `${key}-character-marker-composite.png`))
    await mobileLandscape(key, views[key].gate)
    await detailSheet(key, environment)
  }

  const legacy = await sharp(LEGACY_VIEW).extract({ left: 256, top: 88, width: 768, height: 576 }).png().toBuffer()
  const current = await sharp(CURRENT_VIEW).extract({ left: 256, top: 88, width: 768, height: 576 }).png().toBuffer()
  await labeledBoard('legacy-current-r1a-r1b-equal-viewport.png', [
    { label: 'LEGACY PRODUCTION · player-centered gameplay', input: legacy },
    { label: 'CURRENT 2C-C · Gate start · Block 1', input: current },
    { label: 'PROPOSED R1-A · same 24×18 Gate start', input: views['r1-a'].gate },
    { label: 'PROPOSED R1-B · same 24×18 Gate start', input: views['r1-b'].gate },
  ])

  await labeledBoard('r1-a-r1-b-full-map-comparison.png', [
    { label: 'R1-A · warm organic late afternoon', input: normalized['r1-a'] },
    { label: 'R1-B · crisp rhythmic clear daylight', input: normalized['r1-b'] },
  ], { cols: 2, cellW: 720, cellH: 540, header: 46, gap: 22 })

  const currentNormalized = await sharp(CURRENT).resize(WORLD.width, WORLD.height, { kernel: 'nearest' }).png().toBuffer()
  await labeledBoard('current-r1a-r1b-material-density.png', [
    { label: 'CURRENT 2C-C · flat material density', input: await gameplayView(currentNormalized, config, cameras.garden, feet.garden) },
    { label: 'R1-A · organic material density', input: views['r1-a'].garden },
    { label: 'R1-B · rhythmic material density', input: views['r1-b'].garden },
  ], { cols: 3, cellW: 480, cellH: 360, header: 44, gap: 18 })

  console.log(`Music R1 preview package generated at ${OUT}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
