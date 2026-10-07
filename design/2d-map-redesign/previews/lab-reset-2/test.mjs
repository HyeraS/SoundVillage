import assert from 'node:assert/strict';import fs from 'node:fs';import * as G from './geometry.mjs';
const checks=[];function test(name,fn){fn();checks.push(name);}
const v=JSON.parse(fs.readFileSync(new URL('./validation.json',import.meta.url)));
const slots=JSON.parse(fs.readFileSync(new URL('./slots.json',import.meta.url)));
test('spawn free and outside exit',()=>{assert.equal(G.blocked(G.SPAWN.x,G.SPAWN.y),null);assert.equal(G.inside(G.SPAWN.x,G.SPAWN.y,G.EXIT),false);});
test('required route and complete loop traverse in ground model',()=>{assert(v.route.pass);assert(v.loop.pass);});
test('central base blocks large step, upper arch itself does not',()=>{const p=G.point(724,740),q=G.move(p,0,-500);assert(q.y>650*G.SCALE);assert(q.hits.includes('central-base'));const behind=G.point(724,345);assert.equal(G.blocked(behind.x,behind.y),null);});
test('archive partition blocks but middle opening permits crossing',()=>{let a=G.point(470,350),b=G.move(a,-180,0);assert(b.hits.includes('archive-boundary-upper'));a=G.point(470,478);b=G.move(a,-120,0);assert.equal(b.hits.length,0);assert.equal(G.blocked(b.x,b.y),null);});
test('diagonal corner sliding does not leave a blocked endpoint',()=>{let p=G.point(480,430);for(let i=0;i<100;i++){p=G.move(p,-4,-4);assert.equal(G.blocked(p.x,p.y),null);}});
test('every actual slot has clearance, not reserved; no shared coordinate',()=>{assert.equal(new Set(slots.map(s=>s.x+','+s.y)).size,slots.length);for(const s of slots){assert(G.clearance(s.x,s.y));assert(!G.reserved(s.x,s.y));}for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)assert(Math.hypot(slots[i].x-slots[j].x,slots[i].y-slots[j].y)>=64);});
test('capacity failure remains explicit, never padded with fake markers',()=>{assert.equal(v.capacityPass,false);assert(v.capacity.some(c=>c.shortfallB));assert.equal(v.slotTotal,slots.length);});
test('recommended camera world/display preserve aspect and stay in world',()=>{for(const [w,h] of [[1050,787.5],[366,305],[296,296*5/6],[720,540]])for(const p of G.ROUTE){const c=G.camera(p,'recommended',w,h);assert(c.x>=0&&c.y>=0);assert(c.x+c.w<=1536.001&&c.y+c.h<=1152.001);assert(Math.abs(c.w/c.h-w/h)<.001);}});
fs.writeFileSync(new URL('./tests.json',import.meta.url),JSON.stringify({pass:true,checks},null,2));console.log('PASS '+checks.length+' independent model checks');
