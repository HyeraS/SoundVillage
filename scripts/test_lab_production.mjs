import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { T,MAP_W,MAP_H,PLAYER_BOX,SPAWN,EXIT,OBJECTS,BUILDINGS,PATHS,POND,DOCK_WALKS,DOCK_RAILS,GROUND_DECOR_PATCHES,SLOT_CLEARINGS,APPROVED_BLUEPRINT,buildVillage,collides,collidesPlayerAt,collidesPlacementAt,moveWithCollision,overlapsExit,spawnLabItems,safeSlots,reachableCells,reachablePlacementCells,canCollect,labCamera,onPath } from '../lib/labVillageConfig.mjs'
import { WALKABLE_MASK_METADATA,isMaskCellWalkable,isMaskPointWalkable } from '../lib/generated/labWalkableMask.generated.mjs'
import { canOccupyMask } from '../lib/villageWorldTransform.mjs'
const sounds=JSON.parse(fs.readFileSync(new URL('../data/sound_metadata.json',import.meta.url))).sounds.filter(s=>s.game_zone==='Lab')
const v=buildVillage(sounds),reach=reachableCells(v)
const positions=items=>Object.fromEntries(items.map(i=>[i.id,[i.x,i.y,i.block,i.sound.group]]))
const positionHash=items=>createHash('sha256').update(JSON.stringify(positions(items))).digest('hex')
const EXPECTED_POSITION_HASHES={A:'28174d3d81fb653b3e230fbe3e49d8df04a3b39fcd9418fbbdd3527db5d5e306',B:'7c86fd530d43dae97db8d2e8ef5245b87e98db3d8a0dd6a23279d5af05155450',ALL:'c1a573f4dc0e62626d12a1a56ac13b147068249ef73c503b402a7fc4099274d7'}
test('48x36 map; feet and spawn are valid; entrance cannot fire on entry',()=>{
 assert.deepEqual([MAP_W,MAP_H,T],[48,36,32]);assert.deepEqual(PLAYER_BOX,{w:20,h:14});assert.equal(collides(v,SPAWN.x,SPAWN.y),null);assert.equal(overlapsExit(SPAWN),false);assert.equal(overlapsExit({x:EXIT.x+EXIT.w/2,y:EXIT.y+20}),true);assert.ok(reach.count>500)
})
test('walkable mask requires the complete player foot box, not only its bottom-center anchor',()=>{
 const point={x:384,y:64}
 assert.equal(isMaskPointWalkable(point.x,point.y),true)
 assert.equal(canOccupyMask(isMaskCellWalkable,WALKABLE_MASK_METADATA,point,PLAYER_BOX,v.transform),false)
 assert.equal(collidesPlayerAt(v,point.x,point.y)?.id,'walkable-mask')
})
for(const group of ['A','B','ALL'])test(`all real ${group} IDs, stable order, per-block reachability and interaction clearance`,()=>{
 const list=sounds.filter(s=>group==='ALL'||s.group===group),items=spawnLabItems(list,v)
 assert.equal(list.length,group==='A'?84:group==='B'?85:169)
 assert.equal(items.length,list.length);assert.equal(new Set(items.map(i=>i.id)).size,list.length);assert.equal(new Set(items.map(i=>`${i.x},${i.y}`)).size,list.length)
 assert.deepEqual(new Set(items.map(i=>i.id)),new Set(list.map(s=>s.sound_id)))
 assert.deepEqual(positions(items),positions(spawnLabItems([...list].reverse(),v)))
 assert.equal(positionHash(items),EXPECTED_POSITION_HASHES[group],`${group}: deterministic coordinate hash`)
 assert.ok(items.every(i=>Math.hypot(i.x-SPAWN.x,i.y-SPAWN.y)>=2*T),'no discovery modal on zone entry')
 assert.ok(items.every(i=>!SLOT_CLEARINGS.some(r=>i.x>=r.x&&i.x<=r.x+r.w&&i.y>=r.y&&i.y<=r.y+r.h)),'entries, well, market and spawn stay readable')
 for(const block of [...new Set(list.map(s=>s.block))]){
   const stageReach=reachableCells(v,T/4,block)
   const collected=new Set(items.filter(i=>i.block<block).map(i=>i.id))
   for(const i of items){
     assert.equal(canCollect(i,block,collected),i.block===block,`${i.id}: collect gate at ${block}`)
     if(i.block!==block)continue
     assert.equal(collidesPlacementAt(v,i.x,i.y,8,block),null,`${i.id}: conservative placement clearance`)
     assert.equal(collidesPlayerAt(v,i.x,i.y,0,block),null,`${i.id}: authored-mask player access`)
     assert.ok(stageReach.seen.has(`${i.x},${i.y}`),`${i.id}: stage ${block} reachable with player feet`)
     // Reconstruct the actual BFS route and sweep it with production movement.
     let k=`${i.x},${i.y}`,route=[];while(stageReach.parents.has(k)){route.push(k);k=stageReach.parents.get(k)}
     let pos={...stageReach.start}
     for(const point of route.reverse()){const[x,y]=point.split(',').map(Number);pos=moveWithCollision(v,pos,x-pos.x,y-pos.y,block);assert.ok(Math.abs(pos.x-x)<.001&&Math.abs(pos.y-y)<.001)}
     assert.equal(canCollect(i,block,new Set([...collected,i.id])),false)
   }
 }
})
test('retained visual solids block placement but authored white mask remains player authority',()=>{
 assert.equal(collidesPlayerAt(v,400,80),null,'white authored mask overrides the retained tree collider')
 assert.equal(collidesPlacementAt(v,400,80)?.id,'tree-3')
 assert.ok(OBJECTS.some(o=>o.id==='tree-3'&&o.solid),'tree collision metadata remains on the model')
 assert.equal(collidesPlayerAt(v,7*T,29*T)?.id,'walkable-mask')
 assert.equal(collidesPlacementAt(v,7*T,29*T)?.id,'walkable-mask')
 const witch=BUILDINGS[0];assert.equal(collides(v,witch.x,4*T)?.id,'walkable-mask')
})
test('swept movement cannot tunnel through thin authored black strips or mask corners at large dt',()=>{
 const horizontal=moveWithCollision(v,{x:1320,y:264},64,0);assert.ok(horizontal.x<1384);assert.equal(collidesPlayerAt(v,horizontal.x,horizontal.y),null)
 const vertical=moveWithCollision(v,{x:244,y:708},0,56);assert.ok(vertical.y<764);assert.equal(collidesPlayerAt(v,vertical.x,vertical.y),null)
 let random=2,p={...SPAWN};for(let i=0;i<8000;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;const a=random/2**32*Math.PI*2;p=moveWithCollision(v,p,Math.cos(a)*(i%20===0?300:12),Math.sin(a)*(i%20===0?300:12));assert.equal(collides(v,p.x,p.y),null)}
})
test('progression does not lock movement and remains available to placement rules',()=>{
 assert.equal(collidesPlayerAt(v,400,80,0,Infinity),null)
 assert.equal(collidesPlayerAt(v,400,80,0,1),null)
 assert.equal(collidesPlayerAt(v,400,80,0,5),null)
 assert.equal(collidesPlacementAt(v,400,80,0,1)?.id,'locked-northwest')
 assert.equal(onPath(392,168),true)
 assert.equal(collidesPlayerAt(v,392,168,0,1),null,'locked district path stays exempt')
})
test('movement and placement reachability are separate mask-authority layers',()=>{
 const movement=reachableCells(v,T/4),placement=reachablePlacementCells(v,T/4)
 assert.ok(movement.count>placement.count)
 assert.ok(movement.seen.has('400,80'),'player can reach white mask over retained geometry')
 assert.equal(placement.seen.has('400,80'),false,'placement reachability excludes the retained tree collider')
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
 const runtimeManifest=fs.readFileSync(new URL('../lib/villageRuntimeManifest.mjs',import.meta.url),'utf8');assert.match(runtimeManifest,/lab-witch\/environment-master-v2\.png/);assert.match(engine,/front\.clip\(\)/)
 assert.match(engine,/camera\.dpr\|\|1/);assert.match(engine,/item\.id===nearbyId/)
 const component=fs.readFileSync(new URL('../components/LabZoneMap.js',import.meta.url),'utf8')
 assert.match(component,/useWalkFrame\(animation\.moving\)/);assert.match(component,/frameIndex=\{frameIndex\}/);assert.match(component,/devicePixelRatio/)
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
   for(const i of items)assert.equal(collidesPlacementAt(world,i.x,i.y,8,i.block),null)
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
 for(const d of DOCK_WALKS){const hit=collidesPlayerAt(v,d.x+d.w/2,d.y+d.h/2);assert.notEqual(hit?.id,'water')}
 for(const rail of DOCK_RAILS){assert.ok(v.solids.some(s=>s.id===rail.id));assert.ok(collidesPlacementAt(v,rail.x+rail.w/2,rail.y+rail.h/2))}
 assert.equal(collidesPlayerAt(v,6*T,26*T)?.id,'walkable-mask')
})
