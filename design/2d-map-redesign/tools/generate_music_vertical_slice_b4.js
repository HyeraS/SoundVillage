const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '../../..')
const B1 = path.join(ROOT, 'public/design-previews/music-ground-path-b1')
const B2 = path.join(ROOT, 'public/design-previews/music-landmarks-b2')
const B3 = path.join(ROOT, 'public/design-previews/music-buildings-props-b3')
const OUT = path.join(ROOT, 'public/design-previews/music-vertical-slice-b4')
const PREVIEW = path.join(ROOT, 'design/2d-map-redesign/previews/2c-b4-music')
const TILE = 32
const MAP = { width: 1536, height: 1152, tiles: { width: 48, height: 36 } }

const b1Manifest = JSON.parse(fs.readFileSync(path.join(B1, 'music-ground-path-b1-manifest.json'), 'utf8'))
const b2Manifest = JSON.parse(fs.readFileSync(path.join(B2, 'manifest.json'), 'utf8'))
const b3Manifest = JSON.parse(fs.readFileSync(path.join(B3, 'manifest.json'), 'utf8'))

const MARKERS = [
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

const MARKER_STATES = {
  locked: { label: 'LOCKED', glyph: '▣', color: '#7D7894', dash: '8 7', inner: true },
  unavailable: { label: 'UNAVAILABLE', glyph: '◇', color: '#9A91B0', dash: '3 7', inner: true },
  active: { label: 'ACTIVE', glyph: '≈', color: '#7EE7F2', dash: '', inner: true },
  nearby: { label: 'NEARBY / INTERACTABLE', glyph: '≈', color: '#FFE18A', dash: '', inner: true, thick: true },
  interacting: { label: 'INTERACTING', glyph: 'Ⅱ', color: '#D4B2FF', dash: '', inner: true },
  submitting: { label: 'SUBMITTING', glyph: '↻', color: '#FFD166', dash: '4 4', inner: true },
  completed: { label: 'COMPLETED', glyph: '✓', color: '#8F9BB3', dash: '', fill: true },
  saveError: { label: 'SAVE ERROR', glyph: '!', color: '#FF8F8F', dash: '2 5', inner: true },
  audioError: { label: 'TECHNICAL AUDIO ERROR', glyph: '≁', color: '#FFB36B', dash: '9 4', inner: true },
}

const BUILDING_LAYERS = ['contact-shadow', 'body', 'roof', 'door-window', 'trim']
const POST_PROP_BUILDING_LAYERS = ['foreground', 'emissive']
const CHARACTER = path.join(B3, 'guides/mock-character.png')

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>`)
}

function markerShape(stateKey, label = null) {
  const state = MARKER_STATES[stateKey]
  const strokeWidth = state.thick ? 6 : 4
  return `<circle r="25" fill="#15162A" fill-opacity=".94" stroke="${state.color}" stroke-width="${strokeWidth}" stroke-dasharray="${state.dash}"/>` +
    (state.fill
      ? `<circle r="17" fill="${state.color}" fill-opacity=".34"/>`
      : `<circle r="17" fill="none" stroke="${state.color}" stroke-width="2" opacity=".78"/>`) +
    `<text x="0" y="2" fill="${state.color}" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="21" font-weight="800">${state.glyph}</text>` +
    (label ? `<rect x="-27" y="29" width="54" height="18" rx="5" fill="#111426" fill-opacity=".92"/><text x="0" y="42" fill="#F7F1E7" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="800">${label}</text>` : '')
}

function markerOverlay(markers = MARKERS) {
  return svg(MAP.width, MAP.height, markers.map((marker) => {
    const x = marker.x * TILE + TILE / 2
    const y = marker.y * TILE + TILE / 2
    return `<g transform="translate(${x} ${y})">${markerShape(marker.state, marker.id)}</g>`
  }).join(''))
}

function propSpec(id) {
  return b3Manifest.props.find((prop) => prop.id === id)
}

function propComposites() {
  return b3Manifest.placements.map(([id, x, y]) => {
    const prop = propSpec(id)
    return {
      input: path.join(B3, 'props', prop.category, `${id}.png`),
      left: x * TILE,
      top: y * TILE - Math.max(0, prop.canvas.height - TILE),
    }
  })
}

function buildingLayerComposites(layers, emissive) {
  return b3Manifest.buildings.flatMap((building) => layers.flatMap((layer) => {
    if (layer === 'emissive' && !emissive) return []
    return [{
      input: path.join(B3, 'buildings', building.id, `${layer}.png`),
      left: building.pixelRect.x,
      top: building.pixelRect.y,
    }]
  }))
}

function landmarkComposites(emissive) {
  const stage = b2Manifest.stage
  const gate = b2Manifest.gate
  const stageLayers = [
    'contact-shadow', 'base-platform', 'rear-body', 'opening', 'canopy-s1',
    'trim', 'front-stair', 'foreground', ...(emissive ? ['emissive'] : []),
  ]
  const gateLayers = [
    'contact-shadow', 'posts', 'rail-g1', 'trim', 'foreground', ...(emissive ? ['emissive'] : []),
  ]
  return [
    ...stageLayers.map((layer) => ({ input: path.join(B2, 'stage', `${layer}.png`), left: stage.x, top: stage.y })),
    ...gateLayers.map((layer) => ({ input: path.join(B2, 'gate', `${layer}.png`), left: gate.x, top: gate.y })),
  ]
}

async function baseMap({ emissive = true, markers = false, character = null, overlays = [] } = {}) {
  const composites = [
    ...landmarkComposites(emissive),
    ...buildingLayerComposites(BUILDING_LAYERS, emissive),
    ...propComposites(),
    ...buildingLayerComposites(POST_PROP_BUILDING_LAYERS, emissive),
    ...overlays,
  ]
  if (markers) composites.push({ input: markerOverlay(), left: 0, top: 0 })
  if (character) composites.push({ input: CHARACTER, left: character.left, top: character.top })
  return sharp(path.join(B1, 'music-ground-path-map.png')).composite(composites).png().toBuffer()
}

function viewBox(centerX, centerY, tilesW, tilesH) {
  const width = tilesW * TILE
  const height = tilesH * TILE
  return {
    left: Math.round(Math.min(MAP.width - width, Math.max(0, centerX * TILE - width / 2))),
    top: Math.round(Math.min(MAP.height - height, Math.max(0, centerY * TILE - height / 2))),
    width,
    height,
  }
}

async function crop(source, box) {
  return sharp(source).extract(box).png().toBuffer()
}

async function board(name, cells, { cols = 2, cellW = 560, cellH = 360, header = 42, margin = 22 } = {}) {
  const rows = Math.ceil(cells.length / cols)
  const width = cols * cellW + (cols + 1) * margin
  const height = rows * (cellH + header) + (rows + 1) * margin
  const labels = cells.map((cell, index) => {
    const x = margin + (index % cols) * (cellW + margin)
    const y = margin + Math.floor(index / cols) * (cellH + header + margin)
    return `<text x="${x}" y="${y + 27}">${cell.label}</text>`
  }).join('')
  const background = svg(width, height, `<rect width="100%" height="100%" fill="#171827"/><style>text{font-family:Arial,sans-serif;fill:#F7F1E7;font-size:18px;font-weight:800;letter-spacing:.5px}</style>${labels}`)
  const composites = []
  for (let index = 0; index < cells.length; index++) {
    const input = await sharp(cells[index].input).resize(cellW, cellH, {
      fit: 'contain',
      background: { r: 222, g: 217, b: 197, alpha: 1 },
      kernel: 'nearest',
    }).png().toBuffer()
    composites.push({
      input,
      left: margin + (index % cols) * (cellW + margin),
      top: margin + header + Math.floor(index / cols) * (cellH + header + margin),
    })
  }
  await sharp(background).composite(composites).png().toFile(path.join(PREVIEW, name))
}

async function guideMaps() {
  const collision = await baseMap({ overlays: [
    { input: path.join(B2, 'stage/collision.png'), left: b2Manifest.stage.x, top: b2Manifest.stage.y },
    { input: path.join(B2, 'gate/collision.png'), left: b2Manifest.gate.x, top: b2Manifest.gate.y },
    { input: path.join(B3, 'guides/collision-guide.png'), left: 0, top: 0 },
  ] })
  const entrance = await baseMap({ overlays: [
    { input: path.join(B2, 'guides/stage-approach-map.png'), left: 0, top: 0 },
    { input: path.join(B2, 'gate/interaction.png'), left: b2Manifest.gate.x, top: b2Manifest.gate.y },
    { input: path.join(B2, 'gate/opening-guide.png'), left: b2Manifest.gate.x, top: b2Manifest.gate.y },
    { input: path.join(B3, 'guides/entrances-guide.png'), left: 0, top: 0 },
  ] })
  const marker = await baseMap({ overlays: [
    { input: path.join(B3, 'guides/markers-guide.png'), left: 0, top: 0 },
  ] })
  return { collision, entrance, marker }
}

async function markerStateMontage(environment) {
  const background = await crop(environment, viewBox(24, 19, 10, 6))
  const cells = []
  for (const [stateKey, state] of Object.entries(MARKER_STATES)) {
    const marker = svg(96, 96, `<g transform="translate(48 44)">${markerShape(stateKey)}</g>`)
    const input = await sharp(background).resize(320, 192, { fit: 'cover', kernel: 'nearest' })
      .composite([{ input: marker, left: 112, top: 42 }]).png().toBuffer()
    cells.push({ label: state.label, input })
  }
  await board('marker-state-contrast-montage.png', cells, { cols: 3, cellW: 320, cellH: 192, header: 38, margin: 18 })
}

async function characterMontage(environment) {
  const locations = [
    ['WORLD GATE OPENING', 24, 31.5],
    ['GARDEN SHORTCUT', 24, 20],
    ['STAGE 3×3 APPROACH', 24.5, 13],
    ['RECORD ARCHIVE · SOUTH', 7.5, 11.5],
    ['LISTENING CAFE · SOUTH', 39.5, 11.5],
    ['COMMUNITY STUDIO · EAST', 14.5, 29.5],
    ['SOUND WORKSHOP · WEST', 34.5, 29.5],
    ['FOREGROUND EDGE ADJACENT', 4, 34],
  ]
  const cells = []
  for (const [label, footX, footY] of locations) {
    const left = Math.round(footX * TILE - 36)
    const top = Math.round(footY * TILE - 88)
    const withCharacter = await sharp(environment).composite([{ input: CHARACTER, left, top }]).png().toBuffer()
    cells.push({ label, input: await crop(withCharacter, viewBox(footX, footY - 1, 10, 7)) })
  }
  await board('character-foot-contact-montage.png', cells, { cols: 2, cellW: 480, cellH: 300, header: 38, margin: 18 })
}

async function layerHierarchyDiagram() {
  const rows = [
    ['01', 'B1 · GROUND / PATH', 'grass, soil, loop, spine, Garden, approach tiles'],
    ['02', 'CONTACT SHADOW', 'Stage, Gate, buildings, props · upper-left key light'],
    ['03', 'STRUCTURAL BODY', 'Stage base/rear/opening · Gate posts/rail · building body'],
    ['04', 'ROOF / CANOPY / DOOR', 'S1 canopy · G1 rail · four approved roof and entrance silhouettes'],
    ['05', 'LOW PROP FAMILY', 'flowerbed, bench, planter, lamp, vegetation, Garden object'],
    ['06', 'FOREGROUND CUTOUT', 'Stage/Gate/building overhang and map-edge clusters'],
    ['07', 'ENVIRONMENT EMISSIVE', 'static, restrained, independently removable'],
    ['08', 'CHARACTER', '72×88 display · bottom-center foot contact · 22×28 reference hitbox'],
    ['09', 'SOUND MARKER / UI', 'nine-state shared grammar · highest local functional contrast'],
    ['10', 'GUIDES · PREVIEW ONLY', 'collision, interaction, entrance and marker clearance overlays'],
  ]
  const width = 1400
  const height = 1040
  const boxes = rows.map((row, index) => {
    const y = 58 + index * 96
    const fill = index === 8 ? '#3B5E66' : index === 9 ? '#5B4A5F' : '#EEE7D8'
    const ink = index >= 8 ? '#FFF8E8' : '#3F4358'
    return `<rect x="70" y="${y}" width="1260" height="72" rx="10" fill="${fill}" stroke="#655F62" stroke-width="2"/>` +
      `<text x="96" y="${y + 31}" class="index">${row[0]}</text>` +
      `<text x="160" y="${y + 29}" fill="${ink}" class="title">${row[1]}</text>` +
      `<text x="160" y="${y + 54}" fill="${ink}" class="detail">${row[2]}</text>` +
      (index < rows.length - 1 ? `<path d="M700 ${y + 72}V${y + 93}" stroke="#C69A45" stroke-width="4"/><path d="M690 ${y + 88}L700 ${y + 98}L710 ${y + 88}" fill="none" stroke="#C69A45" stroke-width="4"/>` : '')
  }).join('')
  const source = svg(width, height, `<rect width="100%" height="100%" fill="#AAB490"/><style>.index{font:800 18px Arial;fill:#C69A45}.title{font:800 20px Arial;letter-spacing:.6px}.detail{font:15px Arial}</style>${boxes}`)
  await sharp(source).png().toFile(path.join(PREVIEW, 'b1-b3-layer-hierarchy-diagram.png'))
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function circleRectOverlap(circle, rect) {
  const cx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width))
  const cy = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height))
  return (circle.x - cx) ** 2 + (circle.y - cy) ** 2 < circle.radius ** 2
}

