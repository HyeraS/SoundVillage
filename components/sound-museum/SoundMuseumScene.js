'use client'

import SoundMuseumObject from '@/components/sound-museum/SoundMuseumObject'
import {
  EXHIBIT_ZONES,
  LISTENING_STATIONS,
  MUSEUM_ASSETS,
  MUSEUM_COLLISIONS,
  MUSEUM_INTERACTIONS,
} from '@/lib/soundMuseumFinalBLayout.mjs'

function assetFootY(asset) {
  const rects = asset.collision ? (Array.isArray(asset.collision) ? asset.collision : [asset.collision]) : []
  return rects.length ? Math.max(...rects.map(rect => rect.y + rect.height)) : asset.y + asset.displayHeight
}

function ExhibitStateLights({ zoneCounts }) {
  return EXHIBIT_ZONES.map(item => {
    const collected = zoneCounts?.[item.zone]?.collected ?? 0
    const total = zoneCounts?.[item.zone]?.total ?? 0
    const complete = total > 0 && collected >= total
    const color = complete ? '#F6C85B' : collected > 0 ? '#73CDB8' : '#7D6650'
    return <span key={item.id} data-exhibit-state={item.zone} style={{ position:'absolute', left:item.x, top:item.y, width:10, height:10, borderRadius:'50%', background:color, border:'2px solid #3E2918', boxShadow:complete ? `0 0 12px 5px ${color}aa` : collected > 0 ? `0 0 8px 3px ${color}77` : 'none', zIndex:8, pointerEvents:'none' }}/>
  })
}

function StationLights({ activeStations }) {
  const anchors = [
    { x:228, y:520 }, { x:321, y:520 }, { x:414, y:520 },
    { x:166, y:407 }, { x:166, y:484 },
  ]
  return anchors.map((anchor, index) => {
    const active = index < activeStations
    return <span key={LISTENING_STATIONS[index].id} data-listening-station={index + 1} style={{ position:'absolute', left:anchor.x, top:anchor.y, width:13, height:7, borderRadius:'50%', background:active ? '#F6C85B' : '#675544', opacity:active ? 1 : .55, boxShadow:active ? '0 0 13px 5px #F6C85B99' : 'none', zIndex:8, pointerEvents:'none' }}/>
  })
}

function QaOverlay({ mode }) {
  if (!mode || mode === 'clean') return null
  const showBounds = mode === 'depth'
  const showCollisions = mode === 'collision' || mode === 'depth'
  const showInteractions = mode === 'interactions'
  return <div aria-hidden="true" style={{ position:'absolute', inset:0, zIndex:90, pointerEvents:'none', font:'700 11px/1 monospace' }}>
    {showBounds && MUSEUM_ASSETS.filter(asset => asset.zMode !== 'fixed').map(asset => <div key={asset.id} style={{ position:'absolute', left:asset.x, top:asset.y, width:asset.displayWidth, height:asset.displayHeight, border:`2px solid ${asset.zMode === 'foreground' ? '#ff47e6' : '#42f5e9'}`, color:'#fff', background:'#0002' }}><span style={{ background:'#000b' }}>{asset.id} · {asset.zMode}</span><i style={{ position:'absolute', left:0, right:0, top:assetFootY(asset) - asset.y, borderTop:'2px dashed #fff' }}/></div>)}
    {showCollisions && MUSEUM_COLLISIONS.map(rect => <div key={rect.id} style={{ position:'absolute', left:rect.x, top:rect.y, width:rect.width, height:rect.height, border:'2px solid #ff3b30', background:'#ff3b3028', color:'#fff' }}>{rect.id}</div>)}
    {showInteractions && MUSEUM_INTERACTIONS.map(zone => <div key={zone.id} style={{ position:'absolute', left:zone.x, top:zone.y, width:zone.width, height:zone.height, border:'2px solid #ffd60a', background:'#ffd60a2e', color:'#fff' }}>{zone.id}</div>)}
  </div>
}

export default function SoundMuseumScene({ playerNode, playerFootY, animationTick, activeStations = 0, zoneCounts = {}, qaMode = 'clean' }) {
  const fixed = MUSEUM_ASSETS.filter(asset => asset.zMode === 'fixed')
  const foreground = MUSEUM_ASSETS.filter(asset => asset.zMode === 'foreground')
  const depth = MUSEUM_ASSETS.filter(asset => asset.zMode === 'footY').map(asset => ({
    id: asset.id,
    sortY: assetFootY(asset),
    node: <SoundMuseumObject key={asset.id} asset={asset} animationTick={animationTick} qa={qaMode === 'depth'}/>,
  }))
  depth.push({ id:'player', sortY:playerFootY, node:playerNode })
  depth.sort((a, b) => a.sortY - b.sortY || a.id.localeCompare(b.id))

  return <>
    {fixed.map(asset => <SoundMuseumObject key={asset.id} asset={asset} animationTick={animationTick}/>) }
    <ExhibitStateLights zoneCounts={zoneCounts}/>
    <StationLights activeStations={activeStations}/>
    {depth.map(item => item.node)}
    {foreground.map(asset => <SoundMuseumObject key={asset.id} asset={asset} animationTick={animationTick} qa={qaMode === 'depth'}/>) }
    <QaOverlay mode={qaMode}/>
  </>
}

