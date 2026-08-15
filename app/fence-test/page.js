'use client'

// 격리된 울타리 조립 테스트 — 마을 코드는 건드리지 않는다.
//
// 1차 시도에서 세로 구간이 깨졌던 원인: 원본 시트(864x800) 전체를 SVG viewBox로
// 크롭해서 보여주는 방식에서 그 크롭 "창"째로 회전시켰더니, 회전 중심 주변의
// 옆 타일 내용까지 함께 돌아 들어와 버렸다(시트 참조를 끊지 않은 채 회전).
// 이번엔 각 조각을 먼저 독립된 PNG 파일로 완전히 잘라낸 뒤(오프스크린이 아니라
// 실제 파일로 분리 — public/assets/world/fence_test/*.png, generate_fence_test_assets.py
// 참고) 그 "이미 시트 참조가 끊긴" 이미지에 CSS transform: rotate()만 적용한다.
const TILE = 32
const RENDER = 48

const ISO = {
  straight: '/assets/world/fence_test/straight_isolated.png',
  gate: '/assets/world/fence_test/gate_isolated.png',
  corner: '/assets/world/fence_test/corner_isolated.png',
  post: '/assets/world/fence_test/post_isolated.png',
}

// srcW: 원본 조각의 실제 가로 픽셀(기본 32). post는 16px짜리라 정사각 칸
// 안에서 폭만 절반으로 그리고 가운데 정렬한다.
function Piece({ tx, ty, src, srcW = 32 }) {
  const w = RENDER * (srcW / 32)
  return (
    <img
      src={src}
      alt=""
      style={{
        position: 'absolute',
        left: tx * RENDER + (RENDER - w) / 2, top: ty * RENDER,
        width: w, height: RENDER,
        imageRendering: 'pixelated',
      }}
    />
  )
}

export default function FenceTestPage() {
  const originX = 2, originY = 3
  const runLength = 10
  const gateIndex = 5

  const cells = []
  for (let i = 0; i < runLength; i++) {
    cells.push(
      <Piece key={`h${i}`} tx={originX + i} ty={originY}
        src={i === gateIndex ? ISO.gate : ISO.straight} />
    )
  }
  const cornerX = originX + runLength
  cells.push(<Piece key="corner" tx={cornerX} ty={originY} src={ISO.corner} />)
  // 세로 구간 — 분리된 이미지로 회전시켜도 레일 스프라이트가 타일 중심에
  // 딱 맞게 대칭이 아니라서(좌우로 넓고 상하로는 안쪽에 치우침) 여전히 어긋남.
  // 회전을 억지로 고집하지 않고, 기둥(post) 조각을 방향 상관없이 그대로
  // 반복하는 방식으로 폴백(post 원본이 16px짜리라 srcW=16로 절반 폭만 사용).
  cells.push(<Piece key="v1" tx={cornerX} ty={originY + 1} src={ISO.post} srcW={16} />)
  cells.push(<Piece key="v2" tx={cornerX} ty={originY + 2} src={ISO.post} srcW={16} />)

  const mapW = 16, mapH = 8

  return (
    <div style={{ background: '#83924C', minHeight: '100vh', fontFamily: 'Nunito, sans-serif' }}>
      {/* 1. 게이트 조각 단독 확인 — 카탈로그 좌표 추측 말고 실물을 크게 띄워서 눈으로 판단 */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ color: '#2A2214', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          1. 게이트 후보 조각 단독 확인 — (0,448,32,32), 12배 확대, 회전/합성 없음
        </div>
        <div style={{
          width: 32 * 12, height: 32 * 12, background: '#83924C',
          border: '2px dashed #4A3826', display: 'inline-block',
        }}>
          <img src={ISO.gate} alt="gate candidate" width={32 * 12} height={32 * 12}
            style={{ imageRendering: 'pixelated', display: 'block' }} />
        </div>
      </div>

      {/* 2. 가로 10칸(+게이트) + 90도 코너 3칸 */}
      <div style={{ padding: 20 }}>
        <div style={{ color: '#2A2214', fontSize: 13, fontWeight: 700, margin: '20px 0 8px' }}>
          2. 가로 10칸(게이트 1개 포함) + 90&deg; 코너 3칸 — 세로는 기둥(post) 반복 폴백
        </div>
        <div style={{ position: 'relative', width: mapW * RENDER, height: mapH * RENDER, background: '#83924C' }}>
          {cells}
        </div>
      </div>
    </div>
  )
}
