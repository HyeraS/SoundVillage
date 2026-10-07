/** Lab witch lanes. World units are pixels; all authored geometry uses 32px tiles.
 * No renderer/image sampling or study-data mutations in this module.
 */
import { isMaskPointWalkable } from './generated/labWalkableMask.generated.mjs'
import { getVillageRuntimeManifest } from './villageRuntimeManifest.mjs'
import {
  baseRectToCurrent,
  createWorldTransform,
  currentPointToBase,
  playerFootRectAt,
  projectGeometry,
} from './villageWorldTransform.mjs'

export const VILLAGE_ID = 'lab'
export const VILLAGE_MANIFEST = getVillageRuntimeManifest(VILLAGE_ID)
export const T = 32
export const MAP_W = 48
export const MAP_H = 36
export const WORLD_WIDTH = VILLAGE_MANIFEST.baseWorldWidth
export const WORLD_HEIGHT = VILLAGE_MANIFEST.baseWorldHeight
export const PLAYER_BOX = Object.freeze({ w: 20, h: 14 })
export const SPAWN = Object.freeze({ x: 24*T, y: 31.5*T })
export const EXIT = Object.freeze({ x: 22*T, y: 34.2*T, w: 4*T, h: 1.5*T })
const rect=(x,y,w,h)=>({x:x*T,y:y*T,w:w*T,h:h*T})
const prop=(id,kind,x,y,w,h,foot)=>({id,kind,x:x*T,y:y*T,w,h,solid:foot?rect(...foot):null})

