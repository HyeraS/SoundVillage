/** Isolated localhost QA: copies current source into /tmp, uses an in-memory
 * PostgREST-shaped mock and synthetic audio. Never reads .env or contacts Supabase.
 * Run: node scripts/lab_qa_server.mjs (app 3015, mock 4015).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { spawn } from 'node:child_process'
const root=process.cwd(),work=path.join(os.tmpdir(),'soundvillage-lab-witch-qa')
await fs.mkdir(work,{recursive:true})
async function sync(){
 for(const name of ['app','components','lib','data'])await fs.cp(path.join(root,name),path.join(work,name),{recursive:true})
 for(const name of ['package.json','jsconfig.json','postcss.config.mjs'])try{await fs.copyFile(path.join(root,name),path.join(work,name))}catch{}
 for(const name of ['node_modules','public'])try{await fs.symlink(path.join(root,name),path.join(work,name))}catch{}
 await fs.copyFile(path.join(root,'scripts/labQaControls.jsx'),path.join(work,'components/LabQaControls.js'))
 const layoutPath=path.join(work,'app/layout.js'),worldPath=path.join(work,'components/WorldMap.js')
 let layout=await fs.readFile(layoutPath,'utf8');layout="import LabQaControls from '../components/LabQaControls'\n"+layout.replace('<body>{children}</body>','<body>{children}<LabQaControls/></body>');await fs.writeFile(layoutPath,layout)
 let world=await fs.readFile(worldPath,'utf8');world=world.replace("<HUD totalCount={totalCount}","<span data-qa-world-x={pos.x} data-qa-world-y={pos.y}/><HUD totalCount={totalCount}");world+='\nexport { isWalkable as qaWorldWalkable, PORTALS as qaWorldPortals }\n';await fs.writeFile(worldPath,world)
 await fs.writeFile(path.join(work,'lib/participantAuth.js'),`export class ParticipantAuthError extends Error { constructor(code,message=code){super(message);this.code=code} }
export async function restoreParticipantSession(){return null}
export async function claimParticipantSession(participantId,groupId){await fetch('http://127.0.0.1:4015/__claim?participant_id='+encodeURIComponent(participantId));return{participantId,groupId,status:'active'}}
export async function authorizedPost(){return{ok:true,data:null}}
`)
 await fs.writeFile(path.join(work,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}}\n`)
}
await sync()
const metadata=JSON.parse(await fs.readFile(path.join(root,'data/sound_metadata.json'),'utf8')).sounds
const saved=[],requests=[],seeded=new Set();let currentPid='LOCAL_QA'
const canonical=sound=>{const clean=value=>String(value||'').trim().replaceAll(String.fromCharCode(92),'/').replace(/\/+$/,'').toLowerCase();const dataset=clean(sound?.source_dataset),original=clean(sound?.original_fname);return dataset&&original?`${dataset}:${original}`:`path:${clean(sound?.file_path)}`}
function seed(pid){
 if(!pid||seeded.has(pid))return;seeded.add(pid)
 const group=pid.includes('_B')?'B':'A',stage=Number(pid.match(/_S(\d+)/)?.[1]||1)
 const rows=metadata.filter(s=>s.group===group&&((s.game_zone==='Music'&&s.block===1)||(s.game_zone==='Lab'&&s.block<stage)))
 if(pid.includes('_LAST'))rows.push(...metadata.filter(s=>s.group===group&&s.game_zone==='Lab'&&s.block===1).slice(0,-1))
 for(const s of rows)saved.push({id:saved.length+1,participant_id:pid,session_id:group,sound_id:s.sound_id,zone:s.game_zone,is_skipped:false,expression_text:'로컬 준비 기록',confidence:3})
}
const wav=Buffer.alloc(44+22050*2*2)
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40)
for(let i=44;i<wav.length;i+=2)wav.writeInt16LE(Math.round(Math.sin((i-44)/2/22050*2*Math.PI*440)*900),i)
const mock=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost:4015')
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,HEAD,OPTIONS');res.setHeader('Access-Control-Expose-Headers','content-range')
 if(req.method==='OPTIONS'){res.end();return}
 if(u.pathname==='/__claim'){currentPid=u.searchParams.get('participant_id')||'LOCAL_QA';seed(currentPid);res.end('claimed');return}
 if(u.pathname==='/__sync'){await sync();res.end('synced');return}
 if(u.pathname==='/__report'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({localOnly:true,saved,requests}));return}
 if(u.pathname.startsWith('/audio/')){res.setHeader('Content-Type','audio/wav');res.end(wav);return}
 const table=u.pathname.split('/').pop(),pid=u.searchParams.get('participant_id')?.replace(/^eq\./,'');seed(pid)
 let body='';for await(const chunk of req)body+=chunk
 requests.push({method:req.method,path:u.pathname,query:u.search,body:body?JSON.parse(body):null})
 let data=[]
 if(table==='annotations'){
  if(req.method==='POST'){const rows=JSON.parse(body);for(const row of Array.isArray(rows)?rows:[rows])saved.push({...row,id:saved.length+1});data=[]}
  else data=saved.filter(row=>[...u.searchParams].every(([k,v])=>{
   if(v.startsWith('eq.'))return String(row[k])===v.slice(3)
   if(v.startsWith('neq.'))return String(row[k])!==v.slice(4)
   if(v.startsWith('in.('))return v.slice(4,-1).split(',').map(s=>s.replaceAll('"','')).includes(String(row[k]))
   return true
  }))
 } else if(u.pathname.endsWith('/rpc/get_my_experiment_progress_v1'))data={isComplete:false,assignedCount:84,completedCount:saved.filter(row=>row.participant_id===currentPid&&!row.is_skipped).length}
 else if(u.pathname.endsWith('/rpc/get_my_completed_audio_v1')){
  const args=body?JSON.parse(body):{},zone=args.p_zone
  data=saved.filter(row=>row.participant_id===currentPid&&!row.is_skipped&&(!zone||row.zone===zone)).map(row=>({canonical_audio_id:canonical(metadata.find(sound=>sound.sound_id===row.sound_id))}))
 } else if(u.pathname.endsWith('/rpc/submit_annotation_v4')){
  const args=JSON.parse(body||'{}'),existing=saved.find(row=>row.sound_id===args.p_sound_id)
  if(!existing)saved.push({id:saved.length+1,participant_id:currentPid,session_id:'A',sound_id:args.p_sound_id,zone:args.p_zone,is_skipped:Boolean(args.p_is_skipped),expression_text:args.p_expression_text||'',confidence:args.p_confidence})
  data={ok:true,sound_id:args.p_sound_id}
 } else if(table==='participant_attendance')data=[{id:1,check_in_date:new Date().toISOString().slice(0,10),streak_day:1,reward_currency:0}]
 else if(table==='participant_currency')data=[{balance:0}]
 else if(table==='participant_equipped_outfit')data=[]
 else if(u.pathname.includes('/rpc/'))data=0
 const count=Array.isArray(data)?data.length:0
 res.setHeader('Content-Type','application/json');res.setHeader('Content-Range',`0-${Math.max(0,count-1)}/${count}`)
 if(req.method==='HEAD'){res.end();return}
 if(req.headers.accept?.includes('vnd.pgrst.object'))data=data[0]||null
 res.end(JSON.stringify(data))
})
mock.listen(4015,'127.0.0.1')
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','3015','-H','127.0.0.1'],{cwd:work,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4015',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-mock-only-not-a-secret',NEXT_PUBLIC_AUDIO_BASE_URL:'http://127.0.0.1:4015/audio'}})
console.log(`LOCAL MOCK ONLY: http://127.0.0.1:3015 ; workspace ${work}`)
process.on('SIGINT',()=>{child.kill('SIGINT');mock.close();process.exit()})
