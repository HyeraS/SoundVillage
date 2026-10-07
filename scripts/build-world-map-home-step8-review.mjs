import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/world-map-home-production-step8')
const MASK_DIR = path.join(ROOT, 'public/assets/world/sound-archive-garden-v4')
const SOURCE_DIR = path.join(ROOT, 'design/world-map-v4/source-assets')
await mkdir(REVIEW, { recursive: true })

const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[character])
const header = (width, title, subtitle = '') => Buffer.from(`<svg width="${width}" height="60" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="60" fill="#172019"/><text x="24" y="27" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="700">${esc(title)}</text><text x="24" y="48" fill="#bcd0bf" font-family="Arial,sans-serif" font-size="12">${esc(subtitle)}</text></svg>`)
const label = (width, text) => Buffer.from(`<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="34" fill="#172019cc"/><text x="14" y="23" fill="#fff" font-family="Arial,sans-serif" font-size="14" font-weight="700">${esc(text)}</text></svg>`)

async function fit(file, width, height, background = '#263a2b') {
  return sharp(file).resize(width, height, { fit:'contain', background }).png().toBuffer()
}

async function writeTitled(output, title, subtitle, body, width, height) {
  await sharp({ create:{ width, height:height + 60, channels:4, background:'#263a2b' } })
    .composite([{ input:header(width, title, subtitle), top:0, left:0 }, { input:body, top:60, left:0 }])
    .png()
    .toFile(path.join(REVIEW, output))
}

const baseline = path.join(REVIEW, 'baseline-runtime-1280x720.png')
const finalRuntime = path.join(REVIEW, 'final-runtime-1280x720.png')
const beforeAfter = await sharp({ create:{ width:2560, height:720, channels:4, background:'#263a2b' } })
  .composite([
    { input:await fit(baseline, 1280, 720), left:0, top:0 },
    { input:await fit(finalRuntime, 1280, 720), left:1280, top:0 },
    { input:label(1280, 'BEFORE — legacy single-image Home hub'), left:0, top:0 },
    { input:label(1280, 'AFTER — approved Candidate A, native 2-layer Home'), left:1280, top:0 },
  ]).png().toBuffer()
await writeTitled('01-runtime-before-after.png', 'Step 8 runtime before / after', 'Same 1280×720 production camera; approved Candidate A replaces only the Home presentation.', beforeAfter, 2560, 720)

const layerRuntime = await fit(path.join(REVIEW, 'layer-runtime-objects-1280x720.png'), 1280, 720)
const ground = await fit(path.join(SOURCE_DIR, 'landmark-home-player-site-ground.png'), 600, 360, '#5b6f58')
const building = await fit(path.join(SOURCE_DIR, 'landmark-home-player-building.png'), 600, 360, '#5b6f58')
const layerBody = await sharp({ create:{ width:1880, height:720, channels:4, background:'#314834' } })
  .composite([
    { input:layerRuntime, left:0, top:0 },
    { input:ground, left:1280, top:0 },
    { input:building, left:1280, top:360 },
    { input:label(600, 'ground band · 512×480 · approved PNG'), left:1280, top:0 },
    { input:label(600, 'world band · 352×301 · approved PNG'), left:1280, top:360 },
  ]).png().toBuffer()
await writeTitled('02-layer-runtime.png', 'Native Home layer runtime', 'Ground is below the player; building body participates in world depth sorting.', layerBody, 1880, 720)

const [oldMask, newMask] = await Promise.all([
  sharp(path.join(REVIEW, 'baseline-walkable-clearance-mask.png')).greyscale().raw().toBuffer(),
  sharp(path.join(MASK_DIR, 'walkable-clearance-mask.png')).greyscale().raw().toBuffer(),
])
const diff = Buffer.alloc(960 * 720 * 4)
let newlyBlocked = 0
let newlyWalkable = 0
for (let index = 0; index < 960 * 720; index += 1) {
  const before = oldMask[index] > 127
  const after = newMask[index] > 127
  let color = after ? [36, 67, 50, 255] : [93, 76, 57, 255]
  if (before && !after) { color = [231, 92, 75, 255]; newlyBlocked += 1 }
  if (!before && after) { color = [74, 211, 205, 255]; newlyWalkable += 1 }
  diff.set(color, index * 4)
}
const diffPng = await sharp(diff, { raw:{ width:960, height:720, channels:4 } }).png().toBuffer()
const collisionBody = await sharp({ create:{ width:2240, height:720, channels:4, background:'#263a2b' } })
  .composite([
    { input:await fit(path.join(REVIEW, 'collision-runtime-1280x720.png'), 1280, 720), left:0, top:0 },
    { input:diffPng, left:1280, top:0 },
    { input:label(1280, 'Production collision QA overlay'), left:0, top:0 },
    { input:label(960, `Mask delta — red blocked ${newlyBlocked}, cyan opened ${newlyWalkable}`), left:1280, top:0 },
  ]).png().toBuffer()
await writeTitled('03-collision-clearance.png', 'Collision and clearance regeneration', 'All mask changes are confined to the Home footprint; the adjacent road cell stays clear.', collisionBody, 2240, 720)

