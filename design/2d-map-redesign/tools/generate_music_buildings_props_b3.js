const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '../../..')
const OUT = path.join(ROOT, 'public/design-previews/music-buildings-props-b3')
const PREVIEW = path.join(ROOT, 'design/2d-map-redesign/previews/2c-b3-music')
const BASE = path.join(ROOT, 'public/design-previews/music-ground-path-b1/music-ground-path-map.svg')
const B2 = path.join(ROOT, 'public/design-previews/music-landmarks-b2')
const TILE = 32
const MAP = { width: 1536, height: 1152, tiles: { width: 48, height: 36 } }
const PAL = {
  ground: '#AAB490', groundVariant: '#B3BC98', soil: '#B89E7C', stone: '#D9C7A8',
  stoneHi: '#E8DABF', stoneShade: '#B7A383', teal: '#668F8A', tealHi: '#86ABA4',
  lavender: '#A89BC0', lavenderHi: '#C4B9D5', gold: '#C69A45', plaster: '#E2D3B8',
  plasterHi: '#EFE4CF', wood: '#A97856', woodHi: '#C28E64', navy: '#3F4358',
  outline: '#655F62', shadow: '#5D554A', foliage: '#6E8B68', foliageHi: '#91A878',
  flower: '#C2A5BF', emissive: '#F2D38B', collision: '#E85D75', clearance: '#61B89A', markerGuide: '#227C9D',
}

const BUILDINGS = [
  { id: 'record-archive', label: 'Record Archive', x: 4, y: 4, w: 8, h: 6, entrance: 'south', clearance: { x: 6, y: 10, width: 3, height: 3 }, collision: { x: 4, y: 4, width: 8, height: 6 } },
  { id: 'listening-cafe', label: 'Listening Cafe', x: 35, y: 5, w: 10, h: 5, entrance: 'south', clearance: { x: 38, y: 10, width: 3, height: 3 }, collision: { x: 35, y: 5, width: 10, height: 5 } },
  { id: 'community-studio', label: 'Community Studio', x: 3, y: 28, w: 10, h: 5, entrance: 'east', doorEdge: { x: 12, y: 28, width: 1, height: 3 }, clearance: { x: 13, y: 28, width: 3, height: 3 }, collision: { x: 3, y: 28, width: 10, height: 5 } },
  { id: 'sound-workshop', label: 'Sound Workshop', x: 36, y: 27, w: 8, h: 6, entrance: 'west', doorEdge: { x: 36, y: 28, width: 1, height: 3 }, clearance: { x: 33, y: 28, width: 3, height: 3 }, collision: { x: 36, y: 27, width: 8, height: 6 } },
]

