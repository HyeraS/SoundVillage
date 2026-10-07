import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { T, MAP_W, MAP_H, STAGE, GATE, BUILDINGS, PROP_SPECS, PROPS, PROP_COLLIDERS } from '../../../lib/musicVillageConfig.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT = path.join(ROOT, 'public/assets/music-village-moonlit-v2')
const SOURCE = path.join(ROOT, 'design/2d-map-redesign/sources/music-moonlit-v2/imagegen-material-prop-reference.png')
const STYLEFRAME = 'design/concepts/music-village-cozy-2026-09-17/01-moonlit-concert-garden-v2-music.png'
const files = []

const P = Object.freeze({
  night: '#07152f', night2: '#0b2140', grass: '#0d3650', grass2: '#12465b',
  path: '#b57678', pathLight: '#d29287', pathEdge: '#563e68', ink: '#171735',
  teal: '#087a8f', tealHi: '#13a6ad', violet: '#7046a2', violetHi: '#a45bc2',
  coral: '#ef7188', pink: '#f07cc6', cyan: '#42d5df', amber: '#ffb34f', cream: '#ffe6a0',
  leaf: '#08707a', leaf2: '#14909a', wood: '#925064', woodHi: '#c87973', stone: '#4a4c77',
})

const svg = (w, h, body, transparent = true) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
  `${transparent ? '' : `<rect width="${w}" height="${h}" fill="${P.night}"/>`}${body}</svg>`,
)
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`
const line = (x1, y1, x2, y2, stroke, width = 4, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`

