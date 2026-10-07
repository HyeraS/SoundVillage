import assert from 'node:assert/strict'
import fs from 'node:fs'
import {SAFE_SLOTS,SPAWN,STRUCTURES,isCollision,WHITEBOX_VALIDATION} from '../../../app/lab-whitebox-preview/whiteboxConfig.mjs'
import {SOLIDS,PLAYER,START,blocked,move,intersects,footBox} from '../../../app/lab-observatory-cohesion-preview/cohesionConfig.mjs'
assert.equal(WHITEBOX_VALIDATION.pass,true)
assert.deepEqual(PLAYER,{w:22,h:28,spriteW:72,spriteH:88,speed:3.9/.01667})
for(const s of SOLIDS)assert(s.x>=96&&s.y>=96&&s.x+s.w<=512&&s.y+s.h<=384,'override outside Archive')
// Every original collision outside Archive and every originally walkable point stays unchanged.
let changed=0
for(let y=16;y<1152;y+=8)for(let x=16;x<1536;x+=8){const b=blocked(x,y,false),a=blocked(x,y,true);if(!b)assert.equal(a,false,`new obstruction ${x},${y}`);if(b!==a){changed++;assert(intersects(footBox(x,y),{x:96,y:96,w:416,h:288}))}}
// Unchanged 108 slots, their 3x3 clearance, and a 2-tile approach.
const slots=Object.values(SAFE_SLOTS).flat();assert.equal(slots.length,108)
for(const s of slots){assert.equal(blocked((s.tx+.5)*32,(s.ty+.5)*32),false);for(let y=s.ty-1;y<=s.ty+1;y++)for(let x=s.tx-1;x<=s.tx+1;x++){assert.equal(isCollision(x,y),false);assert(!SOLIDS.some(r=>intersects(r,{x:x*32,y:y*32,w:32,h:32})))}assert([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!blocked((s.tx+.5+dx*2)*32,(s.ty+.5+dy*2)*32)))}
for(const s of Object.values(STRUCTURES))assert(!SOLIDS.some(r=>intersects(r,{x:s.approach.x*32,y:s.approach.y*32,w:96,h:96})))
// AABB reachability on an 8px graph from the unchanged map spawn, not just tile BFS.
const origin=[SPAWN.tx*32+16,SPAWN.ty*32+16],queue=[origin],seen=new Set([origin.join(',')])
for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[8,0],[-8,0],[0,8],[0,-8]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(nx<0||ny<0||nx>=1536||ny>=1152||seen.has(k)||blocked(nx,ny))continue;seen.add(k);queue.push([nx,ny])}}
for(const p of [[304,464],[304,400],[304,336],[304,240],[304,192],[280,240],[368,240],...slots.map(s=>[(s.tx+.5)*32,(s.ty+.5)*32])])assert(seen.has(p.join(',')),`unreachable ${p}`)
let pos=START;pos=move(pos,0,-160,true);assert(Math.abs(pos.y-304)<1e-6);pos=move(pos,-96,0,true);assert(pos.x>=267&&pos.x<270,'desk should stop leftward move')
const instrument=move({x:416,y:336},0,-100,true);assert(instrument.y>=316&&instrument.y<319)
const rear=move({x:304,y:240},0,-100,true);assert(rear.y>=188&&rear.y<191)
const west=move({x:200,y:336},-200,0,true);assert(west.x>=139&&west.x<142)
const old=move(START,0,-160,false);assert(old.y>=412&&old.y<415)
const returned=move({x:304,y:304},0,160,true);assert(Math.abs(returned.y-464)<1e-6)
// Large deltas cannot tunnel through the desk and walls.
assert(move({x:304,y:304},-500,0,true).x>=267)
const result={pass:true,unchangedSlots:108,originalWhitebox:WHITEBOX_VALIDATION,changedFootSamples8px:changed,reachableFootSamples8px:seen.size,movement:{oldStopsAt:old.y,proposedEntersTo:304,deskStopsAt:pos.x,instrumentStopsAt:instrument.y,rearStopsAt:rear.y,westStopsAt:west.x,returnsTo:returned.y},scope:'Archive-only collision override; no production state'}
fs.writeFileSync('design/2d-map-redesign/previews/lab-2a-r1/static-validation.json',JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))
