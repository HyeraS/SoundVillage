import { isCollision, STRUCTURES } from '../lab-whitebox-preview/whiteboxConfig.mjs'
export const PATCH = { x:64,y:64,w:576,h:576, tiles:[2,2,18,18] }
export const ARCHIVE = STRUCTURES.archive
// Current production Lab: 3.9 world px per 16.67ms, 22x28 AABB, 72x88 sprite.
export const PLAYER = {w:22,h:28,spriteW:72,spriteH:88,speed:3.9/0.01667}
export const START = {x:304,y:464}
export const SPAWN_POINT = {x:24*32+16,y:33*32+16}
export const SOLIDS = [
 {id:'rear-wall',x:96,y:96,w:416,h:64},
 {id:'west-wall',x:96,y:160,w:32,h:224},
 {id:'east-wall',x:480,y:160,w:32,h:224},
 {id:'south-west',x:128,y:352,w:128,h:32},
 {id:'south-east',x:352,y:352,w:128,h:32},
 {id:'shelf-west',x:144,y:176,w:112,h:32},
 {id:'shelf-east',x:336,y:176,w:112,h:32},
 {id:'desk',x:152,y:248,w:104,h:40},
 {id:'instrument',x:392,y:240,w:48,h:48},
]
export const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y
export const footBox=(x,y)=>({x:x-PLAYER.w/2,y:y-PLAYER.h,w:PLAYER.w,h:PLAYER.h})
export function blocked(x,y,proposed=true){
 const box=footBox(x,y)
 for(let ty=Math.floor(box.y/32);ty<=Math.floor((y-.001)/32);ty++)for(let tx=Math.floor(box.x/32);tx<=Math.floor((box.x+box.w-.001)/32);tx++){
  const archive=tx>=3&&tx<16&&ty>=3&&ty<12
  if(proposed&&archive)continue
  if(isCollision(tx,ty))return true
 }
 return proposed&&SOLIDS.some(s=>intersects(box,s))
}
export function move(position,dx,dy,proposed=true){
 let p={...position},hits=0
 // <=3px substeps prevent tunnelling even after long frames or repeated button steps.
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/3))
 for(let i=0;i<steps;i++){if(dx){if(!blocked(p.x+dx/steps,p.y,proposed))p.x+=dx/steps;else hits++}if(dy){if(!blocked(p.x,p.y+dy/steps,proposed))p.y+=dy/steps;else hits++}}
 return {...p,hits}
}
export function camera(mobile=false,focus='archive'){
 if(focus==='full')return [0,0,1536,1152]
 if(focus==='detail')return [192,224,384,320]
 return mobile?[64,128,576,384]:[0,32,768,576]
}
