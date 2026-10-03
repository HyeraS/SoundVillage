'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useKeys, SPEED } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, DPad, CompleteModal, ExitConfirmModal } from '@/components/ZoneMap'
import { buildVillage, spawnLabItems, moveWithCollision, SPAWN, overlapsExit, canCollect, regionProgress } from '@/lib/labVillageConfig.mjs'
import { loadLabVillage, renderLabScene, labCamera } from '@/lib/labVillage'
import styles from './LabZoneMap.module.css'
import { trackEvent } from '@/lib/userEvents'

const clearKeys=keys=>{for(const k of Object.keys(keys.current))keys.current[k]=false}
const LAB_PLAYER_SIZE=64
const INTERACTION_RADIUS=48
export default function LabZoneMap({ sounds, onCollectSound, onExit, collectedIds=new Set(), isAnnotating=false, blockNum=1, blockTotal=1, outfitSrc, accessorySrc, characterLoadout }) {
 const stageRef=useRef(null),backRef=useRef(null),frontRef=useRef(null),playerRef=useRef(null)
 const viewportRef=useRef({width:1,height:1,dpr:1})
 const village=useMemo(()=>buildVillage(),[])
 const runtime=useRef({pos:{...SPAWN},dir:'down',moving:false,mode:'move',selected:null,ignore:null,inExit:false,items:[],village})
 const live=useRef({isAnnotating,blockNum,collectedIds,onCollectSound,onExit})
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(null),[modal,setModal]=useState(null),[nearby,setNearby]=useState(null)
 const [animation,setAnimation]=useState({dir:'down',moving:false,tick:0})
 const signature=sounds.map(s=>`${s.sound_id}:${s.block||1}`).sort().join('|')
 const collected=sounds.filter(s=>collectedIds.has(s.sound_id)).length
 const complete=sounds.length>0&&collected===sounds.length
 const {keys,press,release}=useKeys({disabled:isAnnotating||!!modal||complete,screen:'zone',zone:'Lab'})
 useEffect(()=>{
   live.current={isAnnotating,blockNum,collectedIds,onCollectSound,onExit,complete}
   if(isAnnotating||complete)clearKeys(keys)
   if(!isAnnotating&&runtime.current.mode==='annotation')runtime.current.mode='move'
 },[isAnnotating,blockNum,collectedIds,onCollectSound,onExit,complete,keys])
 useEffect(()=>{
   let cancelled=false
   loadLabVillage().then(assets=>{
     if(cancelled)return
     const r=runtime.current;r.village.regionProgress=regionProgress(sounds);r.items=spawnLabItems(sounds,r.village);r.pos={...SPAWN};r.mode='move';r.selected=null;r.ignore=null;setNearby(null)
     setError(null);setLoaded(assets)
   }).catch(e=>{if(!cancelled){runtime.current.mode='error';runtime.current.items=[];setLoaded(null);setError(e.message)}})
   return()=>{cancelled=true}
 // signature includes every identity and block; collection/progress must not reset positions.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[signature])
 const openExit=()=>{
   const r=runtime.current
   if(live.current.isAnnotating||r.mode==='annotation')return
   clearKeys(keys);r.mode='exit';r.selected=null;setNearby(null);setModal({type:'exit'})
 }
 const cancelModal=()=>{
   const r=runtime.current
   if(r.selected)r.ignore=r.selected.id
   r.mode='move';r.selected=null;clearKeys(keys);setModal(null)
 }
 const confirmCollect=()=>{
   const r=runtime.current,l=live.current,item=r.selected
   if(r.mode!=='move'||l.isAnnotating||!canCollect(item,l.blockNum,l.collectedIds))return
   r.mode='annotation';r.ignore=item.id;r.selected=null;setNearby(null);clearKeys(keys);l.onCollectSound(item.sound)
 }
 const confirmExit=()=>{if(runtime.current.mode!=='exit')return;runtime.current.mode='leaving';clearKeys(keys);live.current.onExit()}
 useEffect(()=>{
   const reset=()=>clearKeys(keys)
   const handler=e=>{
     const r=runtime.current,l=live.current
     if(l.isAnnotating||r.mode==='annotation'||r.mode==='leaving')return
     const tag=e.target?.tagName
     if(tag==='INPUT'||tag==='TEXTAREA'||e.target?.isContentEditable)return
     if(e.repeat)return
     if(e.key==='Escape'){e.preventDefault();if(r.mode==='move')openExit();else cancelModal()}
     else if(e.key==='Enter'){if(r.mode==='move'&&r.selected){e.preventDefault();confirmCollect()}else if(r.mode==='exit'){e.preventDefault();confirmExit()}}
   }
   window.addEventListener('keydown',handler);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset)
   return()=>{window.removeEventListener('keydown',handler);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);reset()}
 // Functions read only stable refs and React state setters.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[])
 useEffect(()=>{
   if(!loaded)return
   const stage=stageRef.current,back=backRef.current,front=frontRef.current
   const resize=()=>{
     const width=Math.max(1,Math.round(stage.clientWidth)),height=Math.max(1,Math.round(stage.clientHeight)),dpr=Math.min(3,Math.max(1,window.devicePixelRatio||1))
     viewportRef.current={width,height,dpr}
     for(const c of [back,front]){c.width=Math.max(1,Math.round(width*dpr));c.height=Math.max(1,Math.round(height*dpr))}
   }
   resize();const ro=new ResizeObserver(resize);ro.observe(stage)
   let raf,last=performance.now(),lastAnim=0
   const loop=now=>{
     const r=runtime.current,l=live.current,dt=Math.min((now-last)/16.667,6);last=now
     const blocked=l.isAnnotating||l.complete||r.mode!=='move'
     let dx=0,dy=0,dir=r.dir
     if(!blocked){
       const k=keys.current
       if(k.up){dy--;dir='up'}if(k.down){dy++;dir='down'}if(k.left){dx--;dir='left'}if(k.right){dx++;dir='right'}
       const norm=Math.hypot(dx,dy)||1,next=moveWithCollision(r.village,r.pos,dx/norm*SPEED*dt,dy/norm*SPEED*dt,l.blockNum)
       r.moving=Math.hypot(next.x-r.pos.x,next.y-r.pos.y)>.01;r.pos=next;r.dir=dir
       if(r.ignore){const item=r.items.find(i=>i.id===r.ignore);if(!item||Math.hypot(item.x-r.pos.x,item.y-r.pos.y)>54)r.ignore=null}
       const near=r.items.filter(i=>i.id!==r.ignore&&canCollect(i,l.blockNum,l.collectedIds)&&Math.hypot(i.x-r.pos.x,i.y-r.pos.y)<INTERACTION_RADIUS).sort((a,b)=>Math.hypot(a.x-r.pos.x,a.y-r.pos.y)-Math.hypot(b.x-r.pos.x,b.y-r.pos.y))[0]||null
       if((r.selected?.id||null)!==(near?.id||null)){
         r.selected=near;setNearby(near)
       }
       if(near&&stage.dataset.nearbyItem!==near.id){
         const payload={screen:'zone',zone:'Lab',sound_id:near.sound?.sound_id,target_type:'sound_collectible',target_id:near.sound?.sound_id||near.id}
         trackEvent('collectible_approached',payload);trackEvent('collectible_prompt_shown',payload)
       }
       stage.dataset.nearbyItem=near?.id||''
       const inExit=overlapsExit(r.pos)
       if(inExit&&!r.inExit&&r.mode==='move'){r.mode='exit';clearKeys(keys);setModal({type:'exit'})}
       r.inExit=inExit
     }else{r.moving=false;clearKeys(keys)}
     if(now-lastAnim>90){setAnimation({dir:r.dir,moving:r.moving,tick:Math.floor(now/100)*6});lastAnim=now}
     const viewport=viewportRef.current,camera={...labCamera(viewport.width,viewport.height,r.pos),dpr:viewport.dpr}
     renderLabScene(back.getContext('2d'),front.getContext('2d'),loaded,r.items,r.pos,now,l.blockNum,l.collectedIds,camera,r.village.regionProgress,r.selected?.id||null)
     if(playerRef.current){const el=playerRef.current;el.style.left=`${Math.round(camera.ox+(r.pos.x-LAB_PLAYER_SIZE/2-camera.x)*camera.zoom)}px`;el.style.top=`${Math.round((r.pos.y-LAB_PLAYER_SIZE-camera.y)*camera.zoom)}px`;el.style.transform=`scale(${camera.zoom})`}
     // Read-only DOM diagnostics for QA; no production teleport/unlock hooks.
     stage.dataset.playerX=r.pos.x.toFixed(2);stage.dataset.playerY=r.pos.y.toFixed(2);stage.dataset.mode=r.mode;stage.dataset.direction=r.dir
     raf=requestAnimationFrame(loop)
   }
   raf=requestAnimationFrame(loop)
   return()=>{cancelAnimationFrame(raf);ro.disconnect()}
 },[loaded,keys])
 return <div className={styles.root} data-testid="lab-village" data-map="teal-witch-lanes" data-item-count={sounds.length}>
   <div className={styles.hud}><ZoneHUD zone="Lab" collected={collected} total={sounds.length} onExit={openExit} blockNum={blockNum} blockTotal={blockTotal}/></div>
   <div ref={stageRef} className={styles.stage} data-testid="lab-stage" role="application" aria-label="청록빛 마녀 골목. 방향키 또는 WASD로 이동, 소리에 다가가 Enter로 선택">
     <canvas ref={backRef} className={styles.canvas}/>
     <div ref={playerRef} className={styles.player} style={{width:LAB_PLAYER_SIZE,height:LAB_PLAYER_SIZE}} data-animation-tick={animation.tick}><PixelChar dir={animation.dir} moving={animation.moving} animationTick={animation.tick} displayWidth={LAB_PLAYER_SIZE} displayHeight={LAB_PLAYER_SIZE} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout}/></div>
     <canvas ref={frontRef} className={`${styles.canvas} ${styles.foreground}`}/>
     {!loaded&&!error&&<div className={styles.status} role="status">청록빛 마녀 골목 불러오는 중…</div>}
     {error&&<div className={styles.status} role="alert"><p>{error}</p><button onClick={onExit}>월드맵으로 돌아가기</button></div>}
   </div>
   <div className={styles.controls} aria-hidden={!!modal||isAnnotating||complete} inert={!!modal||isAnnotating||complete}>
     <DPad press={(direction,interactionMethod)=>{if(runtime.current.mode==='move'&&!live.current.isAnnotating)press(direction,interactionMethod)}} release={release} onExit={openExit} onConfirm={nearby?confirmCollect:null}/>
   </div>
   <div className={styles.legend}>청록빛 마녀 골목 <span>· 빛나는 소리 가까이에서 Enter</span></div>
   {nearby&&!isAnnotating&&!modal&&<div className={styles.interactionPrompt} role="status"><kbd>Enter ↵</kbd><span>이 소리 전사하기</span></div>}
   {modal?.type==='exit'&&!isAnnotating&&<div className={styles.exitDialog} role="dialog" aria-modal="true" aria-label="월드맵으로 돌아가기"><ExitConfirmModal zone="Lab" onConfirm={confirmExit} onCancel={cancelModal}/></div>}
   {complete&&!isAnnotating&&<CompleteModal zone="Lab" onExit={onExit}/>}
 </div>
}
