const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = '/Users/hyera/Documents/SoundVillage-house-decor-2d'
const ASSET_DIR = path.join(ROOT, 'public/design-previews/music-ground-path-b1')
const TILE_DIR = path.join(ASSET_DIR, 'tiles')
const PREVIEW_DIR = path.join(ROOT, 'design/2d-map-redesign/previews/2c-b1-music')
const TILE = 32
const MAP_W = 48
const MAP_H = 36
const WIDTH = MAP_W * TILE
const HEIGHT = MAP_H * TILE

const PAL = {
  ground: '#AAB490',
  groundAlt: '#B3BC98',
  groundShade: '#929C77',
  soil: '#B89E7C',
  soilAlt: '#C3AA87',
  stone: '#D9C7A8',
  stoneHi: '#E8DABF',
  stoneShade: '#B7A383',
  teal: '#668F8A',
  lavender: '#A89BC0',
  gold: '#C69A45',
  navy: '#3F4358',
}

const markers = [
  { id: 'M01', x: 24, y: 29, state: 'nearby' },
  { id: 'M02', x: 19, y: 28, state: 'active' },
  { id: 'M03', x: 14, y: 25, state: 'active' },
  { id: 'M04', x: 10, y: 21, state: 'completed' },
  { id: 'M05', x: 10, y: 16, state: 'active' },
  { id: 'M06', x: 16, y: 8, state: 'active' },
  { id: 'M07', x: 19, y: 12, state: 'unavailable' },
  { id: 'M08', x: 24, y: 13, state: 'locked' },
  { id: 'M09', x: 29, y: 12, state: 'active' },
  { id: 'M10', x: 34, y: 14, state: 'active' },
  { id: 'M11', x: 38, y: 19, state: 'active' },
  { id: 'M12', x: 36, y: 24, state: 'completed' },
  { id: 'M13', x: 31, y: 28, state: 'active' },
  { id: 'M14', x: 21, y: 19, state: 'active' },
  { id: 'M15', x: 27, y: 19, state: 'active' },
]

const loopPath = 'M 768 1104 L 768 884 C 660 884 560 846 470 774 C 354 681 320 583 340 470 C 363 341 512 310 640 368 C 712 401 824 401 896 368 C 1024 310 1173 341 1196 470 C 1216 583 1182 681 1066 774 C 976 846 876 884 768 884'