async function assetValidation() {
  const failures = []
  const checks = []
  async function checkPng(file, width, height, label) {
    const metadata = await sharp(file).metadata()
    const pass = metadata.width === width && metadata.height === height && metadata.hasAlpha === true
    checks.push({ label, pass, actual: `${metadata.width}x${metadata.height}`, expected: `${width}x${height}`, rgba: metadata.hasAlpha === true })
    if (!pass) failures.push(label)
  }

  for (const tile of b1Manifest.tiles) await checkPng(path.join(B1, 'tiles', `${tile.name}.png`), 32, 32, `B1:${tile.name}`)
  const stageLayers = ['contact-shadow', 'base-platform', 'rear-body', 'opening', 'canopy-s1', 'trim', 'front-stair', 'foreground', 'emissive', 'collision', 'approach']
  const gateLayers = ['contact-shadow', 'posts', 'rail-g1', 'trim', 'foreground', 'emissive', 'collision', 'interaction', 'opening-guide']
  for (const layer of stageLayers) await checkPng(path.join(B2, 'stage', `${layer}.png`), b2Manifest.stage.width, b2Manifest.stage.height, `B2:stage:${layer}`)
  for (const layer of gateLayers) await checkPng(path.join(B2, 'gate', `${layer}.png`), b2Manifest.gate.width, b2Manifest.gate.height, `B2:gate:${layer}`)
  for (const building of b3Manifest.buildings) {
    for (const layer of building.layers) await checkPng(path.join(B3, 'buildings', building.id, `${layer}.png`), building.canvas.width, building.canvas.height, `B3:${building.id}:${layer}`)
  }
  for (const prop of b3Manifest.props) await checkPng(path.join(B3, 'props', prop.category, `${prop.id}.png`), prop.canvas.width, prop.canvas.height, `B3:prop:${prop.id}`)

  const commonPaletteKeys = ['ground', 'soil', 'stone', 'stoneHi', 'stoneShade', 'teal', 'lavender', 'gold']
  const paletteConsistency = commonPaletteKeys.map((key) => {
    const values = [b1Manifest.palette[key], b2Manifest.palette[key], b3Manifest.palette[key]].filter(Boolean)
    return { key, values, pass: new Set(values).size === 1 }
  })
  if (paletteConsistency.some((entry) => !entry.pass)) failures.push('palette-consistency')

  const propRects = b3Manifest.placements.map(([id, x, y]) => {
    const prop = propSpec(id)
    const height = prop.canvas.height / TILE
    return { id, x, y: y - Math.max(0, height - 1), width: prop.canvas.width / TILE, height }
  })
  const propEntranceOverlaps = []
  for (const prop of propRects) for (const building of b3Manifest.buildings) if (rectsOverlap(prop, building.clearance)) propEntranceOverlaps.push([prop.id, building.id])
  const markerBuildingOverlaps = []
  const markerEntranceOverlaps = []
  const collisionRects = [b2Manifest.stage.collisionTiles, ...b2Manifest.gate.collisionTiles, ...b3Manifest.buildings.map((building) => building.collision)]
  for (const marker of MARKERS) {
    const circle = { x: marker.x + 0.5, y: marker.y + 0.5, radius: 1 }
    collisionRects.forEach((rect, index) => { if (circleRectOverlap(circle, rect)) markerBuildingOverlaps.push([marker.id, index]) })
    b3Manifest.buildings.forEach((building) => { if (circleRectOverlap(circle, building.clearance)) markerEntranceOverlaps.push([marker.id, building.id]) })
  }

  const anchorChecks = [
    { id: 'stage', pass: b2Manifest.stage.anchor.x === b2Manifest.stage.width / 2 && b2Manifest.stage.anchor.y === b2Manifest.stage.height },
    { id: 'gate', pass: b2Manifest.gate.anchor.x === b2Manifest.gate.width / 2 && b2Manifest.gate.anchor.y === b2Manifest.gate.height },
    ...b3Manifest.buildings.map((building) => ({ id: building.id, pass: building.anchor.x === building.canvas.width / 2 && building.anchor.y === building.canvas.height })),
  ]
  if (anchorChecks.some((entry) => !entry.pass)) failures.push('anchor-checks')
  if (propEntranceOverlaps.length) failures.push('prop-entrance-overlap')
  if (markerBuildingOverlaps.length) failures.push('marker-collision-overlap')
  if (markerEntranceOverlaps.length) failures.push('marker-entrance-overlap')

  return {
    pass: failures.length === 0,
    failures,
    pngChecks: { count: checks.length, passed: checks.filter((check) => check.pass).length },
    paletteConsistency,
    anchorChecks,
    overlaps: {
      propEntrance: propEntranceOverlaps,
      markerCollision: markerBuildingOverlaps,
      markerEntrance: markerEntranceOverlaps,
    },
    approvedGeometry: {
      stage: b2Manifest.stage.collisionTiles,
      stageApproach: b2Manifest.stage.approachTiles,
      gateOpening: b2Manifest.gate.openingTiles,
      gatePostCollision: b2Manifest.gate.collisionTiles,
      buildings: b3Manifest.buildings.map(({ id, collision, entrance, doorEdge, clearance }) => ({ id, collision, entrance, doorEdge, clearance })),
    },
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(PREVIEW, { recursive: true })

  const environment = await baseMap()
  const finalOverview = await baseMap({ markers: true })
  const emissiveOff = await baseMap({ emissive: false, markers: true })
  await sharp(finalOverview).png().toFile(path.join(PREVIEW, 'final-overview.png'))

  const cameraSpecs = [
    ['LAPTOP · START', 24, 29, 24, 18], ['LAPTOP · CENTER', 24, 19, 24, 18],
    ['LAPTOP · STAGE APPROACH', 24, 8, 24, 18], ['LAPTOP · RECORD ARCHIVE', 8, 8, 24, 18],
    ['LAPTOP · LISTENING CAFE', 40, 8, 24, 18], ['LAPTOP · COMMUNITY STUDIO', 8, 29, 24, 18],
    ['LAPTOP · SOUND WORKSHOP', 40, 29, 24, 18],
  ]
  const cameraCells = []
  for (const [label, x, y, w, h] of cameraSpecs) cameraCells.push({ label, input: await crop(finalOverview, viewBox(x, y, w, h)) })
  await board('camera-contact-sheet.png', cameraCells, { cols: 2, cellW: 576, cellH: 432, header: 38, margin: 18 })

  const entranceLocations = [
    ['RECORD ARCHIVE · SOUTH', 7.5, 11.5, 8, 9, 12, 8],
    ['LISTENING CAFE · SOUTH', 39.5, 11.5, 40, 9, 12, 8],
    ['COMMUNITY STUDIO · EAST', 14.5, 29.5, 11, 29, 16, 10],
    ['SOUND WORKSHOP · WEST', 34.5, 29.5, 37, 29, 16, 10],
  ]
  const entranceCells = []
  for (const [label, x, y, cropX, cropY, cropW, cropH] of entranceLocations) {
    const withCharacter = await sharp(environment).composite([{ input: CHARACTER, left: Math.round(x * TILE - 36), top: Math.round(y * TILE - 88) }]).png().toBuffer()
    entranceCells.push({ label, input: await crop(withCharacter, viewBox(cropX, cropY, cropW, cropH)) })
  }
  await board('building-entrance-montage.png', entranceCells, { cols: 2, cellW: 480, cellH: 320, header: 38, margin: 18 })

  await markerStateMontage(environment)

  const mobileCells = [
    { label: 'MOBILE PORTRAIT · START', input: await crop(finalOverview, viewBox(24, 29, 14, 25)) },
    { label: 'MOBILE PORTRAIT · STUDIO EAST', input: await crop(finalOverview, viewBox(11, 29, 14, 18)) },
    { label: 'MOBILE LANDSCAPE · CENTER', input: await crop(finalOverview, viewBox(24, 19, 28, 13)) },
    { label: 'MOBILE LANDSCAPE · WORKSHOP WEST', input: await crop(finalOverview, viewBox(37, 29, 18, 10)) },
    { label: '320×180 · FULL MAP', input: await sharp(finalOverview).resize(320, 180, { fit: 'fill', kernel: 'nearest' }).png().toBuffer() },
  ]
  await board('mobile-320-montage.png', mobileCells, { cols: 2, cellW: 480, cellH: 360, header: 38, margin: 18 })

  const grayscale = await sharp(finalOverview).grayscale().png().toBuffer()
  await board('grayscale-emissive-off-comparison.png', [
    { label: 'COLOR · EMISSIVE ON', input: finalOverview },
    { label: 'GRAYSCALE', input: grayscale },
    { label: 'COLOR · EMISSIVE OFF', input: emissiveOff },
  ], { cols: 3, cellW: 420, cellH: 315, header: 38, margin: 24 })

  const guides = await guideMaps()
  await board('collision-entrance-marker-clearance-montage.png', [
    { label: 'COLLISION', input: guides.collision },
    { label: 'ENTRANCE / INTERACTION', input: guides.entrance },
    { label: 'MARKER 1+2 TILE CLEARANCE', input: guides.marker },
  ], { cols: 3, cellW: 420, cellH: 315, header: 38, margin: 18 })

  await characterMontage(environment)
  await layerHierarchyDiagram()

  const validation = await assetValidation()
  const previewFiles = [
    'final-overview.png', 'camera-contact-sheet.png', 'building-entrance-montage.png',
    'marker-state-contrast-montage.png', 'mobile-320-montage.png',
    'grayscale-emissive-off-comparison.png', 'collision-entrance-marker-clearance-montage.png',
    'character-foot-contact-montage.png', 'b1-b3-layer-hierarchy-diagram.png',
  ]
  const manifest = {
    version: '2C-B4-v1',
    productionUse: false,
    role: 'integration-index',
    frozenVariants: { stage: 'S1 low double-wave', gate: 'G1 open wave rail', buildings: '2C-B3.1-v1' },
    map: MAP,
    tileSize: TILE,
    runtimeScale: 1,
    timeOfDay: 'bright-soft-late-afternoon',
    sourceManifests: {
      groundPath: '../music-ground-path-b1/music-ground-path-b1-manifest.json',
      landmarks: '../music-landmarks-b2/manifest.json',
      buildingsProps: '../music-buildings-props-b3/manifest.json',
    },
    markerContract: {
      source: 'app/music-whitebox-preview/page.js',
      count: MARKERS.length,
      positions: MARKERS.map(({ id, x, y }) => ({ id, x, y })),
      states: Object.keys(MARKER_STATES),
      immutableForB4: true,
    },
    drawOrder: [
      'B1 ground/path', 'contact shadows', 'Stage/Gate structural layers',
      'building body/roof/door/trim', 'low props', 'foreground cutouts',
      'environment emissive', 'character', 'sound marker/UI', 'preview-only guides',
    ],
    productionExclusions: [
      'all collision/interaction/clearance guide PNG/SVG', 'mock-character',
      'concept references', 'comparison boards', 'all design/2d-map-redesign/previews files',
    ],
    reviewImages: previewFiles.map((file) => `../../../design/2d-map-redesign/previews/2c-b4-music/${file}`),
    validation,
    remainingProductionMeasurements: [
      'approved preview visual edge versus production walkable/collision mask: target <=0.5 tile',
      'Gate 2-tile opening and post collision with runtime player box',
      'Stage 3x3 approach and four building entrance triggers under real movement input',
      'marker interaction radius versus approved 1+2 tile visual clearance',
      'camera/FOV framing after production renderer replacement',
    ],
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify({ out: OUT, preview: PREVIEW, validation: validation.pass, pngChecks: validation.pngChecks, files: previewFiles.length }))
  if (!validation.pass) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