const MARKERS = [
  [24,29],[19,28],[14,25],[10,21],[10,16],[16,8],[19,12],[24,13],
  [29,12],[34,14],[38,19],[36,24],[31,28],[21,19],[27,19],
]

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>`)
}

async function writeSvgPng(dir, name, width, height, body) {
  fs.mkdirSync(dir, { recursive: true })
  const source = svg(width, height, body)
  fs.writeFileSync(path.join(dir, `${name}.svg`), source)
  await sharp(source).png().toFile(path.join(dir, `${name}.png`))
}

function buildingBodies(spec) {
  const W = spec.w * TILE
  const H = spec.h * TILE
  const common = {
    'contact-shadow': `<ellipse cx="${W/2+8}" cy="${H-14}" rx="${W/2-18}" ry="13" fill="${PAL.shadow}" opacity=".18"/>`,
    collision: `<rect x="2" y="2" width="${W-4}" height="${H-4}" fill="${PAL.collision}" fill-opacity=".22" stroke="${PAL.collision}" stroke-width="4" stroke-dasharray="10 7"/>`,
  }
  if (spec.id === 'record-archive') return { ...common,
    body: `<rect x="24" y="66" width="208" height="110" rx="5" fill="${PAL.plaster}" stroke="${PAL.outline}" stroke-width="2"/><rect x="34" y="74" width="22" height="98" fill="${PAL.stone}"/><rect x="200" y="74" width="22" height="98" fill="${PAL.stone}"/>`,
    roof: `<path d="M22 70L46 22H210L234 70L206 94H50Z" fill="${PAL.teal}" stroke="${PAL.outline}" stroke-width="2"/><path d="M46 22L72 6H184L210 22L194 48H62Z" fill="${PAL.tealHi}" stroke="${PAL.outline}" stroke-width="2"/><path d="M72 6H184L174 30H82Z" fill="${PAL.stone}" opacity=".55"/>`,
    'door-window': `<rect x="104" y="110" width="48" height="66" rx="3" fill="${PAL.wood}" stroke="${PAL.outline}" stroke-width="2"/><rect x="48" y="106" width="34" height="45" fill="${PAL.lavender}" opacity=".58" stroke="${PAL.outline}" stroke-width="2"/><rect x="174" y="106" width="34" height="45" fill="${PAL.lavender}" opacity=".58" stroke="${PAL.outline}" stroke-width="2"/>`,
    trim: `<path d="M36 68H220M54 94H202" stroke="${PAL.stoneHi}" stroke-width="4"/><rect x="122" y="96" width="12" height="5" fill="${PAL.gold}" opacity=".55"/>`,
    foreground: `<rect x="96" y="170" width="64" height="10" fill="${PAL.stoneShade}" opacity=".6"/><path d="M100 176H156" stroke="${PAL.stoneHi}" stroke-width="2"/>`,
    emissive: `<rect x="55" y="114" width="20" height="26" fill="${PAL.emissive}" opacity=".22"/><rect x="181" y="114" width="20" height="26" fill="${PAL.emissive}" opacity=".22"/>`,
  }
  if (spec.id === 'listening-cafe') return { ...common,
    body: `<rect x="12" y="64" width="296" height="88" rx="7" fill="${PAL.plaster}" stroke="${PAL.outline}" stroke-width="2"/><rect x="28" y="78" width="104" height="68" fill="${PAL.woodHi}" opacity=".38"/><rect x="188" y="78" width="104" height="68" fill="${PAL.woodHi}" opacity=".38"/>`,
    roof: `<path d="M8 68L28 30Q88 12 152 38Q222 4 310 36V72Q226 44 158 72Q88 46 8 68Z" fill="${PAL.teal}" stroke="${PAL.outline}" stroke-width="2"/><path d="M20 62Q90 38 158 63Q226 34 300 58" fill="none" stroke="${PAL.tealHi}" stroke-width="4" opacity=".65"/>`,
    'door-window': `<rect x="140" y="92" width="44" height="60" rx="3" fill="${PAL.wood}" stroke="${PAL.outline}" stroke-width="2"/><rect x="38" y="92" width="82" height="42" fill="${PAL.lavender}" opacity=".46" stroke="${PAL.outline}" stroke-width="2"/><rect x="202" y="92" width="78" height="42" fill="${PAL.lavender}" opacity=".46" stroke="${PAL.outline}" stroke-width="2"/>`,
    trim: `<path d="M22 76H298" stroke="${PAL.stoneHi}" stroke-width="4"/><path d="M42 137H116M206 137H276" stroke="${PAL.gold}" stroke-width="3" opacity=".42"/>`,
    foreground: `<path d="M28 146H132M188 146H292" stroke="${PAL.wood}" stroke-width="8" opacity=".46"/><rect x="132" y="148" width="60" height="8" fill="${PAL.stoneShade}" opacity=".46"/>`,
    emissive: `<rect x="46" y="100" width="66" height="26" fill="${PAL.emissive}" opacity=".2"/><rect x="210" y="100" width="62" height="26" fill="${PAL.emissive}" opacity=".2"/>`,
  }
  if (spec.id === 'community-studio') return { ...common,
    body: `<rect x="10" y="54" width="300" height="102" rx="5" fill="${PAL.plaster}" stroke="${PAL.outline}" stroke-width="2"/><rect x="18" y="66" width="84" height="84" fill="${PAL.stone}" opacity=".64"/><rect x="218" y="66" width="84" height="84" fill="${PAL.stone}" opacity=".64"/>`,
    roof: `<path d="M8 70L36 24H148L160 52L176 18H288L312 68L286 84H36Z" fill="${PAL.lavender}" stroke="${PAL.outline}" stroke-width="2"/><path d="M38 28H144L158 55M180 22H284" fill="none" stroke="${PAL.lavenderHi}" stroke-width="5" opacity=".62"/>`,
    'door-window': `<rect x="42" y="92" width="56" height="42" fill="${PAL.teal}" opacity=".48" stroke="${PAL.outline}" stroke-width="2"/><rect x="184" y="92" width="52" height="42" fill="${PAL.teal}" opacity=".48" stroke="${PAL.outline}" stroke-width="2"/><path d="M266 72H316V138H266Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><rect x="280" y="82" width="34" height="54" rx="2" fill="${PAL.wood}" stroke="${PAL.outline}" stroke-width="2"/><rect x="286" y="91" width="4" height="4" fill="${PAL.gold}" opacity=".65"/>`,
    trim: `<path d="M22 74H260" stroke="${PAL.stoneHi}" stroke-width="4"/><path d="M272 78V132" stroke="${PAL.lavenderHi}" stroke-width="3"/><rect x="300" y="70" width="12" height="5" fill="${PAL.gold}" opacity=".48"/>`,
    foreground: `<path d="M276 126H320V150H268V140H276Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><path d="M280 142H320" stroke="${PAL.stoneHi}" stroke-width="3"/>`,
    emissive: `<rect x="50" y="100" width="40" height="26" fill="${PAL.emissive}" opacity=".18"/><rect x="230" y="100" width="40" height="26" fill="${PAL.emissive}" opacity=".18"/>`,
  }
  return { ...common,
    body: `<path d="M16 72H174V176H16Z" fill="${PAL.woodHi}" stroke="${PAL.outline}" stroke-width="2"/><rect x="174" y="92" width="66" height="84" fill="${PAL.plaster}" stroke="${PAL.outline}" stroke-width="2"/>`,
    roof: `<path d="M8 78L72 22H174L210 58V84H8Z" fill="${PAL.teal}" stroke="${PAL.outline}" stroke-width="2"/><path d="M172 64L208 38H238L252 78H184Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><path d="M74 26H168L202 60" fill="none" stroke="${PAL.tealHi}" stroke-width="5" opacity=".62"/>`,
    'door-window': `<path d="M8 78H56V142H8Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><rect x="12" y="88" width="34" height="52" rx="2" fill="${PAL.wood}" stroke="${PAL.outline}" stroke-width="2"/><rect x="38" y="98" width="4" height="4" fill="${PAL.gold}" opacity=".65"/><rect x="134" y="104" width="38" height="38" fill="${PAL.lavender}" opacity=".5" stroke="${PAL.outline}" stroke-width="2"/><rect x="196" y="112" width="28" height="30" fill="${PAL.lavender}" opacity=".42" stroke="${PAL.outline}" stroke-width="2"/>`,
    trim: `<path d="M62 84H194M182 96H232" stroke="${PAL.stoneHi}" stroke-width="4"/><path d="M60 96V158M70 96V158" stroke="${PAL.gold}" stroke-width="2" opacity=".38"/>`,
    foreground: `<path d="M0 130H58V158H0Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><path d="M0 150H50" stroke="${PAL.stoneHi}" stroke-width="3"/><rect x="190" y="164" width="52" height="10" fill="${PAL.wood}" opacity=".62"/>`,
    emissive: `<rect x="164" y="111" width="22" height="24" fill="${PAL.emissive}" opacity=".18"/>`,
  }
}