async function write(relative, input) {
  const target = path.join(OUT, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  await sharp(input).png({ compressionLevel: 9, palette: true }).toFile(target)
  const data = fs.readFileSync(target)
  files.push({ path: relative, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') })
}

function groundSvg() {
  const w = MAP_W * T, h = MAP_H * T
  const grassPattern = `<defs>
    <pattern id="grass" width="32" height="32" patternUnits="userSpaceOnUse">
      <rect width="32" height="32" fill="${P.night2}"/>
      <rect x="4" y="7" width="4" height="4" fill="${P.grass}"/><rect x="23" y="21" width="5" height="3" fill="${P.grass2}"/>
      <rect x="13" y="27" width="3" height="3" fill="#0a2d49"/><rect x="27" y="5" width="2" height="2" fill="#1a5566"/>
    </pattern>
    <pattern id="path" width="32" height="32" patternUnits="userSpaceOnUse">
      <rect width="32" height="32" fill="${P.path}"/><rect x="2" y="3" width="12" height="3" fill="#c88482" opacity=".45"/>
      <rect x="18" y="17" width="10" height="4" fill="#9e666f" opacity=".55"/><rect x="7" y="26" width="5" height="3" fill="#d68e86" opacity=".4"/>
    </pattern>
    <radialGradient id="moon"><stop offset="0" stop-color="#315677" stop-opacity=".36"/><stop offset="1" stop-color="#07152f" stop-opacity="0"/></radialGradient>
  </defs>`
  let body = grassPattern + rect(0, 0, w, h, 'url(#grass)') + circle(768, 520, 690, 'url(#moon)')
  // Four lived-in courtyards, all beneath explicit solid geometry.
  for (const [x, y, rw, rh] of [[72,88,350,270],[1088,96,376,260],[62,830,390,280],[1084,814,374,282]]) {
    body += `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="72" fill="#153b55" stroke="#28536a" stroke-width="8"/>`
  }
  // Main loop, inner loop, and central north-south axis.
  body += `<rect x="302" y="286" width="932" height="634" rx="300" fill="none" stroke="${P.pathEdge}" stroke-width="164"/>`
  body += `<rect x="302" y="286" width="932" height="634" rx="300" fill="none" stroke="url(#path)" stroke-width="140"/>`
  body += `<rect x="533" y="436" width="470" height="300" rx="132" fill="none" stroke="${P.pathEdge}" stroke-width="86"/>`
  body += `<rect x="533" y="436" width="470" height="300" rx="132" fill="none" stroke="url(#path)" stroke-width="68"/>`
  body += rect(720, 272, 96, 880, P.pathEdge) + rect(730, 272, 76, 880, 'url(#path)')
  body += rect(640, 298, 256, 96, P.pathEdge) + rect(650, 306, 236, 76, 'url(#path)')
  // Flat musical inlays: low-contrast staff and waveform lines, no collision.
  for (const y of [390, 790]) body += `<path d="M380 ${y} C520 ${y-24} 610 ${y+22} 720 ${y} S960 ${y-20} 1155 ${y}" fill="none" stroke="#684f78" stroke-width="5" opacity=".55" stroke-dasharray="22 18"/>`
  for (const yy of [510,530,550,570,590]) body += line(570, yy, 690, yy, '#76566f', 3, 'opacity=".35"')
  body += `<path d="M580 550 l18 -12 18 18 18 -28 18 15 25 -8" fill="none" stroke="${P.coral}" stroke-width="4" opacity=".42"/>`
  // Flat flowers, grass tufts, petals, and path edge pixels.
  const flowers = [[92,390],[164,518],[1320,398],[1390,548],[510,960],[1000,974],[476,210],[1060,224],[596,814],[940,824]]
  for (const [x,y] of flowers) body += circle(x,y,5,P.pink)+circle(x+8,y+3,4,P.cyan)+circle(x-6,y+7,3,P.coral)+rect(x-2,y+8,4,10,P.leaf)
  for (let i=0;i<70;i++) {
    const x = (i * 211 + 83) % w, y = (i * 137 + 61) % h
    body += rect(x, y, i % 3 + 2, 2, i % 4 === 0 ? '#2c7180' : '#1a5269', 'opacity=".75"')
  }
  // Open south threshold.
  body += rect(704, 1088, 128, 64, P.pathEdge) + rect(736, 1088, 64, 64, 'url(#path)')
  return svg(w, h, body)
}

function stageLayer(layer) {
  const w = STAGE.w*T, h = STAGE.h*T
  const empty = ''
  if (layer === 'contact-shadow') return svg(w,h,`<ellipse cx="192" cy="202" rx="181" ry="18" fill="#020817" opacity=".65"/>`)
  if (layer === 'base-platform') return svg(w,h,rect(12,150,360,54,P.ink)+rect(20,156,344,38,'#8e5064')+rect(24,160,336,7,'#c87973')+rect(90,202,204,18,P.stone)+rect(106,204,172,10,'#7774a0'))
  if (layer === 'rear-body') return svg(w,h,rect(32,50,320,112,'#28244e')+rect(42,60,300,92,'#151733')+rect(48,66,288,78,'#202248'))
  if (layer === 'opening') return svg(w,h,rect(58,82,268,64,'#10132c')+line(192,88,192,146,'#3a3968',4)+circle(192,118,5,P.amber)+rect(84,110,28,36,'#302d58')+rect(274,110,28,36,'#302d58'))
  if (layer === 'canopy-s1') return svg(w,h,`<path d="M18 70 L18 38 Q92 12 192 54 Q292 12 366 38 L366 70 Q288 45 192 82 Q96 45 18 70Z" fill="${P.teal}" stroke="${P.ink}" stroke-width="8"/><path d="M26 48 Q98 25 192 64 Q286 25 358 48" fill="none" stroke="${P.tealHi}" stroke-width="8"/><path d="M28 62 Q100 40 192 75 Q284 40 356 62" fill="none" stroke="${P.violetHi}" stroke-width="4"/>`)
  if (layer === 'trim') {
    let bulbs=''; for(let i=0;i<9;i++) bulbs += circle(62+i*32,78+(Math.abs(i-4)*2),5,P.amber)+circle(62+i*32,78+(Math.abs(i-4)*2),2,P.cream)
    return svg(w,h,line(28,38,28,172,'#b4777a',8)+line(356,38,356,172,'#b4777a',8)+bulbs+rect(150,34,84,8,P.coral)+rect(158,30,10,8,P.cyan)+rect(177,26,8,12,P.pink)+rect(194,31,12,7,P.cyan)+rect(214,27,8,11,P.pink))
  }
  if (layer === 'front-stair') return svg(w,h,rect(118,194,148,8,'#302e55')+rect(104,204,176,9,'#5f5c83')+rect(90,214,204,10,'#8883a4'))
  if (layer === 'foreground') return svg(w,h,rect(12,168,46,22,P.stone)+rect(326,168,46,22,P.stone)+circle(28,158,13,P.leaf2)+circle(46,160,12,P.pink)+circle(340,160,13,P.leaf2)+circle(356,157,10,P.cyan))
  if (layer === 'emissive') return svg(w,h,`<defs><filter id="g"><feGaussianBlur stdDeviation="8"/></filter></defs><ellipse cx="192" cy="112" rx="150" ry="60" fill="#ffae45" opacity=".12" filter="url(#g)"/>${circle(192,38,20,P.coral,'opacity=".2" filter="url(#g)"')}`)
  return svg(w,h,empty)
}

function gateLayer(layer) {
  const w=GATE.w*T,h=GATE.h*T
  if(layer==='contact-shadow') return svg(w,h,`<ellipse cx="64" cy="88" rx="62" ry="8" fill="#020817" opacity=".7"/>`)
  if(layer==='posts') return svg(w,h,rect(0,18,30,78,P.stone)+rect(98,18,30,78,P.stone)+rect(6,24,18,64,'#716c98')+rect(104,24,18,64,'#716c98')+rect(0,12,30,12,'#a65b7b')+rect(98,12,30,12,'#a65b7b'))
  if(layer==='rail-g1') return svg(w,h,`<path d="M24 38 Q46 8 64 26 Q82 8 104 38" fill="none" stroke="${P.ink}" stroke-width="12"/><path d="M24 38 Q46 8 64 26 Q82 8 104 38" fill="none" stroke="${P.tealHi}" stroke-width="6"/>`)
  if(layer==='trim') return svg(w,h,circle(14,10,6,P.amber)+circle(114,10,6,P.amber)+circle(64,22,4,P.pink)+rect(60,8,8,12,P.cyan))
  if(layer==='foreground') return svg(w,h,circle(8,70,14,P.leaf)+circle(120,70,14,P.leaf)+circle(18,78,10,P.pink)+circle(110,78,10,P.cyan))
  if(layer==='emissive') return svg(w,h,`<defs><filter id="g"><feGaussianBlur stdDeviation="7"/></filter></defs>${circle(14,12,22,P.amber,'opacity=".28" filter="url(#g)"')}${circle(114,12,22,P.amber,'opacity=".28" filter="url(#g)"')}`)
  return svg(w,h,'')
}

function buildingLayer(building, layer) {
  const w=building.w*T,h=building.h*T
  const theme = {
    'record-archive': { roof:P.teal, hi:P.tealHi, wall:'#66456f', motif:'record' },
    'listening-cafe': { roof:P.teal, hi:'#28a9b1', wall:'#75456c', motif:'cafe' },
    'community-studio': { roof:P.violet, hi:P.violetHi, wall:'#56466f', motif:'studio' },
    'sound-workshop': { roof:'#176c83', hi:P.cyan, wall:'#724c63', motif:'workshop' },
  }[building.id]
  if(layer==='contact-shadow') return svg(w,h,`<ellipse cx="${w/2}" cy="${h-8}" rx="${w/2-8}" ry="14" fill="#020817" opacity=".68"/>`)
  if(layer==='body') return svg(w,h,rect(12,58,w-24,h-66,P.ink)+rect(18,62,w-36,h-76,theme.wall)+rect(24,70,w-48,h-92,'#8a5973')+rect(18,h-28,w-36,16,'#303055'))
  if(layer==='roof') return svg(w,h,`<path d="M8 72 L34 24 L${w-42} 24 L${w-8} 72 L${w-20} 88 L20 88Z" fill="${theme.roof}" stroke="${P.ink}" stroke-width="8"/><path d="M28 55 L42 34 L${w-50} 34 L${w-28} 55" fill="none" stroke="${theme.hi}" stroke-width="8"/>`)
  if(layer==='door-window') {
    const doorX = building.entrance === 'west' ? 8 : building.entrance === 'east' ? w-46 : w/2-20
    let s = rect(doorX,h-76,40,64,P.ink)+rect(doorX+7,h-68,26,55,'#6e405e')+circle(doorX+27,h-42,3,P.amber)
    for(const x of [34,w-82]) s += rect(x,h-72,48,38,P.ink)+rect(x+7,h-65,34,24,P.amber)+rect(x+11,h-61,12,16,P.cream)+rect(x+27,h-61,10,16,'#ffd07a')
    return svg(w,h,s)
  }
  if(layer==='trim') {
    let s=''
    if(theme.motif==='record') s += circle(w-54,106,24,P.ink)+circle(w-54,106,17,'#24274f')+circle(w-54,106,7,P.coral)+circle(w-54,106,2,P.cream)+rect(28,105,44,8,'#a86b7b')+rect(28,119,44,8,'#a86b7b')
    if(theme.motif==='cafe') s += `<path d="M34 118 Q56 86 74 104 L60 126Z" fill="${P.amber}" stroke="${P.ink}" stroke-width="5"/>`+circle(50,128,14,'#8d586d')+`<path d="M${w-110} 105 q18 -28 36 0 M${w-70} 105 q18 -28 36 0" fill="none" stroke="${P.pink}" stroke-width="9"/>`
    if(theme.motif==='studio') { for(let i=0;i<7;i++) s += rect(30+i*22,h-58,18,30,i%2?P.cream:'#202341'); s += `<path d="M${w-66} 104 q-18 18 -5 42 q18 12 28 -3 q6 -17 -10 -28Z" fill="#b66d7b" stroke="${P.ink}" stroke-width="5"/>` }
    if(theme.motif==='workshop') s += line(42,98,42,144,P.amber,6)+line(30,98,54,98,P.amber,6)+line(32,92,32,110,P.amber,5)+line(52,92,52,110,P.amber,5)+rect(78,112,100,12,'#a86368')+rect(84,124,88,24,'#4c3854')+circle(96,122,4,P.cyan)+circle(126,122,4,P.pink)+circle(154,122,4,P.amber)
    return svg(w,h,s)
  }
  if(layer==='foreground') return svg(w,h,circle(26,h-22,14,P.leaf2)+circle(w-26,h-22,14,P.leaf)+circle(34,h-30,7,P.pink)+circle(w-34,h-31,7,P.cyan))
  if(layer==='emissive') return svg(w,h,`<defs><filter id="g"><feGaussianBlur stdDeviation="8"/></filter></defs><rect x="24" y="${h-84}" width="${w-48}" height="60" fill="${P.amber}" opacity=".13" filter="url(#g)"/>`)
  return svg(w,h,'')
}

function propSvg(id, spec) {
  const w=spec.w*T,h=spec.h*T, cx=w/2
  let s=''
  if(id==='flowerbed-low-a'||id==='stage-vegetation-low'||id==='gate-vegetation-low') s=rect(2,h-18,w-4,16,P.stone)+rect(6,h-22,w-12,9,P.leaf)+circle(14,h-24,6,P.pink)+circle(w-16,h-25,6,P.cyan)+circle(cx,h-28,5,P.coral)
  else if(id==='bench-low-a') s=rect(5,6,w-10,8,P.woodHi)+rect(8,18,w-16,8,P.wood)+rect(10,26,5,6,P.ink)+rect(w-15,26,5,6,P.ink)
  else if(id==='planter-low-a') s=circle(cx,12,12,P.leaf2)+circle(cx-8,16,8,P.pink)+circle(cx+8,14,7,P.cyan)+rect(9,18,14,12,'#a15c68')
  else if(id==='lamp-low-a') s=rect(cx-4,20,8,h-24,P.ink)+rect(cx-9,h-9,18,7,P.stone)+rect(cx-11,6,22,22,P.ink)+rect(cx-7,10,14,14,P.amber)+rect(cx-3,12,6,10,P.cream)
  else if(id==='shrub-low-a') s=circle(cx,18,14,P.leaf)+circle(10,21,9,P.leaf2)+circle(24,22,8,'#0a5969')+circle(13,14,3,P.pink)+circle(23,16,3,P.cyan)
  else if(id==='tree-low-a') s=rect(cx-5,h-30,10,26,'#704456')+circle(cx,36,32,'#07556a')+circle(cx-22,52,23,P.leaf)+circle(cx+22,52,23,P.leaf2)+circle(cx,18,22,'#0d7890')+rect(cx-18,32,5,5,P.cyan)+rect(cx+15,46,5,5,P.pink)
  else if(id==='garden-resonance-low') { s=`<ellipse cx="${cx}" cy="${h-25}" rx="58" ry="24" fill="#153458" stroke="${P.stone}" stroke-width="9"/>`; for(let i=0;i<7;i++){const bh=18+Math.abs(3-i)*9;s+=rect(31+i*10,h-31-bh,7,bh,i%2?P.pink:P.cyan)} s+=circle(cx,h-24,9,P.amber)+circle(18,h-18,7,P.pink)+circle(w-18,h-18,7,P.cyan) }
  else if(id==='fence-low-a') { for(let x=2;x<w;x+=18)s+=rect(x,4,8,h-4,P.wood)+`<path d="M${x} 4 l4 -4 l4 4" fill="${P.woodHi}"/>`; s+=line(2,15,w-2,15,P.woodHi,6)+line(2,26,w-2,26,P.wood,6) }
  else if(id==='cafe-table-low-a') s=circle(cx,20,24,'#b46b73')+rect(cx-4,20,8,32,P.ink)+circle(10,52,8,P.wood)+circle(w-10,52,8,P.wood)+circle(cx,16,5,P.amber)
  else if(id==='record-crates-low-a') s=rect(2,8,28,23,P.wood)+rect(34,5,28,26,'#7b4960')+circle(16,18,7,P.ink)+circle(16,18,2,P.coral)+line(38,12,58,12,P.woodHi,3)+line(38,18,58,18,P.woodHi,3)
  else if(id==='repair-bench-low-a') s=rect(2,8,w-4,10,P.woodHi)+rect(7,18,w-14,12,'#51374f')+rect(12,28,7,4,P.ink)+rect(w-19,28,7,4,P.ink)+circle(30,11,4,P.cyan)+circle(54,11,4,P.amber)+circle(76,11,4,P.pink)
  else if(id==='instrument-case-low-a') s=`<path d="M16 4 q12 12 5 31 q-8 10 -2 25 h-12 q-6 -14 2 -25 q-6 -20 7 -31Z" fill="#8d5166" stroke="${P.ink}" stroke-width="4"/>`+line(16,10,16,52,P.amber,3)
  else if(id==='laundry-bike-low-a') s=line(8,8,w-8,8,P.woodHi,3)+line(10,8,10,h,P.wood,5)+line(w-10,8,w-10,h,P.wood,5)+rect(24,10,18,24,'#d9d7e8')+rect(48,10,19,24,P.pink)+circle(26,h-12,11,'none','stroke="#56cad5" stroke-width="4"')+circle(56,h-12,11,'none','stroke="#56cad5" stroke-width="4"')+line(26,h-12,43,h-28,P.cyan,4)+line(43,h-28,56,h-12,P.cyan,4)+line(26,h-12,56,h-12,P.cyan,4)
  else if(id==='mailbox-low-a') s=rect(cx-3,25,6,h-25,P.ink)+rect(5,10,22,24,P.coral)+rect(9,16,14,5,P.cream)+rect(24,7,4,16,P.amber)
  else if(id==='foreground-edge-cluster') s=circle(16,h-18,20,P.leaf)+circle(42,h-22,23,P.leaf2)+circle(70,h-16,20,'#0a5268')+circle(32,h-26,5,P.pink)+circle(61,h-30,5,P.cyan)
  return svg(w,h,s)
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Missing ImageGen source reference: ${SOURCE}`)
  fs.mkdirSync(OUT, { recursive: true })
  await write('ground/music-ground-path-map.png', groundSvg())
  for(const layer of ['contact-shadow','base-platform','rear-body','opening','canopy-s1','trim','front-stair','foreground','emissive']) await write(`stage/${layer}.png`,stageLayer(layer))
  for(const layer of ['contact-shadow','posts','rail-g1','trim','foreground','emissive']) await write(`gate/${layer}.png`,gateLayer(layer))
  for(const building of BUILDINGS) for(const layer of ['contact-shadow','body','roof','door-window','trim','foreground','emissive']) await write(`buildings/${building.id}/${layer}.png`,buildingLayer(building,layer))
  for(const [id,spec] of Object.entries(PROP_SPECS)) await write(`props/${spec.category}/${id}.png`,propSvg(id,spec))

  const manifest = {
    version: 'music-moonlit-v2.0.0', productionUse: true,
    generatedAt: '2026-09-18T00:00:00.000Z',
    geometry: { width: MAP_W*T, height: MAP_H*T, tiles: { width:MAP_W,height:MAP_H }, tileSize:T },
    artDirection: { styleframe: STYLEFRAME, imagegenReference: path.relative(ROOT,SOURCE), promptUse: 'material, prop, palette, and pixel-cluster reference only; runtime geometry is config-authoritative' },
    generation: { script: 'design/2d-map-redesign/tools/build_music_moonlit_v2.mjs', deterministicAssembly: true },
    stage: { x:STAGE.x,y:STAGE.y,width:STAGE.w,height:STAGE.h,collision:STAGE.collision,approach:STAGE.approach },
    gate: { x:GATE.x,y:GATE.y,width:GATE.w,height:GATE.h,opening:GATE.opening,colliders:GATE.colliders },
    buildings: BUILDINGS.map(({id,label,x,y,w,h,entrance,clearance})=>({id,label,x,y,width:w,height:h,entrance,clearance})),
    props: PROPS.map((item,index)=>({ id:item.id,category:item.category,x:item.x,y:item.y,top:item.top,visual:{width:item.w,height:item.h},collision:item.collision,worldCollision:PROP_COLLIDERS[index],foreground:Boolean(item.foreground) })),
    drawOrder:['ground/path','contact-shadows','stage/gate structure','building body/roof/door-window/trim','low props','foreground occlusion','emissive','runtime player','runtime sound markers','HUD'],
    exclusions:['characters','sound orbs','UI','labels','guides','collision overlays','review imagery'],
    files: files.sort((a,b)=>a.path.localeCompare(b.path)),
  }
  fs.writeFileSync(path.join(OUT,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`)
  console.log(`Moonlit Music package: ${files.length} PNG files -> ${OUT}`)
}

main().catch((error)=>{ console.error(error); process.exitCode=1 })
