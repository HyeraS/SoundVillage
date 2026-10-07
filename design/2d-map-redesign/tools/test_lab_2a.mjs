import assert from 'node:assert/strict'
import fs from 'node:fs'
import {SAFE_SLOTS,STRUCTURES,FOREGROUND_ZONES,SOUND_AUDIT,isCollision,validateWhitebox} from '../../../app/lab-whitebox-preview/whiteboxConfig.mjs'
import {cameraFor,PLAYER_POINTS} from '../../../app/lab-observatory-art-preview/observatoryArt.mjs'
const sounds=JSON.parse(fs.readFileSync('data/sound_metadata.json','utf8')).sounds.filter(s=>s.game_zone==='Lab')
assert.equal(sounds.length,169)
for(const group of ['A','B']) assert.deepEqual(Array.from({length:6},(_,i)=>sounds.filter(s=>s.group===group&&s.block===i+1).length),SOUND_AUDIT.groups[group].blocks)
assert.equal(validateWhitebox().pass,true)
let checked=0
for(const slot of Object.values(SAFE_SLOTS).flat())for(let y=slot.ty-1;y<=slot.ty+1;y++)for(let x=slot.tx-1;x<=slot.tx+1;x++){assert.equal(isCollision(x,y),false);checked++}
for(const s of Object.values(STRUCTURES))for(let y=s.approach.y;y<s.approach.y+s.approach.h;y++)for(let x=s.approach.x;x<s.approach.x+s.approach.w;x++)assert.equal(isCollision(x,y),false)
for(let x=23;x<=25;x++)for(let y=24;y<=35;y++)assert.equal(isCollision(x,y),false)
// Continuous circulation at cardinal and intermediate sample tiles around the raised core.
for(let i=0;i<64;i++){const a=i*Math.PI/32;assert.equal(isCollision(Math.floor(24+5*Math.cos(a)),Math.floor(18.5+5*Math.sin(a))),false)}
for(const [focus,point] of Object.entries(PLAYER_POINTS)){assert.equal(isCollision(Math.floor(point[0]),Math.floor(point[1])),false);if(focus!=='full'){assert.deepEqual(cameraFor(focus).slice(2),[768,576]);assert.deepEqual(cameraFor(focus,true).slice(2),[576,384])}}
let candidateWalkable=0
for(const r of FOREGROUND_ZONES)for(let y=Math.floor(r.y);y<r.y+r.h;y++)for(let x=Math.floor(r.x);x<r.x+r.w;x++)if(!isCollision(x,y))candidateWalkable++
const sources=fs.readdirSync('app/lab-observatory-art-preview').filter(n=>/\.(js|mjs)$/.test(n)).map(n=>fs.readFileSync('app/lab-observatory-art-preview/'+n,'utf8')).join('\n')
assert.doesNotMatch(sources,/from\s+['"][^'"]*(ZoneMap|supabase|sound_metadata|labDungeon|audioManager)/)
assert.doesNotMatch(sources,/\b(fetch|Audio|Howl|localStorage|sessionStorage)\s*\(/)
console.log(JSON.stringify({pass:true,sounds:169,groups:SOUND_AUDIT.groups,slots:108,clearanceTileChecks:checked,reachableTiles:validateWhitebox().reachableTiles,foregroundCandidateWalkableTiles:candidateWalkable,note:'Actual tall artwork clipped to original collision; candidate guide unchanged. Static geometry is not runtime gameplay validation.'},null,2))
