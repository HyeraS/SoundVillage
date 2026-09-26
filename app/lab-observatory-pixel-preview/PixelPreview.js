'use client'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SAFE_SLOTS, STRUCTURES, isCollision } from '../lab-whitebox-preview/whiteboxConfig.mjs'
import { PLAYER, PATCH, SOLIDS, START, SPAWN_POINT, blocked, camera, move } from '../lab-observatory-cohesion-preview/cohesionConfig.mjs'
import { scene, VISUAL_BOUNDS } from './pixelArt.mjs'
import styles from '../lab-observatory-cohesion-preview/cohesion.module.css'
const subscribe=()=>()=>{}
const directions={ArrowUp:[0,-1,'up'],w:[0,-1,'up'],ArrowDown:[0,1,'down'],s:[0,1,'down'],ArrowLeft:[-1,0,'left'],a:[-1,0,'left'],ArrowRight:[1,0,'right'],d:[1,0,'right']}
const rows={down:0,up:1,left:3,right:2}
const cells=Array.from({length:1728},(_,i)=>({x:i%48,y:Math.floor(i/48)})).filter(c=>isCollision(c.x,c.y))
function Avatar({position,dir}){return <g data-layer="player" transform={`translate(${position.x} ${position.y})`}><ellipse cy={-3} rx={12} ry={5} fill="#203641" opacity=".45"/><svg x={-36} y={-88} width={72} height={88} viewBox="0 0 32 32" style={{imageRendering:'pixelated'}} overflow="hidden">{['body','clothes','hair'].map(part=><image key={part} href={`/assets/world/player_${part}.png`} y={-rows[dir]*32} width={256} height={128}/>)}</svg></g>}
export default function PixelPreview(){
 const ready=useSyncExternalStore(subscribe,()=>true,()=>false)
 const [after,setAfter]=useState(true),[proposed,setProposed]=useState(true),[mobile,setMobile]=useState(false),[focus,setFocus]=useState('archive')
 const [position,setPosition]=useState(START),[dir,setDir]=useState('down'),[hits,setHits]=useState(0)
 const [on,setOn]=useState({grid:false,collision:false,foreground:true,clearance:false,grayscale:false,emissive:true,markers:true,bounds:false})
 const pos=useRef(START),keys=useRef(new Set()),physics=useRef(true),trace=useRef([])
 const world=useMemo(()=>scene({after,foreground:on.foreground,emissive:on.emissive}),[after,on.foreground,on.emissive])
 function perform(dx,dy,direction,source){const n=move(pos.current,dx,dy,physics.current);pos.current={x:n.x,y:n.y};setPosition(pos.current);setDir(direction);if(n.hits)setHits(h=>h+n.hits);trace.current.push({source,x:+n.x.toFixed(2),y:+n.y.toFixed(2),blocked:n.hits>0});if(trace.current.length>80)trace.current.shift()}
 useEffect(()=>{
  let last=null,id
  const loop=now=>{const dt=Math.min((now-(last??now))/1000,.05001);last=now;let dx=0,dy=0,direction='down';for(const key of keys.current){const d=directions[key];if(d){dx+=d[0];dy+=d[1];direction=d[2]}}if(dx||dy){const n=move(pos.current,Math.sign(dx)*PLAYER.speed*dt,Math.sign(dy)*PLAYER.speed*dt,physics.current);pos.current={x:n.x,y:n.y};setPosition(pos.current);setDir(direction);if(n.hits)setHits(h=>h+n.hits)}id=requestAnimationFrame(loop)}
  const down=ev=>{if(/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName))return;const key=ev.key.length===1?ev.key.toLowerCase():ev.key;if(!directions[key])return;ev.preventDefault();if(!keys.current.has(key)){const d=directions[key];const n=move(pos.current,d[0]*3.9,d[1]*3.9,physics.current);pos.current={x:n.x,y:n.y};setPosition(pos.current);setDir(d[2]);if(n.hits)setHits(h=>h+n.hits)}keys.current.add(key)}
  const up=ev=>{const key=ev.key.length===1?ev.key.toLowerCase():ev.key;keys.current.delete(key)}
  const clear=()=>keys.current.clear(),visibility=()=>{if(document.hidden)clear()}
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility);id=requestAnimationFrame(loop)
  return()=>{cancelAnimationFrame(id);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);clear()}
 },[])
 const reset=(point=START)=>{keys.current.clear();pos.current={...point};setPosition(pos.current);setDir('down');setHits(0);trace.current=[]}
 const toggleCollision=()=>{keys.current.clear();physics.current=!proposed;setProposed(!proposed)}
 const btn=(label,active,fn)=><button type="button" aria-pressed={active} onClick={fn}>{label}</button>
 const cam=focus==='isolated'?[64,64,576,576]:camera(mobile,focus),behind=world.objects.filter(o=>o.depth<=position.y),front=world.objects.filter(o=>o.depth>position.y)
 const object=o=>{const v=VISUAL_BOUNDS[o.id];const cover=position.y<o.depth&&position.x+11>v.x&&position.x-11<v.x+v.w&&position.y>v.y&&position.y<v.y+v.h;return <g key={o.id} data-object={o.id} data-foot-fade={cover?'true':'false'} opacity={cover?.32:1} dangerouslySetInnerHTML={{__html:o.svg}}/>}
 return <main className={styles.page}><header><small>LAB–2A / R2 · ARCHIVE TRIAL</small><h1>기존 마을의 픽셀로 만든 Archive</h1><p>기존 스프라이트 모듈 · 원본 1px → world 2px · R1 이동 유지</p></header>
 <nav>{btn('R1',!after,()=>setAfter(false))}{btn('R2',after,()=>setAfter(true))}<button type="button" aria-pressed={proposed} onClick={()=>{if(!proposed)toggleCollision()}}>제안 충돌</button><button type="button" aria-pressed={!proposed} onClick={()=>{if(proposed)toggleCollision()}}>기존 충돌</button>{btn('Desktop',!mobile,()=>setMobile(false))}{btn('Mobile',mobile,()=>setMobile(true))}{btn('시험 구간',focus==='archive',()=>setFocus('archive'))}{btn('연결 확대',focus==='detail',()=>setFocus('detail'))}{btn('구간만 보기',focus==='isolated',()=>setFocus('isolated'))}{btn('전체 범위',focus==='full',()=>setFocus('full'))}</nav>
 <div className={styles.layout}><section><div className={styles.mapTop}><b>{after?'R2 · 픽셀 모듈':'R1 · 연결감 기준'}</b><span>{cam[2]}×{cam[3]} world px · sprite 72×88</span></div>
 <svg role="img" aria-label="Archive 연결감 시험 맵" className={styles.map} viewBox={cam.join(' ')} style={{aspectRatio:`${cam[2]}/${cam[3]}`,filter:on.grayscale?'grayscale(1)':'none'}}>
 <rect width={1536} height={1152} fill="#162734"/>
 {ready&&<g dangerouslySetInnerHTML={{__html:world.base}}/>}
 {ready&&behind.map(object)}
 <Avatar position={position} dir={dir}/>
 {ready&&front.map(object)}
 {ready&&<g data-layer="foreground" dangerouslySetInnerHTML={{__html:world.foreground}}/>}
 {ready&&<g data-layer="emissive" dangerouslySetInnerHTML={{__html:world.emissive}}/>}
 {on.markers&&Object.values(SAFE_SLOTS).flat().map((s,i)=><g key={i} data-slot={`${s.block}:${s.tx},${s.ty}`} opacity={s.block===3?1:.25} transform={`translate(${(s.tx+.5)*32} ${(s.ty+.5)*32})`}><circle r={13} fill="#233d4b" stroke={s.block===3?'#f2e8b2':'#a0b2ba'} strokeWidth={2}/>{s.block===3&&<circle r={18} fill="none" stroke="#edf3e1" strokeWidth={2}/>}<path d="M-6 0h2l2-4 4 8 2-4h2" fill="none" stroke="#e5ddae" strokeWidth={2}/></g>)}
 {on.grid&&<g data-guide="grid" stroke="#c0d8da" opacity=".25">{Array.from({length:49},(_,i)=><path key={'x'+i} d={`M${i*32} 0v1152`}/>)}{Array.from({length:37},(_,i)=><path key={'y'+i} d={`M0 ${i*32}h1536`}/>)}</g>}
 {on.collision&&<g data-guide="collision" fill="#ff887e" fillOpacity=".25" stroke="#fd9a8b">{cells.filter(c=>!(proposed&&c.x>=3&&c.x<16&&c.y>=3&&c.y<12)).map((c,i)=><rect key={i} x={c.x*32} y={c.y*32} width={32} height={32}/>)}{proposed&&SOLIDS.map(s=><rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h}/>)}<rect x={position.x-11} y={position.y-28} width={22} height={28} fill="#65efb1" stroke="#65efb1"/></g>}
 {on.clearance&&<g data-guide="clearance" fill="#7bdfac" fillOpacity=".04" stroke="#a0d6b2">{Object.values(SAFE_SLOTS).flat().map((s,i)=><rect key={i} x={(s.tx-1)*32} y={(s.ty-1)*32} width={96} height={96}/>)}{Object.values(STRUCTURES).map(s=><rect key={s.label} x={s.approach.x*32} y={s.approach.y*32} width={96} height={96} fillOpacity=".17" strokeWidth={2}/>)}</g>}
 {on.bounds&&<rect data-guide="scope" x={PATCH.x} y={PATCH.y} width={PATCH.w} height={PATCH.h} fill="none" stroke="#ccaa74" strokeWidth={2} strokeDasharray="10 7"/>}
 </svg>
 <div className={styles.steps} aria-label="한 칸 이동">{[['↑',0,-32,'up'],['←',-32,0,'left'],['↓',0,32,'down'],['→',32,0,'right']].map(([label,dx,dy,d])=><button key={d} onClick={()=>perform(dx,dy,d,'step-button')} aria-label={`한 칸 ${label}`}>{label}</button>)}<button onClick={()=>reset()}>위치 초기화</button></div>
 <p className={styles.status} data-testid="position" data-x={position.x.toFixed(2)} data-y={position.y.toFixed(2)}>발 위치 ({position.x.toFixed(1)}, {position.y.toFixed(1)}) · 충돌 접촉 {hits} · {blocked(position.x,position.y,proposed)?'현재 충돌 안 — 위치 초기화 필요':'이동 가능'}</p>
 </section><aside><h2>검수 도구</h2><div className={styles.controls}>{Object.entries({grid:'Grid',collision:'Collision',foreground:'Foreground',clearance:'Clearance',grayscale:'Grayscale',emissive:'Emissive',markers:'Mock markers',bounds:'수정 범위'}).map(([k,label])=><span key={k}>{btn(label,on[k],()=>setOn(v=>({...v,[k]:!v[k]})))}</span>)}</div>
 <h2>연속 이동</h2><p>방향키 / WASD 또는 아래 버튼을 누르고 이동합니다. 지도 아래 화살표는 32px씩 같은 충돌 계산을 거칩니다.</p><div className={styles.pad}>{[['↑','ArrowUp'],['←','ArrowLeft'],['↓','ArrowDown'],['→','ArrowRight']].map(([label,key])=><button key={key} aria-label={`누르고 ${label}`} onPointerDown={ev=>{ev.preventDefault();ev.currentTarget.setPointerCapture(ev.pointerId);keys.current.add(key);const d=directions[key];perform(d[0]*3.9,d[1]*3.9,d[2],'pointer-tap')}} onPointerUp={()=>keys.current.delete(key)} onPointerCancel={()=>keys.current.delete(key)} onLostPointerCapture={()=>keys.current.delete(key)}>{label}</button>)}</div>
 <button onClick={()=>reset(SPAWN_POINT)}>맵 Spawn으로</button>
 <p>R1/R2는 카메라·캐릭터 위치를 유지합니다. 충돌안은 별도 선택하므로 같은 그림에서 두 충돌을 비교할 수 있습니다.</p><p>범위 표시를 켜면 수정 구간을 볼 수 있습니다: tile [2,2,18,18]. Spectrum·Signal·중앙 장치와 범위 밖은 LAB-2A 그대로입니다.</p><p>수정 구간은 기존 sprite를 조합한 픽셀 아트입니다. 바닥·가구·그림자·전경·발광은 독립 레이어입니다. 방 사각형 이미지 사용 없음. 범위 밖 기존 이미지의 내재 조명은 Emissive off에도 남습니다.</p><p>108 후보 slot 표시용 mock이며 실제 sound 배치·재생·보상·저장 기능은 없습니다.</p>
 </aside></div></main>
}