const PROP_SPECS = [
  { category: 'flowerbeds', id: 'flowerbed-low-a', w: 64, h: 32, body: `<rect x="2" y="16" width="60" height="13" rx="3" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><path d="M10 17L16 8L22 17M28 17L36 6L42 17M46 17L53 9L58 17" fill="${PAL.foliage}" stroke="${PAL.foliageHi}" stroke-width="2"/><circle cx="18" cy="10" r="3" fill="${PAL.flower}"/><circle cx="38" cy="9" r="3" fill="${PAL.gold}" opacity=".65"/>` },
  { category: 'benches', id: 'bench-low-a', w: 64, h: 32, body: `<ellipse cx="34" cy="27" rx="27" ry="4" fill="${PAL.shadow}" opacity=".14"/><rect x="7" y="11" width="50" height="8" rx="2" fill="${PAL.wood}" stroke="${PAL.outline}" stroke-width="2"/><rect x="12" y="20" width="6" height="8" fill="${PAL.stoneShade}"/><rect x="46" y="20" width="6" height="8" fill="${PAL.stoneShade}"/>` },
  { category: 'planters', id: 'planter-low-a', w: 32, h: 32, body: `<ellipse cx="18" cy="27" rx="11" ry="3" fill="${PAL.shadow}" opacity=".14"/><path d="M6 15H27L24 29H9Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><path d="M10 15Q12 5 18 14Q22 4 25 15" fill="${PAL.foliage}" stroke="${PAL.foliageHi}" stroke-width="2"/>` },
  { category: 'lamps', id: 'lamp-low-a', w: 32, h: 64, body: `<ellipse cx="17" cy="59" rx="9" ry="3" fill="${PAL.shadow}" opacity=".14"/><rect x="14" y="24" width="5" height="34" fill="${PAL.outline}"/><path d="M8 13H25V27H8Z" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><rect x="11" y="16" width="11" height="8" fill="${PAL.emissive}" opacity=".38"/>` },
  { category: 'vegetation', id: 'shrub-low-a', w: 32, h: 32, body: `<ellipse cx="17" cy="27" rx="12" ry="3" fill="${PAL.shadow}" opacity=".12"/><path d="M4 24Q5 11 14 15Q17 5 22 15Q29 13 29 25Z" fill="${PAL.foliage}" stroke="${PAL.outline}" stroke-width="2"/><path d="M9 20Q15 14 24 19" fill="none" stroke="${PAL.foliageHi}" stroke-width="3"/>` },
  { category: 'vegetation', id: 'tree-low-a', w: 64, h: 64, body: `<ellipse cx="34" cy="57" rx="20" ry="5" fill="${PAL.shadow}" opacity=".14"/><rect x="29" y="36" width="9" height="20" fill="${PAL.wood}"/><path d="M9 38Q8 18 23 21Q27 5 39 19Q54 14 56 34Q49 46 31 44Q18 47 9 38Z" fill="${PAL.foliage}" stroke="${PAL.outline}" stroke-width="2"/><path d="M17 31Q30 20 47 29" fill="none" stroke="${PAL.foliageHi}" stroke-width="4"/>` },
  { category: 'garden', id: 'garden-resonance-low', w: 64, h: 32, body: `<ellipse cx="33" cy="27" rx="27" ry="4" fill="${PAL.shadow}" opacity=".12"/><path d="M7 22H17V12H25V24H34V8H42V20H56" fill="none" stroke="${PAL.teal}" stroke-width="5" stroke-linejoin="round"/><path d="M9 27H55" stroke="${PAL.stoneShade}" stroke-width="3"/>` },
  { category: 'gate-vegetation', id: 'gate-vegetation-low', w: 64, h: 32, body: `<path d="M4 27Q8 14 17 20Q20 7 28 20Q38 11 42 23Q51 14 59 27Z" fill="${PAL.foliage}" stroke="${PAL.outline}" stroke-width="2"/><path d="M12 24Q24 18 34 24Q44 18 54 24" fill="none" stroke="${PAL.foliageHi}" stroke-width="3"/>` },
  { category: 'stage-vegetation', id: 'stage-vegetation-low', w: 64, h: 32, body: `<rect x="3" y="22" width="58" height="7" rx="2" fill="${PAL.stone}" stroke="${PAL.outline}" stroke-width="2"/><path d="M8 23Q12 11 20 21Q25 8 31 21Q39 9 44 21Q52 14 58 23" fill="${PAL.foliage}" stroke="${PAL.foliageHi}" stroke-width="2"/>` },
  { category: 'foreground', id: 'foreground-edge-cluster', w: 96, h: 64, body: `<ellipse cx="51" cy="58" rx="42" ry="5" fill="${PAL.shadow}" opacity=".14"/><path d="M5 56Q7 31 23 37Q25 15 39 34Q52 6 61 35Q80 17 91 55Z" fill="${PAL.foliage}" stroke="${PAL.outline}" stroke-width="2"/><path d="M14 48Q33 31 49 45Q68 29 84 47" fill="none" stroke="${PAL.foliageHi}" stroke-width="5"/>` },
]

