'use client'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { SAFE_SLOTS, SOUND_AUDIT, STRUCTURES, FOREGROUND_ZONES, WHITEBOX_VALIDATION } from '../lab-whitebox-preview/whiteboxConfig.mjs'
import { environment, collisionCells, cameraFor, FOCUS, PLAYER_POINTS } from './observatoryArt.mjs'
import styles from './preview.module.css'
const labels={full:'전체',entrance:'입구',central:'중앙',archive:'Archive',spectrum:'Spectrum',signal:'Signal'}
const toggles={environment:'환경',markers:'Marker',player:'캐릭터',grid:'Grid',collision:'Collision',foreground:'Foreground',fgGuide:'Foreground guide',clearance:'Marker clearance',grayscale:'Grayscale',emissive:'Emissive'}
const rect=s=>({x:s.x*32,y:s.y*32,width:s.w*32,height:s.h*32})
function Player({point}){return <g data-layer="player" transform={`translate(${point[0]*32} ${point[1]*32})`}><ellipse cy={-4} rx={13} ry={5} fill="#132630" opacity=".5"/><svg x={-36} y={-88} width={72} height={88} viewBox="0 0 32 32" overflow="hidden" style={{imageRendering:'pixelated'}}>{['body','clothes','hair'].map(part=><image key={part} href={`/assets/world/player_${part}.png`} width={256} height={128}/>)}</svg></g>}
const subscribe=()=>()=>{}
export default function ObservatoryPreview(){
 const ready=useSyncExternalStore(subscribe,()=>true,()=>false)
 const [focus,setFocus]=useState('full'),[mobile,setMobile]=useState(false),[group,setGroup]=useState('B'),[block,setBlock]=useState(1)
 const [on,setOn]=useState({environment:true,markers:true,player:true,grid:false,collision:false,foreground:true,fgGuide:false,clearance:false,grayscale:false,emissive:true})
 const camera=cameraFor(focus,mobile), counts=SOUND_AUDIT.groups[group].blocks
 const art=useMemo(()=>environment({foreground:on.foreground,emissive:on.emissive}),[on.foreground,on.emissive])
 const button=(text,active,action)=><button type="button" aria-pressed={active} onClick={action}>{text}</button>
 const active=counts[block-1],done=counts.slice(0,block-1).reduce((a,b)=>a+b,0),locked=counts.slice(block).reduce((a,b)=>a+b,0)
 return <main className={styles.page}>
  <header><span className={styles.eyebrow}>SOUND VILLAGE / ART STUDY 02A</span><h1>소리 관측소</h1><p>원본의 석재·황동·청록 유리를 LAB-1 동선에 맞춘 시각 preview</p><span className={styles.badge}>PREVIEW ONLY · production 미적용</span></header>
  <nav aria-label="카메라 위치">{Object.keys(FOCUS).map(k=><span key={k}>{button(labels[k],focus===k,()=>setFocus(k))}</span>)}</nav>
  <div className={styles.layout}><section className={styles.mapPanel}>
   <div className={styles.meta}><span>{focus==='full'?'전체 맵 · 48×36':`${mobile?'Mobile · 18×12':'Desktop · 24×18'}`} tiles</span><span>32 px / tile · 캐릭터 72×88 px</span></div>
   <svg className={styles.map} role="img" aria-label="관측소 좌표 기반 시각 preview" data-focus={focus} viewBox={camera.join(' ')} style={{aspectRatio:`${camera[2]} / ${camera[3]}`,filter:on.grayscale?'grayscale(1)':'none'}}>
    <rect width="1536" height="1152" fill="#142430"/>
    {ready&&on.environment&&<g dangerouslySetInnerHTML={{__html:art}}/>}
    {on.markers&&Object.entries(SAFE_SLOTS).flatMap(([b,ss])=>ss.slice(0,counts[Number(b)-1]).map((s,i)=>{const state=+b<block?'done':+b===block?'active':'locked';const color=state==='active'?'#fff0a5':state==='done'?'#87a4ab':'#778490';return <g key={`${b}-${i}`} data-marker-state={state} transform={`translate(${(s.tx+.5)*32} ${(s.ty+.5)*32})`} opacity={state==='active'?1:state==='done'?.58:.3}>
     <circle r={14} fill="#142630" stroke={color} strokeWidth={2}/>{state==='active'&&<circle r={20} fill="none" stroke="#f2faf2" strokeWidth={2}/>}<path d={state==='done'?'M-6 0l4 4 8-9':state==='locked'?'M-4-1v-4a4 4 0 0 1 8 0v4M-5 0h10v7H-5Z':'M-7 0h3l2-5 4 10 2-5h3'} fill="none" stroke={color} strokeWidth={2}/></g>}))}
    {on.player&&<Player point={PLAYER_POINTS[focus]}/>}
    {on.grid&&<g data-layer="grid" opacity=".22">{Array.from({length:49},(_,i)=><path key={`x${i}`} d={`M${i*32} 0v1152`} stroke="#c1e4e4"/>)}{Array.from({length:37},(_,i)=><path key={`y${i}`} d={`M0 ${i*32}h1536`} stroke="#c1e4e4"/>)}</g>}
    {on.collision&&<g data-layer="collision" fill="#f57c7c" fillOpacity=".28" stroke="#f8a5a5" strokeWidth={1}>{collisionCells.map(p=><rect key={`${p.x}-${p.y}`} x={p.x*32} y={p.y*32} width={32} height={32}/>)}</g>}
    {on.fgGuide&&<g data-layer="foreground-guide" fill="#d7a9ff" fillOpacity=".23" stroke="#dfbafa" strokeDasharray="8 4">{FOREGROUND_ZONES.map(s=><rect key={s.id} {...rect(s)}/>)}</g>}
    {on.clearance&&<g data-layer="clearance" fill="#8ef1c8" fillOpacity=".06" stroke="#94e6c8" strokeWidth={1}>{Object.values(SAFE_SLOTS).flat().map(s=><rect key={`${s.tx}-${s.ty}`} x={(s.tx-1)*32} y={(s.ty-1)*32} width={96} height={96}/>)}{Object.values(STRUCTURES).map(s=><rect key={s.label} {...rect(s.approach)} fillOpacity=".22" strokeWidth={3}/>)}</g>}
   </svg>
   <p className={styles.caption}>카메라 비교용 캐릭터는 선택한 접근점에 정적으로 놓입니다. 이동·출입·소리 재생 기능은 연결하지 않았습니다.</p>
  </section><aside>
   <h2>카메라 / 상태</h2><div className={styles.controls}>{button('Desktop · 24×18',!mobile,()=>setMobile(false))}{button('Mobile · 18×12',mobile,()=>setMobile(true))}{['A','B'].map(g=><span key={g}>{button(`Group ${g}`,g===group,()=>setGroup(g))}</span>)}</div>
   <div className={styles.controls}>{[1,2,3,4,5,6].map(b=><span key={b}>{button(`Block ${b}`,block===b,()=>setBlock(b))}</span>)}</div>
   <p data-testid="counts">활성 {active} · 완료 {done} · 잠금 {locked}<br/>Group {group} 합계 {active+done+locked}</p>
   <h2>레이어 / 검수</h2><div className={styles.controls}>{Object.entries(toggles).map(([k,label])=><span key={k}>{button(label,on[k],()=>setOn(v=>({...v,[k]:!v[k]})))}</span>)}</div>
   <p>정적 검증 {WHITEBOX_VALIDATION.pass?'PASS':'FAIL'} · 후보 slot 108개<br/>A 84 / B 85를 각각 수용</p><p className={styles.note}>Foreground는 실제 장식, Foreground guide는 LAB-1 후보 영역입니다. 가이드 일부가 통행로 위에 있어 실제 장식은 충돌 영역 안으로 제한했습니다.</p>
   <p className={styles.note}>저녁 관측소 조도 제안: 중간 명도의 길과 작은 따뜻한 조명. 좌표 기반 바닥·마스크에 생성 시안의 구조물 부분만 맞춘 혼합 preview입니다. 최종 분리 에셋이 아니며 Emissive off도 원본 재료에 남은 조명색까지 제거하지 않습니다.</p>
  </aside></div>
 </main>
}