// Approved concept → 48×36 map blueprint. Coordinates use visible foot/bottom
// contacts so the same data can drive visual review and collision tests.
export const APPROVED_BLUEPRINT = Object.freeze({
 source:'design/lab-halloween-concepts-2026-09-01/03-violet-witch-lanes-teal-v2.png',
 environmentCrop:{x:36,y:54,w:1376,h:1032},
 landmarks:{
  northwestShop:{center:[5.3,8.4],foot:[5.3,10.1],visibleTiles:[7.2,8.9]},
  witchHouse:{center:[23.7,8.3],foot:[23.7,11.0],visibleTiles:[8.7,11.3]},
  potionShop:{center:[5.0,18.0],foot:[5.0,20.3],visibleTiles:[8.1,8.8]},
  well:{center:[24.2,18.7],foot:[24.2,20.2],visibleTiles:[4.2,5.7]},
  eastHome:{center:[41.5,17.0],foot:[41.5,19.2],visibleTiles:[8.8,8.4]},
  market:{center:[25.5,25.7],foot:[25.5,28.2],visibleTiles:[7.2,5.9]},
  cart:{center:[32.0,27.4],foot:[32.0,29.0],visibleTiles:[4.7,3.4]},
  southeastHome:{center:[41.0,25.0],foot:[41.0,27.5],visibleTiles:[8.0,8.5]},
  southwestPond:{center:[5.8,28.2],foot:[5.8,32.8],visibleTiles:[13.0,10.5]},
  southEntrance:{center:[24,35.15],foot:[24,35.7],visibleTiles:[4.2,1.25]},
 },
 pathCenterlines:[
  {id:'south-spine',width:2.75,points:[[24,36],[24,33.4],[21,31.5],[18.7,28.6],[19.5,25.5],[17.2,23.3]]},
  {id:'west-lower-loop',width:2.55,points:[[17.2,23.3],[13.7,24],[10.4,22.2],[8.5,20],[9.5,16.7],[12,13.7],[14.2,11.3]]},
  {id:'west-upper-loop',width:2.5,points:[[14.2,11.3],[11.5,9],[9.2,7.3],[10.4,5.8],[14.8,6.2],[18.1,8.5],[19.2,11.3]]},
  {id:'north-arch',width:2.55,points:[[19.2,11.3],[21.5,13.2],[25,13.5],[28.8,12.4],[31.2,10.1],[34.7,8.3],[38,9.1],[40.8,11.2]]},
  {id:'east-upper-loop',width:2.65,points:[[31.2,10.1],[30.6,13.4],[32.5,16.6],[36,18.1],[39.3,17.3],[42,18.8]]},
  {id:'east-lower-loop',width:2.75,points:[[32.5,16.6],[31,20.3],[32.6,23.4],[36,25.3],[38.1,28.4],[36.3,31.1],[31.7,32],[27.8,31.1],[24,33.4]]},
 ],
 pondPolygon:[[.3,25.2],[1.8,23.7],[5.4,22.9],[9.1,23.5],[11.8,24.7],[13.1,26.8],[12.6,30.1],[10.4,32.4],[6.8,33.4],[3.1,32.8],[.5,30.8]],
 docks:[{center:[9.95,25.68],size:[3.5,1.15]},{center:[4.1,28.98],size:[3.2,1.15]},{center:[9.35,30.6],size:[1.3,2.8]}],
 boat:{center:[5.2,30.5],size:[2.56,1.56]},
 fishingStructure:{center:[9.8,28.8],size:[1.69,2.31]},
 fenceRuns:{woodHorizontal:21,woodVertical:10,stone:17},
 treeClusters:[{id:'north-boundary',bounds:[0,0,48,4.5]},{id:'west-boundary',bounds:[0,3,3,36]},{id:'east-boundary',bounds:[45,3,3,33]},{id:'south-organic-edge',bounds:[0,31,48,5]},{id:'interior-pockets',bounds:[9,5,29,27]}],
 openGrass:[{id:'well-island',bounds:[17,14,14,9]},{id:'pond-bank',bounds:[0,22,15,12]},{id:'market-ring',bounds:[18,24,19,9]}],
 clearings:{spawn:[22,30.5,4,4],entrance:[21.5,33.5,5,2.5],well:[21.7,17.5,5,5],market:[22,25.3,8,4],cartGap:[28.5,26,5.5,3.5]},
 spawn:[24,31.5],
 targetCoverage:{screenPathPct:14.04,screenTealPct:45.21,geometryPathPct:24.67,waterPct:6.21},
 referenceCounts:{trees:49,deadTrees:6,lanterns:18,pumpkinClusters:25,shrubs:26,flowers:31,mushrooms:12,rocks:14,woodFenceSegments:31,stoneFenceSegments:17,barrelsCratesSigns:21,benches:2,docks:3,boats:1},
 tolerances:{landmarkTiles:.5,visibleSizePct:7,pathScreenPct:3,tealScreenPct:3,pathCenterTiles:.5,shoreTiles:1,densityPct:10},
})

export const BUILDINGS = [
 prop('north-witch','witch-house',23.7,11,278,362,[20.2,7.55,7,3.35]),
 prop('northwest-shop','pumpkin-shop',5.3,10.1,230,285,[2.2,6.75,6.2,3.05]),
 prop('west-potions','potion-shop',5,20.3,259,282,[1.7,17.25,6.6,2.8]),
 prop('east-home','rust-house',41.5,19.2,282,269,[37.9,16.1,7.2,2.95]),
 prop('southeast-home','violet-house',41,27.5,256,272,[37.8,24.65,6.4,2.6]),
 prop('south-market','market',25.5,28.2,230,189,[22.55,25.75,5.9,2.15]),
 prop('central-well','well',24.2,20.2,134,182,[22.72,18.65,2.95,1.35]),
 prop('market-cart','cart',32,29,150,109,[30.35,27.45,3.3,1.35]),
]
const trees = []
const tree=(x,y,i,kind)=>{const k=kind||(i%3===0?'tree-violet':'tree-jade');trees.push(prop(`tree-${trees.length}`,k,x,y,k==='ghost-tree'?96:92,k==='ghost-tree'?110:116,[x-.32,y-.65,.64,.65]))}
;[[.8,3.4],[4.1,2.6],[8.4,3.5],[12.7,2.4],[17.1,3.6],[20.4,2.5],[28.7,2.7],[32.5,3.7],[36.1,2.25],[40.4,3.15],[44.5,2.35],[47.35,4.2],
 [.45,7.2],[1.05,12.1],[.45,18.1],[1.0,23.1],[.5,29.8],[1.2,34.7],[47.45,8],[46.8,13.2],[47.5,18.6],[46.9,24.3],[47.5,31],[46.8,35],
 [2.1,36],[5.3,34.7],[13.4,34.8],[17.5,36],[20.7,34.9],[28.3,35.8],[32.1,34.7],[40.8,34.8],[45.1,36],
 [10.8,12.8],[15.8,7.3],[18.4,14.7],[19.5,18],[29.2,6.5],[33.2,11.8],[36.3,15.5],[13.6,24.8],[17.2,29.7],[34.2,24.6],[35.9,30.7],[10.6,31.4],[29.6,29.9]].forEach(([x,y],i)=>tree(x,y,i))
