import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  T, MAP_W, MAP_H, STAGE, GATE, BUILDINGS, PROPS, COLLIDERS,
  CLEARANCE_TILES, PRIMARY_SLOTS, SPAWN, EXIT_TRIGGER,
} from '../../../lib/musicVillageConfig.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const ASSETS = path.join(ROOT, 'public/assets/music-village-moonlit-v2')
const OUT = path.join(ROOT, 'design/2d-map-redesign/previews/music-moonlit-v2')
const STYLEFRAME = path.join(ROOT, 'design/concepts/music-village-cozy-2026-09-17/01-moonlit-concert-garden-v2-music.png')
const W=MAP_W*T,H=MAP_H*T
const svg=(w,h,body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)

async function environment(includeEmissive=true) {
  const composites=[]
  const add=(relative,left,top)=>composites.push({input:path.join(ASSETS,relative),left,top})
  for(const layer of ['contact-shadow','base-platform','rear-body','opening','canopy-s1','trim','front-stair']) add(`stage/${layer}.png`,STAGE.x*T,STAGE.y*T)
  for(const layer of ['contact-shadow','posts','rail-g1','trim']) add(`gate/${layer}.png`,GATE.x*T,GATE.y*T)
  for(const building of BUILDINGS) for(const layer of ['contact-shadow','body','roof','door-window','trim']) add(`buildings/${building.id}/${layer}.png`,building.x*T,building.y*T)
  for(const item of PROPS.filter((p)=>!p.foreground)) add(`props/${item.category}/${item.id}.png`,item.x*T,item.top*T)
  add('stage/foreground.png',STAGE.x*T,STAGE.y*T); add('gate/foreground.png',GATE.x*T,GATE.y*T)
  for(const building of BUILDINGS) add(`buildings/${building.id}/foreground.png`,building.x*T,building.y*T)
  for(const item of PROPS.filter((p)=>p.foreground)) add(`props/${item.category}/${item.id}.png`,item.x*T,item.top*T)
  if(includeEmissive){
    add('stage/emissive.png',STAGE.x*T,STAGE.y*T); add('gate/emissive.png',GATE.x*T,GATE.y*T)
    for(const building of BUILDINGS) add(`buildings/${building.id}/emissive.png`,building.x*T,building.y*T)
  }
  return sharp(path.join(ASSETS,'ground/music-ground-path-map.png')).composite(composites).png().toBuffer()
}

async function main(){
  fs.mkdirSync(OUT,{recursive:true})
  const on=await environment(true),off=await environment(false)
  await sharp(on).toFile(path.join(OUT,'production-overview.png'))
  await sharp(off).toFile(path.join(OUT,'production-emissive-off.png'))
  await sharp(on).grayscale().toFile(path.join(OUT,'grayscale-readability.png'))

  const collision=COLLIDERS.filter((r)=>!r.tag.startsWith('map-')).map((r)=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#ff315f" fill-opacity=".38" stroke="#ff84a0" stroke-width="2"/>`).join('')
  const clear=CLEARANCE_TILES.map((r)=>`<rect x="${r.x*T}" y="${r.y*T}" width="${r.w*T}" height="${r.h*T}" fill="#34e7a7" fill-opacity=".22" stroke="#72ffd0" stroke-width="3" stroke-dasharray="9 5"/>`).join('')
  const slots=PRIMARY_SLOTS.map(({tx,ty})=>`<circle cx="${tx*T+16}" cy="${ty*T+16}" r="6" fill="#42d5df" stroke="#07152f" stroke-width="2"/>`).join('')
  const spawn=`<rect x="${SPAWN.x-10}" y="${SPAWN.y-14}" width="20" height="14" fill="#ffe6a0" stroke="#07152f" stroke-width="2"/>`
  const exit=`<rect x="${EXIT_TRIGGER.x}" y="${EXIT_TRIGGER.y}" width="${EXIT_TRIGGER.w}" height="${EXIT_TRIGGER.h}" fill="#b17bd8" fill-opacity=".5" stroke="#ead2ff" stroke-width="2"/>`
  await sharp(on).composite([{input:svg(W,H,collision+clear+slots+spawn+exit),left:0,top:0}]).png().toFile(path.join(OUT,'collision-entrance-sound-slot-overlay.png'))

  const onSmall=await sharp(on).resize(720,540,{fit:'contain',background:'#07152f',kernel:'nearest'}).png().toBuffer()
  const offSmall=await sharp(off).resize(720,540,{fit:'contain',background:'#07152f',kernel:'nearest'}).png().toBuffer()
  const board=svg(1480,610,'<rect width="1480" height="610" fill="#07152f"/><text x="30" y="38" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">EMISSIVE ON</text><text x="760" y="38" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">EMISSIVE OFF · geometry remains readable</text>')
  await sharp(board).composite([{input:onSmall,left:20,top:55},{input:offSmall,left:750,top:55}]).png().toFile(path.join(OUT,'emissive-on-off-comparison.png'))

  const concept=await sharp(STYLEFRAME).resize(700,525,{fit:'contain',background:'#07152f',kernel:'nearest'}).png().toBuffer()
  const production=await sharp(on).resize(700,525,{fit:'contain',background:'#07152f',kernel:'nearest'}).png().toBuffer()
  const compare=svg(1480,610,'<rect width="1480" height="610" fill="#07152f"/><text x="40" y="40" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">SELECTED STYLEFRAME · art direction</text><text x="760" y="40" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">MOONLIT V2 · production geometry</text>')
  await sharp(compare).composite([{input:concept,left:40,top:60},{input:production,left:760,top:60}]).png().toFile(path.join(OUT,'styleframe-production-comparison.png'))
  console.log(`Moonlit Music QA previews -> ${OUT}`)
}

main().catch((error)=>{console.error(error);process.exitCode=1})
