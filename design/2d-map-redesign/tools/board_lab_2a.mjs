import fs from 'node:fs'
import sharp from 'sharp'
const out='design/2d-map-redesign/previews/lab-2a'
const label=(title,sub,w=768)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="68"><rect width="100%" height="100%" fill="#142430"/><text x="20" y="27" fill="#e0c894" font-family="sans-serif" font-size="19">${title}</text><text x="20" y="50" fill="#a7b9c4" font-family="sans-serif" font-size="13">${sub}</text></svg>`)
const rows=[['current-nature-768x576.png','NATURE / current renderer','Fresh local test-route capture; 24x18 FOV; 72x88 sprite'],['current-animal-768x576.png','ANIMAL / current renderer','Fresh local test-route capture; 24x18 FOV; 72x88 sprite'],['current-human-768x576.png','HUMAN / current Winter renderer','Test route uses all 169 Human sounds; density is not A/B gameplay'],['current-music-768x576.png','MUSIC / current 2C-C renderer','Not the old baseline, B1-B4 preview, or unapplied R1'],['desktop-entrance.png','LAB / 2A coordinate art preview','Same world sprite size, 24x18 camera; mock state only'],['desktop-central.png','LAB / 2A central camera','Same proposal, different focus; not a second art direction']]
let layers=[]
for(let i=0;i<rows.length;i++){let [file,t,s]=rows[i],x=i%3*768,y=Math.floor(i/3)*644;layers.push({input:label(t,s),left:x,top:y},{input:await sharp(out+'/'+file).resize(768,576,{fit:'contain'}).toBuffer(),left:x,top:y+68})}
await sharp({create:{width:2304,height:1288,channels:4,background:'#142430'}}).composite(layers).png().toFile(out+'/village-comparison.png')
let cams=[]
for(let i=0;i<5;i++){let key=['entrance','central','archive','spectrum','signal'][i];cams.push({input:label(key.toUpperCase(),'Desktop 768x576 world px',384),left:i%3*384,top:Math.floor(i/3)*356},{input:await sharp(out+'/desktop-'+key+'.png').resize(384,288,{kernel:'nearest'}).toBuffer(),left:i%3*384,top:Math.floor(i/3)*356+68})}
await sharp({create:{width:1152,height:712,channels:4,background:'#142430'}}).composite(cams).png().toFile(out+'/camera-board.png')
await sharp(out+'/mobile-entrance.png').resize(320,213,{kernel:'nearest'}).grayscale().png().toFile(out+'/mobile-320-gray.png')
await sharp(out+'/desktop-full.png').grayscale().png().toFile(out+'/full-grayscale.png')
console.log('Comparison and camera boards exported')