;[[2.7,14.2],[7.8,15.7],[34.8,8.5],[37.2,14.5],[3.2,23.4],[36.2,20.4]].forEach(([x,y],i)=>tree(x,y,i,'ghost-tree'))
export const TREES = trees
const props=[]
const add=(kind,x,y,w,h,foot)=>props.push(prop(`${kind}-${props.length}`,kind,x,y,w,h,foot))
const fenceH=(kind,x,y,len=2.7)=>add(kind,x,y,len*T,kind==='stone-fence'?60:48,[x-len/2,y-.36,len,.36])
const fenceV=(x,y,len=2.5)=>add('wood-fence-v',x,y,48,len*T,[x-.25,y-len,.5,len])
// Courtyard fences: short runs with explicit 2+ tile openings, never map-spanning walls.
;[[1.5,11.8,2.2],[8.7,11.8,2.4],[1.8,21.6,2.4],[8.2,21.6,2.3],[19.2,12.2,2.4],[27.9,12.2,2.3],[35.7,11.8,2.4],[40.6,12.4,2.2],[44.8,12.2,2.2],[37.2,21.6,2.3],[44.7,21.8,2.3],[37,29.6,2.4],[44.9,30,2.2],[19.8,24.8,2.4],[30.8,24.7,2.3],[19.3,31.3,2.5],[34.1,31.5,2.4],[2.2,33.3,2.4],[8.4,33.2,2.4],[18.2,34.1,2.2],[37.1,33.5,2.4]].forEach(([x,y,l])=>fenceH('wood-fence-h',x,y,l))
;[[10.2,10.7,2.3],[10.5,19.7,2.5],[17.8,11.8,2.1],[31,11.7,2.4],[35,11.5,2.2],[46.2,20.5,2.6],[36.2,29.4,2.3],[18.3,30.8,2.4],[12.4,31.2,2.4],[35.1,33.1,2.1]].forEach(([x,y,l])=>fenceV(x,y,l))
;[[18.2,9.1,2.3],[28.7,9.3,2.1],[20.1,13.2,2.1],[27.8,13.1,2.1],[20.2,20.9,2.2],[28.2,20.9,2.1],[35.8,8.1,2.1],[39.2,6.6,2.2],[43,7.1,2.1],[45.5,10.4,2.1],[37.3,16.2,2.2],[44.6,16.1,2.1],[37,24.1,2.1],[44.7,23.6,2.1],[21,28.9,2.1],[29.8,29.1,2.1]].forEach(([x,y,l])=>fenceH('stone-fence',x,y,l))
// Lamps create thresholds and place hierarchy; their glow stays below item glow.
;[[1.9,9.4],[9.3,9.7],[3.1,20.7],[8.9,19.9],[18.3,11.3],[29.1,11.1],[35.2,18.4],[45.8,18.8],[36.7,27.2],[45.2,28.2],[21.2,28.6],[29.7,28.4],[18.9,32.8],[35.1,32.8],[20.8,34.5],[27.3,34.5],[8.8,30.5],[13.6,23.3]].forEach(([x,y])=>add('lantern',x,y,36,118,[x-.23,y-.4,.46,.4]))
;[[2.4,10.5],[7.9,10.6],[9.1,8.5],[2.2,20.5],[7.4,20.8],[9,18.3],[19.6,10.6],[27.5,10.8],[30,11.7],[35.6,11],[45.3,11],[38.2,19.7],[44.8,19.9],[38,27.1],[44.8,27.5],[20.5,27.8],[29.5,27.7],[30.5,30.3],[33.7,30],[19.8,32.8],[34.8,32.4],[11.8,24.8],[8.8,32.1],[4.1,32.3],[15.8,29.8]].forEach(([x,y])=>add('pumpkins',x,y,52,26,[x-.7,y-.5,1.4,.5]))
;[[9.2,11.3],[17.5,10.3],[29.5,8.1],[31.2,10.2],[36,10.7],[44.1,11.4],[10.1,19],[12.7,21.4],[18.4,18],[29.5,20.5],[35.7,19.5],[45.2,20.8],[36.8,25.8],[44.6,27],[18.8,26],[21.1,30.4],[28.7,30.6],[34.4,29.9],[13.3,30.2],[11.3,32.4],[3.4,31.5],[7.2,24.2],[2.1,24.7],[15.2,33.3],[39.6,32.5],[46.1,32]].forEach(([x,y])=>add('shrub',x,y,64,42,[x-.7,y-.55,1.4,.55]))
;[[36.7,8.9],[40.4,9.5],[43.3,8.3],[38.4,10.8],[4,24.9],[7.3,24.1],[10.2,25.2],[1.7,31.4],[5.4,32],[11.1,31.3],[35.8,15.2],[45.8,15.4],[13.2,22.1],[17.2,23.2]].forEach(([x,y])=>add('rocks',x,y,72,52,[x-.85,y-.9,1.7,.8]))
// Dense life clusters stay attached to buildings/fences; open grass centers remain clear.
;[[2.8,8.7],[4,17.7],[20.1,9.1],[27.5,8.9],[38.6,17.3],[22.2,26.5],[31.2,27.2]].forEach(([x,y])=>add('barrel',x,y,34,44,[x-.4,y-.55,.8,.55]))
;[[7.2,9.5],[2.5,18.8],[21.2,9.7],[39.4,18.4],[39,26.5],[20.9,27.1],[29,27.2]].forEach(([x,y])=>add('crate',x,y,38,34,[x-.45,y-.55,.9,.55]))
;[[8.5,9.8],[8.7,18.5],[29,19.4],[36.5,18.9],[35.3,29.9],[11.7,23.2],[29.1,30]].forEach(([x,y])=>add('sign',x,y,42,62,[x-.32,y-.45,.64,.45]))
;[[9.6,7.2],[10.2,20.7],[18.7,7.7],[29.8,7.5],[34.7,9.6],[46,10],[10.8,17.8],[13.1,20.1],[18.8,16.8],[29.9,18.1],[34.8,17.2],[46,20],[35.7,24.3],[45.7,25.4],[18.9,25.1],[20.6,30.1],[29.3,30.4],[34.6,28.8],[12.6,29.5],[10.6,32.7],[2.9,30.4],[7.8,23.8],[1.8,25.5],[14.6,32.5],[40,31.7],[45.3,31.4],[3.5,7.4],[6.7,7.1],[23.7,12.6],[40.9,21.6],[41,29.7]].forEach(([x,y],i)=>add(i%3===0?'mushroom':'flower',x,y,32,32,null))
add('mushroom',32.4,14.4,32,32,null)
add('bench',28.1,19.9,80,50,[27,19,2.2,.8]);add('bench',19.9,19.8,80,50,[18.8,18.9,2.2,.8])
add('boat',5.2,30.5,82,50,[4.2,29.6,2,1]);add('fishing',9.8,28.8,54,74,[9.4,28.2,.8,.6])
export const PROPS = props
export const OBJECTS = [...BUILDINGS,...TREES,...PROPS]
export const POND = [[.3,25.2],[1.8,23.7],[5.4,22.9],[9.1,23.5],[11.8,24.7],[13.1,26.8],[12.6,30.1],[10.4,32.4],[6.8,33.4],[3.1,32.8],[.5,30.8]].map(([x,y])=>[x*T,y*T])
export const DOCK_WALKS = [rect(8.2,25.1,3.5,1.15),rect(2.5,28.4,3.2,1.15),rect(8.7,29.2,1.3,2.8)]
export const DOCK_RAILS = DOCK_WALKS.flatMap((d,i)=>[
 {x:d.x-4,y:d.y-8,w:8,h:14,id:`dock-${i}-nw`},{x:d.x+d.w-4,y:d.y-8,w:8,h:14,id:`dock-${i}-ne`},
 {x:d.x-4,y:d.y+d.h-6,w:8,h:14,id:`dock-${i}-sw`},{x:d.x+d.w-4,y:d.y+d.h-6,w:8,h:14,id:`dock-${i}-se`},
])
export const GROUND_DECOR_PATCHES = [[13,13],[11,21],[17,23],[20,16],[28,17],[31,10],[36,9],[34,27],[14,30],[20,33],[6,23]]
export const SLOT_CLEARINGS = [
 rect(3.8,9,3,3),rect(22.2,10.1,3,3),rect(3.5,19.3,3,3),
 rect(40,18.2,3,3),rect(39.5,26.5,3,3),rect(24,27.1,3,3),
 rect(21.7,17.5,5,5),
]
export const PATHS = [
 {id:'south-spine',width:2.75,points:[[24,36],[24,33.4],[21,31.5],[18.7,28.6],[19.5,25.5],[17.2,23.3]]},
 {id:'west-lower-loop',width:2.55,points:[[17.2,23.3],[13.7,24],[10.4,22.2],[8.5,20],[9.5,16.7],[12,13.7],[14.2,11.3]]},
 {id:'west-upper-loop',width:2.5,points:[[14.2,11.3],[11.5,9],[9.2,7.3],[10.4,5.8],[14.8,6.2],[18.1,8.5],[19.2,11.3]]},
 {id:'north-arch',width:2.55,points:[[19.2,11.3],[21.5,13.2],[25,13.5],[28.8,12.4],[31.2,10.1],[34.7,8.3],[38,9.1],[40.8,11.2]]},
 {id:'east-upper-loop',width:2.65,points:[[31.2,10.1],[30.6,13.4],[32.5,16.6],[36,18.1],[39.3,17.3],[42,18.8]]},
 {id:'east-lower-loop',width:2.75,points:[[32.5,16.6],[31,20.3],[32.6,23.4],[36,25.3],[38.1,28.4],[36.3,31.1],[31.7,32],[27.8,31.1],[24,33.4]]},
 {id:'well-north',width:2.25,points:[[12,13.7],[15.4,15.1],[18.8,16.4],[21,17.4],[22.4,18.2]]},
 {id:'well-south',width:2.35,points:[[17.2,23.3],[19.5,21.8],[22.1,21.4],[24.2,22.3],[27,21.6],[31,20.3]]},
 {id:'witch-door',width:2.25,points:[[23.7,11],[23.7,13.5]]},
 {id:'northwest-door',width:2.2,points:[[5.3,10.1],[7.3,10.3],[9.2,7.3]]},
 {id:'potion-door',width:2.2,points:[[5,20.3],[8.5,20]]},
 {id:'east-door',width:2.2,points:[[42,18.8],[41.5,19.2]]},
 {id:'southeast-door',width:2.2,points:[[38.1,28.4],[41,27.5]]},
 {id:'market-door',width:2.4,points:[[24,33.4],[25.5,30.1],[25.5,28.2]]},
]
export const DISTRICTS = [
 {id:'market',name:'시장 골목',anchor:[29,31]}, {id:'well',name:'우물 마당',anchor:[24,21]},
 {id:'west',name:'서쪽 상점길',anchor:[12,18]}, {id:'east',name:'동쪽 정원길',anchor:[35,20]},
 {id:'northwest',name:'호박 상점길',anchor:[13,9]}, {id:'witch',name:'마녀 집 앞뜰',anchor:[30,10]},
]
export function pointInPolygon(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
const intersect=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y
const transformFor=(worldSize={})=>createWorldTransform({baseWorldWidth:WORLD_WIDTH,baseWorldHeight:WORLD_HEIGHT,currentWorldWidth:worldSize.currentWorldWidth??WORLD_WIDTH,currentWorldHeight:worldSize.currentWorldHeight??WORLD_HEIGHT})
export function footBox(x,y,pad=0,worldSize={}){const transform=transformFor(worldSize),footprint={w:PLAYER_BOX.w+pad*2,h:PLAYER_BOX.h+pad*2};return playerFootRectAt({x,y},footprint,transform)}
export function districtAt(x,y){
 const tx=x/T,ty=y/T
 if(ty<13)return tx<20?'northwest':'witch'
 if(ty<24)return tx<16?'west':tx>=32?'east':'well'
 return tx<12?'west':tx>=38?'east':'market'
}
export const REGION_BOUNDS = {
 market:[[12,24],[38,24],[38,36],[12,36]],well:[[16,13],[32,13],[32,24],[16,24]],
 west:[[0,13],[16,13],[16,24],[12,24],[12,36],[0,36]],
 east:[[32,13],[48,13],[48,36],[38,36],[38,24],[32,24]],
 northwest:[[0,0],[20,0],[20,13],[0,13]],witch:[[20,0],[48,0],[48,13],[20,13]],
}
export function regionProgress(sounds){
 const blocks=[...new Set(sounds.map(s=>s.block||1))].sort((a,b)=>a-b)
 return Object.fromEntries(DISTRICTS.map((d,i)=>[d.id,blocks[Math.min(blocks.length-1,(blocks.length>DISTRICTS.length?Math.ceil:Math.floor)(i*blocks.length/DISTRICTS.length))]||1]))
}
export function buildVillage(sounds=[],worldSize={}){
 const transform=transformFor(worldSize)
 // Water raster is authored from POND geometry at 8px, shared by rendering/tests.
 const water=[]
 for(let y=22*T;y<34*T;y+=8)for(let x=0;x<14*T;x+=8)if(pointInPolygon(x+4,y+4,POND)&&!DOCK_WALKS.some(d=>intersect({x:x+1,y:y+1,w:6,h:6},d)))water.push({x,y,w:8,h:8,id:'water'})
 const baseSolids=[...OBJECTS.filter(o=>o.solid).map(o=>({...o.solid,id:o.id})),...DOCK_RAILS,...water]
 return {villageId:VILLAGE_ID,manifest:VILLAGE_MANIFEST,transform,
  baseWorldWidth:WORLD_WIDTH,baseWorldHeight:WORLD_HEIGHT,
  currentWorldWidth:transform.currentWorldWidth,currentWorldHeight:transform.currentWorldHeight,
  spawn:projectGeometry(SPAWN,transform),objects:OBJECTS,regionProgress:regionProgress(sounds),solids:baseSolids.map(s=>baseRectToCurrent(s,transform))}
}
export function collides(v,x,y,pad=0,blockNum=Infinity){const transform=v.transform||transformFor(),b=playerFootRectAt({x,y},{w:PLAYER_BOX.w+pad*2,h:PLAYER_BOX.h+pad*2},transform);
 if(Number.isFinite(blockNum))for(const [px,py]of [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]]){const base=currentPointToBase({x:px,y:py},transform),region=districtAt(base.x,base.y);if((v.regionProgress[region]||1)>blockNum&&!onPath(base.x,base.y))return{id:`locked-${region}`}}
 const hard=v.solids.find(s=>intersect(b,s));if(hard)return hard
 // The authored walkable mask describes valid player foot-anchor positions.
 // Sampling a full 20x14 footprint here eroded the white area a second time,
 // so mask collision intentionally uses the bottom-center foot point only.
 if(v.manifest?.villageId===VILLAGE_ID&&!isMaskPointWalkable(x,y,transform.currentWorldWidth,transform.currentWorldHeight))return{id:'walkable-mask'}
 return null}
