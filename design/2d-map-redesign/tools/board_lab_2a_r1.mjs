import fs from 'node:fs'
import sharp from 'sharp'
const out='design/2d-map-redesign/previews/lab-2a-r1'
const title=(text,sub,w)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="64"><rect width="100%" height="100%" fill="#162c39"/><text x="16" y="27" fill="#e5c98f" font-size="20" font-family="sans-serif">${text}</text><text x="16" y="49" fill="#b0c3cc" font-size="12" font-family="sans-serif">${sub}</text></svg>`)
async function pair(file,a,b,w,h){await sharp({create:{width:w*2,height:h+64,channels:4,background:'#162c39'}}).composite([{input:title('BEFORE / LAB-2A','Identical camera and player position',w),left:0,top:0},{input:title('AFTER / Archive R1','Common floor + independent objects + local collision',w),left:w,top:0},{input:await sharp(`${out}/${a}.png`).resize(w,h,{kernel:'nearest'}).toBuffer(),left:0,top:64},{input:await sharp(`${out}/${b}.png`).resize(w,h,{kernel:'nearest'}).toBuffer(),left:w,top:64}]).png().toFile(`${out}/${file}.png`)}
await pair('before-after','before-archive','after-archive',768,576)
await pair('connection-closeup','before-connection-detail','after-connection-detail',576,480)
await pair('collision-comparison','original-collision','proposed-collision',768,576)
const refs=[['current-nature-768x576.png','NATURE'],['current-animal-768x576.png','ANIMAL'],['current-human-768x576.png','HUMAN'],['current-music-768x576.png','MUSIC 2C-C']]
const layers=[]
for(let i=0;i<6;i++){const x=i%3*768,y=Math.floor(i/3)*640;let src,text,sub;if(i<4){src=`${out}/${refs[i][0]}`;text=refs[i][1]+' / CURRENT IMPLEMENTATION';sub='Fresh R1 test-route capture; 24x18 world FOV'}else{src=`${out}/${i===4?'before-archive':'after-archive'}.png`;text=i===4?'LAB-2A / BEFORE':'ARCHIVE R1 / AFTER';sub='72x88 sprite frame; same 768x576 world camera, same foot position'}layers.push({input:title(text,sub,768),left:x,top:y},{input:await sharp(src).resize(768,576,{fit:'contain'}).toBuffer(),left:x,top:y+64})}
await sharp({create:{width:2304,height:1280,channels:4,background:'#162c39'}}).composite(layers).png().toFile(`${out}/village-scale-comparison.png`)
await sharp(`${out}/mobile-gray-off.png`).resize(320,213,{kernel:'nearest'}).png().toFile(`${out}/mobile-320-gray.png`)
// Compact independent-layer board, not a claimed runtime atlas.
const names=['ground','shadow','building','foreground','emissive'];let parts=[];for(let i=0;i<names.length;i++){let x=i%3*384,y=Math.floor(i/3)*448;parts.push({input:title(names[i].toUpperCase(),'Archive trial only / independently authored',384),left:x,top:y},{input:await sharp(`${out}/layer-${names[i]}.png`).resize(384,384).toBuffer(),left:x,top:y+64})}await sharp({create:{width:1152,height:896,channels:4,background:'#263d49'}}).composite(parts).png().toFile(`${out}/layer-plan.png`)
console.log('R1 comparison boards exported')
