import fs from 'node:fs';
import * as G from './geometry.mjs';
const out=new URL('./',import.meta.url);
const audit=JSON.parse(fs.readFileSync(new URL('./sound-audit.json',out)));
const step=8,cols=193,rows=145,key=(x,y)=>Math.round(y/step)*cols+Math.round(x/step);
const free=new Uint8Array(cols*rows);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)free[y*cols+x]=G.blocked(x*step,y*step)?0:1;
const start={x:Math.round(G.SPAWN.x/8)*8,y:Math.round(G.SPAWN.y/8)*8};const visited=new Set([key(start.x,start.y)]),queue=[start];
for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy] of [[8,0],[-8,0],[0,8],[0,-8]]){const x=p.x+dx,y=p.y+dy,k=key(x,y);if(x<0||y<0||x>1536||y>1152||visited.has(k)||!free[k])continue;const q=G.move(p,dx,dy);if(Math.abs(q.x-x)+Math.abs(q.y-y)>0.01)continue;visited.add(k);queue.push({x,y});}}
const reachable=(x,y)=>visited.has(key(x,y));
const slots=[],capacity=[];
for(let b=0;b<6;b++){let candidates=[];const region=G.BLOCK_REGIONS[b];for(let y=48;y<1120;y+=16)for(let x=48;x<1500;x+=16){if(G.inside(x,y,region)&&!G.reserved(x,y)&&G.clearance(x,y)&&reachable(x,y))candidates.push({x,y,block:b+1});}
 // Deterministic farthest spacing: 64px center spacing, no lowering clearance to meet demand.
 let chosen=[];while(candidates.length){candidates.sort((a,c)=>score(c)-score(a)||a.y-c.y||a.x-c.x);let p=candidates.shift();if(slots.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<64))continue;chosen.push(p);slots.push(p);candidates=candidates.filter(q=>Math.hypot(p.x-q.x,p.y-q.y)>=64);}
 function score(p){return slots.length?Math.min(...slots.map(q=>Math.hypot(p.x-q.x,p.y-q.y))):p.y;}
 capacity.push({block:b+1,candidatesBeforeSpacing:'16px grid, 32px clearance',available:chosen.length,A:audit.groups.A[b],B:audit.groups.B[b],shortfallA:Math.max(0,audit.groups.A[b]-chosen.length),shortfallB:Math.max(0,audit.groups.B[b]-chosen.length)});
}
function routeCheck(path){const trace=[];let p=path[0];for(let i=1;i<path.length;i++){let target=path[i],q=G.move(p,target.x-p.x,target.y-p.y);trace.push({from:p,to:target,reached:Math.hypot(q.x-target.x,q.y-target.y)<1,stop:{x:q.x,y:q.y},hits:q.hits});p={x:q.x,y:q.y};}return {pass:trace.every(t=>t.reached),trace};}
const route=routeCheck(G.ROUTE),loop=routeCheck(G.LOOP);
const allFreeCount=free.reduce((a,b)=>a+b,0);
const result={model:'hand-traced approximate ground contacts; not art boundary certification',grid:8,speed:G.PLAYER.speed,spawn:G.SPAWN,spawnBlocked:G.blocked(G.SPAWN.x,G.SPAWN.y),spawnInsideExit:G.inside(G.SPAWN.x,G.SPAWN.y,G.EXIT),reachableSamples:visited.size,freeSamples:allFreeCount,route,loop,capacity,slotTotal:slots.length,capacityPass:capacity.every(c=>!c.shortfallA&&!c.shortfallB),slotsMeetCriteria:slots.every(p=>G.clearance(p.x,p.y)&&reachable(p.x,p.y)),assumptions:['64px square center clearance against explicit solid footprints','64px approach checked every4px with22x28 player AABB','minimum64px center spacing; deterministic packing, not optimal capacity proof','foreground40px marker footprint exclusion; approximate art silhouettes','8px graph does not prove subpixel art edge alignment','all peripheral solids are provisional; first route is browser-test target']};
fs.writeFileSync(new URL('./slots.json',out),JSON.stringify(slots,null,2));fs.writeFileSync(new URL('./validation.json',out),JSON.stringify(result,null,2));
export function shape(s,attrs=''){if(s.type==='rect')return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" ${attrs}/>`;if(s.type==='ellipse')return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs}/>`;return `<polygon points="${s.points.map(p=>p.join(',')).join(' ')}" ${attrs}/>`;}
const env='<image href="../lab-reset-1/environment-world.png" width="1536" height="1152"/>';
const frame=c=>`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1152" viewBox="0 0 1536 1152">${env}${c}</svg>`;
const labels=G.SOLIDS.map(s=>{let x=s.x??s.cx,y=s.y??s.cy;return `<text x="${x}" y="${y+12}" font-size="10" fill="white">${s.id}</text>`;}).join('');
fs.writeFileSync(new URL('./logical-plan.svg',out),frame(G.SOLIDS.map(s=>shape(s,'fill="#ef6c5b55" stroke="#ffb199" stroke-width="2"')).join('')+G.APPROACHES.map(s=>shape(s,'fill="#8edfaa22" stroke="#8edfaa"')).join('')+`<polyline points="${G.ROUTE.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="#90ffe1" stroke-width="5"/>`+labels));
fs.writeFileSync(new URL('./foreground-plan.svg',out),frame(G.OCCLUDERS.map(s=>shape(s,'fill="#af87ff66" stroke="#d4c3ff" stroke-width="2"')).join('')));
fs.writeFileSync(new URL('./slot-plan.svg',out),frame(slots.map(p=>`<rect x="${p.x-32}" y="${p.y-32}" width="64" height="64" fill="#64ceb11a" stroke="#64ceb1"/><circle cx="${p.x}" cy="${p.y}" r="12" fill="#172f3e"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle" font-size="14" fill="white">${p.block}</text>`).join('')));
console.log(JSON.stringify({route:route.pass,loop:loop.pass,spawn:result.spawnBlocked,reachable:visited.size,total:slots.length,capacity},null,2));
if(!route.pass)console.log('ROUTE ISSUES',JSON.stringify(route.trace.filter(t=>!t.reached)));
if(!loop.pass)console.log('LOOP ISSUES',JSON.stringify(loop.trace.filter(t=>!t.reached)));
