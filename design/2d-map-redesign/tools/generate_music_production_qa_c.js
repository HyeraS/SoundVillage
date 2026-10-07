const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '../../..')
const ASSETS = path.join(ROOT, 'public/assets/music-village')
const OUT = path.join(ROOT, 'design/2d-map-redesign/previews/2c-c-music-production')
const BASELINE = path.join(ROOT, 'design/2d-map-redesign/baseline/music-village.png')
const T = 32
const MAP = { width: 1536, height: 1152 }

const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)

async function main() {
  const config = await import(path.join(ROOT, 'lib/musicVillageConfig.mjs'))
  fs.mkdirSync(OUT, { recursive: true })

  const stageLayers = ['contact-shadow', 'base-platform', 'rear-body', 'opening', 'canopy-s1', 'trim', 'front-stair']
  const gateLayers = ['contact-shadow', 'posts', 'rail-g1', 'trim']
  const buildingLayers = ['contact-shadow', 'body', 'roof', 'door-window', 'trim']
  const composites = []
  const add = (relative, left, top) => composites.push({ input: path.join(ASSETS, relative), left, top })
  for (const layer of stageLayers) add(`stage/${layer}.png`, config.STAGE.x * T, config.STAGE.y * T)
  for (const layer of gateLayers) add(`gate/${layer}.png`, config.GATE.x * T, config.GATE.y * T)
  for (const building of config.BUILDINGS) {
    for (const layer of buildingLayers) add(`buildings/${building.id}/${layer}.png`, building.x * T, building.y * T)
  }
  for (const item of config.PROPS.filter((item) => !item.foreground)) add(`props/${item.category}/${item.id}.png`, item.x * T, item.top * T)
  for (const layer of ['foreground']) {
    add(`stage/${layer}.png`, config.STAGE.x * T, config.STAGE.y * T)
    add(`gate/${layer}.png`, config.GATE.x * T, config.GATE.y * T)
    for (const building of config.BUILDINGS) add(`buildings/${building.id}/${layer}.png`, building.x * T, building.y * T)
  }
  for (const item of config.PROPS.filter((item) => item.foreground)) add(`props/${item.category}/${item.id}.png`, item.x * T, item.top * T)

  const nonEmissive = await sharp(path.join(ASSETS, 'ground/music-ground-path-map.png')).composite(composites).png().toBuffer()
  add('stage/emissive.png', config.STAGE.x * T, config.STAGE.y * T)
  add('gate/emissive.png', config.GATE.x * T, config.GATE.y * T)
  for (const building of config.BUILDINGS) add(`buildings/${building.id}/emissive.png`, building.x * T, building.y * T)
  const environment = await sharp(path.join(ASSETS, 'ground/music-ground-path-map.png')).composite(composites).png().toBuffer()
  await sharp(environment).toFile(path.join(OUT, 'production-overview.png'))
  await sharp(nonEmissive).toFile(path.join(OUT, 'production-emissive-off.png'))
  await sharp(environment).grayscale().toFile(path.join(OUT, 'production-grayscale.png'))

  const collisionRects = config.COLLIDERS.filter((rect) => !rect.tag.startsWith('map-')).map((rect) => (
    `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="#e85d75" fill-opacity=".28" stroke="#b61f42" stroke-width="3"/>`
  )).join('')
  const clearanceRects = config.CLEARANCE_TILES.map((rect) => (
    `<rect x="${rect.x * T}" y="${rect.y * T}" width="${rect.w * T}" height="${rect.h * T}" fill="#61b89a" fill-opacity=".22" stroke="#267b63" stroke-width="3" stroke-dasharray="9 6"/>`
  )).join('')
  const slots = config.PRIMARY_SLOTS.map(({ tx, ty }) => `<circle cx="${tx * T + 16}" cy="${ty * T + 16}" r="7" fill="#227c9d" fill-opacity=".75"/>`).join('')
  const spawn = `<rect x="${config.SPAWN.x - 10}" y="${config.SPAWN.y - 14}" width="20" height="14" fill="#ffe18a" fill-opacity=".6" stroke="#8a6918" stroke-width="2"/>`
  const exit = `<rect x="${config.EXIT_TRIGGER.x}" y="${config.EXIT_TRIGGER.y}" width="${config.EXIT_TRIGGER.w}" height="${config.EXIT_TRIGGER.h}" fill="#c4a8e8" fill-opacity=".45" stroke="#68478e" stroke-width="2"/>`
  await sharp(environment).composite([{ input: svg(MAP.width, MAP.height, collisionRects + clearanceRects + slots + spawn + exit), left: 0, top: 0 }]).png().toFile(path.join(OUT, 'collision-slot-clearance-overlay.png'))

  const playerChecks = [
    [23.5, 33.5, 'gate lane'], [22.9, 32.2, 'gate post'], [17.7, 8.2, 'stage corner'],
    [12.7, 29.5, 'studio east'], [35.3, 29.5, 'workshop west'], [12.2, 10.2, 'archive corner'],
  ].map(([x, y, label]) => `<g><rect x="${x * T - 10}" y="${y * T - 14}" width="20" height="14" fill="#ffe18a" fill-opacity=".72" stroke="#8a6918" stroke-width="2"/><text x="${x * T}" y="${y * T - 20}" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="#3f4358">${label}</text></g>`).join('')
  await sharp(environment).composite([{ input: svg(MAP.width, MAP.height, playerChecks), left: 0, top: 0 }]).png().toFile(path.join(OUT, 'player-20x14-corner-tests.png'))

  const entranceCrops = [
    ['stage', 18, 2, 12, 12], ['record archive south', 2, 2, 13, 12], ['listening cafe south', 33, 3, 14, 11],
    ['community studio east', 1, 25, 16, 10], ['sound workshop west', 31, 24, 15, 11], ['world gate', 18, 27, 12, 9],
  ]
  const cells = []
  for (const [label, x, y, w, h] of entranceCrops) {
    const crop = await sharp(environment).extract({ left: x * T, top: y * T, width: w * T, height: h * T }).resize(480, 300, { fit: 'contain', background: '#aab490', kernel: 'nearest' }).png().toBuffer()
    cells.push({ label, crop })
  }
  const boardW = 1020, boardH = 1030
  const labels = cells.map((cell, index) => `<text x="${30 + (index % 2) * 500}" y="${36 + Math.floor(index / 2) * 330}" font-family="Arial" font-size="18" font-weight="700" fill="#f7f1e7">${cell.label}</text>`).join('')
  const boardComposites = cells.map((cell, index) => ({ input: cell.crop, left: 30 + (index % 2) * 500, top: 50 + Math.floor(index / 2) * 330 }))
  await sharp(svg(boardW, boardH, `<rect width="100%" height="100%" fill="#3f4358"/>${labels}`)).composite(boardComposites).png().toFile(path.join(OUT, 'stage-gate-building-entrances.png'))

  const oldView = await sharp(BASELINE).resize(700, 525, { fit: 'contain', background: '#3f4358', kernel: 'nearest' }).png().toBuffer()
  const newView = await sharp(environment).resize(700, 525, { fit: 'contain', background: '#3f4358', kernel: 'nearest' }).png().toBuffer()
  const comparisonBase = svg(1480, 610, '<rect width="100%" height="100%" fill="#242735"/><text x="40" y="42" fill="#f7f1e7" font-family="Arial" font-size="22" font-weight="700">BEFORE · legacy Music production</text><text x="760" y="42" fill="#f7f1e7" font-family="Arial" font-size="22" font-weight="700">AFTER · approved B1–B4 production</text>')
  await sharp(comparisonBase).composite([{ input: oldView, left: 40, top: 65 }, { input: newView, left: 760, top: 65 }]).png().toFile(path.join(OUT, 'legacy-vs-production-comparison.png'))

  console.log(`Music production QA previews -> ${OUT}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
