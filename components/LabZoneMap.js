'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useKeys, SPEED } from '@/components/GameEngine'
import { PixelChar, ZoneHUD, DPad, CompleteModal, ExitConfirmModal } from '@/components/ZoneMap'
import { buildVillage, spawnLabItems, moveWithCollision, overlapsExit, canCollect, regionProgress } from '@/lib/labVillageConfig.mjs'
import { loadLabVillage, renderLabScene, labCamera } from '@/lib/labVillage'
import styles from './LabZoneMap.module.css'
import { trackEvent } from '@/lib/userEvents'
import { CHARACTER_RENDER_SIZE, getCharacterRenderMetrics, placeCharacterAtScreenFoot } from '@/lib/characterRenderMetrics.mjs'
import { useWalkFrame } from '@/components/useWalkFrame'
import { getVillageRuntimeManifest } from '@/lib/villageRuntimeManifest.mjs'
import { basePointToCurrent, currentPointToBase } from '@/lib/villageWorldTransform.mjs'

const clearKeys=keys=>{for(const k of Object.keys(keys.current))keys.current[k]=false}
const LAB_PLAYER_W=CHARACTER_RENDER_SIZE.width
const LAB_PLAYER_H=CHARACTER_RENDER_SIZE.height
const INTERACTION_RADIUS=48
export default function LabZoneMap({ sounds, onCollectSound, onExit, collectedIds=new Set(), isAnnotating=false, blockNum=1, blockTotal=1, outfitSrc, accessorySrc, characterLoadout, debugFirstItem=false, debugStart=null, debugCollision=false, currentWorldWidth=getVillageRuntimeManifest('lab').baseWorldWidth, currentWorldHeight=getVillageRuntimeManifest('lab').baseWorldHeight }) {
 const stageRef=useRef(null),backRef=useRef(null),frontRef=useRef(null),playerRef=useRef(null)
 const viewportRef=useRef({width:1,height:1,dpr:1})
 const worldSize=useMemo(()=>({currentWorldWidth,currentWorldHeight}),[currentWorldWidth,currentWorldHeight])
 const village=useMemo(()=>buildVillage([],worldSize),[worldSize])
 const runtime=useRef({pos:{...village.spawn},dir:'down',moving:false,mode:'move',selected:null,ignore:null,inExit:false,items:[],village})
 const live=useRef({isAnnotating,blockNum,collectedIds,onCollectSound,onExit})
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(null),[modal,setModal]=useState(null),[nearby,setNearby]=useState(null)
 const [animation,setAnimation]=useState({dir:'down',moving:false})
 const animationRef=useRef(animation)
 const frameIndex=useWalkFrame(animation.moving)
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
     const r=runtime.current
     r.village={...village,regionProgress:regionProgress(sounds)}
     const baseVillage=buildVillage(sounds)
     r.items=spawnLabItems(sounds,baseVillage).map(item=>({...item,...basePointToCurrent(item,village.transform)}))
     r.pos=debugStart&&Number.isFinite(debugStart.x)&&Number.isFinite(debugStart.y)
       ?basePointToCurrent(debugStart,village.transform)
       :debugFirstItem&&r.items[0]?{x:r.items[0].x,y:r.items[0].y}:{...village.spawn};r.mode='move';r.selected=null;r.ignore=null;setNearby(null)
     setError(null);setLoaded(assets)
   }).catch(e=>{if(!cancelled){runtime.current.mode='error';runtime.current.items=[];setLoaded(null);setError(e.message)}})
   return()=>{cancelled=true}
 // signature includes every identity and block; collection/progress must not reset positions.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[debugFirstItem,debugStart,signature,village])
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
   let raf,last=performance.now()
   const loop=now=>{
     const r=runtime.current,l=live.current,dt=Math.min((now-last)/16.667,6);last=now
     const blocked=l.isAnnotating||l.complete||r.mode!=='move'
     let dx=0,dy=0,dir=r.dir
     if(!blocked){
       const k=keys.current
       if(k.up){dy--;dir='up'}if(k.down){dy++;dir='down'}if(k.left){dx--;dir='left'}if(k.right){dx++;dir='right'}
       const hasMovementInput=dx!==0||dy!==0
       const norm=Math.hypot(dx,dy)||1,next=moveWithCollision(r.village,r.pos,
         dx/norm*SPEED*dt*r.village.transform.scaleX,
         dy/norm*SPEED*dt*r.village.transform.scaleY,l.blockNum)
       r.moving=Math.hypot(next.x-r.pos.x,next.y-r.pos.y)>.01;r.pos=next;r.dir=dir
       const interactionScale=Math.max(r.village.transform.scaleX,r.village.transform.scaleY)
       if(r.ignore){const item=r.items.find(i=>i.id===r.ignore);if(!item||Math.hypot(item.x-r.pos.x,item.y-r.pos.y)>54*interactionScale)r.ignore=null}
       const near=r.items.filter(i=>i.id!==r.ignore&&canCollect(i,l.blockNum,l.collectedIds)&&Math.hypot(i.x-r.pos.x,i.y-r.pos.y)<INTERACTION_RADIUS*interactionScale).sort((a,b)=>Math.hypot(a.x-r.pos.x,a.y-r.pos.y)-Math.hypot(b.x-r.pos.x,b.y-r.pos.y))[0]||null
       if((r.selected?.id||null)!==(near?.id||null)){
         r.selected=near;setNearby(near)
       }
       if(near&&stage.dataset.nearbyItem!==near.id){
         const payload={screen:'zone',zone:'Lab',sound_id:near.sound?.sound_id,target_type:'sound_collectible',target_id:near.sound?.sound_id||near.id}
         trackEvent('collectible_approached',payload);trackEvent('collectible_prompt_shown',payload)
       }
       stage.dataset.nearbyItem=near?.id||''
       const inExit=overlapsExit(r.pos,worldSize)
       if(inExit&&!r.inExit&&r.mode==='move'){r.mode='exit';clearKeys(keys);setModal({type:'exit'})}
       r.inExit=inExit
       stage.dataset.movementBlocked=hasMovementInput&&!r.moving?'true':'false'
     }else{r.moving=false;stage.dataset.movementBlocked='false';clearKeys(keys)}
     if(animationRef.current.dir!==r.dir||animationRef.current.moving!==r.moving){
       animationRef.current={dir:r.dir,moving:r.moving};setAnimation(animationRef.current)
     }
     const viewport=viewportRef.current
     const basePosition=currentPointToBase(r.pos,r.village.transform)
     const camera={...labCamera(viewport.width,viewport.height,basePosition),dpr:viewport.dpr}
     const renderItems=r.items.map(item=>({...item,...currentPointToBase(item,r.village.transform)}))
     renderLabScene(back.getContext('2d'),front.getContext('2d'),loaded,renderItems,basePosition,now,l.blockNum,l.collectedIds,camera,r.village.regionProgress,r.selected?.id||null)
     if(debugCollision&&loaded.walkableMask){
       const overlay=front.getContext('2d');overlay.save();overlay.globalAlpha=.28;overlay.drawImage(loaded.walkableMask,0,0,r.village.baseWorldWidth,r.village.baseWorldHeight);overlay.restore()
       overlay.save();overlay.strokeStyle='#ff6370';overlay.fillStyle='#ff3c4644';overlay.lineWidth=2/camera.zoom
       for(const solid of r.village.solids){const x=solid.x/r.village.transform.scaleX,y=solid.y/r.village.transform.scaleY,w=solid.w/r.village.transform.scaleX,h=solid.h/r.village.transform.scaleY;overlay.fillRect(x,y,w,h);overlay.strokeRect(x,y,w,h)}
       overlay.strokeStyle='#fff45c';overlay.strokeRect(basePosition.x-10,basePosition.y-14,20,14);overlay.restore()
     }
     if(playerRef.current){
       const metrics=getCharacterRenderMetrics({stageWidth:viewport.width,stageHeight:viewport.height,sceneCameraScale:camera.zoom})
       const footX=camera.ox+(basePosition.x-camera.x)*camera.zoom,footY=camera.oy+(basePosition.y-camera.y)*camera.zoom
       const placement=placeCharacterAtScreenFoot(footX,footY,metrics),el=playerRef.current
       el.style.left=`${placement.left}px`;el.style.top=`${placement.top}px`;el.style.transform=`scale(${metrics.screenScale})`
       el.dataset.footScreenX=placement.footX.toFixed(2);el.dataset.footScreenY=placement.footY.toFixed(2)
     }
     // Read-only DOM diagnostics for QA; no production teleport/unlock hooks.
     stage.dataset.playerX=r.pos.x.toFixed(2);stage.dataset.playerY=r.pos.y.toFixed(2);stage.dataset.mode=r.mode;stage.dataset.direction=r.dir
     stage.dataset.worldWidth=String(r.village.currentWorldWidth);stage.dataset.worldHeight=String(r.village.currentWorldHeight)
     stage.dataset.worldScale=String(r.village.transform.scaleX);stage.dataset.maskSource=r.village.manifest.mask.src
     stage.dataset.generatedMask='true'
     raf=requestAnimationFrame(loop)
   }
   raf=requestAnimationFrame(loop)
   return()=>{cancelAnimationFrame(raf);ro.disconnect()}
 },[debugCollision,loaded,keys,worldSize])
 return <div className={styles.root} data-testid="lab-village" data-map="teal-witch-lanes" data-item-count={sounds.length}>
   <div className={styles.hud}><ZoneHUD zone="Lab" collected={collected} total={sounds.length} onExit={openExit} blockNum={blockNum} blockTotal={blockTotal}/></div>
   <div ref={stageRef} className={styles.stage} data-testid="lab-stage" role="application" aria-label="청록빛 마녀 골목. 방향키 또는 WASD로 이동, 소리에 다가가 Enter로 선택">
     <canvas ref={backRef} className={styles.canvas}/>
     <div ref={playerRef} className={styles.player} style={{width:LAB_PLAYER_W,height:LAB_PLAYER_H}} data-testid="lab-player" data-frame-index={frameIndex}><PixelChar dir={animation.dir} moving={animation.moving} frameIndex={frameIndex} displayWidth={LAB_PLAYER_W} displayHeight={LAB_PLAYER_H} outfitSrc={outfitSrc} accessorySrc={accessorySrc} characterLoadout={characterLoadout}/></div>
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