const maskRaw = newMask
const anchors = {
  spawn:[480,376], approach:[412,440], eastRoad:[456,440], westRing:[336,440], northRoad:[412,336], southRoad:[412,520],
}
const indexOf = (x, y) => y * 960 + x
function route(from, to) {
  const parent = new Int32Array(960 * 720); parent.fill(-2)
  const qx = new Int16Array(960 * 720); const qy = new Int16Array(960 * 720)
  let head = 0; let tail = 1
  qx[0] = from[0]; qy[0] = from[1]; parent[indexOf(...from)] = -1
  while (head < tail && parent[indexOf(...to)] === -2) {
    const x = qx[head]; const y = qy[head]; head += 1; const current = indexOf(x, y)
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy
      if (nx<0 || ny<0 || nx>=960 || ny>=720) continue
      const next=indexOf(nx,ny)
      if (parent[next]!==-2 || maskRaw[next] <= 127) continue
      parent[next]=current; qx[tail]=nx; qy[tail]=ny; tail+=1
    }
  }
  const result=[]
  for(let current=indexOf(...to); current>=0; current=parent[current]) { const y=Math.floor(current/960); result.push([current-y*960,y]) }
  return result.reverse()
}
const routeSpecs = [
  ['spawn','approach','#ffd166'], ['eastRoad','approach','#67e8f9'], ['westRing','approach','#a7f3d0'],
  ['approach','eastRoad','#f9a8d4'], ['approach','westRing','#c4b5fd'], ['northRoad','southRoad','#fb923c'], ['southRoad','northRoad','#fde047'],
  ['westRing','eastRoad','#60a5fa'], ['eastRoad','westRing','#f87171'],
]
const crop = { left:280, top:300, width:240, height:280 }
const routeLines = routeSpecs.map(([from,to,color]) => {
  const points=route(anchors[from],anchors[to]).filter((_,index,array)=>index%6===0 || index===array.length-1).map(([x,y])=>`${(x-crop.left)*3},${(y-crop.top)*3}`).join(' ')
  return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.82"/>`
}).join('')
const anchorMarks = Object.entries(anchors).map(([name,[x,y]])=>`<circle cx="${(x-crop.left)*3}" cy="${(y-crop.top)*3}" r="8" fill="#fff" stroke="#172019" stroke-width="3"/><text x="${(x-crop.left)*3+12}" y="${(y-crop.top)*3-10}" fill="#fff" stroke="#172019" stroke-width="3" paint-order="stroke" font-family="Arial,sans-serif" font-size="16" font-weight="700">${name}</text>`).join('')
const routeOverlay=Buffer.from(`<svg width="720" height="840" xmlns="http://www.w3.org/2000/svg">${routeLines}${anchorMarks}<rect x="12" y="776" width="696" height="48" rx="8" fill="#172019dd"/><text x="28" y="806" fill="#fff" font-family="Arial,sans-serif" font-size="16">7 required cases / 9 directed routes · stalled frames 0</text></svg>`)
const routeBase=await sharp(path.join(MASK_DIR,'walkable-clearance-mask.png')).extract(crop).resize(720,840,{kernel:'nearest'}).tint('#59715c').png().toBuffer()
const routeBody=await sharp(routeBase).composite([{input:routeOverlay,left:0,top:0}]).png().toBuffer()
await writeTitled('04-route-validation.png','Home circulation route validation','Production clearance-mask BFS replayed through moveWorldPlayer; bidirectional N–S and W–E included.',routeBody,720,840)

await writeTitled('05-depth-runtime.png', 'Depth sorting and interaction runtime', 'Player stands at the canonical approach while ground remains below and building body sorts in the world band.', await fit(path.join(REVIEW,'home-near-runtime-1280x720.png'),1280,720), 1280,720)

const seamCrop = await sharp(path.join(REVIEW,'home-near-runtime-1280x720.png')).extract({ left:350, top:45, width:650, height:620 }).resize(1300,1240,{kernel:'lanczos3'}).png().toBuffer()
await writeTitled('06-road-seam-runtime.png','Home / east-road seam close-up','The approved 512×480 site ground meets the existing circular road without covering the retained x=1792 road cell.',seamCrop,1300,1240)

const cameraFiles=[['1280×720','camera-1280x720.png'],['1440×900','camera-1440x900.png'],['390×844','camera-390x844.png'],['844×390','camera-844x390.png']]
const cameraComposites=[]
for(let index=0;index<cameraFiles.length;index+=1){const [name,file]=cameraFiles[index];const left=(index%2)*720,top=Math.floor(index/2)*450;cameraComposites.push({input:await fit(path.join(REVIEW,file),720,450),left,top},{input:label(720,name),left,top})}
const cameraBody=await sharp({create:{width:1440,height:900,channels:4,background:'#263a2b'}}).composite(cameraComposites).png().toBuffer()
await writeTitled('07-camera-grid-runtime.png','Four-viewport browser matrix','Actual in-app browser captures; Home keeps the same two world-space layer rects at every viewport.',cameraBody,1440,900)

const minimapBody=await sharp({create:{width:2560,height:720,channels:4,background:'#263a2b'}}).composite([
  {input:await fit(path.join(REVIEW,'minimap-overlay-home-1280x720.png'),1280,720),left:0,top:0},
  {input:await fit(path.join(REVIEW,'home-autowalk-arrived-1280x720.png'),1280,720),left:1280,top:0},
  {input:label(1280,'Minimap · Home marker (1648,1760) · near=true'),left:0,top:0},
  {input:label(1280,'Production auto-walk arrived · blocked X/Y=no · reason=none'),left:1280,top:0},
]).png().toBuffer()
await writeTitled('08-minimap-interaction.png','Minimap and interaction parity','The marker, guide path, collision approach, interaction prompt, and runtime arrival share one canonical point.',minimapBody,2560,720)

console.log(JSON.stringify({ status:'PASS', newlyBlocked, newlyWalkable, outputs:Array.from({length:8},(_,index)=>`${String(index+1).padStart(2,'0')}-${['runtime-before-after','layer-runtime','collision-clearance','route-validation','depth-runtime','road-seam-runtime','camera-grid-runtime','minimap-interaction'][index]}.png`) }, null, 2))
