import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { T,MAP_W,MAP_H,PLAYER_BOX,SPAWN,EXIT,OBJECTS,BUILDINGS,PATHS,POND,DOCK_WALKS,DOCK_RAILS,GROUND_DECOR_PATCHES,SLOT_CLEARINGS,APPROVED_BLUEPRINT,buildVillage,collides,moveWithCollision,overlapsExit,spawnLabItems,safeSlots,reachableCells,canCollect,labCamera,onPath } from '../lib/labVillageConfig.mjs'
const sounds=JSON.parse(fs.readFileSync(new URL('../data/sound_metadata.json',import.meta.url))).sounds.filter(s=>s.game_zone==='Lab')
const v=buildVillage(sounds),reach=reachableCells(v)
const positions=items=>Object.fromEntries(items.map(i=>[i.id,[i.x,i.y,i.block,i.sound.group]]))
test('48x36 map; feet and spawn are valid; entrance cannot fire on entry',()=>{
 assert.deepEqual([MAP_W,MAP_H,T],[48,36,32]);assert.deepEqual(PLAYER_BOX,{w:20,h:14});assert.equal(collides(v,SPAWN.x,SPAWN.y),null);assert.equal(overlapsExit(SPAWN),false);assert.equal(overlapsExit({x:EXIT.x+EXIT.w/2,y:EXIT.y+20}),true);assert.ok(reach.count>4000)
})
for(const group of ['A','B','ALL'])test(`all real ${group} IDs, stable order, per-block reachability and interaction clearance`,()=>{
 const list=sounds.filter(s=>group==='ALL'||s.group===group),items=spawnLabItems(list,v)
 assert.equal(list.length,group==='A'?84:group==='B'?85:169)
 assert.equal(items.length,list.length);assert.equal(new Set(items.map(i=>i.id)).size,list.length);assert.equal(new Set(items.map(i=>`${i.x},${i.y}`)).size,list.length)
 assert.deepEqual(new Set(items.map(i=>i.id)),new Set(list.map(s=>s.sound_id)))
 assert.deepEqual(positions(items),positions(spawnLabItems([...list].reverse(),v)))
 assert.ok(items.every(i=>Math.hypot(i.x-SPAWN.x,i.y-SPAWN.y)>=2*T),'no discovery modal on zone entry')
 assert.ok(items.every(i=>!SLOT_CLEARINGS.some(r=>i.x>=r.x&&i.x<=r.x+r.w&&i.y>=r.y&&i.y<=r.y+r.h)),'entries, well, market and spawn stay readable')
 for(const block of [...new Set(list.map(s=>s.block))]){
   const stageReach=reachableCells(v,16,block)
   const collected=new Set(items.filter(i=>i.block<block).map(i=>i.id))
   for(const i of items){
     assert.equal(canCollect(i,block,collected),i.block===block,`${i.id}: collect gate at ${block}`)
     if(i.block!==block)continue
     assert.equal(collides(v,i.x,i.y,16),null,`${i.id}: 1-tile shared approach clearance`)
     assert.ok(stageReach.seen.has(`${i.x},${i.y}`),`${i.id}: stage ${block} reachable with player feet`)
     // Reconstruct the actual BFS route and sweep it with production movement.
     let k=`${i.x},${i.y}`,route=[];while(stageReach.parents.has(k)){route.push(k);k=stageReach.parents.get(k)}
     let pos={...stageReach.start}
     for(const point of route.reverse()){const[x,y]=point.split(',').map(Number);pos=moveWithCollision(v,pos,x-pos.x,y-pos.y,block);assert.ok(Math.abs(pos.x-x)<.001&&Math.abs(pos.y-y)<.001)}
     assert.equal(canCollect(i,block,new Set([...collected,i.id])),false)
   }
 }
})
test('buildings, trunks, fences, well, cart, bench and water block feet; roofs do not block as rectangles',()=>{
 for(const o of OBJECTS){if(!o.solid)continue;const s=o.solid;assert.ok(collides(v,s.x+s.w/2,s.y+s.h/2),o.id)}
 assert.equal(collides(v,7*T,29*T)?.id,'water')
 const witch=BUILDINGS[0];assert.equal(collides(v,witch.x,4*T),null)
})
test('swept collision resists 2-second stalls, diagonal corners and slides along the unblocked axis',()=>{
 const wall={spawn:SPAWN,solids:[{x:400,y:200,w:8,h:500,id:'thin-fence'}]}
 const stopped=moveWithCollision(wall,{x:350,y:350},1200,0);assert.ok(stopped.x<=390)
 const slide=moveWithCollision(wall,{x:350,y:300},180,120);assert.ok(slide.x<=390);assert.ok(slide.y>410)
 const corner={solids:[{x:400,y:400,w:160,h:160,id:'corner'}]}
 let p={x:350,y:350};for(let i=0;i<100;i++){p=moveWithCollision(corner,p,10,10);assert.equal(collides(corner,p.x,p.y),null)}
 let random=2;p={...SPAWN};for(let i=0;i<8000;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;const a=random/2**32*Math.PI*2;p=moveWithCollision(v,p,Math.cos(a)*(i%20===0?300:12),Math.sin(a)*(i%20===0?300:12));assert.equal(collides(v,p.x,p.y),null)}
})
test('capacity and bad identities fail explicitly, never truncate or use obstacle fallback',()=>{
 assert.ok(safeSlots().length>=169)
 assert.throws(()=>spawnLabItems([sounds[0],sounds[0]]),/duplicate/)
 assert.throws(()=>spawnLabItems(Array.from({length:safeSlots().length+1},(_,i)=>({sound_id:`overflow_${i}`,block:1}))),/배치 공간 부족/)
})
test('production route retains all props; research persistence and other zones remain independent',()=>{
 const source=fs.readFileSync(new URL('../app/page.js',import.meta.url),'utf8')
 assert.match(source,/activeZone === 'Lab' \? \(\s*<LabZoneMap/)
 assert.match(source,/zone === 'Lab' \? sounds : uniqueSoundsByCanonicalAudio\(sounds\)/)
 assert.match(source,/if \(zone === 'Lab'\)[\s\S]*canonicalAudioId\(sound\) === canonicalId/)
 for(const name of ['sounds','onCollectSound','onExit','collectedIds','isAnnotating','blockNum','blockTotal'])assert.match(source.slice(source.indexOf('<LabZoneMap')),new RegExp(name+'='))
 const engine=fs.readFileSync(new URL('../lib/labVillage.js',import.meta.url),'utf8');assert.doesNotMatch(engine,/supabase|saveAnnotation|sound_metadata/)
 assert.match(engine,/environment-master-v2\.png/);assert.match(engine,/front\.clip\(\)/)
 assert.match(engine,/camera\.dpr\|\|1/);assert.match(engine,/item\.id===nearbyId/)
 const component=fs.readFileSync(new URL('../components/LabZoneMap.js',import.meta.url),'utf8')
 assert.match(component,/animationTick=\{animation\.tick\}/);assert.match(component,/devicePixelRatio/)
 assert.match(component,/onConfirm=\{nearby\?confirmCollect:null\}/);assert.match(component,/r\.mode==='move'&&r\.selected/)
 assert.doesNotMatch(component,/setModal\(\{type:'collect'/);assert.doesNotMatch(component,/modal\?\.type==='collect'/)
 assert.ok(fs.existsSync(new URL('../public/assets/lab-witch/environment-master-v2.png',import.meta.url)))
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/assets/lab-witch/manifest.json',import.meta.url)))
 for(const [name,entry]of Object.entries(manifest.entries)){assert.ok(entry.width>0&&entry.height>0);for(const suffix of ['','-body','-foreground'])assert.ok(fs.existsSync(new URL(`../public/assets/lab-witch/${name}${suffix}.png`,import.meta.url)))}
})
console.log(JSON.stringify({groups:{A:84,B:85,ALL:169},safeSlots:safeSlots().length,reachableFootCells:reach.count,objects:OBJECTS.length,collisionRects:v.solids.length}))

test('block count is data-driven, including fewer and more than six blocks',()=>{
 for(const count of [1,2,4,7,9]){
   const list=Array.from({length:count*3},(_,i)=>({sound_id:`dynamic_${i}`,block:Math.floor(i/3)+1,group:'A'}))
   const world=buildVillage(list),items=spawnLabItems(list,world)
   assert.equal(items.length,list.length)
   for(const i of items)assert.equal(collides(world,i.x,i.y,16,i.block),null)
 }
})
test('camera preserves aspect and 18-tile vertical scale at desktop and both mobile orientations',()=>{
 for(const [w,h]of [[1440,844],[768,576],[390,788],[844,334],[2560,664]]){
   const c=labCamera(w,h,SPAWN);assert.equal(c.vh,576);assert.equal(c.zoom,h/576);assert.ok(c.x>=0&&c.y>=0);assert.ok(c.x+c.vw<=1536.001)
   const sx=c.ox+(SPAWN.x-c.x)*c.zoom,sy=(SPAWN.y-c.y)*c.zoom
   assert.ok(sx>=0&&sx<=w&&sy>=0&&sy<=h)
 }
})

test('approved blueprint controls landmarks, organic lane coverage and place density',()=>{
 const ids={northwestShop:'northwest-shop',witchHouse:'north-witch',potionShop:'west-potions',well:'central-well',eastHome:'east-home',market:'south-market',cart:'market-cart',southeastHome:'southeast-home'}
 for(const [name,target]of Object.entries(APPROVED_BLUEPRINT.landmarks)){
  if(!ids[name])continue
  const o=BUILDINGS.find(b=>b.id===ids[name]);assert.ok(o,name)
  assert.ok(Math.hypot(o.x/T-target.foot[0],o.y/T-target.foot[1])<=APPROVED_BLUEPRINT.tolerances.landmarkTiles,`${name}: foot contact`)
  const sizeError=Math.max(Math.abs(o.w/T-target.visibleTiles[0])/target.visibleTiles[0],Math.abs(o.h/T-target.visibleTiles[1])/target.visibleTiles[1])*100
  assert.ok(sizeError<=APPROVED_BLUEPRINT.tolerances.visibleSizePct,`${name}: visible size ${sizeError}`)
 }
 let path=0,total=0;for(let y=0;y<MAP_H*T;y+=4)for(let x=0;x<MAP_W*T;x+=4){total++;if(onPath(x+2,y+2))path++}
 const polygonArea=poly=>Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2
 assert.ok(Math.abs(path/total*100-APPROVED_BLUEPRINT.targetCoverage.geometryPathPct)<=APPROVED_BLUEPRINT.tolerances.pathScreenPct)
 assert.ok(Math.abs(polygonArea(POND)/(MAP_W*T*MAP_H*T)*100-APPROVED_BLUEPRINT.targetCoverage.waterPct)<=1)
 assert.ok(PATHS.every(p=>p.width>=2&&p.width<3.5),'no giant 5-tile road band')
 const count=k=>OBJECTS.filter(o=>o.kind===k).length
 const actual={trees:count('tree-jade')+count('tree-violet'),deadTrees:count('ghost-tree'),lanterns:count('lantern'),pumpkinClusters:count('pumpkins'),shrubs:count('shrub'),flowers:count('flower')+GROUND_DECOR_PATCHES.length,mushrooms:count('mushroom'),rocks:count('rocks'),woodFenceSegments:count('wood-fence-h')+count('wood-fence-v'),stoneFenceSegments:count('stone-fence'),barrelsCratesSigns:count('barrel')+count('crate')+count('sign'),benches:count('bench'),docks:DOCK_WALKS.length,boats:count('boat')}
 for(const [kind,target]of Object.entries(APPROVED_BLUEPRINT.referenceCounts))assert.ok(Math.abs(actual[kind]-target)/target<=APPROVED_BLUEPRINT.tolerances.densityPct/100,`${kind}: ${actual[kind]} vs ${target}`)
})

test('pond water and dock rails block feet while authored dock planks remain walkable',()=>{
 for(const d of DOCK_WALKS){const hit=collides(v,d.x+d.w/2,d.y+d.h/2);assert.notEqual(hit?.id,'water')}
 for(const rail of DOCK_RAILS){assert.ok(v.solids.some(s=>s.id===rail.id));assert.ok(collides(v,rail.x+rail.w/2,rail.y+rail.h/2))}
 assert.equal(collides(v,6*T,26*T)?.id,'water')
})