const PROP_PLACEMENTS = [
  ['flowerbed-low-a',3,12],['flowerbed-low-a',42,12],['bench-low-a',18,22],['bench-low-a',28,16],
  ['planter-low-a',13,9],['planter-low-a',34,9],['planter-low-a',13,31],['planter-low-a',34,31],
  ['lamp-low-a',2,14],['lamp-low-a',46,14],['lamp-low-a',6,24],['lamp-low-a',42,24],
  ['shrub-low-a',3,18],['shrub-low-a',44,18],['shrub-low-a',4,22],['shrub-low-a',43,22],
  ['tree-low-a',2,14],['tree-low-a',44,14],['tree-low-a',1,26],['tree-low-a',45,26],
  ['garden-resonance-low',23,16],['gate-vegetation-low',19,34],['gate-vegetation-low',27,34],
  ['stage-vegetation-low',14,3],['stage-vegetation-low',32,3],['foreground-edge-cluster',0,32],['foreground-edge-cluster',45,31],
]

const VISUAL_LAYERS = ['contact-shadow','body','roof','door-window','trim','foreground','emissive']

async function createBuildings() {
  for (const spec of BUILDINGS) {
    const dir = path.join(OUT, 'buildings', spec.id)
    const bodies = buildingBodies(spec)
    for (const [name, body] of Object.entries(bodies)) await writeSvgPng(dir, name, spec.w*TILE, spec.h*TILE, body)
    const approachLocal = { x: spec.clearance.x-spec.x, y: spec.clearance.y-spec.y }
    const doorLocal = spec.doorEdge ? { x: spec.doorEdge.x-spec.x, y: spec.doorEdge.y-spec.y } : null
    const entranceBody = `<rect x="${approachLocal.x*TILE}" y="${approachLocal.y*TILE}" width="${spec.clearance.width*TILE}" height="${spec.clearance.height*TILE}" fill="${PAL.clearance}" fill-opacity=".2" stroke="${PAL.clearance}" stroke-width="3" stroke-dasharray="8 6"/>${doorLocal ? `<rect x="${doorLocal.x*TILE+2}" y="${doorLocal.y*TILE+2}" width="${spec.doorEdge.width*TILE-4}" height="${spec.doorEdge.height*TILE-4}" fill="${PAL.gold}" fill-opacity=".16" stroke="${PAL.gold}" stroke-width="3"/>` : ''}`
    await writeSvgPng(dir, 'entrance-clearance', spec.w*TILE, spec.h*TILE, entranceBody)
    const comps = VISUAL_LAYERS.map((name) => ({ input: path.join(dir, `${name}.png`), left: 0, top: 0 }))
    await sharp({ create: { width: spec.w*TILE, height: spec.h*TILE, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } }).composite(comps).png().toFile(path.join(dir, `${spec.id}-composite.png`))
    await sharp({ create: { width: spec.w*TILE, height: spec.h*TILE, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } }).composite(comps.slice(0,-1)).png().toFile(path.join(dir, `${spec.id}-composite-emissive-off.png`))
  }
}

