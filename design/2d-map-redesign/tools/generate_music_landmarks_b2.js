const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = '/Users/hyera/Documents/SoundVillage-house-decor-2d'
const OUT = path.join(ROOT, 'public/design-previews/music-landmarks-b2')
const PREVIEW = path.join(ROOT, 'design/2d-map-redesign/previews/2c-b2-music')
const BASE = path.join(ROOT, 'public/design-previews/music-ground-path-b1/music-ground-path-map.png')
const TILE = 32
const MAP = { width: 1536, height: 1152 }
const STAGE = { x: 576, y: 96, width: 384, height: 224, anchor: { x: 192, y: 224 }, tiles: { width: 12, height: 7 } }
const GATE = { x: 704, y: 1024, width: 128, height: 96, anchor: { x: 64, y: 96 }, tiles: { width: 4, height: 3 }, opening: { x: 32, y: 0, width: 64, height: 96 } }
const PAL = {
  stone: '#D9C7A8', stoneHi: '#E8DABF', stoneShade: '#B7A383',
  ground: '#AAB490', soil: '#B89E7C', teal: '#668F8A', lavender: '#A89BC0',
  gold: '#C69A45', plaster: '#E2D3B8', wood: '#A97856', woodHi: '#C28E64',
  navy: '#3F4358', outline: '#655F62', shadow: '#5D554A',
}

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>`)
}

async function writeSvgPng(dir, name, width, height, body) {
  const source = svg(width, height, body)
  fs.writeFileSync(path.join(dir, `${name}.svg`), source)
  await sharp(source).png().toFile(path.join(dir, `${name}.png`))
  return path.join(dir, `${name}.png`)
}

const stageBodies = {
  'contact-shadow': `<ellipse cx="202" cy="204" rx="172" ry="16" fill="${PAL.shadow}" opacity="0.18"/>`,
  'base-platform': `<rect x="20" y="136" width="344" height="54" rx="5" fill="${PAL.wood}" stroke="${PAL.outline}" stroke-width="2"/><path d="M24 150H360M24 164H360M70 138V188M126 138V188M182 138V188M238 138V188M294 138V188" stroke="${PAL.woodHi}" stroke-width="1" opacity="0.5"/><rect x="12" y="184" width="360" height="12" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/>`,
  'front-stair': `<path d="M140 188H244V198H252V207H132V198H140Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><path d="M140 197H244M132 206H252" stroke="${PAL.stoneHi}" stroke-width="2"/>`,
  'rear-body': `<rect x="12" y="44" width="360" height="112" rx="7" fill="${PAL.plaster}" stroke="${PAL.outline}" stroke-width="2"/><rect x="22" y="54" width="18" height="126" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><rect x="344" y="54" width="18" height="126" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/>`,
  opening: `<rect x="48" y="68" width="288" height="86" rx="5" fill="${PAL.navy}" stroke="${PAL.outline}" stroke-width="2"/><rect x="56" y="77" width="272" height="68" fill="#50566A" opacity="0.28"/>`,
  'canopy-s1': `<path d="M16 66V36Q94 20 192 48Q290 20 368 36V74Q290 52 192 78Q94 52 16 74Z" fill="${PAL.teal}" stroke="${PAL.outline}" stroke-width="2"/><path d="M22 64Q95 44 192 70Q289 44 362 64" fill="none" stroke="${PAL.lavender}" stroke-width="5" opacity="0.65"/>`,
  'canopy-s2': `<path d="M16 64V34Q74 18 132 46Q192 18 252 46Q310 18 368 34V74Q310 52 252 76Q192 50 132 76Q74 52 16 74Z" fill="${PAL.lavender}" stroke="${PAL.outline}" stroke-width="2"/><path d="M22 64Q76 45 132 68Q192 43 252 68Q308 45 362 64" fill="none" stroke="${PAL.teal}" stroke-width="4" opacity="0.62"/>`,
  trim: `<rect x="28" y="50" width="5" height="122" fill="${PAL.gold}" opacity="0.55"/><rect x="351" y="50" width="5" height="122" fill="${PAL.gold}" opacity="0.55"/><rect x="178" y="31" width="28" height="7" rx="2" fill="${PAL.gold}" opacity="0.62"/>`,
  foreground: `<rect x="48" y="146" width="288" height="8" fill="${PAL.navy}" opacity="0.18"/><path d="M22 176H362" stroke="${PAL.stoneHi}" stroke-width="2" opacity="0.7"/>`,
  emissive: `<path d="M40 78Q112 58 192 82Q272 58 344 78" fill="none" stroke="#F2D38B" stroke-width="3" opacity="0.42"/><rect x="184" y="37" width="16" height="3" fill="#F2D38B" opacity="0.35"/>`,
  collision: `<rect x="0" y="0" width="384" height="160" fill="#E85D75" fill-opacity="0.22" stroke="#E85D75" stroke-width="4" stroke-dasharray="10 7"/>`,
  approach: `<rect x="160" y="160" width="64" height="64" fill="#61B89A" fill-opacity="0.2" stroke="#61B89A" stroke-width="3" stroke-dasharray="8 6"/>`,
  'canopy-visibility': `<rect x="16" y="18" width="352" height="70" fill="#F2B84B" fill-opacity="0.12" stroke="#F2B84B" stroke-width="3" stroke-dasharray="8 6"/>`,
}

