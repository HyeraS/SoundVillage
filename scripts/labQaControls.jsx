'use client'
// QA-only controls. This module is copied ONLY into the temporary mock app.
// Movement emits keyboard events through the real input handler; never teleports.
import {useState,useRef} from 'react'
import {qaWorldWalkable,qaWorldPortals} from './WorldMap'
import {buildVillage,collides,moveWithCollision,spawnLabItems,T} from '../lib/labVillageConfig.mjs'
import {loadLabVillage,drawLabItem} from '../lib/labVillage'
import metadata from '../data/sound_metadata.json'
const keyMap={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}
export default function LabQaControls(){
 const [status,setStatus]=useState('LOCAL MOCK · 데이터 외부 전송 없음'),[zone,setZone]=useState('Lab'),[group,setGroup]=useState('A'),[target,setTarget]=useState(''),[duration,setDuration]=useState(500),[overview,setOverview]=useState(false)
 const held=useRef(new Set()),stop=useRef(false),mapRef=useRef(null)
 const list=spawnLabItems(metadata.sounds.filter(s=>s.game_zone==='Lab'&&s.group===group))
 const key=(keys)=>{for(const k of held.current)if(!keys.includes(k))window.dispatchEvent(new KeyboardEvent('keyup',{key:keyMap[k],bubbles:true}));for(const k of keys)if(!held.current.has(k))window.dispatchEvent(new KeyboardEvent('keydown',{key:keyMap[k],bubbles:true}));held.current=new Set(keys)}
 const pause=()=>new Promise(resolve=>requestAnimationFrame(resolve))
 const hold=async(d)=>{key([d]);const start=performance.now();while(performance.now()-start<duration)await pause();key([]);setStatus(`키 입력 ${d} ${duration}ms 완료`)}
 const walk=async()=>{
  stop.current=false;const world=document.querySelector('[data-qa-world-x]'),lab=document.querySelector('[data-testid="lab-stage"]'),v=buildVillage(metadata.sounds.filter(s=>s.game_zone==='Lab'))
  if(!world&&!lab)return
  const read=()=>world?{x:Number(world.dataset.qaWorldX),y:Number(world.dataset.qaWorldY)}:{x:Number(lab.dataset.playerX),y:Number(lab.dataset.playerY)}
  const start=read(),step=16,queue=[{x:start.x,y:start.y}],seen=new Set(),parents=new Map()
  const dest=world?qaWorldPortals.find(p=>p.zone===zone):list.find(i=>i.id===(target||list[0].id))
  const goal=p=>world?p.x>dest.tx*T&&p.x<(dest.tx+dest.w)*T&&p.y>dest.ty*T&&p.y<(dest.ty+dest.h)*T:Math.hypot(p.x-dest.x,p.y-dest.y)<12
  const pointKey=p=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`
  seen.add(pointKey(queue[0]))
  let end=null
  for(let i=0;i<queue.length;i++){
   const p=queue[i],pk=pointKey(p);if(goal(p)){end=pk;break}
   for(const [dx,dy]of[[step,0],[-step,0],[0,step],[0,-step]]){
    const x=p.x+dx,y=p.y+dy,k=pointKey({x,y});if(x<0||y<0||x>3840||y>2880||seen.has(k))continue
    if(world?!qaWorldWalkable(x,y):!!collides(v,x,y))continue
    if(!world){const q=moveWithCollision(v,p,dx,dy);if(Math.abs(q.x-x)>.01||Math.abs(q.y-y)>.01)continue}
    seen.add(k);parents.set(k,pk);queue.push({x,y})
   }
  }
  if(!end){setStatus('도달 경로 없음');return}
  const route=[];let k=end;while(parents.has(k)){route.push(k.split(',').map(Number));k=parents.get(k);if(route.length>2000)throw Error('cycle')}
  setStatus(`실제 키보드 이동 중 · ${route.length} steps`)
  for(const [x,y]of route.reverse()){
   const began=performance.now();for(;;){
    const p=read(),dx=x-p.x,dy=y-p.y
    if(stop.current||(!world&&lab.dataset.mode!=='move')){key([]);setStatus('이동 종료 · 상호작용/중단');return}
    // The product loop advances by frame-time-sized fractions. A half-tile BFS
    // waypoint only needs to be reached within one collision-foot radius.
    if(Math.abs(dx)<14&&Math.abs(dy)<14)break
    if(performance.now()-began>1500){key([]);setStatus(`이동 막힘 ${p.x},${p.y} → ${x},${y}`);return}
    const horizontal=Math.abs(dx)>=7&&(Math.abs(dx)>=Math.abs(dy)||Math.abs(dy)<7)
    key(horizontal?[dx<0?'left':'right']:[dy<0?'up':'down']);await pause()
   }
  }
  key([]);setStatus('도보 도착 · Enter로 실제 진입/선택')
 }
 const review=async()=>{
  setOverview(true);await pause();const canvas=mapRef.current,c=canvas.getContext('2d'),assets=await loadLabVillage();c.imageSmoothingEnabled=false;c.drawImage(assets.environment,0,0,1536,1152)
  for(const i of list)drawLabItem(c,i,0,6,new Set())
 }
 return <><details style={{position:'fixed',right:6,top:62,zIndex:900,background:'#fff9',font:'11px monospace',maxWidth:280}}><summary>로컬 QA 도구</summary><div style={{padding:8,background:'#fff'}}><p role="status">{status}</p><select aria-label="QA 마을" value={zone} onChange={e=>setZone(e.target.value)}>{['Lab','Animal','Nature','Music'].map(z=><option key={z}>{z}</option>)}</select><button onClick={walk}>현재 목표까지 걷기</button><button onClick={()=>{stop.current=true;key([])}}>중단</button><div><select aria-label="QA 그룹" value={group} onChange={e=>setGroup(e.target.value)}><option>A</option><option>B</option></select><select aria-label="QA 소리 목표" value={target} onChange={e=>setTarget(e.target.value)}><option value="">첫 소리</option>{list.map(i=><option key={i.id} value={i.id}>{i.id} · 구역 {i.block} · {i.tx},{i.ty}</option>)}</select></div><input aria-label="QA 키 입력 시간" type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))}/>{['up','left','down','right'].map(d=><button key={d} onClick={()=>hold(d)}>{d} 키</button>)}<button onClick={review}>전체 조감 렌더</button></div></details>
 {overview&&<div style={{position:'fixed',inset:0,zIndex:950,background:'#66968a',display:'flex',justifyContent:'center',alignItems:'center'}}><canvas ref={mapRef} width={1536} height={1152} style={{width:'min(100vw,133.33vh)',height:'auto',imageRendering:'pixelated'}}/><button style={{position:'absolute',top:0,right:0}} onClick={()=>setOverview(false)}>조감 닫기</button></div>}</>
}