async function createProps() {
  for (const prop of PROP_SPECS) await writeSvgPng(path.join(OUT, 'props', prop.category), prop.id, prop.w, prop.h, prop.body)
}

function propById(id) { return PROP_SPECS.find((prop) => prop.id === id) }

function buildingComposites({ emissive = true, layers = VISUAL_LAYERS } = {}) {
  return BUILDINGS.flatMap((spec) => layers.map((layer) => ({ input: path.join(OUT, 'buildings', spec.id, `${layer}.png`), left: spec.x*TILE, top: spec.y*TILE })))
}

function propComposites() {
  return PROP_PLACEMENTS.map(([id,x,y]) => {
    const prop = propById(id)
    return { input: path.join(OUT, 'props', prop.category, `${id}.png`), left: x*TILE, top: y*TILE - Math.max(0, prop.h-TILE) }
  })
}

async function baseB2() {
  return sharp(BASE).composite([
    { input: path.join(B2, 'stage/stage-s1-composite.png'), left: 576, top: 96 },
    { input: path.join(B2, 'gate/gate-g1-composite.png'), left: 704, top: 1024 },
  ]).png().toBuffer()
}

function guideBodies() {
  const collision = BUILDINGS.map((b) => `<rect x="${b.collision.x*TILE}" y="${b.collision.y*TILE}" width="${b.collision.width*TILE}" height="${b.collision.height*TILE}" fill="${PAL.collision}" fill-opacity=".2" stroke="${PAL.collision}" stroke-width="4" stroke-dasharray="10 7"/>`).join('')
  const entrances = BUILDINGS.map((b) => {
    const box = `<rect x="${b.clearance.x*TILE}" y="${b.clearance.y*TILE}" width="${b.clearance.width*TILE}" height="${b.clearance.height*TILE}" fill="${PAL.clearance}" fill-opacity=".18" stroke="${PAL.clearance}" stroke-width="4" stroke-dasharray="10 7"/>`
    if (!b.doorEdge) return box
    const door = `<rect x="${b.doorEdge.x*TILE+2}" y="${b.doorEdge.y*TILE+2}" width="${b.doorEdge.width*TILE-4}" height="${b.doorEdge.height*TILE-4}" fill="${PAL.gold}" fill-opacity=".14" stroke="${PAL.gold}" stroke-width="3"/>`
    const cy = (b.clearance.y + b.clearance.height/2)*TILE
    const fromX = b.entrance === 'east' ? (b.x+b.w-.5)*TILE : (b.x+.5)*TILE
    const toX = (b.clearance.x+b.clearance.width/2)*TILE
    const arrow = `<path d="M${fromX} ${cy}H${toX}" stroke="${PAL.clearance}" stroke-width="5"/><path d="M${toX} ${cy}l${b.entrance === 'east' ? -12 : 12} -9v18Z" fill="${PAL.clearance}"/>`
    return box+door+arrow
  }).join('')
  const markers = MARKERS.map(([x,y]) => `<circle cx="${x*TILE+16}" cy="${y*TILE+16}" r="32" fill="${PAL.markerGuide}" fill-opacity=".06" stroke="${PAL.markerGuide}" stroke-width="3"/><circle cx="${x*TILE+16}" cy="${y*TILE+16}" r="64" fill="none" stroke="${PAL.markerGuide}" stroke-width="2" stroke-dasharray="8 8"/>`).join('')
  const foreground = `<rect x="0" y="992" width="96" height="160" fill="${PAL.lavender}" fill-opacity=".13" stroke="${PAL.lavender}" stroke-width="3" stroke-dasharray="9 7"/><rect x="1440" y="960" width="96" height="192" fill="${PAL.lavender}" fill-opacity=".13" stroke="${PAL.lavender}" stroke-width="3" stroke-dasharray="9 7"/>`
  return { collision, entrances, markers, foreground }
}