const gateBodies = {
  'contact-shadow': `<ellipse cx="16" cy="86" rx="14" ry="7" fill="${PAL.shadow}" opacity="0.16"/><ellipse cx="112" cy="86" rx="14" ry="7" fill="${PAL.shadow}" opacity="0.16"/>`,
  posts: `<rect x="2" y="20" width="28" height="70" rx="4" fill="${PAL.plaster}" stroke="${PAL.outline}" stroke-width="2"/><rect x="98" y="20" width="28" height="70" rx="4" fill="${PAL.plaster}" stroke="${PAL.outline}" stroke-width="2"/><rect x="6" y="10" width="20" height="18" rx="4" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><rect x="102" y="10" width="20" height="18" rx="4" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/>`,
  'rail-g1': `<path d="M28 34Q46 20 64 34Q82 20 100 34" fill="none" stroke="${PAL.teal}" stroke-width="9" stroke-linejoin="round"/><path d="M29 31Q47 18 64 31Q81 18 99 31" fill="none" stroke="${PAL.stoneHi}" stroke-width="2" opacity="0.65"/>`,
  'canopy-g2': `<path d="M28 18H100V38Q82 24 64 38Q46 24 28 38Z" fill="${PAL.teal}" stroke="${PAL.outline}" stroke-width="2"/><path d="M32 34Q48 23 64 34Q80 23 96 34" fill="none" stroke="${PAL.lavender}" stroke-width="3" opacity="0.58"/>`,
  trim: `<rect x="6" y="28" width="20" height="3" fill="${PAL.gold}" opacity="0.5"/><rect x="102" y="28" width="20" height="3" fill="${PAL.gold}" opacity="0.5"/><rect x="59" y="16" width="10" height="5" rx="2" fill="${PAL.gold}" opacity="0.58"/>`,
  foreground: `<rect x="4" y="82" width="24" height="7" fill="${PAL.stoneShade}" opacity="0.46"/><rect x="100" y="82" width="24" height="7" fill="${PAL.stoneShade}" opacity="0.46"/>`,
  emissive: `<rect x="11" y="31" width="10" height="3" fill="#F2D38B" opacity="0.35"/><rect x="107" y="31" width="10" height="3" fill="#F2D38B" opacity="0.35"/>`,
  collision: `<rect x="0" y="0" width="32" height="96" fill="#E85D75" fill-opacity="0.22" stroke="#E85D75" stroke-width="3" stroke-dasharray="7 5"/><rect x="96" y="0" width="32" height="96" fill="#E85D75" fill-opacity="0.22" stroke="#E85D75" stroke-width="3" stroke-dasharray="7 5"/>`,
  interaction: `<rect x="32" y="0" width="64" height="96" fill="#61B89A" fill-opacity="0.18" stroke="#61B89A" stroke-width="3" stroke-dasharray="8 5"/>`,
  'opening-guide': `<path d="M32 94V8M96 94V8" fill="none" stroke="#227C9D" stroke-width="2" stroke-dasharray="5 4"/>`,
}

const stageOrder = ['contact-shadow', 'base-platform', 'rear-body', 'opening', 'canopy', 'trim', 'front-stair', 'foreground', 'emissive']
const gateOrder = ['contact-shadow', 'posts', 'top', 'trim', 'foreground', 'emissive']

