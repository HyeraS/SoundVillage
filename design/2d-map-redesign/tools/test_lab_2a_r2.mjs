import assert from 'node:assert/strict'
import fs from 'node:fs'
import sharp from 'sharp'
import {scene as r1scene,VISUAL_BOUNDS as r1bounds} from '../../../app/lab-observatory-cohesion-preview/cohesionArt.mjs'
import {scene,OBJECTS,VISUAL_BOUNDS} from '../../../app/lab-observatory-pixel-preview/pixelArt.mjs'
const dir='design/2d-map-redesign/previews/lab-2a-r2'
const old=fs.readFileSync('app/lab-observatory-cohesion-preview/CohesionPreview.js','utf8'),next=fs.readFileSync('app/lab-observatory-pixel-preview/PixelPreview.js','utf8')
for(const [a,b] of [['function Avatar','export default'],[' function perform',' const btn'],[' const object=',' return <main'],[' {on.markers&&',' {on.grid&&']])assert.equal(next.slice(next.indexOf(a),next.indexOf(b)),old.slice(old.indexOf(a),old.indexOf(b)))
assert.deepEqual(VISUAL_BOUNDS,r1bounds)
assert.deepEqual(OBJECTS.map(o=>[o.id,o.depth]),r1scene().objects.map(o=>[o.id,o.depth]))
assert.deepEqual(scene({after:false}),r1scene({after:true}))
const assets=[]
for(const o of OBJECTS){const match=o.svg.match(/href="([^"]+)" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);const [,p,x,y,w,h]=match;const md=await sharp('public'+p).metadata();assert.equal(+w/md.width,2);assert.equal(+h/md.height,2);assert(+x>=64&&+y>=64&&+x+(+w)<=640&&+y+(+h)<=640);const data=await sharp('public'+p).ensureAlpha().raw().toBuffer();assert([...data.filter((_,i)=>i%4===3)].every(a=>a===0||a===255));assets.push({id:o.id,source:[md.width,md.height],world:[+w,+h],scale:2,binaryAlpha:true})}
function svg(s){let code=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1152">${s.base}${s.objects.map(o=>o.svg).join('')}${s.foreground}${s.emissive}</svg>`;return code.replace(/href="(\/[^\"]+)"/g,(_,p)=>`href="data:image/png;base64,${fs.readFileSync('public'+p).toString('base64')}"`)}
const [a,b]=await Promise.all([sharp(Buffer.from(svg(r1scene()))).ensureAlpha().raw().toBuffer(),sharp(Buffer.from(svg(scene()))).ensureAlpha().raw().toBuffer()]);let outside=0,inside=0;for(let y=0;y<1152;y++)for(let x=0;x<1536;x++){let i=(y*1536+x)*4;if(!a.subarray(i,i+4).equals(b.subarray(i,i+4))){if(x>=64&&x<640&&y>=64&&y<640)inside++;else outside++}}assert.equal(outside,0)
const result={pass:true,behaviorAndAvatarAndMarkers:'byte-identical excerpts to R1',depthAndFade:'same IDs, depths, and bounds',outsidePatchChangedPixels:outside,insidePatchChangedPixels:inside,assets};fs.writeFileSync(dir+'/r2-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