function svgDocument(width, height, body, transparent = false) {
  const bg = transparent ? '' : `<rect width="${width}" height="${height}" fill="${PAL.ground}"/>`
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${bg}${body}</svg>`)
}

function detail(seed, tone) {
  const x = 5 + ((seed * 7) % 20)
  const y = 6 + ((seed * 11) % 18)
  const x2 = 6 + ((seed * 13) % 18)
  const y2 = 5 + ((seed * 17) % 20)
  return `<rect x="${x}" y="${y}" width="${seed % 2 ? 2 : 3}" height="1" rx="0.5" fill="${tone}" opacity="0.45"/>
    <rect x="${x2}" y="${y2}" width="1" height="${seed % 3 ? 2 : 3}" fill="${tone}" opacity="0.28"/>`
}

function groundTile(kind, variant) {
  const base = kind === 'grass' ? PAL.ground : PAL.soil
  const alt = kind === 'grass' ? PAL.groundAlt : PAL.soilAlt
  const mark = kind === 'grass' ? PAL.groundShade : PAL.stoneShade
  return svgDocument(TILE, TILE, `<rect width="32" height="32" fill="${base}"/>
    <rect x="4" y="5" width="3" height="1" fill="${alt}" opacity="${0.22 + variant * 0.03}"/>
    ${detail(variant + (kind === 'grass' ? 2 : 8), mark)}`, true)
}

function edgeTile(mask) {
  let edge = ''
  if (mask & 1) edge += `<rect x="0" y="0" width="32" height="2" fill="${PAL.stoneShade}"/><rect x="0" y="2" width="32" height="1" fill="${PAL.stoneHi}"/>`
  if (mask & 2) edge += `<rect x="30" y="0" width="2" height="32" fill="${PAL.stoneShade}"/><rect x="29" y="0" width="1" height="32" fill="${PAL.stoneHi}"/>`
  if (mask & 4) edge += `<rect x="0" y="30" width="32" height="2" fill="${PAL.stoneShade}"/><rect x="0" y="29" width="32" height="1" fill="${PAL.stoneHi}"/>`
  if (mask & 8) edge += `<rect x="0" y="0" width="2" height="32" fill="${PAL.stoneShade}"/><rect x="2" y="0" width="1" height="32" fill="${PAL.stoneHi}"/>`
  const joint = mask % 3 === 0 ? `<rect x="10" y="15" width="12" height="1" fill="${PAL.stoneShade}" opacity="0.25"/>` : `<rect x="15" y="9" width="1" height="14" fill="${PAL.stoneShade}" opacity="0.22"/>`
  return svgDocument(TILE, TILE, `<rect width="32" height="32" fill="${PAL.stone}"/>${edge}${joint}`, true)
}

function curveTile(name, d) {
  return svgDocument(TILE, TILE, `<path d="${d}" fill="none" stroke="${PAL.stoneShade}" stroke-width="18" stroke-linecap="butt"/>
    <path d="${d}" fill="none" stroke="${PAL.stone}" stroke-width="14" stroke-linecap="butt"/>
    <path d="${d}" fill="none" stroke="${PAL.stoneHi}" stroke-width="1" opacity="0.72"/>`, true)
}

function gardenTile(name) {
  const bodies = {
    'garden-ring-h': `<rect y="10" width="32" height="12" fill="${PAL.stoneShade}"/><rect y="8" width="32" height="12" fill="${PAL.stone}"/><rect y="8" width="32" height="1" fill="${PAL.stoneHi}"/>`,
    'garden-ring-v': `<rect x="10" width="12" height="32" fill="${PAL.stoneShade}"/><rect x="8" width="12" height="32" fill="${PAL.stone}"/><rect x="8" width="1" height="32" fill="${PAL.stoneHi}"/>`,
    'garden-shortcut-v': `<rect x="8" width="16" height="32" fill="${PAL.stone}"/><rect x="8" width="1" height="32" fill="${PAL.stoneHi}"/><rect x="23" width="1" height="32" fill="${PAL.stoneShade}"/>`,
    'garden-center-motif': `<path d="M3 11 Q8 7 13 11 T23 11" fill="none" stroke="${PAL.teal}" stroke-width="2" opacity="0.58"/><path d="M9 20 Q14 16 19 20 T29 20" fill="none" stroke="${PAL.lavender}" stroke-width="2" opacity="0.48"/><rect x="5" y="25" width="8" height="2" fill="${PAL.teal}" opacity="0.28"/><rect x="17" y="5" width="6" height="2" fill="${PAL.lavender}" opacity="0.25"/>`,
    'flowerbed-edge-h': `<rect y="18" width="32" height="8" fill="${PAL.stoneShade}"/><rect y="16" width="32" height="8" fill="${PAL.stone}"/><rect y="12" width="32" height="5" fill="${PAL.teal}"/><rect x="6" y="10" width="3" height="3" fill="${PAL.lavender}"/><rect x="22" y="11" width="3" height="3" fill="${PAL.gold}"/>`,
    'flowerbed-edge-v': `<rect x="18" width="8" height="32" fill="${PAL.stoneShade}"/><rect x="16" width="8" height="32" fill="${PAL.stone}"/><rect x="12" width="5" height="32" fill="${PAL.teal}"/><rect x="10" y="6" width="3" height="3" fill="${PAL.lavender}"/><rect x="11" y="22" width="3" height="3" fill="${PAL.gold}"/>`,
    'gate-approach': `<rect x="5" width="22" height="32" fill="${PAL.stone}"/><rect x="5" width="2" height="32" fill="${PAL.gold}" opacity="0.7"/><rect x="25" width="2" height="32" fill="${PAL.gold}" opacity="0.7"/>`,
    'stage-approach': `<rect x="5" width="22" height="32" fill="${PAL.stone}"/><path d="M8 24 Q16 14 24 24" fill="none" stroke="${PAL.lavender}" stroke-width="2"/>`,
  }
  return svgDocument(TILE, TILE, bodies[name], true)
}

async function writeTiles() {
  const tiles = []
  for (let i = 0; i < 5; i++) tiles.push({ name: `grass-${i}`, svg: groundTile('grass', i), group: 'ground' })
  for (let i = 0; i < 4; i++) tiles.push({ name: `soil-${i}`, svg: groundTile('soil', i), group: 'ground' })
  for (let mask = 0; mask < 16; mask++) tiles.push({ name: `path-edge-${mask.toString(16).toUpperCase()}`, svg: edgeTile(mask), group: 'path' })
  tiles.push(
    { name: 'curve-ne', svg: curveTile('curve-ne', 'M16 32 Q16 16 32 16'), group: 'curve' },
    { name: 'curve-es', svg: curveTile('curve-es', 'M0 16 Q16 16 16 32'), group: 'curve' },
    { name: 'curve-sw', svg: curveTile('curve-sw', 'M16 0 Q16 16 0 16'), group: 'curve' },
    { name: 'curve-wn', svg: curveTile('curve-wn', 'M32 16 Q16 16 16 0'), group: 'curve' },
  )
  for (const name of ['garden-ring-h', 'garden-ring-v', 'garden-shortcut-v', 'garden-center-motif', 'flowerbed-edge-h', 'flowerbed-edge-v', 'gate-approach', 'stage-approach']) {
    tiles.push({ name, svg: gardenTile(name), group: 'garden' })
  }

  const columns = 8
  const rows = Math.ceil(tiles.length / columns)
  const composites = []
  const manifestTiles = []
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]
    const png = await sharp(tile.svg).png().toBuffer()
    await sharp(png).toFile(path.join(TILE_DIR, `${tile.name}.png`))
    const x = (i % columns) * TILE
    const y = Math.floor(i / columns) * TILE
    composites.push({ input: png, left: x, top: y })
    manifestTiles.push({ name: tile.name, group: tile.group, x, y, w: TILE, h: TILE })
  }
  await sharp({ create: { width: columns * TILE, height: rows * TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites).png().toFile(path.join(ASSET_DIR, 'music-ground-path-b1-atlas.png'))

  const atlasSvg = tiles.map((tile, i) => {
    const x = (i % columns) * TILE
    const y = Math.floor(i / columns) * TILE
    return `<g transform="translate(${x} ${y})">${tile.svg.toString().replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`
  }).join('')
  fs.writeFileSync(path.join(ASSET_DIR, 'music-ground-path-b1-atlas.svg'), svgDocument(columns * TILE, rows * TILE, atlasSvg, true))

  fs.writeFileSync(path.join(ASSET_DIR, 'music-ground-path-b1-manifest.json'), JSON.stringify({
    version: '2C-B1-v1',
    tileSize: TILE,
    runtimeScale: 1,
    sourceMaster: 'music-ground-path-b1-atlas.svg',
    smoothing: false,
    palette: PAL,
    tiles: manifestTiles,
  }, null, 2))
  return { tiles, columns, rows }
}

function mapDetails() {
  const parts = []
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const hash = (x * 17 + y * 31 + x * y * 3) % 23
      if (hash === 0 || hash === 7) {
        const color = hash === 0 ? PAL.groundAlt : PAL.groundShade
        parts.push(`<rect x="${x * TILE + 8 + (y % 7)}" y="${y * TILE + 9 + (x % 8)}" width="${hash === 0 ? 3 : 2}" height="1" fill="${color}" opacity="0.32"/>`)
      }
    }
  }
  return parts.join('')
}

function mapSvg() {
  return svgDocument(WIDTH, HEIGHT, `
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${PAL.ground}"/>
    ${mapDetails()}
    <rect x="64" y="64" width="384" height="256" rx="80" fill="${PAL.soil}" opacity="0.48"/>
    <rect x="1088" y="64" width="384" height="256" rx="80" fill="${PAL.soil}" opacity="0.42"/>
    <rect x="64" y="864" width="384" height="224" rx="72" fill="${PAL.soil}" opacity="0.36"/>
    <rect x="1088" y="864" width="384" height="224" rx="72" fill="${PAL.soil}" opacity="0.32"/>

    <path d="${loopPath}" fill="none" stroke="${PAL.stoneShade}" stroke-width="116" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${loopPath}" fill="none" stroke="${PAL.stone}" stroke-width="96" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${loopPath}" fill="none" stroke="${PAL.stoneHi}" stroke-width="2" stroke-linecap="round" opacity="0.75"/>

    <path d="M640 400 L640 320 M896 400 L896 320 M768 448 L768 320" stroke="${PAL.stoneShade}" stroke-width="84" stroke-linecap="round"/>
    <path d="M640 400 L640 320 M896 400 L896 320 M768 448 L768 320" stroke="${PAL.stone}" stroke-width="68" stroke-linecap="round"/>
    <path d="M768 1104 L768 704" stroke="${PAL.stone}" stroke-width="96"/>
    <path d="M768 1104 L768 704" stroke="${PAL.stoneHi}" stroke-width="2" opacity="0.7"/>

    <rect x="544" y="448" width="448" height="256" rx="104" fill="${PAL.groundAlt}" stroke="${PAL.stoneShade}" stroke-width="42"/>
    <rect x="544" y="448" width="448" height="256" rx="104" fill="none" stroke="${PAL.stone}" stroke-width="30"/>
    <path d="M768 704 L768 448" stroke="${PAL.stoneShade}" stroke-width="58"/>
    <path d="M768 704 L768 448" stroke="${PAL.stone}" stroke-width="48"/>

    <path d="M704 520 Q736 496 768 520 T832 520" fill="none" stroke="${PAL.teal}" stroke-width="7" opacity="0.48"/>
    <path d="M720 636 Q748 616 776 636 T832 636" fill="none" stroke="${PAL.lavender}" stroke-width="6" opacity="0.38"/>
    <rect x="716" y="548" width="22" height="5" rx="2" fill="${PAL.teal}" opacity="0.26"/>
    <rect x="798" y="592" width="18" height="5" rx="2" fill="${PAL.lavender}" opacity="0.24"/>
    <path d="M740 570 L756 562 M784 606 L800 598" stroke="${PAL.stoneShade}" stroke-width="4" opacity="0.32"/>

    <rect x="704" y="1056" width="128" height="80" rx="16" fill="${PAL.stone}" stroke="${PAL.stoneShade}" stroke-width="3"/>
    <path d="M724 1088 Q768 1058 812 1088" fill="none" stroke="${PAL.teal}" stroke-width="6"/>
    <path d="M754 1060 H782" stroke="${PAL.gold}" stroke-width="3" opacity="0.52"/>

    <path d="M704 318 Q768 266 832 318" fill="none" stroke="${PAL.lavender}" stroke-width="8" opacity="0.8"/>
    <path d="M720 324 Q768 286 816 324" fill="none" stroke="${PAL.gold}" stroke-width="3" opacity="0.65"/>
  `)
}

function guidesSvg() {
  const markerGuides = markers.map((m) => `<circle cx="${m.x * TILE + 16}" cy="${m.y * TILE + 16}" r="32" fill="none" stroke="#227C9D" stroke-width="4"/><circle cx="${m.x * TILE + 16}" cy="${m.y * TILE + 16}" r="64" fill="none" stroke="#227C9D" stroke-width="2" stroke-dasharray="8 8" opacity="0.5"/>`).join('')
  return svgDocument(WIDTH, HEIGHT, `
    <g fill="#E85D75" fill-opacity="0.16" stroke="#E85D75" stroke-width="4" stroke-dasharray="10 8">
      <rect x="96" y="128" width="320" height="192"/><rect x="1120" y="128" width="320" height="192"/>
      <rect x="96" y="864" width="320" height="192"/><rect x="1120" y="864" width="320" height="192"/>
      <rect x="576" y="96" width="384" height="224"/>
    </g>
    <g fill="#C69A45" fill-opacity="0.18" stroke="#C69A45" stroke-width="4">
      <rect x="704" y="1056" width="128" height="80"/>
    </g>
    <g>${markerGuides}</g>
    <g fill="#61B89A" fill-opacity="0.12" stroke="#61B89A" stroke-width="4" stroke-dasharray="12 8">
      <rect x="48" y="1024" width="420" height="80" rx="30"/>
      <rect x="1068" y="1024" width="420" height="80" rx="30"/>
    </g>
  `, true)
}

function gridOverlay(color = '#443B59', opacity = 0.34) {
  let lines = ''
  for (let x = 0; x <= WIDTH; x += TILE) lines += `<path d="M${x} 0V${HEIGHT}"/>`
  for (let y = 0; y <= HEIGHT; y += TILE) lines += `<path d="M0 ${y}H${WIDTH}"/>`
  return svgDocument(WIDTH, HEIGHT, `<g fill="none" stroke="${color}" stroke-width="1" opacity="${opacity}">${lines}</g>`, true)
}

function repetitionOverlay() {
  const colors = ['#E36E77', '#F2B84B', '#5AB7A8', '#7B88D1', '#A879C2']
  let cells = ''
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const idx = (x * 17 + y * 31 + x * y * 3) % 5
      cells += `<rect x="${x * TILE}" y="${y * TILE}" width="32" height="32" fill="${colors[idx]}" opacity="0.13"/>`
    }
  }
  return svgDocument(WIDTH, HEIGHT, cells, true)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function viewBox(focusX, focusY, tilesW, tilesH) {
  return {
    left: Math.round(clamp(focusX - tilesW / 2, 0, MAP_W - tilesW) * TILE),
    top: Math.round(clamp(focusY - tilesH / 2, 0, MAP_H - tilesH) * TILE),
    width: tilesW * TILE,
    height: tilesH * TILE,
  }
}

async function capture(name, basePath, box, overlays = [], grayscale = false) {
  let pipeline = sharp(basePath).extract(box)
  if (overlays.length) {
    const comps = []
    for (const overlay of overlays) {
      const crop = await sharp(overlay).extract(box).png().toBuffer()
      comps.push({ input: crop, left: 0, top: 0 })
    }
    pipeline = pipeline.composite(comps)
  }
  if (grayscale) pipeline = pipeline.grayscale()
  await pipeline.png().toFile(path.join(PREVIEW_DIR, name))
}

async function makeComparison(artPath) {
  const whitebox = path.join(ROOT, 'design/2d-map-redesign/previews/music-whitebox-overview-desktop.png')
  const left = await sharp(whitebox).resize(900, 675, { fit: 'cover' }).png().toBuffer()
  const right = await sharp(artPath).resize(900, 675, { fit: 'cover' }).png().toBuffer()
  const overlay = svgDocument(1900, 760, `<style>text{font-family:Arial,sans-serif;fill:#F7F1E7;font-weight:700;font-size:28px}</style>
    <text x="40" y="52">WHITEBOX STRUCTURE</text><text x="960" y="52">2C-B1 GROUND / PATH ART</text>
    <rect x="30" y="70" width="910" height="685" fill="none" stroke="#8F8AA8" stroke-width="4"/>
    <rect x="950" y="70" width="910" height="685" fill="none" stroke="${PAL.teal}" stroke-width="4"/>`, true)
  await sharp({ create: { width: 1900, height: 760, channels: 4, background: '#171827' } })
    .composite([{ input: left, left: 35, top: 75 }, { input: right, left: 955, top: 75 }, { input: overlay, left: 0, top: 0 }])
    .png().toFile(path.join(PREVIEW_DIR, 'whitebox-new-art-comparison.png'))
}

async function main() {
  fs.mkdirSync(TILE_DIR, { recursive: true })
  fs.mkdirSync(PREVIEW_DIR, { recursive: true })
  const atlas = await writeTiles()

  const mapSource = mapSvg()
  const guideSource = guidesSvg()
  const gridSource = gridOverlay()
  const repetitionSource = repetitionOverlay()
  fs.writeFileSync(path.join(ASSET_DIR, 'music-ground-path-map.svg'), mapSource)
  fs.writeFileSync(path.join(ASSET_DIR, 'music-ground-path-guides.svg'), guideSource)
  fs.writeFileSync(path.join(ASSET_DIR, 'music-tile-grid.svg'), gridSource)
  fs.writeFileSync(path.join(ASSET_DIR, 'music-repetition-guide.svg'), repetitionSource)

  const mapPath = path.join(ASSET_DIR, 'music-ground-path-map.png')
  const guidePath = path.join(ASSET_DIR, 'music-ground-path-guides.png')
  const gridPath = path.join(ASSET_DIR, 'music-tile-grid.png')
  const repetitionPath = path.join(ASSET_DIR, 'music-repetition-guide.png')
  await sharp(mapSource).png().toFile(mapPath)
  await sharp(guideSource).png().toFile(guidePath)
  await sharp(gridSource).png().toFile(gridPath)
  await sharp(repetitionSource).png().toFile(repetitionPath)

  await sharp(path.join(ASSET_DIR, 'music-ground-path-b1-atlas.png')).resize(atlas.columns * 64, atlas.rows * 64, { kernel: 'nearest' }).png().toFile(path.join(PREVIEW_DIR, 'asset-atlas-2x-nearest.png'))
  await capture('ground-path-overview.png', mapPath, { left: 0, top: 0, width: WIDTH, height: HEIGHT })
  await capture('laptop-start.png', mapPath, viewBox(24, 29, 24, 18))
  await capture('laptop-center.png', mapPath, viewBox(24, 19, 24, 18))
  await capture('laptop-stage-approach.png', mapPath, viewBox(24, 8, 24, 18))
  await capture('mobile-portrait-start.png', mapPath, viewBox(24, 29, 14, 25))
  await capture('mobile-landscape-center.png', mapPath, viewBox(24, 19, 28, 13))
  await capture('grayscale-overview.png', mapPath, { left: 0, top: 0, width: WIDTH, height: HEIGHT }, [], true)
  await capture('tile-seam-emphasis.png', mapPath, { left: 0, top: 0, width: WIDTH, height: HEIGHT }, [gridPath])
  await capture('repetition-check.png', mapPath, { left: 0, top: 0, width: WIDTH, height: HEIGHT }, [repetitionPath, gridPath])
  await capture('marker-clearance-overlay.png', mapPath, { left: 0, top: 0, width: WIDTH, height: HEIGHT }, [guidePath])
  await makeComparison(mapPath)

  console.log(JSON.stringify({ tileSize: TILE, tiles: atlas.tiles.length, atlas: `${atlas.columns}x${atlas.rows}`, markers: markers.length, output: ASSET_DIR }))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