async function createGuides() {
  const dir = path.join(OUT, 'guides')
  for (const [name, body] of Object.entries(guideBodies())) await writeSvgPng(dir, `${name}-guide`, MAP.width, MAP.height, body)
  const character = `<ellipse cx="36" cy="84" rx="17" ry="4" fill="${PAL.navy}" opacity=".2"/><g transform="scale(3.2727 3.1429)"><rect x="7" y="2" width="8" height="7" rx="2" fill="#6A4A38" stroke="${PAL.navy}" stroke-width=".7"/><rect x="6" y="8" width="10" height="11" rx="2" fill="${PAL.teal}" stroke="${PAL.navy}" stroke-width=".7"/><rect x="5" y="18" width="5" height="8" rx="1" fill="${PAL.stone}" stroke="${PAL.navy}" stroke-width=".7"/><rect x="12" y="18" width="5" height="8" rx="1" fill="${PAL.stone}" stroke="${PAL.navy}" stroke-width=".7"/><rect x="7" y="26" width="3" height="2" fill="${PAL.navy}"/><rect x="12" y="26" width="3" height="2" fill="${PAL.navy}"/></g><path d="M20 87H52" stroke="${PAL.collision}" stroke-width="2"/>`
  await writeSvgPng(dir, 'mock-character', 72, 88, character)
}

