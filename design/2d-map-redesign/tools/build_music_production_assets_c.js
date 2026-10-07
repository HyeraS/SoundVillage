const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '../../..')
const SOURCES = {
  b1: path.join(ROOT, 'public/design-previews/music-ground-path-b1'),
  b2: path.join(ROOT, 'public/design-previews/music-landmarks-b2'),
  b3: path.join(ROOT, 'public/design-previews/music-buildings-props-b3'),
}
const OUT = path.join(ROOT, 'public/assets/music-village')

const b2 = JSON.parse(fs.readFileSync(path.join(SOURCES.b2, 'manifest.json'), 'utf8'))
const b3 = JSON.parse(fs.readFileSync(path.join(SOURCES.b3, 'manifest.json'), 'utf8'))

const files = []
function copy(sourceRoot, relativeSource, relativeDestination = relativeSource) {
  const source = path.join(sourceRoot, relativeSource)
  const destination = path.join(OUT, relativeDestination)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
  const data = fs.readFileSync(destination)
  files.push({
    path: relativeDestination,
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  })
}

copy(SOURCES.b1, 'music-ground-path-map.png', 'ground/music-ground-path-map.png')

for (const layer of ['contact-shadow', 'base-platform', 'rear-body', 'opening', 'canopy-s1', 'trim', 'front-stair', 'foreground', 'emissive']) {
  copy(SOURCES.b2, `stage/${layer}.png`)
}
for (const layer of ['contact-shadow', 'posts', 'rail-g1', 'trim', 'foreground', 'emissive']) {
  copy(SOURCES.b2, `gate/${layer}.png`)
}
for (const building of b3.buildings) {
  for (const layer of ['contact-shadow', 'body', 'roof', 'door-window', 'trim', 'foreground', 'emissive']) {
    copy(SOURCES.b3, `buildings/${building.id}/${layer}.png`)
  }
}
for (const prop of b3.props) copy(SOURCES.b3, `props/${prop.category}/${prop.id}.png`)

const manifest = {
  version: '2C-C-v1',
  productionUse: true,
  generatedFrom: {
    ground: '2C-B1-v1',
    landmarks: '2C-B2-v1 (approved S1/G1 only)',
    buildingsProps: '2C-B3.1-v1',
    integrationFreeze: '2C-B4-v1',
  },
  map: { width: 1536, height: 1152, tiles: { width: 48, height: 36 }, tileSize: 32 },
  approvedVariants: { stage: 'S1 low double-wave', gate: 'G1 open wave rail' },
  collision: {
    stageRear: b2.stage.collisionTiles,
    gatePosts: b2.gate.collisionTiles,
    buildings: b3.buildings.map(({ id, collision }) => ({ id, ...collision })),
  },
  entranceClearance: {
    stage: b2.stage.approachTiles,
    gateOpening: b2.gate.openingTiles,
    buildings: b3.buildings.map(({ id, entrance, clearance }) => ({ id, entrance, clearance })),
  },
  placements: b3.placements,
  drawOrder: ['ground', 'contact-shadow', 'structure', 'low-props', 'foreground', 'emissive', 'character', 'sound-marker', 'hud'],
  exclusions: ['SVG', 'guides', 'collision overlays', 'interaction overlays', 'mock character', 'concept variants', 'S2', 'G2', 'comparisons'],
  files: files.sort((a, b) => a.path.localeCompare(b.path)),
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Music production package: ${files.length} PNG files -> ${OUT}`)
