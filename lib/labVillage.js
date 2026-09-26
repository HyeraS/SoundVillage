import { T, MAP_W, MAP_H, OBJECTS, BUILDINGS, TREES, POND, DOCK_WALKS, GROUND_DECOR_PATCHES, PATHS, onPath, pointInPolygon, canCollect, districtAt, DISTRICTS } from './labVillageConfig.mjs'
import manifest from '../public/assets/lab-witch/manifest.json'
const BASE='/assets/lab-witch/'
const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(`에셋을 불러오지 못했습니다: ${src}`));im.src=src})
let cached
export function loadLabVillage(){
 if(!cached)cached=loadImage(`${BASE}environment-master-v2.png`).then(environment=>({environment,lockCanvases:new Map()})).catch(error=>{cached=null;throw error})
 return cached
}
function random(seed){let a=seed>>>0;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}}
function drawGround(c,images){
 const r=random(90331),w=MAP_W*T/2,h=MAP_H*T/2
 c.fillStyle='#66968a';c.fillRect(0,0,w,h)
 // Continuous low-frequency turf patches, never a visible repeated tile border.
 for(let i=0;i<190;i++){const x=Math.floor(r()*w/4)*4,y=Math.floor(r()*h/4)*4,rx=12+Math.floor(r()*30),ry=8+Math.floor(r()*18);c.fillStyle=['#6d9d8f','#709f8e','#5e8d83','#639287'][i%4];for(let dy=-ry;dy<ry;dy+=4){const dx=Math.round(rx*Math.sqrt(1-dy*dy/(ry*ry))/4)*4;c.fillRect(x-dx,y+dy,dx*2,4)}}
 // Rasterized paths create stepped pixel edges; geometry also serves path placement.
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){if(onPath((x+1)*2,(y+1)*2)){c.fillStyle='#dfc28e';c.fillRect(x,y,2,2)}}
 for(let i=0;i<10000;i++){
   const x=Math.floor(r()*w),y=Math.floor(r()*h),path=onPath(x*2,y*2)
   c.fillStyle=path?['#d4b482','#e5cb9a','#ddbe8b'][i%3]:['#80ab94','#588a7d','#76a18e'][i%3]
   if(r()<.5)c.fillRect(x,y,2,1)
   else if(!path){c.fillRect(x,y,1,2);c.fillRect(x+2,y-1,1,2)}
 }
 // Large concept-matched pond: dark water core, jade shallows and a narrow bank.
 for(let y=350;y<552;y+=2)for(let x=0;x<224;x+=2){
   const wet=pointInPolygon(x*2,y*2,POND)
   const shallow=wet&&[[18,0],[-18,0],[0,18],[0,-18]].some(([dx,dy])=>!pointInPolygon(x*2+dx,y*2+dy,POND))
   const shore=!wet&&[[10,0],[-10,0],[0,10],[0,-10]].some(([dx,dy])=>pointInPolygon(x*2+dx,y*2+dy,POND))
   if(wet||shore){c.fillStyle=shore?'#8fa98f':shallow?'#338e89':'#147878';c.fillRect(x,y,2,2)}
 }
 for(let i=0;i<430;i++){const x=Math.floor(r()*215),y=365+Math.floor(r()*170);if(pointInPolygon(x*2,y*2,POND)){c.fillStyle=i%3?'#2f918c':'#74b8aa';c.fillRect(x,y,3+Math.floor(r()*6),1)}}
 // Three short docks are walkable only on their authored planks and never cross water.
 for(const d of DOCK_WALKS){const x=Math.round(d.x/2),y=Math.round(d.y/2),dw=Math.round(d.w/2),dh=Math.round(d.h/2)
   c.fillStyle='#493a2c';c.fillRect(x-2,y+2,dw+4,dh)
   const horizontal=dw>dh
   for(let p=0;p<(horizontal?dw:dh);p+=6){c.fillStyle=(p/6)%2?'#a97846':'#bc8b55';if(horizontal)c.fillRect(x+p,y,5,dh-2);else c.fillRect(x,y+p,dw-2,5)}
   for(const [px,py]of horizontal?[[x,y-5],[x+dw-3,y-5],[x,y+dh-2],[x+dw-3,y+dh-2]]:[[x-4,y],[x+dw-2,y],[x-4,y+dh-4],[x+dw-2,y+dh-4]]){c.fillStyle='#60442e';c.fillRect(px,py,3,8)}
 }
 // Reuse the existing purchased nature sheet for sparse flowers and mushrooms.
 GROUND_DECOR_PATCHES.forEach(([tx,ty],i)=>{for(let j=0;j<4;j++){const x=tx*16+r()*24-12,y=ty*16+r()*16-8;if(!onPath(x*2,y*2))c.drawImage(images.nature,(i+j)%8*16,i%3===0?128:112,16,16,Math.round(x),Math.round(y),16,16)}})
 // Well courtyard is a complete place: low jade turf island and broad cobbles.
 for(let yy=276;yy<350;yy+=2)for(let xx=285;xx<495;xx+=2){const dx=(xx-390)/105,dy=(yy-313)/37;if(dx*dx+dy*dy<1){c.fillStyle=(xx+yy)%8?'#6a9988':'#759f8c';c.fillRect(xx,yy,2,2)}}
 for(let i=0;i<100;i++){const x=24.2*16+(r()-.5)*178,y=19.7*16+(r()-.5)*60;if(((x-387)/90)**2+((y-315)/31)**2<1){c.fillStyle=['#a7ac92','#c1c1a4','#8d9c8b'][i%3];c.fillRect(Math.floor(x/2)*2,Math.floor(y/2)*2,4+r()*4|0,3)}}
 // South entrance posts reuse purchased wood tiles; physical posts are the lamps.
 c.fillStyle='#ebd8ab';c.fillRect(22*16,34.65*16,4*16,15);c.strokeStyle='#795e42';c.lineWidth=1;c.strokeRect(22*16,34.65*16,4*16,15)
 c.fillStyle='#543e2f';c.font='bold 8px sans-serif';c.textAlign='center';c.fillText('↓ 입구',24*16,34.65*16+10)
}
function drawPixelObject(c,assets,o){
 const x=Math.round(o.x-o.w/2),y=Math.round(o.y-o.h)
 if(o.kind==='flower'||o.kind==='mushroom'){
  const seed=[...o.id].reduce((n,ch)=>n+ch.charCodeAt(0),0),sx=(seed%8)*16,sy=o.kind==='flower'?112:128
  c.drawImage(assets.images.nature,sx,sy,16,16,x,y,o.w,o.h);return true
 }
 if(o.kind==='wood-fence-h'){
  c.fillStyle='#3c302638';c.fillRect(x,o.y-8,o.w,8)
  c.fillStyle='#6a462c';c.fillRect(x,o.y-27,o.w,5);c.fillRect(x,o.y-14,o.w,5)
  c.fillStyle='#9b6a3c';c.fillRect(x,o.y-29,o.w,3);c.fillRect(x,o.y-16,o.w,3)
  for(let px=x;px<=x+o.w-6;px+=Math.max(28,Math.floor(o.w/3))){c.fillStyle='#553723';c.fillRect(px,o.y-38,8,37);c.fillStyle='#b17b48';c.fillRect(px+2,o.y-40,4,5)}return true
 }
 if(o.kind==='wood-fence-v'){
  c.fillStyle='#3c302638';c.fillRect(o.x-4,y,13,o.h)
  c.fillStyle='#6a462c';c.fillRect(o.x-12,y,5,o.h);c.fillRect(o.x+7,y,5,o.h)
  c.fillStyle='#9b6a3c';c.fillRect(o.x-13,y,3,o.h);c.fillRect(o.x+6,y,3,o.h)
  for(let py=y;py<=o.y-6;py+=Math.max(26,Math.floor(o.h/3))){c.fillStyle='#553723';c.fillRect(o.x-7,py,14,8);c.fillStyle='#b17b48';c.fillRect(o.x-5,py+1,10,3)}return true
 }
 if(o.kind==='barrel'){
  c.fillStyle='#37291f44';c.fillRect(x+2,o.y-5,o.w-4,7);c.fillStyle='#8b5c31';c.fillRect(x+4,y+5,o.w-8,o.h-7);c.fillStyle='#b77a40';c.fillRect(x+7,y+7,o.w-14,o.h-11);c.fillStyle='#463529';c.fillRect(x+3,y+9,o.w-6,4);c.fillRect(x+3,o.y-12,o.w-6,4);return true
 }
 if(o.kind==='crate'){
  c.fillStyle='#3d2d2340';c.fillRect(x+2,o.y-4,o.w-2,6);c.fillStyle='#9b6737';c.fillRect(x,y,o.w,o.h);c.fillStyle='#c38a4e';c.fillRect(x+4,y+4,o.w-8,o.h-8);c.fillStyle='#6e482b';c.fillRect(x+7,y+6,4,o.h-12);c.fillRect(x+o.w-11,y+6,4,o.h-12);return true
 }
 if(o.kind==='sign'){
  c.fillStyle='#443126';c.fillRect(o.x-4,y+20,8,o.h-20);c.fillRect(x+1,y+1,o.w-2,25);c.fillStyle='#a97642';c.fillRect(x+4,y+4,o.w-8,18);c.fillStyle='#efd38b';c.fillRect(o.x-8,y+10,16,3);return true
 }
 if(o.kind==='boat'){
  c.fillStyle='#2f292540';c.fillRect(x+6,o.y-5,o.w-12,6);c.fillStyle='#5c3a25';c.fillRect(x,y+12,o.w,14);c.fillStyle='#ad7545';c.fillRect(x+8,y+7,o.w-16,15);c.fillStyle='#e0b06b';c.fillRect(x+18,y+11,o.w-36,5);return true
 }
 if(o.kind==='fishing'){
  c.fillStyle='#493528';c.fillRect(o.x-3,y,6,o.h);c.fillRect(x+3,o.y-13,o.w-6,6);c.fillStyle='#c39a61';c.fillRect(o.x-1,y+2,2,o.h-8);c.fillStyle='#d9d1ad';c.fillRect(x+7,o.y-8,o.w-14,3);return true
 }
 return false
}
export function drawObject(c,assets,o,player,{foreground=false}={}){
 const im=assets.images[o.kind]
 const x=Math.round(o.x-o.w/2),y=Math.round(o.y-o.h)
 const touching=foreground&&player&&Math.abs(player.x-o.x)<o.w/2+22&&player.y>y&&player.y<o.y
 if(!foreground){c.fillStyle='#284a4930';c.beginPath();c.ellipse(o.x,o.y-3,o.kind.startsWith('tree')?23:o.w*.38,7,0,0,Math.PI*2);c.fill()}
 if(!im){drawPixelObject(c,assets,o);return}
 // Foreground fades only over a player's upper body; foundations keep their weight.
 const split=manifest.entries[o.kind]?.split,ih=im.height
 if(touching&&split){
   c.globalAlpha=.42;c.drawImage(im,0,0,im.width,split,x,y,o.w,o.h*split/ih)
   c.globalAlpha=1;c.drawImage(im,0,split,im.width,ih-split,x,y+o.h*split/ih,o.w,o.h*(ih-split)/ih)
 }else c.drawImage(im,x,y,o.w,o.h)
}
export function drawLabItem(c,item,now,blockNum,collectedIds,nearby=false){
 const done=collectedIds.has(item.id),active=canCollect(item,blockNum,collectedIds)
 const x=Math.round(item.x/2)*2,y=Math.round(item.y/2)*2,bob=Math.round(Math.sin(now/600+item.phase)*2)*2
 if(nearby&&active){
   const pulse=Math.floor((Math.sin(now/150)+1)*2)*2
   c.fillStyle='#dffff044';c.fillRect(x-18-pulse/2,y-42-pulse/2,36+pulse,36+pulse)
   c.strokeStyle='#f8ffe8';c.lineWidth=2;c.strokeRect(x-16-pulse/2,y-40-pulse/2,32+pulse,32+pulse)
   c.fillStyle='#ffffff';for(const [sx,sy]of[[-22,-28],[22,-20],[-14,-48],[15,-44]]){c.fillRect(x+sx-1,y+sy-3,2,6);c.fillRect(x+sx-3,y+sy-1,6,2)}
 }
 c.fillStyle=done?'#29494428':'#264d4a80';c.beginPath();c.ellipse(x,y+2,9,4,0,0,Math.PI*2);c.fill()
 if(!active&&!done){
   c.fillStyle='#456960';c.fillRect(x-5,y-19,10,10);c.strokeStyle='#ccceae';c.lineWidth=2;c.strokeRect(x-3,y-24,6,7);return
 }
 c.globalAlpha=done?.28:1
 const iy=y-26+bob
 c.fillStyle='#325f58';c.fillRect(x-8,iy-6,16,14);c.fillRect(x-4,iy-10,8,22)
 c.fillStyle='#b2f7dc';c.fillRect(x-10,iy-4,20,10);c.fillRect(x-6,iy-10,12,22)
 c.fillStyle='#fffbdc';c.fillRect(x-6,iy-6,12,14);c.fillRect(x-2,iy-10,4,22)
 c.fillStyle='#65cdb8';c.fillRect(x-3,iy-2,6,6)
 if(!done){c.fillStyle='#f5ffe9';c.fillRect(x-1,iy-18,2,6);c.fillRect(x-3,iy-16,6,2)}
 c.globalAlpha=1
}
export function drawLabLocks(c,blockNum,progress){
 // Native 2px-world raster, exactly the same path exemptions as collision.
 for(let y=0;y<MAP_H*T/2;y+=2)for(let x=0;x<MAP_W*T/2;x+=2){
   const region=districtAt(x*2,y*2)
   if(progress[region]>blockNum&&!onPath(x*2,y*2)){c.fillStyle='#e3e4d438';c.fillRect(x,y,2,2)}
 }
 for(const d of DISTRICTS){if(progress[d.id]<=blockNum)continue
   const [x,y]=d.anchor;c.fillStyle='#314e48e0';c.fillRect(x*16-33,y*16-9,66,15)
   c.fillStyle='#f5edd8';c.textAlign='center';c.font='bold 8px sans-serif';c.fillText(`구역 ${progress[d.id]} · 잠김`,x*16,y*16+1)
 }
}
export function renderLabScene(back,front,assets,items,player,now,blockNum,collectedIds,camera,progress,nearbyId=null){
 const dpr=camera.dpr||1
 for(const c of [back,front]){c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,c.canvas.width,c.canvas.height);c.imageSmoothingEnabled=false;c.setTransform(camera.zoom*dpr,0,0,camera.zoom*dpr,(camera.ox-camera.x*camera.zoom)*dpr,(camera.oy-camera.y*camera.zoom)*dpr)}
 // The concept-derived environment is a dedicated Lab asset, not a DOM
 // screenshot. Gameplay geometry, collection state and camera remain live.
 back.drawImage(assets.environment,0,0,MAP_W*T,MAP_H*T)
 // Slots exclude visible silhouettes; items remain clear and above environment effects.
 for(const item of items)drawLabItem(back,item,now,blockNum,collectedIds,item.id===nearbyId)
 // Repaint only the silhouette that is physically in front of the player.
 // The opaque master stays on the back layer; these clipped samples provide
 // roof/canopy occlusion without turning their full rectangles into collision.
 if(player)for(const o of [...BUILDINGS,...TREES].sort((a,b)=>a.y-b.y)){
   const x=o.x-o.w/2,y=o.y-o.h
   if(player.y>=o.y||player.y<y-12||player.x<x-22||player.x>x+o.w+22)continue
   front.save();front.beginPath()
   if(o.kind.startsWith('tree-'))front.ellipse(o.x,y+o.h*.42,o.w*.54,o.h*.42,0,0,Math.PI*2)
   else if(o.kind==='ghost-tree'){
     front.ellipse(o.x,y+o.h*.46,o.w*.52,o.h*.45,0,0,Math.PI*2)
   }else if(o.kind==='well'){
     front.rect(x+o.w*.12,y,o.w*.76,o.h*.82)
   }else if(o.kind==='market'||o.kind==='cart'){
     front.rect(x,y,o.w,o.h*.82)
   }else{
     front.moveTo(o.x,y);front.lineTo(x+o.w*.14,y+o.h*.28);front.lineTo(x,y+o.h*.58)
     front.lineTo(x+o.w*.06,o.y-o.h*.08);front.lineTo(x+o.w*.94,o.y-o.h*.08)
     front.lineTo(x+o.w,y+o.h*.58);front.lineTo(x+o.w*.86,y+o.h*.28);front.closePath()
   }
   front.clip();front.drawImage(assets.environment,0,0,MAP_W*T,MAP_H*T);front.restore()
 }
 if(progress){
   const key=`${blockNum}:${JSON.stringify(progress)}`
   if(!assets.lockCanvases.has(key)){
     const canvas=document.createElement('canvas');canvas.width=MAP_W*T/2;canvas.height=MAP_H*T/2
     drawLabLocks(canvas.getContext('2d'),blockNum,progress);assets.lockCanvases.set(key,canvas)
   }
   front.drawImage(assets.lockCanvases.get(key),0,0,MAP_W*T,MAP_H*T)
 }
}
export { labCamera } from './labVillageConfig.mjs'