async function renderMap(name, options = {}) {
  const base = await baseB2()
  const comps = []
  if (options.buildings !== false) comps.push(...buildingComposites({ layers: options.emissive === false ? VISUAL_LAYERS.filter((l) => l !== 'emissive') : VISUAL_LAYERS }))
  if (options.props !== false) comps.push(...propComposites())
  if (options.guide) comps.push({ input: path.join(OUT, 'guides', `${options.guide}-guide.png`), left: 0, top: 0 })
  if (options.character) comps.push({ input: path.join(OUT, 'guides/mock-character.png'), left: options.character.left, top: options.character.top })
  const out = path.join(PREVIEW, name)
  await sharp(base).composite(comps).png().toFile(out)
  return out
}

async function crop(source, name, centerX, centerY, tilesW, tilesH) {
  const width = tilesW*TILE, height = tilesH*TILE
  const left = Math.round(Math.min(MAP.width-width, Math.max(0, centerX*TILE-width/2)))
  const top = Math.round(Math.min(MAP.height-height, Math.max(0, centerY*TILE-height/2)))
  await sharp(source).extract({ left, top, width, height }).png().toFile(path.join(PREVIEW, name))
}

async function comparison(name, leftPath, rightPath, leftLabel, rightLabel, width, height) {
  const m=24, h=52
  const board=svg(width*2+m*3,height+h+m*2,`<rect width="100%" height="100%" fill="#171827"/><style>text{font-family:Arial,sans-serif;fill:#F7F1E7;font-size:22px;font-weight:700}</style><text x="${m}" y="36">${leftLabel}</text><text x="${width+m*2}" y="36">${rightLabel}</text>`)
  const left=await sharp(leftPath).resize(width,height,{fit:'contain',background:{r:242,g:236,b:220,alpha:1}}).png().toBuffer()
  const right=await sharp(rightPath).resize(width,height,{fit:'contain',background:{r:242,g:236,b:220,alpha:1}}).png().toBuffer()
  await sharp(board).composite([{input:left,left:m,top:h},{input:right,left:width+m*2,top:h}]).png().toFile(path.join(PREVIEW,name))
}

