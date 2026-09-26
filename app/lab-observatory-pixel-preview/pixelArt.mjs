import {scene as r1Scene,VISUAL_BOUNDS} from '../lab-observatory-cohesion-preview/cohesionArt.mjs'
export {VISUAL_BOUNDS}
const image=(name,x,y,w,h)=>`<image href="/design-previews/lab-2a-r2/${name}.png" x="${x}" y="${y}" width="${w}" height="${h}" style="image-rendering:pixelated"/>`
const definitions=[['rear',160,'rear',96,72,416,88],['shelf-west',208,'shelf',141,126,118,82],['shelf-east',208,'shelf',333,126,118,82],['desk',288,'desk',148,216,112,72],['instrument',288,'device',392,200,48,88],['west',384,'side',96,144,32,240],['east',384,'side',480,144,32,240],['front-west',384,'front-west',128,300,128,84],['front-east',384,'front-east',352,300,128,84],['existing-prop',256,'prop',580,208,24,48]]
export const OBJECTS=definitions.map(([id,depth,name,x,y,w,h])=>({id,depth,svg:image(name,x,y,w,h)}))
export function scene({after=true,foreground=true,emissive=true}={}){
 const prior=r1Scene({after:true,foreground,emissive})
 if(!after)return prior
 // Keep all unmodified Lab artwork as context only. Trial-only camera hides it.
 return {base:prior.base+`<g data-layer="r2-ground">${image('ground',64,64,576,576)}</g><g data-layer="r2-shadow">${image('shadow',64,64,576,576)}</g>`,objects:OBJECTS,foreground:foreground?image('foreground',96,72,416,8):'',emissive:emissive?image('emissive',64,64,576,576):''}
}
