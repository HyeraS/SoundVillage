// Preview-only, editable geometry. LAB-1 remains the sole logical source.
import { MAP, STRUCTURES, OBSERVATORY, PROP_BLOCKERS, FOREGROUND_ZONES, SAFE_SLOTS, isCollision } from '../lab-whitebox-preview/whiteboxConfig.mjs'
const R=(x,y,w,h,fill,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`
const E=(x,y,rx,ry,fill,stroke='none',sw=1)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
const P=(d,stroke,sw=1,fill='none',extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`
const G=(x,y,s)=>`<g transform="translate(${x} ${y})">${s}</g>`
const slots=Object.values(SAFE_SLOTS).flat()
export const collisionCells=Array.from({length:MAP.width*MAP.height},(_,i)=>({x:i%48,y:Math.floor(i/48)})).filter(p=>isCollision(p.x,p.y))
const collisionMask=collisionCells.map(p=>R(p.x*32,p.y*32,32,32,'white')).join('')
const clipRect=s=>R(s.x*32,s.y*32,s.w*32,s.h*32,'white')
const defs=`<defs><clipPath id="solid-mask">${collisionMask}</clipPath><clipPath id="fg-mask">${FOREGROUND_ZONES.map(clipRect).join('')}</clipPath>
<pattern id="masonry" width="64" height="32" patternUnits="userSpaceOnUse">${R(0,0,64,32,'#303c4a')}${R(1,1,62,14,'#495360')}${R(2,2,59,2,'#59616a')}${R(0,17,30,14,'#404b59')}${R(33,17,31,14,'#45505b')}${P('M4 12h12M39 26h17','#3b4551')}</pattern>
<pattern id="roof" width="20" height="16" patternUnits="userSpaceOnUse">${R(0,0,20,16,'#263443')}${P('M0 15L10 1 20 15M0 7L10 -7 20 7','#46515d',2)}${P('M0 16L10 2','#192733',2)}</pattern>
<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">${P('M32 0H0V32','#bbdce2',1)}</pattern></defs>`
function lamp(x,y){return G(x,y,R(-7,-16,14,28,'#262c32')+R(-5,-13,10,19,'#a88042')+R(-3,-10,6,12,'#c7ad72')+R(-9,7,18,4,'#675842')+R(-8,-18,16,4,'#776348'))}
function glow(x,y){return G(x,y,E(0,0,24,28,'#dcb06a22')+E(0,0,12,16,'#dcb06a24')+R(-3,-9,6,11,'#e5c786'))}
function cabinet(x,y,w=70){let s=R(3,8,w,48,'#192630')+R(0,0,w,48,'#826747')+R(3,2,w-6,8,'#aa8960')+R(4,13,w-8,31,'#26333c');for(let i=8;i<w-8;i+=13)s+=R(i,17,9,22,i%2?'#747466':'#556777')+R(i+2,20,5,2,'#b49767');return G(x,y,s)}
function instrument(x,y,kind=0){let s=E(0,13,15,9,'#202d35')+R(-12,-1,24,14,'#4c555a')+E(0,0,12,7,'#957849','#c6a56c',1);if(kind%3===0){s+=R(-8,-22,16,22,'#285363')+R(-5,-20,4,19,'#54838a')+E(0,-22,10,5,'#445860','#a88a51',2)+E(0,-2,10,5,'none','#a88a51',2)}else if(kind%3===1){s+=R(-10,-14,20,15,'#1e313d')+P('M-8 -11L7 -7 -4 0Z','#aa8c54',2,'#496471')}else{s+=E(0,-10,11,10,'#354652','#9b7b48',2)+P('M0 -18V-10L6 -7','#bdac77',2)}return G(x,y,s)}
function bay(s,kind){const w=s.w*32,h=s.h*32;let a=R(0,0,w,h,'#182932')+R(4,4,w-8,h-8,'url(#masonry)')+R(22,60,w-44,h-96,'#4b5660');
 // Rear wall has thickness; all apparent walls/steps remain inside blocked footprint.
 a+=R(10,8,w-20,58,'url(#masonry)')+R(6,5,w-12,12,'#646d75')+R(10,18,w-20,3,'#a48b5f')+R(18,30,w-36,5,'#24313e');
 for(let x=22;x<w-30;x+=92)a+=R(x,33,68,29,'url(#roof)')+R(x-5,20,9,55,'#747470')+R(x-4,25,7,3,'#b09a68');
 a+=R(6,69,18,h-93,'url(#masonry)')+R(w-24,69,18,h-93,'url(#masonry)');
 // Open research bay reads as a shallow staged workspace, not an enterable room.
 a+=R(24,h-58,w-48,12,'#6f7779')+R(22,h-46,w-44,10,'#263844')+R(18,h-35,w-36,9,'#778082')+R(16,h-26,w-32,6,'#313f4a')+R(12,h-19,w-24,8,'#646d74');
 const ex=kind==='signal'?0:(s.entrance.x-s.x)*32;
 if(kind==='signal'){a+=R(0,128,28,96,'#142934')+R(0,129,8,94,'#929389')+R(10,131,7,90,'#777e7e')+R(19,134,7,84,'#626c70')}else{a+=R(ex,h-54,96,54,'#182d36')+R(ex+5,h-48,86,13,'#7d8585')+R(ex+3,h-31,90,11,'#6b767b')+R(ex,h-16,96,11,'#89908b')+R(ex,h-5,96,5,'#b09b73');a+=R(ex-12,h-73,10,63,'#8b8b7e')+R(ex+98,h-73,10,63,'#8b8b7e')}
 if(kind==='archive'){a+=cabinet(40,81,108)+cabinet(194,81,126)+cabinet(278,164,88);a+=R(40,160,154,38,'#28333b')+R(36,153,162,26,'#947952')+R(40,154,154,3,'#b49b70');for(let i=0;i<5;i++)a+=R(50+i*27,159,18,12,['#71807c','#b2a184','#516873'][i%3])+P(`M${53+i*27} 161v8`,'#d3bd86');a+=instrument(235,175,2)}
 if(kind==='spectrum'){a+=E(w/2,122,121,53,'#263a49','#8b784f',4)+E(w/2,119,105,43,'#355b67','#6d8787',2);for(let i=-2;i<=2;i++)a+=P(`M${w/2+i*34} 81Q${w/2+i*52} 115 ${w/2+i*34} 152`,'#997e4d',3);a+=P(`M${w/2-97} 118H${w/2+97}`,'#8d835e',3)+cabinet(43,195,95)+cabinet(290,195,104);a+=instrument(180,217,1)+instrument(254,217,0)}
 if(kind==='signal'){a+=cabinet(55,82,112)+E(229,138,58,34,'#233949','#a08b61',3)+E(229,128,43,27,'#405c67','#ba9b64',2)+P('M197 127L224 81 261 130Z','#a98b56',4,'#32505e')+P('M227 93v44','#709a9d',4);a+=cabinet(93,217,140)+instrument(278,240,2)+instrument(65,173,0)}
 a+=lamp(33,53)+lamp(w-34,53);return G(s.x*32,s.y*32,a)}
// Crops are scene-material references, not separated runtime sprites.
const STUDY='/design-previews/lab-2a/material-study.png'
const crop=(x,y,w,h,sx,sy,sw,sh)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" overflow="hidden"><image href="${STUDY}" width="1448" height="1086"/></svg>`
function texturedBays(){let a='';const crops={archive:[91,96,399,267],spectrum:[932,96,432,291],signal:[989,665,367,298]};for(const [k,s] of Object.entries(STRUCTURES)){a+=crop(s.x*32,s.y*32,s.w*32,s.h*32,...crops[k]);if(k==='signal'){
 // Generated study incorrectly has south steps. Keep immutable west entrance;
 // cover southern stairs with stone foundation and open a west-facing dock.
 a+=G(s.x*32,s.y*32,R(0,s.h*32-36,s.w*32,36,'url(#masonry)')+R(0,128,40,96,'#3f4d58')+R(0,129,8,94,'#91948b')+R(10,131,7,90,'#6b767a')+R(20,134,7,84,'#85908e')+R(31,138,6,76,'#566872')+R(0,121,43,7,'#a69370')+R(0,224,43,7,'#a69370'));}}
 a+=`<defs><clipPath id="core-study-crop">${E(768,588,103,102,'white')}</clipPath></defs><g clip-path="url(#core-study-crop)">${crop(663,483,210,210,613,433,214,234)}</g>`;return `<g clip-path="url(#solid-mask)">${a}</g>`}
function ground(){let a=R(0,0,1536,1152,'#142430');for(let y=2;y<35;y++)for(let x=2;x<46;x++){const h=((x*83+y*137)^(x*y*13))>>>0;const near=slots.some(s=>Math.abs(s.tx-x)<=1&&Math.abs(s.ty-y)<=1);const colors=['#475462','#4c5864','#4b5762','#505b66','#455461'];a+=R(x*32,y*32,32,32,colors[h%5]);a+=P(`M${x*32+1} ${y*32+31}h30M${x*32+31} ${y*32+1}v29`,'#354552',1)+P(`M${x*32+2} ${y*32+1}h27`,'#586570',1);if(!near&&h%3===0)a+=R(x*32+6+h%9,y*32+8+h%13,5,2,'#67707955')}
 // Flat inlaid circuit: decorative paving, no raised curb across the loop.
 a+=E(768,592,302,302,'none','#303f4d',53)+E(768,592,302,302,'none','#738087',49)+E(768,592,302,302,'none','#5e6d76',45)+E(768,592,329,329,'none','#9e9276',2)+E(768,592,275,275,'none','#9e9276',2);
 for(let i=0;i<48;i++){let t=i*Math.PI/24;a+=P(`M${768+278*Math.cos(t)} ${592+278*Math.sin(t)}L${768+326*Math.cos(t)} ${592+326*Math.sin(t)}`,'#465560',2)}
 a+=R(736,768,96,384,'#77818a')+P('M736 776V1152M832 776V1152','#b1a17e',2);for(let y=800;y<1152;y+=32)a+=P(`M738 ${y}h92`,'#586772',1);
 for(const s of Object.values(STRUCTURES)){const p=s.approach;a+=R(p.x*32,p.y*32,p.w*32,p.h*32,'#78848a');for(let y=p.y*32;y<(p.y+p.h)*32;y+=32)a+=P(`M${p.x*32+2} ${y+1}h${p.w*32-4}`,'#9b9f98',1)}
 a+=E(325,843,127,109,'none','#68757b',2)+E(325,843,120,102,'none','#8c826a',1);return a}
function core(){let a='';
 // Ground-level circular apron is traversable and has no faux pillars.
 a+=E(768,592,188,196,'#576773','#899188',2)+E(768,592,177,185,'none','#a18e66',2)+E(768,592,151,159,'none','#394e5c',3);
 for(let i=0;i<32;i++){let t=i*Math.PI/16;a+=P(`M${768+157*Math.cos(t)} ${592+166*Math.sin(t)}L${768+172*Math.cos(t)} ${592+182*Math.sin(t)}`,'#8e8c76',2)}
 let b=E(768,599,105,102,'#1a2c38')+E(768,583,102,97,'#566571','#9b8a65',4)+E(768,575,94,88,'#273c4d','#414f5b',5)+E(768,573,82,76,'#4d5860','#b19966',3);
 for(let i=0;i<20;i++){let t=i*Math.PI/10;b+=G(768+87*Math.cos(t),574+77*Math.sin(t),R(-4,-3,8,6,'#b09b6d')+R(-1,-2,2,2,'#ddc894'))}
 b+=E(768,584,59,50,'#1e3440','#8c7952',4)+R(716,541,104,39,'#715f44')+E(768,578,52,25,'#455c63','#aa8a53',3)+E(768,540,52,27,'#355663','#b09a69',3)+E(768,521,37,29,'#335d68','#8c9b94',2)+E(768,518,28,22,'#487c82','#769694',2);
 for(const dx of [-41,41])b+=P(`M${768+dx} 546v30`,'#c0a270',5);
 b+=E(768,493,52,29,'none','#66939a',2)+E(768,477,37,21,'none','#61898e',2)+R(764,465,8,30,'#5d959a');
 return a+`<g clip-path="url(#solid-mask)">${b}</g>`}
function building(){let a=collisionCells.filter(p=>p.x<2||p.x>45||p.y<2||p.y>34).map(p=>R(p.x*32,p.y*32,32,32,'url(#masonry)')).join('');a+=P('M62 64H1473V1118H864M704 1118H62V64','#859093',4)+P('M49 64V1105M1486 64V1105','#aa9061',2);for(let x=96;x<1480;x+=160){a+=R(x,9,28,52,'#2a3948')+R(x-3,8,34,10,'#636b71')+lamp(x+14,47)}a+=Object.entries(STRUCTURES).map(([k,s])=>bay(s,k)).join('');a+=PROP_BLOCKERS.map((p,i)=>instrument(p.x*32+16,p.y*32+16,i)).join('');return `<g clip-path="url(#solid-mask)">${a}</g>`+core()}
function foreground(){let a='';for(const [k,s] of Object.entries(STRUCTURES)){let w=s.w*32;a+=G(s.x*32,s.y*32,R(0,0,w,17,'#1d2d3b')+R(5,4,w-10,10,'#677079')+R(12,18,w-24,7,'#aa9164')+R(15,28,w-30,38,'url(#roof)'));if(k==='signal')a+=G(s.x*32,s.y*32,R(0,20,20,s.h*32-20,'url(#masonry)')+R(0,20,5,s.h*32-20,'#8d8e80'))}return `<g clip-path="url(#fg-mask)"><g clip-path="url(#solid-mask)">${a}</g></g>`}
function emissive(){let a='';for(const s of Object.values(STRUCTURES))a+=glow(s.x*32+33,s.y*32+53)+glow((s.x+s.w)*32-34,s.y*32+53);a+=E(768,518,23,17,'#79aeb566')+E(768,493,52,29,'none','#8fbdbe',1)+E(768,477,37,21,'none','#83b3b7',1);return a}
// Texture patch samples only empty paving in the source study. Geometry remains editable.
const floorTexture=`<defs><pattern id="slate-texture" width="160" height="160" patternUnits="userSpaceOnUse">${crop(0,0,160,160,515,85,100,115)}</pattern></defs>`
const groundArt=ground()+floorTexture+R(64,64,1408,1056,'url(#slate-texture)','opacity=".29"')
const solidTexture=`<g clip-path="url(#solid-mask)">${crop(0,0,1536,64,0,4,1448,60)}${crop(0,64,64,1056,8,68,50,960)}${crop(1472,64,64,1056,1390,68,50,960)}${crop(0,1120,1536,32,0,1030,1448,32)}</g>`
const splitMask=`<defs><mask id="under-roof">${R(0,0,1536,1152,'white')}${FOREGROUND_ZONES.map(s=>R(s.x*32,s.y*32,s.w*32,s.h*32,'black')).join('')}</mask></defs>`
export const ART_LAYERS={ground:groundArt,building:building()+solidTexture+splitMask+`<g mask="url(#under-roof)">${texturedBays()}</g>`,foreground:`<g clip-path="url(#fg-mask)">${texturedBays()}</g>`,emissive:emissive()}
export function environment({foreground:fg=true,emissive:em=true}={}){return defs+`<g data-layer="ground">${ART_LAYERS.ground}</g><g data-layer="building">${ART_LAYERS.building}</g>`+(fg?`<g data-layer="foreground">${ART_LAYERS.foreground}</g>`:'')+(em?`<g data-layer="emissive">${ART_LAYERS.emissive}</g>`:'')}
export function environmentSVG(options={}){return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1152" viewBox="0 0 1536 1152">${environment(options)}</svg>`}
export const FOCUS={full:[24,18],entrance:[24,30],central:[24,18],archive:[10,10],spectrum:[38,10],signal:[37,27]}
export const PLAYER_POINTS={full:[24.5,33.5],entrance:[24.5,33.5],central:[24,23.5],archive:[9.5,13.5],spectrum:[38.5,14.5],signal:[32.5,27.5]}
export function cameraFor(focus='full',mobile=false){if(focus==='full')return [0,0,1536,1152];const [cx,cy]=FOCUS[focus],w=mobile?18:24,h=mobile?12:18;return [Math.max(0,Math.min(48-w,cx-w/2))*32,Math.max(0,Math.min(36-h,cy-h/2))*32,w*32,h*32]}
