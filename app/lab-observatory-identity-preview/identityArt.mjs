import {scene as r2Scene,OBJECTS as r2Objects,VISUAL_BOUNDS} from '../lab-observatory-pixel-preview/pixelArt.mjs'
export {VISUAL_BOUNDS}
const replacements={'shelf-west':['records',141,126,118,82],'shelf-east':['measurement',333,126,118,82],desk:['workbench',148,216,112,72],instrument:['frame',392,200,48,88]}
const image=(name,x,y,w,h)=>`<image href="/design-previews/lab-2a-r3/${name}.png" x="${x}" y="${y}" width="${w}" height="${h}" style="image-rendering:pixelated"/>`
export const OBJECTS=r2Objects.map(o=>replacements[o.id]?{...o,svg:image(...replacements[o.id])}:o)
export function scene({after=true,foreground=true,emissive=true}={}){
 const prior=r2Scene({after:true,foreground,emissive})
 if(!after)return prior
 return {...prior,objects:OBJECTS,emissive:emissive?image('emissive',64,64,576,576):''}
}