export function moveWithCollision(v,pos,dx,dy,blockNum=Infinity){
 // <=4px swept axis steps: thin fences/corners cannot be crossed even after stalls.
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));let{x,y}=pos
 for(let i=0;i<steps;i++){if(!collides(v,x+dx/steps,y,0,blockNum))x+=dx/steps;if(!collides(v,x,y+dy/steps,0,blockNum))y+=dy/steps}
 return{x,y}
}
export function overlapsExit(pos,worldSize={}){const transform=transformFor(worldSize);return intersect(footBox(pos.x,pos.y,0,worldSize),baseRectToCurrent(EXIT,transform))}
export function canCollect(item,blockNum,collectedIds){return !!item&&item.block<=blockNum&&!collectedIds.has(item.id)}
export function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
export function onPath(x,y){return PATHS.some(p=>p.points.slice(1).some((b,i)=>segmentDistance(x/T,y/T,p.points[i],b)<p.width/2))}
export function reachableCells(v,step=16,blockNum=Infinity){
 const key=(x,y)=>`${x},${y}`,start={x:Math.round(SPAWN.x/step)*step,y:Math.round(SPAWN.y/step)*step}
 const queue=[start],seen=new Set([key(start.x,start.y)]),parents=new Map()
 for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[step,0],[-step,0],[0,step],[0,-step]]){
   const p=queue[i],x=p.x+dx,y=p.y+dy,k=key(x,y);if(seen.has(k)||collides(v,x,y,0,blockNum))continue
   const q=moveWithCollision(v,p,dx,dy,blockNum);if(Math.abs(q.x-x)>.01||Math.abs(q.y-y)>.01)continue
   seen.add(k);parents.set(k,key(p.x,p.y));queue.push({x,y})
 }
 return{seen,parents,start,step,count:seen.size}
}
let candidatesCache
export function safeSlots(v=buildVillage()){
 if(candidatesCache)return candidatesCache
 const step=T/4,reach=reachableCells(v,step),slots=[]
 // Checkerboard half-tile sampling preserves breathing room while using lawns
 // and courtyards instead of widening the approved lanes for 169 real sounds.
 for(let y=3*T,iy=0;y<33*T;y+=step,iy++)for(let x=2*T,ix=0;x<46*T;x+=step,ix++){
   if((ix+iy)%2)continue
   if(collides(v,x,y,8)||!reach.seen.has(`${x},${y}`)||overlapsExit({x,y}))continue
   if(Math.hypot(x-SPAWN.x,y-SPAWN.y)<2*T)continue
   if(SLOT_CLEARINGS.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h))continue
   // Keep the floating sprite and a full character away from roofs/crowns/props.
   const visual={x:x-12,y:y-36,w:24,h:40}
   if(OBJECTS.some(o=>!['flower','mushroom','pumpkins','shrub'].includes(o.kind)&&intersect(visual,{x:o.x-o.w/2,y:o.y-o.h,w:o.w,h:o.h})))continue
   slots.push({x,y,tx:x/T,ty:y/T})
 }
 candidatesCache=slots
 return slots
}
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
export function spawnLabItems(sounds,v=buildVillage()){
 const ids=new Set();for(const s of sounds){if(!s.sound_id||ids.has(s.sound_id))throw new Error(`Lab: missing/duplicate sound_id ${s.sound_id}`);ids.add(s.sound_id)}
 const slots=[...safeSlots(v)]
 if(sounds.length>slots.length)throw new Error(`Lab 배치 공간 부족: 소리 ${sounds.length}개 / 안전 위치 ${slots.length}개. 장식 배치를 조정해야 합니다.`)
 const blocks=[...new Set(sounds.map(s=>s.block||1))].sort((a,b)=>a-b),items=[]
 for(const [bi,block]of blocks.entries()){
   const region=DISTRICTS[Math.min(DISTRICTS.length-1,Math.floor(bi*DISTRICTS.length/blocks.length))]
   const [ax,ay]=region.anchor
   const progress=regionProgress(sounds)
   const belongs=slot=>blocks.length>DISTRICTS.length?districtAt(slot.x,slot.y)===region.id:progress[districtAt(slot.x,slot.y)]===block
   const stageVillage={...v,regionProgress:progress},stageReach=reachableCells(stageVillage,T/4,block)
   const stageAccessible=slots.filter(slot=>stageReach.seen.has(`${slot.x},${slot.y}`)&&!collides(stageVillage,slot.x,slot.y,8,block))
   const preferred=stageAccessible.filter(belongs)
   const eligible=[...preferred,...stageAccessible.filter(slot=>!preferred.includes(slot))]
   const eligibleSet=new Set(eligible)
   if(eligible.length<sounds.filter(s=>(s.block||1)===block).length)throw new Error(`Lab 구역 ${block} 배치 공간 부족: 장식을 조정해야 합니다.`)
   const ordered=sounds.filter(s=>(s.block||1)===block).sort((a,b)=>a.sound_id.localeCompare(b.sound_id))
   slots.sort((a,b)=>(Math.hypot(a.tx-ax,a.ty-ay)+(onPath(a.x,a.y)?0:1))-(Math.hypot(b.tx-ax,b.ty-ay)+(onPath(b.x,b.y)?0:1))||a.y-b.y||a.x-b.x)
   const chosen=[]
   for(let i=0;i<ordered.length;i++){
     let best=0,bestScore=Infinity
     slots.forEach((slot,j)=>{
       if(!eligibleSet.has(slot))return
       const distance=Math.hypot(slot.tx-ax,slot.ty-ay)
       const crowded=[...items,...chosen].reduce((sum,p)=>sum+Math.max(0,2.5-Math.hypot(slot.tx-p.tx,slot.ty-p.ty))*7,0)
       const score=distance+crowded+(onPath(slot.x,slot.y)?0:1)
       if(score<bestScore){bestScore=score;best=j}
     })
     chosen.push(slots.splice(best,1)[0])
   }
   // The lexicographically first sound becomes the stage's concept-rhythm
   // discovery marker nearest the authored district anchor. Remaining slots
   // stay deterministic and spread by the greedy crowding score above.
   chosen.sort((a,b)=>Math.hypot(a.tx-ax,a.ty-ay)-Math.hypot(b.tx-ax,b.ty-ay)||a.y-b.y||a.x-b.x)
   ordered.forEach((sound,i)=>items.push({...chosen[i],id:sound.sound_id,sound,block,region:districtAt(chosen[i].x,chosen[i].y),phase:hash(sound.sound_id)%1000}))
 }
 return items
}

export function labCamera(width,height,player){
 // Same 18-tile vertical play zoom as Nature/Animal; portrait crops the
 // horizontal field instead of shrinking the player. Ultra-wide views letterbox.
 const zoom=height/(18*T),vw=Math.min(MAP_W*T,width/zoom),vh=height/zoom
 const x=Math.max(0,Math.min(MAP_W*T-vw,player.x-vw/2)),y=Math.max(0,Math.min(MAP_H*T-vh,player.y-vh/2))
 return{zoom,x:Math.round(x*zoom)/zoom,y:Math.round(y*zoom)/zoom,ox:Math.max(0,(width-MAP_W*T*zoom)/2),oy:0,vw,vh}
}
