// Preview-only native pixel module composition. No original sprite is overwritten.
const sharp=require('sharp'),fs=require('fs');
const OUT='public/design-previews/lab-2a-r2', REPORT='design/2d-map-redesign/previews/lab-2a-r2';
const manifest=[];
function canvas(w,h){return {w,h,b:Buffer.alloc(w*h*4)}}
function rect(c,x,y,w,h,hex){let a=hex.match(/\w\w/g).map(v=>parseInt(v,16));if(a.length===3)a.push(255);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>=0&&yy>=0&&xx<c.w&&yy<c.h)for(let k=0;k<4;k++)c.b[(yy*c.w+xx)*4+k]=a[k]}
function paste(c,s,x,y){for(let yy=0;yy<s.h;yy++)for(let xx=0;xx<s.w;xx++){const i=(yy*s.w+xx)*4;if(s.b[i+3]&&xx+x>=0&&yy+y>=0&&xx+x<c.w&&yy+y<c.h)s.b.copy(c.b,((yy+y)*c.w+xx+x)*4,i,i+4)}}
function cut(s,x,y,w,h){let c=canvas(w,h);for(let yy=0;yy<h;yy++)s.b.copy(c.b,yy*w*4,((y+yy)*s.w+x)*4,((y+yy)*s.w+x+w)*4);return c}
function palette(c,base,contrast=1){const n=canvas(c.w,c.h);for(let i=0;i<c.b.length;i+=4){const lum=c.b[i]*.2126+c.b[i+1]*.7152+c.b[i+2]*.0722;for(let k=0;k<3;k++)n.b[i+k]=Math.max(0,Math.min(255,Math.round(base[k]+(lum-105)*contrast)));n.b[i+3]=c.b[i+3]}return n}
async function save(c,name){await sharp(c.b,{raw:{width:c.w,height:c.h,channels:4}}).png().toFile(`${OUT}/${name}.png`)}
async function source(name,path,crop,usage){const md=await sharp(path).metadata();const {data,info}=await sharp(path).extract({left:crop[0],top:crop[1],width:crop[2],height:crop[3]}).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=info.width,y0=info.height,x1=-1,y1=-1,colors=new Set();for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){let i=(y*info.width+x)*4;if(data[i+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);colors.add(data.subarray(i,i+4).toString('hex'))}}const c={w:info.width,h:info.height,b:data};manifest.push({name,path,sheet:[md.width,md.height],crop,alphaBounds:[x0,y0,x1-x0+1,y1-y0+1],opaqueColors:colors.size,usage});await save(c,`source-${name}`);return c}
(async()=>{
const floor=await source('stone','public/assets/world/terrain.png',[16,624,16,16],'derived: low-contrast blue-grey floor; 2x world'),
wall=await source('paving','public/assets/world/terrain-town.png',[576,16,16,16],'derived: masonry facing modules; 2x world'),
table=await source('table','public/assets/lab/tables.png',[256,48,32,32],'derived: native edge/center modules; 2x world'),
cab=await source('shelf','public/assets/lab/storage.png',[327,516,16,27],'derived: three bays + one extra shelf row; 2x world'),
books=await source('books','public/assets/interior/books.png',[0,0,23,11],'derived: muted paper/wood colours; 2x world'),
lamp=await source('lamp','public/assets/lab/decorations.png',[304,176,32,32],'reuse desk lamp; native crop trimmed on composition; 2x world'),
dresser=await source('dresser','public/assets/interior/dresser.png',[0,0,29,30],'excluded whole: exceeds fixed desk pedestal height; drawer module reused'),
nat=await source('nature-ground','public/assets/world/nature_village_map/terrain.png',[16,16,16,16],'reference: Nature terrain world32x32'),
fence=await source('nature-fence','public/assets/world/nature_village_map/terrain.png',[0,498,32,16],'reference: Nature fence world64x32'),
animal=await source('animal-path','public/assets/world/terrain-town.png',[80,40,32,32],'reference: Animal path world32x32'),
bench=await source('animal-bench','public/assets/world/terrain-town.png',[264,938,32,20],'reference candidate: see renderer individual scale; not used as desk');
let ft=palette(floor,[85,103,112],.20);await save(ft,'floor');let ft2=palette(floor,[87,105,113],.16);await save(ft2,'floor-alt');
const stone=palette(wall,[68,86,100],.48);await save(stone,'stone');
function wallSprite(w,h){let c=canvas(w,h);for(let y=5;y<h;y+=16)for(let x=0;x<w;x+=16)paste(c,stone,x,y);rect(c,0,2,w,4,'344955');rect(c,1,0,w-2,3,'87959a');rect(c,2,0,w-4,1,'a5ada7');rect(c,1,4,w-2,1,'b19b71');rect(c,0,h-3,w,3,'2e414e');rect(c,2,h-4,w-4,1,'657784');return c}
await save(wallSprite(208,44),'rear');await save(wallSprite(16,120),'side');
const sb=palette(cab,[88,83,72],.9),bk=canvas(23,11);books.b.copy(bk.b);for(let i=0;i<bk.b.length;i+=4){let r=bk.b[i],g=bk.b[i+1],b=bk.b[i+2];bk.b[i]=Math.round(r*.68+20);bk.b[i+1]=Math.round(g*.72+23);bk.b[i+2]=Math.round(b*.65+30)}
let shelf=canvas(59,41);for(let x of [3,21,39]){paste(shelf,sb,x,14);paste(shelf,cut(sb,0,7,16,10),x,5)}rect(shelf,1,2,56,3,'897d65');rect(shelf,2,1,54,1,'b1a083');rect(shelf,2,5,2,34,'706b5d');rect(shelf,55,5,2,34,'41484b');for(const [x,y,w]of [[5,7,12],[25,7,7],[41,7,10],[5,20,8],[24,20,12],[44,20,5],[8,31,7],[24,31,9],[42,31,12]])paste(shelf,cut(bk,(x+y)%9,1,w,8),x,y);await save(shelf,'shelf');
// Extend the table using its original left and right rims; repeat only middle pixels.
let desk=canvas(56,36);const top=cut(table,1,11,30,21);for(let x=3;x<53;x+=2)paste(desk,cut(top,14,0,2,21),x,4);paste(desk,cut(top,0,0,4,21),0,4);paste(desk,cut(top,26,0,4,21),52,4);const drawer=palette(cut(dresser,0,20,29,10),[87,83,71],.65);paste(desk,cut(drawer,0,0,12,10),3,24);paste(desk,cut(drawer,17,0,12,10),41,24);rect(desk,4,34,3,2,'3c4446');rect(desk,49,34,3,2,'3c4446');paste(desk,cut(bk,0,0,14,11),9,8);paste(desk,cut(lamp,5,6,24,26),29,0);await save(desk,'desk');
// No matching non-semantic observatory apparatus exists in the checked sheets.
// Native 24x44 pixel silhouette; stepped cap/base, four brass and four glass values.
let dev=canvas(24,44);const R=(x,y,w,h,c)=>rect(dev,x,y,w,h,c);
R(4,37,16,6,'263e4a');R(2,35,20,6,'455c66');R(0,33,24,4,'29434f');R(2,30,20,6,'82908c');R(4,29,16,2,'b6a079');R(2,32,20,2,'a18b63');R(4,35,16,3,'536b74');R(5,36,4,1,'9babac');R(15,35,4,2,'303f4a');
R(7,5,10,25,'244956');R(6,8,12,18,'315e6a');R(8,7,8,22,'487d84');R(8,9,3,17,'709e9e');R(9,10,1,11,'a4b9af');R(14,9,2,18,'2b5663');R(11,25,4,2,'5b8d8f');
R(6,3,12,3,'7e7058');R(8,1,8,3,'ab9871');R(10,0,4,1,'d1bd89');R(5,5,14,2,'c3aa77');R(5,7,2,21,'9d8359');R(17,7,2,21,'655c4d');R(6,7,1,19,'c0a478');R(5,27,14,3,'ac9466');R(7,30,10,1,'635b4b');R(9,28,6,1,'dbc592');R(2,38,3,4,'334a56');R(19,38,3,4,'334a56');await save(dev,'device');
let front=wallSprite(64,42);for(let y=0;y<26;y++)rect(front,0,y,48,1,'00000000');let pier=wallSprite(16,42);paste(front,pier,48,0);
// Pier lamp is a small stepped casing, intentionally separate from optional light.
rect(front,53,16,7,14,'243b46');rect(front,54,16,5,2,'b49b6c');rect(front,54,19,4,8,'a89873');rect(front,55,20,2,6,'d4bd8b');rect(front,54,28,5,2,'7c735e');await save(front,'front-west');let east=canvas(64,42);for(let y=0;y<42;y++)for(let x=0;x<64;x++)front.b.copy(east.b,(y*64+x)*4,(y*64+63-x)*4,(y*64+64-x)*4);await save(east,'front-east');
let prop=canvas(12,24);paste(prop,cut(dev,6,3,12,21),0,0);rect(prop,0,20,12,4,'6b7776');rect(prop,1,20,10,1,'b49c72');await save(prop,'prop');
let threshold=canvas(48,4);rect(threshold,0,0,48,4,'3e5360');rect(threshold,0,0,48,1,'b6a17b');rect(threshold,0,1,48,1,'837c65');for(let x=3;x<48;x+=10)rect(threshold,x,1,1,1,'d0ba85');await save(threshold,'threshold');
let ground=canvas(288,288);for(let y=0;y<288;y+=16)for(let x=0;x<288;x+=16)paste(ground,((x/16+3*y/16)%11===0)?ft2:ft,x,y);
// Quiet flush circular corridor retained at the original world anchor.
for(let y=0;y<288;y++)for(let x=0;x<288;x++){let radius=Math.hypot(64+x*2-768,64+y*2-592);if(Math.abs(radius-276)<1||Math.abs(radius-328)<1)rect(ground,x,y,1,1,'8d8c79')}
paste(ground,threshold,96,158);await save(ground,'ground');
let shadow=canvas(288,288);for(const [x,y,w,h] of [[101,159,410,10],[128,173,10,208],[512,167,7,221],[144,203,116,10],[336,203,116,10],[153,279,111,12],[393,278,52,12],[128,378,128,10],[352,378,132,10]])rect(shadow,Math.floor((x-64)/2),Math.floor((y-64)/2),Math.ceil(w/2),Math.ceil(h/2),'172c3830');await save(shadow,'shadow');
let light=canvas(288,288);for(const x of [240,368]){rect(light,(x-64)/2-3,135,6,12,'d7b36e12');rect(light,(x-64)/2-1,137,2,6,'f0d79b66')}rect(light,172,76,1,11,'a3d6d74a');await save(light,'emissive');
let cap=canvas(208,4);rect(cap,1,0,206,3,'839398');rect(cap,2,0,204,1,'a3ada8');rect(cap,2,3,204,1,'a79570');await save(cap,'foreground');
manifest.push({name:'device',usage:'new: native 24x44 raster pixel drawing; 2x = 48x88; no matching device in inspected sheets',alpha:'binary; no antialiasing'});
fs.writeFileSync(`${REPORT}/asset-manifest.json`,JSON.stringify(manifest,null,2));
console.log(manifest);
})().catch(e=>{console.error(e);process.exit(1)})