async function buildingBoard() {
  const cellW=400, cellH=280, m=24, header=44
  const board=svg(cellW*2+m*3,cellH*2+header*2+m*3,`<rect width="100%" height="100%" fill="#EEE7D8"/><style>text{font-family:Arial,sans-serif;fill:#3F4358;font-size:20px;font-weight:700}</style>${BUILDINGS.map((b,i)=>`<text x="${m+(i%2)* (cellW+m)}" y="${32+Math.floor(i/2)*(cellH+header+m)}">${b.label.toUpperCase()} · ${b.w}×${b.h}</text>`).join('')}`)
  const comps=[]
  for (let i=0;i<BUILDINGS.length;i++) {
    const b=BUILDINGS[i]
    const input=await sharp(path.join(OUT,'buildings',b.id,`${b.id}-composite.png`)).resize(cellW,cellH,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()
    comps.push({input,left:m+(i%2)*(cellW+m),top:header+m+Math.floor(i/2)*(cellH+header+m)})
  }
  await sharp(board).composite(comps).png().toFile(path.join(PREVIEW,'building-silhouette-comparison.png'))
}

async function propsBoard() {
  const cell=128, cols=5, rows=2, m=20, header=34
  const board=svg(cols*cell+(cols+1)*m,rows*(cell+header)+(rows+1)*m,`<rect width="100%" height="100%" fill="#EEE7D8"/><style>text{font-family:Arial,sans-serif;fill:#3F4358;font-size:13px;font-weight:700}</style>${PROP_SPECS.map((p,i)=>`<text x="${m+(i%cols)*(cell+m)}" y="${m+18+Math.floor(i/cols)*(cell+header+m)}">${p.id}</text>`).join('')}`)
  const comps=[]
  for (let i=0;i<PROP_SPECS.length;i++) { const p=PROP_SPECS[i]; const input=await sharp(path.join(OUT,'props',p.category,`${p.id}.png`)).resize(cell,cell,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(); comps.push({input,left:m+(i%cols)*(cell+m),top:m+header+Math.floor(i/cols)*(cell+header+m)}) }
  await sharp(board).composite(comps).png().toFile(path.join(PREVIEW,'prop-family-atlas.png'))
}

async function main() {
  fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(PREVIEW,{recursive:true}); fs.mkdirSync(path.join(OUT,'variants'),{recursive:true})
  await createBuildings(); await createProps(); await createGuides()
  const b2=path.join(PREVIEW,'overview-b1-b2.png'); await sharp(await baseB2()).png().toFile(b2)
  const overview=await renderMap('overview-b1-b2-b3.png')
  const emissiveOff=await renderMap('emissive-off.png',{emissive:false})
  const collision=await renderMap('collision-guide.png',{guide:'collision'})
  const entrances=await renderMap('entrance-clearance-guide.png',{guide:'entrances'})
  const markers=await renderMap('marker-clearance-guide.png',{guide:'markers'})
  const foreground=await renderMap('foreground-guide.png',{guide:'foreground'})
  const studioCharacter=await renderMap('character-studio-east-approach-map.png',{character:{left:428,top:856}})
  const workshopCharacter=await renderMap('character-workshop-west-approach-map.png',{character:{left:1068,top:856}})
  await crop(overview,'laptop-start.png',24,29,24,18); await crop(overview,'laptop-center.png',24,19,24,18); await crop(overview,'laptop-stage-approach.png',24,8,24,18)
  await crop(overview,'mobile-portrait-start.png',24,29,14,25); await crop(overview,'mobile-landscape-center.png',24,19,28,13)
  await sharp(overview).grayscale().png().toFile(path.join(PREVIEW,'grayscale.png'))
  await crop(studioCharacter,'character-studio-east-approach.png',11,29,16,10)
  await crop(workshopCharacter,'character-workshop-west-approach.png',37,29,16,10)
  await crop(overview,'mobile-portrait-studio-east-entrance.png',11,29,14,18)
  await crop(overview,'mobile-landscape-workshop-west-entrance.png',37,29,18,10)
  const studioCrop=path.join(PREVIEW,'character-studio-east-approach.png')
  const workshopCrop=path.join(PREVIEW,'character-workshop-west-approach.png')
  await comparison('south-building-entrances-character-comparison.png',studioCrop,workshopCrop,'STUDIO · EAST APPROACH','WORKSHOP · WEST APPROACH',512,320)
  await sharp(studioCrop).grayscale().png().toFile(path.join(PREVIEW,'studio-east-entrance-grayscale.png'))
  await sharp(workshopCrop).grayscale().png().toFile(path.join(PREVIEW,'workshop-west-entrance-grayscale.png'))
  await comparison('b2-b3-comparison.png',b2,overview,'B1+B2','B1+B2+B3',768,576)
  await buildingBoard(); await propsBoard()
  for (const b of BUILDINGS) {
    await sharp(path.join(OUT,'buildings',b.id,`${b.id}-composite.png`)).resize(b.w*TILE*2,b.h*TILE*2,{kernel:'nearest'}).png().toFile(path.join(PREVIEW,`building-${b.id}.png`))
  }
  fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({
    version:'2C-B3.1-v1',productionUse:false,tileSize:TILE,map:MAP,timeOfDay:'bright-soft-late-afternoon',palette:PAL,
    approvedLandmarks:{stage:'S1 low double-wave',gate:'G1 open wave rail'},
    buildings:BUILDINGS.map((b)=>({...b,pixelRect:{x:b.x*TILE,y:b.y*TILE,width:b.w*TILE,height:b.h*TILE},canvas:{width:b.w*TILE,height:b.h*TILE},anchor:{x:b.w*TILE/2,y:b.h*TILE},layers:[...VISUAL_LAYERS,'collision','entrance-clearance']})),
    props:PROP_SPECS.map(({category,id,w,h})=>({category,id,canvas:{width:w,height:h},anchor:{x:Math.round(w/2),y:h}})),placements:PROP_PLACEMENTS,
    guides:['collision-guide','entrances-guide','markers-guide','foreground-guide','mock-character'],
    drawOrder:['B1 ground/path','B2 Stage/Gate','building contact shadow','building body','building roof','door/window','trim','props','foreground','emissive','guides','character','marker/UI'],
    conceptReferences:['variants/imagegen-four-building-concept.png'],
  },null,2))
  console.log(JSON.stringify({out:OUT,preview:PREVIEW,buildings:BUILDINGS.length,props:PROP_SPECS.length}))
}

main().catch((error)=>{console.error(error);process.exit(1)})
