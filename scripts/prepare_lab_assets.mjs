// Mechanical sprite-sheet packaging only: color-key alpha, cell extraction,
// nearest-neighbour native resolution, and roof/body separation. Art by ImageGen.
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
const out = path.resolve('public/assets/lab-witch')
await fs.mkdir(out, { recursive: true })
const sources = [
 ['architecture-source.png', process.argv[2], ['witch-house','pumpkin-shop','potion-shop','rust-house','violet-house','market','well','cart'], [112,104,104,104,96,96,58,64]],
 ['nature-source.png', process.argv[3], ['tree-jade','tree-violet','ghost-tree','lantern','shrub','pumpkins','stone-fence','rocks'], [52,52,48,18,32,26,48,36]],
]
const entries = {}
for (const [source, input, names, widths] of sources) {
 if (!input) throw new Error('Pass both ImageGen source PNG paths')
 await fs.copyFile(input, path.join(out, source))
 const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject:true })
 for (let i=0;i<data.length;i+=4) {
   if (data[i]>140 && data[i+2]>140 && data[i+1]<45 && data[i]-data[i+1]>100 && data[i+2]-data[i+1]>100) data[i+3]=0
   else data[i+3]=255
 }
 for (let n=0;n<8;n++) {
   const cw=info.width/4,ch=info.height/2
   const cell=await sharp(data,{raw:info}).extract({left:n%4*cw,top:Math.floor(n/4)*ch,width:cw,height:ch}).png().toBuffer()
   const {data:d,info:s}=await sharp(cell).raw().toBuffer({resolveWithObject:true})
   // Discard fragments of neighbouring sprites straddling atlas cell edges.
   const seen=new Uint8Array(s.width*s.height), components=[]
   for(let k=0;k<seen.length;k++) if(!seen[k]&&d[k*4+3]) {
     const q=[k];seen[k]=1
     for(let z=0;z<q.length;z++){const a=q[z],x=a%s.width,y=Math.floor(a/s.width);for(const b of [x>0?a-1:-1,x<s.width-1?a+1:-1,y>0?a-s.width:-1,y<s.height-1?a+s.width:-1])if(b>=0&&!seen[b]&&d[b*4+3]){seen[b]=1;q.push(b)}}
     components.push(q)
   }
   const largest=Math.max(...components.map(c=>c.length))
   for(const c of components)if(c.length<largest*0.012 || (c.length<largest*0.25&&c.some(k=>k%s.width<3||k%s.width>s.width-4)))for(const k of c)d[k*4+3]=0
   const cleaned=await sharp(d,{raw:s}).png().toBuffer()
   let x0=s.width,y0=s.height,x1=0,y1=0
   for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(d[(y*s.width+x)*4+3]){x0=Math.min(x,x0);y0=Math.min(y,y0);x1=Math.max(x,x1);y1=Math.max(y,y1)}
   const w=widths[n],h=Math.round((y1-y0+1)/(x1-x0+1)*w)
   const img=await sharp(cleaned).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(w,h,{kernel:'nearest'}).png().toBuffer()
   await fs.writeFile(path.join(out,`${names[n]}.png`),img)
   // Upper canopies are independent sprites, not collision masks.
   const split=Math.round(h*(names[n].startsWith('tree-')?0.72:0.6))
   for(const [layer,top,height] of [['foreground',0,split],['body',split,h-split]]){
     await sharp(img).extract({left:0,top,width:w,height}).toFile(path.join(out,`${names[n]}-${layer}.png`))
   }
   entries[names[n]]={width:w,height:h,split,source,cell:n,scale:2}
 }
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({generator:'Built-in ImageGen; production packing with sharp',tile:32,nativePixelScale:2,entries},null,2)+'\n')
console.log(entries)
