// R3 extends the editable native-pixel R2 assets; no source asset is overwritten.
const fs=require('fs'),sharp=require('sharp');
const OUT='public/design-previews/lab-2a-r3',OLD='public/design-previews/lab-2a-r2';
const P={dark:'283e4a',edge:'354c57',metal:'536c76',light:'859b9e',brass:'a38b5e',gold:'c7ad77',shade:'6a624f',glass:'376773',glassMid:'558992',glassHi:'86ada9',paper:'b5ad90',wood:'6d6655'};
function canvas(w,h){return {w,h,b:Buffer.alloc(w*h*4)}}
function rect(c,x,y,w,h,col){let a=(P[col]||col).match(/\w\w/g).map(v=>parseInt(v,16));if(a.length===3)a.push(255);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>=0&&yy>=0&&xx<c.w&&yy<c.h)for(let k=0;k<4;k++)c.b[(yy*c.w+xx)*4+k]=a[k]}
function paste(c,s,x,y){for(let yy=0;yy<s.h;yy++)for(let xx=0;xx<s.w;xx++){let i=(yy*s.w+xx)*4;if(s.b[i+3]&&x+xx>=0&&y+yy>=0&&x+xx<c.w&&y+yy<c.h)s.b.copy(c.b,((y+yy)*c.w+x+xx)*4,i,i+4)}}
function cut(s,x,y,w,h){let c=canvas(w,h);for(let yy=0;yy<h;yy++)s.b.copy(c.b,yy*w*4,((y+yy)*s.w+x)*4,((y+yy)*s.w+x+w)*4);return c}
async function read(n){let {data,info}=await sharp(`${OLD}/${n}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {w:info.width,h:info.height,b:data}}
async function save(c,n){await sharp(c.b,{raw:{width:c.w,height:c.h,channels:4}}).png().toFile(`${OUT}/${n}.png`)}
function line(c,x0,y0,x1,y1,col,w=1){let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;for(;;){rect(c,x0,y0,w,w,col);if(x0===x1&&y0===y1)break;let e=2*err;if(e>=dy){err+=dy;x0+=sx}if(e<=dx){err+=dx;y0+=sy}}}
function glass(c,x,y,w,h){rect(c,x,y,w,h,'dark');rect(c,x+1,y+1,w-2,h-2,'glass');rect(c,x+2,y+2,2,h-4,'glassHi');rect(c,x+4,y+2,w-6,h-4,'glassMid');rect(c,x+w-2,y+2,1,h-3,'edge')}
function drawer(c,x,y,w,h){rect(c,x,y,w,h,'dark');rect(c,x+1,y+1,w-2,h-2,'metal');rect(c,x+1,y+1,w-3,1,'light');rect(c,x+Math.floor(w/2)-2,y+3,4,1,'brass');rect(c,x+Math.floor(w/2)-1,y+4,2,1,'dark')}
(async()=>{
const oldShelf=await read('shelf'),oldDesk=await read('desk'),table=await read('source-table'),book=await read('source-books');
// Record rack retains the original furniture cornice, feet and warm outer rim.
let rec=canvas(59,41);paste(rec,oldShelf,0,0);rect(rec,3,6,52,33,'dark');rect(rec,3,6,29,1,'brass');rect(rec,31,7,2,30,'shade');
for(const [x,h,col]of [[5,14,'paper'],[10,17,'wood'],[16,15,'metal'],[23,17,'paper']]){rect(rec,x,8,5,h,'edge');rect(rec,x,9,4,h-2,col);rect(rec,x+1,12,2,2,'gold')}
rect(rec,4,26,27,2,'wood');paste(rec,cut(book,8,1,11,8),5,29);drawer(rec,19,29,11,9);glass(rec,36,8,16,12);rect(rec,35,7,18,1,'brass');drawer(rec,35,23,18,7);drawer(rec,35,31,18,7);await save(rec,'records');
// Instrument rack: broad horizontal measurement panel, asymmetric glass cabinet.
let met=canvas(59,41);rect(met,2,5,55,33,'dark');rect(met,3,3,53,3,'metal');rect(met,5,2,49,1,'light');rect(met,4,6,51,1,'brass');rect(met,3,7,2,30,'metal');rect(met,54,7,2,30,'edge');
rect(met,7,10,28,16,'edge');rect(met,8,10,26,1,'light');rect(met,10,13,22,9,'metal');for(let x=12;x<31;x+=4)rect(met,x,14,1,(x%8===4)?4:2,'paper');rect(met,11,21,20,1,'dark');rect(met,27,19,3,2,'brass');glass(met,39,9,13,22);rect(met,38,8,15,1,'brass');rect(met,38,31,15,2,'shade');drawer(met,7,28,13,9);drawer(met,22,28,13,9);rect(met,39,35,13,2,'metal');rect(met,3,38,53,2,'edge');rect(met,6,40,6,1,'dark');rect(met,47,40,6,1,'dark');await save(met,'measurement');
// Same table rim, width and lower drawers; replace only the equipment above them.
let desk=canvas(56,36);paste(desk,cut(oldDesk,0,24,56,12),0,24);rect(desk,20,24,20,2,'00000000');let top=cut(table,1,11,30,21);for(let x=3;x<53;x+=2)paste(desk,cut(top,14,0,2,21),x,4);paste(desk,cut(top,0,0,4,21),0,4);paste(desk,cut(top,26,0,4,21),52,4);
rect(desk,6,12,13,10,'shade');rect(desk,6,11,12,9,'paper');rect(desk,7,11,1,8,'gold');rect(desk,10,14,6,1,'wood');rect(desk,10,17,4,1,'wood');
rect(desk,22,10,24,12,'dark');rect(desk,23,8,22,11,'metal');rect(desk,24,8,20,1,'light');glass(desk,25,11,9,6);for(let x=36;x<43;x+=3)rect(desk,x,11,1,3,'paper');rect(desk,36,16,3,2,'brass');rect(desk,41,16,2,2,'shade');
// A low hooded worklight, deliberately less tall than the R2 stand.
rect(desk,47,12,5,2,'dark');rect(desk,49,4,2,9,'edge');rect(desk,43,3,8,3,'metal');rect(desk,43,2,7,1,'light');rect(desk,43,6,5,1,'paper');await save(desk,'workbench');
let dev=canvas(24,44);const R=(x,y,w,h,c)=>rect(dev,x,y,w,h,c);
R(3,38,18,5,'dark');R(1,35,22,5,'edge');R(2,34,20,3,'metal');R(4,33,16,2,'light');R(4,37,16,1,'brass');R(5,39,4,1,'metal');R(18,39,3,2,'dark');
// Structural posts link the two offset half-frames to the same grounded plinth.
R(5,18,2,16,'shade');R(5,18,1,15,'brass');R(18,19,2,15,'shade');R(18,19,1,14,'gold');R(6,31,13,2,'brass');
function arc(cx,cy,rx,ry,a,b){let last=null;for(let t=a;t<=b;t+=3){let p=[Math.round(cx+rx*Math.cos(t*Math.PI/180)),Math.round(cy+ry*Math.sin(t*Math.PI/180))];if(last)line(dev,...last,...p,'brass',2);last=p}last=null;for(let t=a;t<=b;t+=3){let p=[Math.round(cx+rx*Math.cos(t*Math.PI/180)),Math.round(cy+ry*Math.sin(t*Math.PI/180))];if(last)line(dev,...last,...p,'gold');last=p}}
arc(12,15,10,12,105,255);arc(11,18,9,10,-60,60);
R(3,14,4,3,'shade');R(4,14,2,2,'gold');R(18,18,4,3,'shade');R(19,18,2,2,'gold');
line(dev,6,25,11,29,'shade',2);line(dev,11,29,18,25,'brass',2);glass(dev,9,13,8,11);R(9,12,8,1,'brass');R(10,24,6,1,'shade');R(11,26,3,3,'metal');R(20,26,3,2,'brass');R(21,24,1,6,'light');R(5,7,2,1,'paper');R(3,11,1,2,'paper');R(3,20,2,1,'shade');await save(dev,'frame');
// Preserve all old lamps; remove only the obsolete glass-column glow.
let em=await read('emissive');rect(em,172,76,1,11,'00000000');rect(em,175,84,1,5,'86ada933');rect(em,85,82,2,1,'dfc88d22');await save(em,'emissive');
fs.writeFileSync('design/2d-map-redesign/previews/lab-2a-r3/asset-manifest.json',JSON.stringify({pixelScale:2,source:'editable R2 native pixel modules; originals untouched',assets:[{name:'records',size:[59,41],world:[118,82],reuse:'R2 shelf cornice, feet; source-books small crop',new:'record files, boxes and small glass bay'},{name:'measurement',size:[59,41],world:[118,82],new:'metal casing, horizontal neutral tick panel, glass bay, drawers'},{name:'workbench',size:[56,36],world:[112,72],reuse:'R2 source-table rim and desk bottom drawers',new:'low panel, paper, knobs, hooded worklight'},{name:'frame',size:[24,44],world:[48,88],new:'grounded plinth, connected offset half-frames and central small glass plate'},{name:'emissive',size:[288,288],world:[576,576],reuse:'R2 wall-lamp masks',new:'only glass-column mask replaced with faint frame reflection, small workbench light'}],palette:P},null,2));
})()