async function writeLayers() {
  const stageDir = path.join(OUT, 'stage')
  const gateDir = path.join(OUT, 'gate')
  for (const [name, body] of Object.entries(stageBodies)) await writeSvgPng(stageDir, name, STAGE.width, STAGE.height, body)
  for (const [name, body] of Object.entries(gateBodies)) await writeSvgPng(gateDir, name, GATE.width, GATE.height, body)
}

async function composeVariant(kind, variant, emissive = true) {
  const isStage = kind === 'stage'
  const spec = isStage ? STAGE : GATE
  const dir = path.join(OUT, kind)
  const list = isStage
    ? ['contact-shadow', 'base-platform', 'rear-body', 'opening', `canopy-${variant}`, 'trim', 'front-stair', 'foreground', ...(emissive ? ['emissive'] : [])]
    : ['contact-shadow', 'posts', variant === 'g1' ? 'rail-g1' : 'canopy-g2', 'trim', 'foreground', ...(emissive ? ['emissive'] : [])]
  const comps = list.map((name) => ({ input: path.join(dir, `${name}.png`), left: 0, top: 0 }))
  const outName = `${kind}-${variant}-composite${emissive ? '' : '-emissive-off'}.png`
  const output = path.join(dir, outName)
  await sharp({ create: { width: spec.width, height: spec.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toFile(output)
  return output
}

async function fullMap(stageVariant, gateVariant, options = {}) {
  const name = options.name || `overview-${stageVariant}-${gateVariant}.png`
  const comps = [
    { input: path.join(OUT, 'stage', `stage-${stageVariant}-composite${options.emissive === false ? '-emissive-off' : ''}.png`), left: STAGE.x, top: STAGE.y },
    { input: path.join(OUT, 'gate', `gate-${gateVariant}-composite${options.emissive === false ? '-emissive-off' : ''}.png`), left: GATE.x, top: GATE.y },
  ]
  if (options.guides) comps.push({ input: path.join(OUT, 'guides', `${options.guides}.png`), left: 0, top: 0 })
  if (options.character) comps.push({ input: path.join(OUT, 'guides', 'mock-character.png'), left: options.character.left, top: options.character.top })
  const out = path.join(PREVIEW, name)
  await sharp(BASE).composite(comps).png().toFile(out)
  return out
}

function fullGuides() {
  const markerX = 24 * TILE + 16
  const markerY = 29 * TILE + 16
  return {
    'collision-interaction-overlay': svg(MAP.width, MAP.height, `<g transform="translate(${STAGE.x} ${STAGE.y})">${stageBodies.collision}</g><rect x="736" y="320" width="96" height="96" fill="#61B89A" fill-opacity="0.2" stroke="#61B89A" stroke-width="4" stroke-dasharray="10 7"/><g transform="translate(${GATE.x} ${GATE.y})">${gateBodies.collision}${gateBodies.interaction}${gateBodies['opening-guide']}</g>`),
    'marker-clearance-overlay': svg(MAP.width, MAP.height, `<circle cx="${markerX}" cy="${markerY}" r="32" fill="#227C9D" fill-opacity="0.08" stroke="#227C9D" stroke-width="4"/><circle cx="${markerX}" cy="${markerY}" r="64" fill="none" stroke="#227C9D" stroke-width="2" stroke-dasharray="8 8"/><rect x="672" y="992" width="192" height="128" fill="none" stroke="#61B89A" stroke-width="3" stroke-dasharray="10 7"/>`),
    'stage-cue-overlay': svg(MAP.width, MAP.height, `<rect x="${STAGE.x + 16}" y="${STAGE.y + 18}" width="352" height="70" fill="#F2B84B" fill-opacity="0.13" stroke="#F2B84B" stroke-width="4" stroke-dasharray="10 7"/>`),
    'stage-approach-map': svg(MAP.width, MAP.height, `<rect x="736" y="320" width="96" height="96" fill="#61B89A" fill-opacity="0.18" stroke="#61B89A" stroke-width="4" stroke-dasharray="10 7"/>`),
  }
}

async function writeGuides() {
  const dir = path.join(OUT, 'guides')
  for (const [name, source] of Object.entries(fullGuides())) {
    fs.writeFileSync(path.join(dir, `${name}.svg`), source)
    await sharp(source).png().toFile(path.join(dir, `${name}.png`))
  }
  const character = svg(72, 88, `<ellipse cx="36" cy="84" rx="17" ry="4" fill="#3F4358" opacity="0.2"/><g transform="scale(3.2727 3.1429)"><rect x="7" y="2" width="8" height="7" rx="2" fill="#6A4A38" stroke="#3F4358" stroke-width="0.7"/><rect x="6" y="8" width="10" height="11" rx="2" fill="#668F8A" stroke="#3F4358" stroke-width="0.7"/><rect x="5" y="18" width="5" height="8" rx="1" fill="#D9C7A8" stroke="#3F4358" stroke-width="0.7"/><rect x="12" y="18" width="5" height="8" rx="1" fill="#D9C7A8" stroke="#3F4358" stroke-width="0.7"/><rect x="7" y="26" width="3" height="2" fill="#3F4358"/><rect x="12" y="26" width="3" height="2" fill="#3F4358"/></g><path d="M20 87H52" stroke="#E85D75" stroke-width="2"/>`)
  fs.writeFileSync(path.join(dir, 'mock-character.svg'), character)
  await sharp(character).png().toFile(path.join(dir, 'mock-character.png'))
}

async function crop(source, name, centerX, centerY, tilesW, tilesH) {
  const width = tilesW * TILE
  const height = tilesH * TILE
  const left = Math.round(Math.min(MAP.width - width, Math.max(0, centerX * TILE - width / 2)))
  const top = Math.round(Math.min(MAP.height - height, Math.max(0, centerY * TILE - height / 2)))
  await sharp(source).extract({ left, top, width, height }).png().toFile(path.join(PREVIEW, name))
}

async function comparison(name, leftPath, rightPath, leftLabel, rightLabel, width, height) {
  const margin = 24
  const header = 52
  const board = svg(width * 2 + margin * 3, height + header + margin * 2, `<rect width="100%" height="100%" fill="#171827"/><style>text{font-family:Arial,sans-serif;fill:#F7F1E7;font-size:22px;font-weight:700}</style><text x="${margin}" y="36">${leftLabel}</text><text x="${width + margin * 2}" y="36">${rightLabel}</text>`)
  const left = await sharp(leftPath).resize(width, height, { fit: 'contain', background: { r: 242, g: 236, b: 220, alpha: 1 } }).png().toBuffer()
  const right = await sharp(rightPath).resize(width, height, { fit: 'contain', background: { r: 242, g: 236, b: 220, alpha: 1 } }).png().toBuffer()
  await sharp(board).composite([{ input: left, left: margin, top: header }, { input: right, left: width + margin * 2, top: header }]).png().toFile(path.join(PREVIEW, name))
}

async function main() {
  for (const dir of [OUT, PREVIEW, path.join(OUT, 'stage'), path.join(OUT, 'gate'), path.join(OUT, 'guides'), path.join(OUT, 'variants')]) fs.mkdirSync(dir, { recursive: true })
  await writeLayers()
  await writeGuides()
  const s1 = await composeVariant('stage', 's1')
  const s2 = await composeVariant('stage', 's2')
  const s1Off = await composeVariant('stage', 's1', false)
  await composeVariant('stage', 's2', false)
  const g1 = await composeVariant('gate', 'g1')
  const g2 = await composeVariant('gate', 'g2')
  const g1Off = await composeVariant('gate', 'g1', false)
  await composeVariant('gate', 'g2', false)

  await sharp(s1).resize(768, 448, { kernel: 'nearest' }).png().toFile(path.join(PREVIEW, 'stage-s1-full.png'))
  await sharp(s2).resize(768, 448, { kernel: 'nearest' }).png().toFile(path.join(PREVIEW, 'stage-s2-full.png'))
  await sharp(g1).resize(512, 384, { kernel: 'nearest' }).png().toFile(path.join(PREVIEW, 'gate-g1-full.png'))
  await sharp(g2).resize(512, 384, { kernel: 'nearest' }).png().toFile(path.join(PREVIEW, 'gate-g2-full.png'))
  await comparison('stage-s1-s2-comparison.png', s1, s2, 'S1 LOW DOUBLE-WAVE', 'S2 RESTRAINED TRIPLE-WAVE', 576, 336)
  await comparison('gate-g1-g2-comparison.png', g1, g2, 'G1 OPEN WAVE RAIL', 'G2 SHALLOW WAVE CANOPY', 448, 336)

  const o11 = await fullMap('s1', 'g1', { name: 'overview-s1-g1.png' })
  const o22 = await fullMap('s2', 'g2', { name: 'overview-s2-g2.png' })
  const emissiveOff = await fullMap('s1', 'g1', { name: 'emissive-off.png', emissive: false })
  await fullMap('s1', 'g1', { name: 'collision-interaction-overlay.png', guides: 'collision-interaction-overlay' })
  await fullMap('s1', 'g1', { name: 'marker-clearance-overlay.png', guides: 'marker-clearance-overlay' })
  const character = await fullMap('s1', 'g1', { name: 'character-scale-foot-contact.png', character: { left: 732, top: 920 } })
  const stageCharacter = await fullMap('s1', 'g1', { name: 'character-stage-occlusion.png', character: { left: 748, top: 328 } })
  const cue = await fullMap('s1', 'g1', { name: 'stage-cue-full.png', guides: 'stage-cue-overlay' })

  await crop(o11, 'laptop-start.png', 24, 29, 24, 18)
  await crop(o11, 'laptop-center.png', 24, 19, 24, 18)
  await crop(o11, 'laptop-stage-approach.png', 24, 8, 24, 18)
  await crop(o11, 'mobile-portrait-start.png', 24, 29, 14, 25)
  await crop(o11, 'mobile-landscape-center.png', 24, 19, 28, 13)
  await sharp(o11).grayscale().png().toFile(path.join(PREVIEW, 'grayscale.png'))
  await crop(character, 'character-scale-foot-contact-start.png', 24, 29, 24, 18)
  await crop(stageCharacter, 'character-stage-occlusion-camera.png', 24, 8, 24, 18)
  await crop(cue, 'start-fov-stage-canopy-cue-conflict.png', 24, 29, 24, 18)
  await crop(cue, 'stage-camera-canopy-visibility-guide.png', 24, 8, 24, 18)
  await sharp(BASE).extract({ left: 640, top: 448, width: 256, height: 256 }).png().toFile(path.join(PREVIEW, 'garden-motif-after.png'))
  await comparison('garden-motif-before-after.png', path.join(PREVIEW, 'garden-motif-before.png'), path.join(PREVIEW, 'garden-motif-after.png'), 'BEFORE: RING-LIKE', 'AFTER: ASYMMETRIC RHYTHM', 384, 384)
  await sharp(BASE).extract({ left: 672, top: 992, width: 192, height: 160 }).png().toFile(path.join(PREVIEW, 'gate-pad-after.png'))
  await comparison('gate-pad-before-after.png', path.join(PREVIEW, 'gate-pad-before.png'), path.join(PREVIEW, 'gate-pad-after.png'), 'BEFORE: GOLD OUTLINE', 'AFTER: STONE EDGE', 384, 320)

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
    version: '2C-B2-v1', tileSize: TILE, runtimeScale: 1, timeOfDay: 'bright-soft-late-afternoon', palette: PAL,
    stage: { ...STAGE, layers: stageOrder, variants: { s1: 'low-double-wave', s2: 'restrained-triple-wave' }, collisionTiles: { x: 18, y: 3, width: 12, height: 5 }, approachTiles: { x: 23, y: 10, width: 3, height: 3 } },
    gate: { ...GATE, layers: gateOrder, variants: { g1: 'open-wave-rail', g2: 'shallow-wave-canopy' }, collisionTiles: [{ x: 22, y: 32, width: 1, height: 3 }, { x: 25, y: 32, width: 1, height: 3 }], openingTiles: { x: 23, y: 32, width: 2, height: 3 } },
    drawOrder: ['ground/path', 'contact shadow', 'base/body', 'opening', 'canopy/rail', 'trim', 'stair', 'foreground', 'emissive', 'guides', 'marker/UI'],
    conceptReferences: ['variants/imagegen-stage-s1-s2-concept.png', 'variants/imagegen-gate-g1-g2-concept.png'],
    productionUse: false,
  }, null, 2))

  console.log(JSON.stringify({ stage: STAGE, gate: GATE, recommended: 'S1+G1', previews: PREVIEW }))
}

main().catch((error) => { console.error(error); process.exit(1) })
