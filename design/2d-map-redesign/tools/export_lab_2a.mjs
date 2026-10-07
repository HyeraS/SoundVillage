// Rasterizes DOM-exported camera snapshots. Does not edit generated study pixels.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
const root=process.cwd(), out=path.join(root,'design/2d-map-redesign/previews/lab-2a')
for(const name of fs.readdirSync(out).filter(n=>n.endsWith('.svg'))){
 let svg=fs.readFileSync(path.join(out,name),'utf8')
 const v=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
 svg=svg.replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${v[2]}" height="${v[3]}" viewBox="${v.join(' ')}">`)
 svg=svg.replaceAll(/href="(\/[^\"]+)"/g,(_,src)=>`href="data:image/png;base64,${fs.readFileSync(path.join(root,'public',src)).toString('base64')}"`)
 await sharp(Buffer.from(svg)).png().toFile(path.join(out,name.replace('.svg','.png')))
}
console.log('Exported exact-world-size PNGs from preview SVG snapshots.')
