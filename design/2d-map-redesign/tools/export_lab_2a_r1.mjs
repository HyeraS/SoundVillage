import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {TRIAL_LAYERS,scene} from '../../../app/lab-observatory-cohesion-preview/cohesionArt.mjs'
const out='design/2d-map-redesign/previews/lab-2a-r1'
const svg=(body,view='64 64 576 576')=>`<svg xmlns="http://www.w3.org/2000/svg" width="${view.split(' ')[2]}" height="${view.split(' ')[3]}" viewBox="${view}">${body}</svg>`
for(const k of ['ground','shadow','foreground','emissive'])fs.writeFileSync(`${out}/layer-${k}.svg`,svg(TRIAL_LAYERS[k]))
fs.writeFileSync(`${out}/layer-building.svg`,svg(TRIAL_LAYERS.objects.map(o=>o.svg).join('')))
for(const after of [false,true]){const s=scene({after});fs.writeFileSync(`${out}/environment-${after?'after':'before'}.svg`,svg(s.base+s.objects.map(o=>o.svg).join('')+s.foreground+s.emissive,'0 0 1536 1152'))}
for(const name of fs.readdirSync(out).filter(n=>n.endsWith('.svg'))){
 let s=fs.readFileSync(path.join(out,name),'utf8');const v=s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
 const gray=/filter:\s*grayscale\(1\)/.test(s)
 s=s.replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${v[2]}" height="${v[3]}" viewBox="${v.join(' ')}">`)
 s=s.replace(/href="(\/[^\"]+)"/g,(_,src)=>`href="data:image/png;base64,${fs.readFileSync(path.join('public',src)).toString('base64')}"`)
 let raster=sharp(Buffer.from(s));if(gray)raster=raster.grayscale();await raster.png().toFile(path.join(out,name.replace('.svg','.png')))
}
// Pixel comparison outside the fixed trial region: other areas must be identical.
const a=await sharp(out+'/environment-after.png').ensureAlpha().raw().toBuffer(),b=await sharp(out+'/environment-before.png').ensureAlpha().raw().toBuffer();let diff=0
for(let y=0;y<1152;y++)for(let x=0;x<1536;x++){if(x>=64&&x<640&&y>=64&&y<640)continue;let i=(y*1536+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])diff++}
fs.writeFileSync(out+'/outside-scope-pixel-check.json',JSON.stringify({changedPixelsOutsideTrial:diff,pass:diff===0},null,2));if(diff)throw Error(`outside trial: ${diff} changed pixels`)
console.log('R1 PNGs, independent layers and outside-scope pixel comparison complete')
