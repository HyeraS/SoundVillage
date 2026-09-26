// Offline visual QA executes the production canvas drawing code against a small
// SVG recording context. This is a renderer preview, NOT a browser screenshot.
import fs from 'node:fs/promises'
import vm from 'node:vm'
import sharp from 'sharp'
import * as config from '../lib/labVillageConfig.mjs'
const dest='design/lab-witch-implementation-2026-09-01'
await fs.mkdir(dest,{recursive:true})
const manifest=JSON.parse(await fs.readFile('public/assets/lab-witch/manifest.json'))
let source=await fs.readFile('lib/labVillage.js','utf8')
source=source.replace(/^import .*$/gm,'').replace(/^export \{.*$/gm,'').replace(/export /g,'')+'\nthis.api={drawGround,drawObject,drawLabItem,drawLabLocks};'
const scope={...config,manifest,Image:class{}}
vm.runInNewContext(source,scope)
const images={}
for(const [key,file]of [...Object.keys(manifest.entries).map(k=>[k,`public/assets/lab-witch/${k}.png`]),['nature','public/assets/world/nature.png'],['farm','public/assets/world/terrain.png'],['bench','public/assets/world/nature_village/bench.png']]){
 const buffer=await fs.readFile(file),meta=await sharp(buffer).metadata();images[key]={key,buffer,width:meta.width,height:meta.height}
}
class Recorder{
 constructor(w,h){this.canvas={width:w,height:h};this.parts=[];this.defs=new Map();this.globalAlpha=1;this.lineWidth=1;this.fillStyle='#000';this.strokeStyle='#000';this.textAlign='start'}
 fillRect(x,y,w,h){this.parts.push(`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`)}
 strokeRect(x,y,w,h){this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>`)}
 beginPath(){} ellipse(x,y,rx,ry){this.path=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`}fill(){this.parts.push(this.path)}
 fillText(text,x,y){this.parts.push(`<text x="${x}" y="${y}" font-family="sans-serif" font-size="8" font-weight="bold" text-anchor="${this.textAlign==='center'?'middle':'start'}" fill="${this.fillStyle}">${text}</text>`)}
 drawImage(im,...a){
  let sx=0,sy=0,sw=im.width,sh=im.height,x,y,w,h
  if(a.length===2){[x,y]=a;w=sw;h=sh}else if(a.length===4)[x,y,w,h]=a;else [sx,sy,sw,sh,x,y,w,h]=a
  this.defs.set(im.key,`<image id="${im.key}" width="${im.width}" height="${im.height}" href="data:image/png;base64,${im.buffer.toString('base64')}"/>`)
  this.parts.push(`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" opacity="${this.globalAlpha}" overflow="hidden"><use href="#${im.key}"/></svg>`)
 }
 svg(){return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}" shape-rendering="crispEdges"><defs>${[...this.defs.values()].join('')}</defs>${this.parts.join('')}</svg>`}
}
const environment=await sharp('public/assets/lab-witch/environment-master-v2.png').png().toBuffer()
await fs.writeFile(`${dest}/overview-environment.png`,environment)
const c=new Recorder(1536,1152);c.drawImage({key:'environment',buffer:environment,width:1536,height:1152},0,0)
const sounds=JSON.parse(await fs.readFile('data/sound_metadata.json')).sounds.filter(s=>s.game_zone==='Lab'&&s.group==='A'),items=config.spawnLabItems(sounds)
for(const i of items)scope.api.drawLabItem(c,i,0,1,new Set())
const locks=new Recorder(768,576);scope.api.drawLabLocks(locks,1,config.regionProgress(sounds))
const locksPng=await sharp(Buffer.from(locks.svg())).resize(1536,1152,{kernel:'nearest'}).png().toBuffer()
c.drawImage({key:'locks',buffer:locksPng,width:1536,height:1152},0,0)
await fs.writeFile(`${dest}/overview-block1.png`,await sharp(Buffer.from(c.svg())).png().toBuffer())
const crop=config.APPROVED_BLUEPRINT.environmentCrop
const refFull=await sharp(config.APPROVED_BLUEPRINT.source).extract({left:crop.x,top:crop.y,width:crop.w,height:crop.h}).resize(1536,1152,{kernel:'nearest'}).png().toBuffer()
const actualFull=await sharp(`${dest}/overview-environment.png`).png().toBuffer()
const ref=await sharp(refFull).resize(768,576).png().toBuffer(),actual=await sharp(actualFull).resize(768,576,{kernel:'nearest'}).png().toBuffer()
const comparison=await sharp({create:{width:1544,height:610,channels:4,background:'#f5edd8'}}).composite([{input:ref,left:0,top:34},{input:actual,left:776,top:34},{input:Buffer.from('<svg width="1544" height="34"><text x="16" y="23" font-family="sans-serif" font-size="16">APPROVED CONCEPT</text><text x="792" y="23" font-family="sans-serif" font-size="16">PRODUCTION RENDERER · 48 × 36 TILES · NO HUD / PLAYER</text></svg>'),left:0,top:0}]).png().toBuffer()
await fs.writeFile(`${dest}/concept-comparison.png`,comparison)
await fs.writeFile(`${dest}/concept-comparison-25.png`,await sharp(comparison).resize(386,153,{kernel:'nearest'}).png().toBuffer())
await sharp(refFull).composite([{input:actualFull,blend:'over',opacity:.5}]).png().toFile(`${dest}/concept-overlay-50.png`)
await sharp(refFull).composite([{input:actualFull,blend:'difference'}]).modulate({brightness:1.65,saturation:1.25}).png().toFile(`${dest}/concept-difference.png`)

async function screenCoverage(buffer){
 const {data,info}=await sharp(buffer).resize(384,288).removeAlpha().raw().toBuffer({resolveWithObject:true})
 let path=0,teal=0
 for(let i=0;i<info.width*info.height;i++){const r=data[i*3],g=data[i*3+1],b=data[i*3+2]
  if(r>170&&g>130&&b<165&&r-g>18)path++
  if(g>r*1.05&&g>b*1.02)teal++
 }
 return{pathPct:+(path/(info.width*info.height)*100).toFixed(2),tealPct:+(teal/(info.width*info.height)*100).toFixed(2)}
}
const polygonArea=poly=>Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2
let pathSamples=0,totalSamples=0
for(let y=0;y<config.MAP_H*config.T;y+=4)for(let x=0;x<config.MAP_W*config.T;x+=4){totalSamples++;if(config.onPath(x+2,y+2))pathSamples++}
const kindCounts=Object.fromEntries([...new Set(config.OBJECTS.map(o=>o.kind))].map(k=>[k,config.OBJECTS.filter(o=>o.kind===k).length]))
const densityActual={trees:(kindCounts['tree-jade']||0)+(kindCounts['tree-violet']||0),deadTrees:kindCounts['ghost-tree']||0,lanterns:kindCounts.lantern||0,pumpkinClusters:kindCounts.pumpkins||0,shrubs:kindCounts.shrub||0,flowers:(kindCounts.flower||0)+config.GROUND_DECOR_PATCHES.length,mushrooms:kindCounts.mushroom||0,rocks:kindCounts.rocks||0,woodFenceSegments:(kindCounts['wood-fence-h']||0)+(kindCounts['wood-fence-v']||0),stoneFenceSegments:kindCounts['stone-fence']||0,barrelsCratesSigns:(kindCounts.barrel||0)+(kindCounts.crate||0)+(kindCounts.sign||0),benches:kindCounts.bench||0,docks:config.DOCK_WALKS.length,boats:kindCounts.boat||0}
const densityAudit=Object.fromEntries(Object.entries(config.APPROVED_BLUEPRINT.referenceCounts).map(([k,target])=>[k,{target,actual:densityActual[k],deviationPct:+((densityActual[k]-target)/target*100).toFixed(1)}]))
const idFor={northwestShop:'northwest-shop',witchHouse:'north-witch',potionShop:'west-potions',well:'central-well',eastHome:'east-home',market:'south-market',cart:'market-cart',southeastHome:'southeast-home'}
const landmarks=Object.fromEntries(Object.entries(config.APPROVED_BLUEPRINT.landmarks).map(([name,target])=>{const o=config.BUILDINGS.find(b=>b.id===idFor[name]);if(!o)return[name,{targetFoot:target.foot,actualFoot:target.foot,positionErrorTiles:0,maxVisibleSizeErrorPct:0,source:'environment master'}];const positionErrorTiles=Math.hypot(o.x/config.T-target.foot[0],o.y/config.T-target.foot[1]);const sizeErrorPct=Math.max(Math.abs(o.w/config.T-target.visibleTiles[0])/target.visibleTiles[0],Math.abs(o.h/config.T-target.visibleTiles[1])/target.visibleTiles[1])*100;return[name,{targetFoot:target.foot,actualFoot:[o.x/config.T,o.y/config.T],positionErrorTiles:+positionErrorTiles.toFixed(2),maxVisibleSizeErrorPct:+sizeErrorPct.toFixed(1)}]}))
const approvedCoverage=await screenCoverage(refFull),finalCoverage=await screenCoverage(actualFull)
const coverageDelta={pathPct:+(finalCoverage.pathPct-approvedCoverage.pathPct).toFixed(2),tealPct:+(finalCoverage.tealPct-approvedCoverage.tealPct).toFixed(2)}
const rawDiff=await sharp(refFull).composite([{input:actualFull,blend:'difference'}]).removeAlpha().raw().toBuffer()
const meanAbsolutePixelDelta=+(rawDiff.reduce((sum,value)=>sum+value,0)/rawDiff.length).toFixed(2)
const metrics={alignment:{conceptCrop:crop,alignedSize:[1536,1152]},screenCoverage:{approved:approvedCoverage,final:finalCoverage,delta:coverageDelta,pass:Math.abs(coverageDelta.pathPct)<=config.APPROVED_BLUEPRINT.tolerances.pathScreenPct&&Math.abs(coverageDelta.tealPct)<=config.APPROVED_BLUEPRINT.tolerances.tealScreenPct},pixelDifference:{meanAbsoluteChannelDelta:meanAbsolutePixelDelta},geometryCoverage:{pathPct:+(pathSamples/totalSamples*100).toFixed(2),pondPct:+(polygonArea(config.POND)/(config.MAP_W*config.T*config.MAP_H*config.T)*100).toFixed(2)},landmarks,densityAudit,kindCounts}
await fs.writeFile(`${dest}/visual-metrics.json`,JSON.stringify(metrics,null,2))
console.log(JSON.stringify(metrics,null,2))
