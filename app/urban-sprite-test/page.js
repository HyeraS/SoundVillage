'use client'
import { URBAN_TRANSIT, URBAN_EDGE, URBAN_LANDMARKS } from '@/components/AssetRegistry'

// 격리 스프라이트 진단 페이지 — 지도 배치/카메라/다른 오브젝트와 완전히 분리된
// 빈 배경 위에 URBAN_TRANSIT 스프라이트 각각을 크게 그려서, "크롭 좌표 자체가
// 잘못됐는지(스프라이트가 원래 잘려있음)" vs "배치/뷰포트 문제로 잘려 보이는
// 것뿐인지"를 구분한다. ZoneMap.js의 LabSprite와 완전히 같은 기법(중첩 SVG +
// viewBox)을 그대로 복제해서 쓴다 — 렌더링 기법 자체의 버그도 함께 잡기 위함.
function Sprite({ sprite, scale = 6 }) {
  const { src, sheetW, sheetH, x, y, w, h } = sprite
  return (
    <svg width={w * scale} height={h * scale}
      viewBox={`${x} ${y} ${w} ${h}`} style={{ overflow: 'hidden', border: '2px solid red' }}>
      <image href={src} width={sheetW} height={sheetH} style={{ imageRendering: 'pixelated' }}/>
    </svg>
  )
}

function Item({ label, sprite, scale }) {
  return (
    <div style={{ display: 'inline-block', margin: 16, textAlign: 'center' }}>
      <div style={{ color: '#fff', fontFamily: 'monospace', marginBottom: 8 }}>
        {label} — x:{sprite.x} y:{sprite.y} w:{sprite.w} h:{sprite.h}
      </div>
      <div style={{ background: '#2a7a2a', display: 'inline-block' }}>
        <Sprite sprite={sprite} scale={scale}/>
      </div>
    </div>
  )
}

export default function UrbanSpriteTestPage() {
  return (
    <div style={{ background: '#111', minHeight: '100vh', padding: 24 }}>
      <Item label="busStop" sprite={URBAN_TRANSIT.busStop}/>
      <Item label="ticketBooth" sprite={URBAN_TRANSIT.ticketBooth}/>
      {URBAN_TRANSIT.bus.map((s, i) => (
        <Item key={i} label={`bus[${i}]`} sprite={s}/>
      ))}
      <Item label="fenceRail" sprite={URBAN_EDGE.fenceRail}/>
      <Item label="fencePost" sprite={URBAN_EDGE.fencePost}/>
      {/* 한 줄로 5개 반복 타일링했을 때 진짜 이음매 없이 이어지는지도 같이 확인 */}
      <div style={{ display: 'inline-block', margin: 16, textAlign: 'center' }}>
        <div style={{ color: '#fff', fontFamily: 'monospace', marginBottom: 8 }}>fenceRail ×5 반복</div>
        <div style={{ background: '#2a7a2a', display: 'flex' }}>
          {[0,1,2,3,4].map(i => <Sprite key={i} sprite={URBAN_EDGE.fenceRail}/>)}
        </div>
      </div>
      <Item label="stationCanopy" sprite={URBAN_LANDMARKS.stationCanopy} scale={3}/>
      <Item label="trainEngine" sprite={URBAN_LANDMARKS.trainEngine} scale={3}/>
      <Item label="supam" sprite={URBAN_LANDMARKS.supam} scale={2}/>
    </div>
  )
}
