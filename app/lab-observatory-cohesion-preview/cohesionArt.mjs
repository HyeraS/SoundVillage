import { environment as beforeEnvironment } from '../lab-observatory-art-preview/observatoryArt.mjs'
import { PATCH } from './cohesionConfig.mjs'
const r=(x,y,w,h,c,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`
const p=(d,c,w=1,fill='none')=>`<path d="${d}" stroke="${c}" stroke-width="${w}" fill="${fill}"/>`
const e=(x,y,rx,ry,c,s='none',w=1)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" stroke="${s}" stroke-width="${w}"/>`
const rect=({x,y,w,h},c)=>r(x,y,w,h,c)
const stone=['#556471','#596976','#52636f','#60707a']
function slab(x,y,w,h,seed,bright=false){const c=bright?'#687983':stone[seed%4];return r(x,y,w,h,'#354956')+r(x+1,y+1,w-2,h-2,c)+p(`M${x+2} ${y+2}h${w-5}`,'#809098',1)+p(`M${x+w-2} ${y+3}v${h-5}h${-w+5}`,'#455a66',1)+(seed%4===0?r(x+8,y+8,6,2,'#77858b55'):'')}
function paving(){let s='';for(let y=64;y<640;y+=32)for(let x=32;x<640;x+=64)s+=slab(x+((y/32)%2)*32,y,64,32,Math.floor(x/32+y/32));
 // A connected, level apron enters the bay; no rectangular room background.
 s+=p('M256 296V448Q256 496 304 512H480','#7a8789',2)+p('M352 296V416Q352 432 384 432H480','#7a8789',2);
 // Flush radial voussoirs, sharing the same four stone tones as the bay floor.
 for(let i=0;i<96;i++){const a=i*Math.PI/48,b=(i+1)*Math.PI/48;const x1=768+277*Math.cos(a),y1=592+277*Math.sin(a),x2=768+327*Math.cos(a),y2=592+327*Math.sin(a),x3=768+327*Math.cos(b),y3=592+327*Math.sin(b),x4=768+277*Math.cos(b),y4=592+277*Math.sin(b);s+=p(`M${x1} ${y1}L${x2} ${y2}A327 327 0 0 1 ${x3} ${y3}L${x4} ${y4}A277 277 0 0 0 ${x1} ${y1}Z`,'#415764',1,stone[i%4])}
 for(const rr of [275,329])s+=e(768,592,rr,rr,'none','#a29170',2)
 // Same-level brass threshold: no stairs or height discontinuity.
 s+=r(256,380,96,4,'#aa9770')+r(256,386,96,2,'#3a505c');return s}
function masonry(x,y,w,h){let s=r(x,y,w,h,'#263a48');for(let yy=y;yy<y+h;yy+=16)for(let xx=x;xx<x+w;xx+=32){let ww=Math.min(31,x+w-xx);s+=r(xx+1,yy+1,ww,14,(xx/32+yy/16)%2?'#3e5261':'#455966')+p(`M${xx+2} ${yy+2}h${ww-3}`,'#607381',1)}return s}
function wall(x,y,w,h,rise=24){return masonry(x,y-rise,w,h+rise)+r(x,y-rise,w,7,'#7d8990')+r(x+2,y-rise+8,w-4,3,'#b09a6e')+r(x,y+h-3,w,3,'#203543')}
function shelf(x){let s=r(x+4,133,112,75,'#213642')+r(x,128,112,76,'#576474')+r(x+4,132,104,65,'#263d4a');for(let row=0;row<2;row++){for(let i=0;i<7;i++){const xx=x+9+i*14,yy=140+row*26;s+=r(xx,yy,10,18,['#7e918d','#af9e7a','#718a95'][i%3])+r(xx+2,yy+4,5,2,'#c6b991')+r(xx+1,yy,2,18,'#91a2a033')}s+=r(x+4,159+row*26,104,5,'#8a795b')+r(x+4,164+row*26,104,2,'#b7a073')}s+=r(x-3,125,118,7,'#7a8a92')+r(x,132,4,69,'#a58f67')+r(x+108,132,4,69,'#a58f67');return s}
function desk(){let s=r(152,248,104,40,'#304552')+r(158,246,9,41,'#5b6b70')+r(241,246,9,41,'#5b6b70')+r(160,276,88,6,'#8d8064');s+=r(148,219,112,40,'#344955')+r(148,215,112,32,'#9b8b6d')+r(151,217,106,26,'#6c7980')+p('M153 219h102M151 241h106','#b3a27e',2);s+=r(162,222,25,15,'#c3b69b')+r(165,225,17,2,'#829087')+r(165,229,13,2,'#829087')+r(198,222,22,15,'#344d5c')+r(201,225,16,9,'#668e94')+r(230,221,13,13,'#a58f60')+r(234,224,5,5,'#526875');return s}
function device(){return r(392,257,48,30,'#293f4c')+r(395,258,42,23,'#5c6d73')+e(416,256,24,14,'#516774','#ab956b',2)+r(404,209,24,43,'#355d6d')+r(407,210,5,39,'#628991')+r(425,211,2,38,'#7a9897')+e(416,211,15,7,'#4b606d','#ae986b',2)+e(416,250,15,7,'#365866','#ae986b',2)+r(400,260,32,4,'#a08b66')}
function post(x){return masonry(x,303,32,81)+r(x-2,300,36,8,'#829097')+r(x+2,310,28,3,'#b49d73')+r(x+8,332,16,23,'#263d49')+r(x+10,334,12,17,'#8b8166')+r(x+13,337,6,11,'#68767a')}
const OBJECTS=[
 {id:'rear',depth:160,svg:wall(96,96,416,64,24)+r(128,90,352,12,'#2b4050')+r(136,93,336,3,'#9b8763')},
 {id:'shelf-west',depth:208,svg:shelf(144)}, {id:'shelf-east',depth:208,svg:shelf(336)},
 {id:'desk',depth:288,svg:desk()},{id:'instrument',depth:288,svg:device()},
 {id:'west',depth:384,svg:wall(96,160,32,224,16)}, {id:'east',depth:384,svg:wall(480,160,32,224,16)},
 {id:'front-west',depth:384,svg:wall(128,352,128,32,12)+post(224)},
 {id:'front-east',depth:384,svg:wall(352,352,128,32,12)+post(352)},
 // Existing LAB-1 blocker at (18,7), unchanged logical location.
 {id:'existing-prop',depth:256,svg:r(580,231,24,25,'#354c58')+r(582,225,20,10,'#7f7965')+r(588,208,8,21,'#4f7a84')+r(581,251,22,4,'#aa9468')},
]
function shadows(){return r(101,159,410,10,'#172c3830')+r(128,173,10,208,'#172c3825')+r(512,167,7,221,'#172c3825')+[ [144,203,116,10],[336,203,116,10],[153,279,111,12],[393,278,52,12],[128,378,128,10],[352,378,132,10]].map(a=>r(...a,'#172c3826')).join('')}
function glow(){return [240,368].map(x=>e(x,352,32,39,'#d7b36e0e')+e(x,348,14,20,'#d7b36e14')+r(x-3,337,6,11,'#ecd39a')).join('')+r(408,215,3,28,'#86b9bc')}
// Visual projection is independent of ground-level collision. Objects fade only when
// their raised projection would cover the player's foot point during depth sorting.
export const VISUAL_BOUNDS={rear:{x:96,y:72,w:416,h:88},'shelf-west':{x:141,y:125,w:118,h:83},'shelf-east':{x:333,y:125,w:118,h:83},desk:{x:148,y:215,w:112,h:73},instrument:{x:392,y:200,w:48,h:88},west:{x:96,y:144,w:32,h:240},east:{x:480,y:144,w:32,h:240},'front-west':{x:128,y:300,w:128,h:84},'front-east':{x:352,y:300,w:128,h:84},'existing-prop':{x:580,y:208,w:24,h:48}}
export const TRIAL_LAYERS={ground:paving(),shadow:shadows(),objects:OBJECTS,foreground:r(96,71,416,6,'#849198')+r(99,78,410,3,'#b09b72'),emissive:glow()}
export function scene({after=true,foreground=true,emissive=true}={}){
 const base=beforeEnvironment({foreground,emissive})
 if(!after)return {base,objects:[],foreground:'',emissive:''}
 const defs=`<defs><clipPath id="trial-region">${rect(PATCH,'white')}</clipPath><mask id="outside-trial">${r(0,0,1536,1152,'white')}${rect(PATCH,'black')}</mask></defs>`
 return {base:defs+`<g mask="url(#outside-trial)">${base}</g><g clip-path="url(#trial-region)" data-layer="trial-ground">${TRIAL_LAYERS.ground}${TRIAL_LAYERS.shadow}</g>`,objects:OBJECTS,foreground:foreground?TRIAL_LAYERS.foreground:'',emissive:emissive?TRIAL_LAYERS.emissive:''}
}
