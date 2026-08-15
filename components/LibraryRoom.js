'use client'
import { useEffect, useRef, useState } from 'react'
import { useKeys, overlaps } from '@/components/GameEngine'
import { ASSET_READY, WORLD_CHARACTER, LIBRARY_DECOR } from '@/components/AssetRegistry'

/* ─────────────────────────────────────────────
   Library 룸 — ZoneMap과 같은 "걸어다니는 공간 + AABB 충돌판정 + 근접
   상호작용(overlaps 체크 → 프롬프트 → Enter로 확정 → 멀어지면 자동 닫힘)"
   패턴이되, 스크롤 가능한 큰 맵이 아니라 뷰포트에 꽉 차는 방 하나뿐이라
   SVG 월드좌표계 대신 방의 실측 픽셀 크기(roomSize, ResizeObserver로 추적)를
   기준으로 물리 연산을 한다. 가구/상호작용 존 좌표는 방 크기에 대한 분수
   (0~1)로 정의해서 뷰포트 크기가 바뀌어도 항상 레퍼런스 비율을 유지한다.
   FURNITURE의 각 rect가 곧 "보이는 모습"이자 "부딪히는 충돌 박스"라 — 시각과
   판정이 어긋날 일이 없다.
───────────────────────────────────────────── */

const CHAR_W = 22
const CHAR_H = 28
const SPRITE_W = 72
const SPRITE_H = 88
const SPEED = 3.2

// 캐릭터가 절대 넘어갈 수 없는 방의 바깥 경계 — wallY보다 위(벽/천장)로는
// 가구 충돌판정 없이도 원천적으로 못 올라간다.
const BOUNDS = { minX: 0.02, maxX: 0.98, wallY: 0.10, maxY: 0.95 }

// 가구 충돌 박스 — x,y는 좌상단, w,h는 크기(전부 방 크기에 대한 분수).
// 보이는 그림(FurniturePiece)도 정확히 이 rect를 채우도록 그린다.
// fireplace/armchair 박스는 원본 스프라이트 비율(16:16, 19:15)에 맞춰뒀다 — objectFit:contain이
// 박스 안에서 여백 없이 꽉 차야 "보이는 그림 = 충돌 판정"이 실제로 성립한다(박스가 스프라이트보다
// 넓으면 캐릭터가 빈 공간에서 멈추는 것처럼 보임).
const FURNITURE = [
  { id: 'shelf-left',    type: 'shelf',     x: 0.03, y: 0.10, w: 0.17, h: 0.42 },
  { id: 'shelf-right',   type: 'shelf',     x: 0.80, y: 0.10, w: 0.17, h: 0.42 },
  { id: 'fireplace',     type: 'fireplace', x: 0.44, y: 0.13, w: 0.12, h: 0.21 },
  { id: 'armchair-left', type: 'armchair',  x: 0.315, y: 0.565, w: 0.086, h: 0.122, flip: false },
  { id: 'armchair-right',type: 'armchair',  x: 0.60,  y: 0.565, w: 0.086, h: 0.122, flip: true },
]
const RUG = { x: 0.26, y: 0.44, w: 0.48, h: 0.30 } // 장식 전용, 충돌 없음

const SPAWN = { xf: 0.5, yf: 0.84 }

// 근접 상호작용 존 — ZoneMap 소리 아이템과 같은 "캐릭터 히트박스와 overlaps()"
// 판정 대상. 가구 자체(FURNITURE)는 막혀서 절대 들어갈 수 없으므로, 존은
// 가구 앞의 "서서 상호작용하는 자리"를 감싸는 더 넓은 영역으로 따로 정의한다.
// 셋 다 서로 겹치지 않게(x/y 간격 확인됨) 배치해서 "지금 어느 존에 있는지"가
// 항상 하나로만 정해진다.
const INTERACTION_ZONES = [
  { id: 'vote',     card: 'vote',     prompt: '🕮 열람하기',      x: 0.34, y: 0.13, w: 0.32, h: 0.50 },
  { id: 'exhibits', card: 'exhibits', prompt: '📖 전시 현황 보기', x: 0.00, y: 0.08, w: 0.26, h: 0.50 },
  { id: 'shop',     card: 'shop',     prompt: '🛍️ 상점 열기',     x: 0.74, y: 0.08, w: 0.26, h: 0.50 },
]

// 카드 배치 — exhibits/shop은 여전히 뷰포트 하단부에 작게, 벽난로(y 0.13~0.34)/
// 책장(y 0.10~0.52)/안락의자(y 0.565~0.687)를 가리지 않는 y대(0.56 이후)에만.
// vote만 예외 — 투표는 후보 문구를 전부 읽고 비교해야 하는 작업이라 작은
// 구석 카드로는 스크롤 없인 다 안 보인다는 피드백으로, 화면 중앙을 거의
// 다 차지하는 큰 카드로 키웠다(방은 살짝 여백으로만 비치는 정도).
const CARD_LAYOUT = {
  // 가로:세로 ≈ 3:4(1280×800 기준폭 계산) — 세로는 그대로 두고 폭만 좁혔다.
  vote:     { x: 0.285, y: 0.04, w: 0.43, h: 0.92 },
  exhibits: { x: 0.02, y: 0.56, w: 0.28, h: 0.38 },
  shop:     { x: 0.70, y: 0.56, w: 0.28, h: 0.38 },
}

/* ── 책장 (CSS 아트) — 좌(전시현황)/우(상점) 팻말로 구분. 책등 색만으로는
   구분이 안 된다는 피드백 반영: 상단에 작은 나무 팻말(아이콘+라벨) 고정,
   상점 쪽엔 눈에 띄는 세일 리본을 코너에 하나 더 붙인다. ─────────────── */
function BookshelfArt({ side }) {
  const rows = 5
  const booksPerRow = 6
  const palette = ['#8B6347', '#4A9E38', '#D4A070', '#7A5230', '#4A6B27', '#C08040']
  const isShop = side === 'right'
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#3A2010',
      border: '2px solid #00000033',
      borderRadius: '3px',
      display: 'flex', flexDirection: 'column',
      boxShadow: 'inset 0 0 20px #00000066',
      overflow: 'visible',
    }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '3px' }}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} style={{
            flex: 1, display: 'flex', alignItems: 'flex-end', gap: '3%',
            padding: '4% 6% 0', borderBottom: '3px solid #00000055',
          }}>
            {Array.from({ length: booksPerRow }, (_, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${40 + ((i * 17 + r * 11) % 50)}%`,
                background: palette[(i + r * 2) % palette.length],
                borderRadius: '2px 2px 0 0',
                opacity: 0.85 + (i % 3) * 0.05,
              }}/>
            ))}
          </div>
        ))}
      </div>

      {/* 팻말 — 방 안에서 항상 보이는 영구 표지(디버그 라벨 아님) */}
      <div style={{
        position: 'absolute', top: '-11%', left: '50%', transform: 'translateX(-50%)',
        background: '#5A3A20', border: '1.5px solid #C8A96E', borderRadius: '6px',
        padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px',
        boxShadow: '0 2px 6px #00000055', whiteSpace: 'nowrap', zIndex: 2,
      }}>
        <span style={{ fontSize: '11px' }}>{isShop ? '🛍️' : '📖'}</span>
        <span style={{ fontSize: '8px', fontWeight: 800, color: '#FAF6EE', letterSpacing: '0.5px' }}>
          {isShop ? '상점' : '전시 현황'}
        </span>
      </div>

      {/* 상점 쪽만 — 세일 리본으로 한 번 더 구분 */}
      {isShop && (
        <div style={{
          position: 'absolute', top: '6%', right: '-8%', transform: 'rotate(18deg)',
          background: '#D4453A', color: '#FAF6EE', fontSize: '7px', fontWeight: 800,
          padding: '2px 10px', boxShadow: '0 2px 6px #00000055', letterSpacing: '0.5px', zIndex: 2,
        }}>SALE</div>
      )}
    </div>
  )
}

function FurniturePiece({ f }) {
  if (f.type === 'shelf') return <BookshelfArt side={f.id === 'shelf-left' ? 'left' : 'right'}/>
  if (f.type === 'fireplace') {
    const d = LIBRARY_DECOR.fireplace
    return (
      <img src={d.src} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', objectPosition: 'center bottom', imageRendering: 'pixelated',
      }}/>
    )
  }
  if (f.type === 'armchair') {
    const d = LIBRARY_DECOR.armchair
    return (
      <img src={d.src} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', imageRendering: 'pixelated',
        transform: f.flip ? 'scaleX(-1)' : 'none',
      }}/>
    )
  }
  return null
}

/* ── 캐릭터 — WorldMap/ZoneMap과 동일한 레이어 스프라이트(player_body/clothes/hair)를
   plain <img> 클리핑으로 재현. 이 파일은 ZoneMap.js를 건드리지 않기 위해 렌더링
   로직만 독립적으로 복제(게임플레이 로직과 무관한 순수 표시 코드). ───────────── */
function LibraryChar({ dir, moving }) {
  if (!ASSET_READY.world) return null
  const { frame: fs, rows, cols, layers } = WORLD_CHARACTER
  const row = rows[dir] ?? rows.down
  const walkTick = Math.floor(Date.now() / 100) % cols.length
  const srcCol = cols[moving ? walkTick : 0]
  const scaleX = SPRITE_W / fs, scaleY = SPRITE_H / fs
  return (
    <div style={{ position: 'relative', width: SPRITE_W, height: SPRITE_H, overflow: 'hidden' }}>
      {layers.map((L, i) => (
        <img key={i} src={L.src} alt=""
          style={{
            position: 'absolute',
            left: -srcCol * fs * scaleX,
            top: -row * fs * scaleY,
            width: L.sheetW * scaleX,
            height: L.sheetH * scaleY,
            imageRendering: 'pixelated',
          }}/>
      ))}
    </div>
  )
}

function collidesFurniture(px, py, W, H) {
  for (const f of FURNITURE) {
    const fx = f.x * W, fy = f.y * H, fw = f.w * W, fh = f.h * H
    if (overlaps(px, py, CHAR_W, CHAR_H, fx, fy, fw, fh)) return f
  }
  return null
}

// 캐릭터가 지금 어느 상호작용 존 안에 있는지 — ZoneMap의 소리 아이템 overlaps()
// 판정과 동일한 방식. 존끼리 겹치지 않게 배치해뒀으니 최대 1개만 반환된다.
function zoneAt(px, py, W, H) {
  for (const z of INTERACTION_ZONES) {
    const zx = z.x * W, zy = z.y * H, zw = z.w * W, zh = z.h * H
    if (overlaps(px, py, CHAR_W, CHAR_H, zx, zy, zw, zh)) return z
  }
  return null
}

// 실시간 rAF 루프와 헤드리스 동기 시뮬레이션이 물리 계산 하나를 공유—
// 두 경로의 충돌 결과가 어긋날 일이 없다. dt=1이면 "프레임 1개"만큼 이동.
function stepFrame({ x, y, dir, keysDown, W, H, dt = 1 }) {
  let newDir = dir, moved = false
  const spd = SPEED * dt
  let dx = 0, dy = 0
  if (keysDown.left)  { dx -= spd; newDir = 'left';  moved = true }
  if (keysDown.right) { dx += spd; newDir = 'right'; moved = true }
  if (keysDown.up)    { dy -= spd; newDir = 'up';    moved = true }
  if (keysDown.down)  { dy += spd; newDir = 'down';  moved = true }

  const minX = BOUNDS.minX * W, maxX = BOUNDS.maxX * W - CHAR_W
  const minY = BOUNDS.wallY * H, maxY = BOUNDS.maxY * H - CHAR_H

  let hit = null
  // x축 먼저 해석(원래 y로 검사) → 그다음 y축(해석된 x로 검사): 벽/가구를 따라
  // 미끄러지듯 이동(대각선 이동 시 한쪽 축만 막혀도 다른 축은 진행).
  let nx = Math.max(minX, Math.min(maxX, x + dx))
  const hitX = collidesFurniture(nx, y, W, H)
  if (!hitX) x = nx; else hit = hitX.id

  let ny = Math.max(minY, Math.min(maxY, y + dy))
  const hitY = collidesFurniture(x, ny, W, H)
  if (!hitY) y = ny; else hit = hitY.id || hit

  return { x, y, dir: newDir, moved, hit }
}

/* ── 카드 UI — 우드톤 반투명, 뷰포트의 작은 영역만 차지(CARD_LAYOUT). 지금은
   플레이스홀더 콘텐츠 — 실제 투표/전시/상점 로직(SoundMuseum.js)은 참여자
   ID·소리 데이터 등 실제 세션 컨텍스트가 필요해서 이 격리 테스트 페이지에는
   연결하지 않았다(연결 시 실제 Supabase 호출이 발생해 테스트 데이터가 생길
   위험도 있음) — 상호작용 방식·스타일 검증이 이번 단계의 목적. ────────────── */
function CardBody({ kind }) {
  if (kind === 'vote') {
    return (
      <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.6 }}>
        여기에 실제 투표 UI(파형 재생 · 표현 후보 · 동의 슬라이더)가 들어갑니다.
        <div style={{ opacity: 0.55, fontSize: 10, marginTop: 4 }}>— 다음 단계에서 기존 투표 로직과 연결 예정</div>
      </div>
    )
  }
  const rows = kind === 'exhibits'
    ? [['🐾 동물 마을', '3/8'], ['🌿 자연 마을', '5/8'], ['🎵 음악 마을', '1/8']]
    : [['👗 원피스 세트', '🪙 40'], ['🕶 선글라스', '🪙 15'], ['🎩 마법사 모자', '🪙 60']]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(([label, val]) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between', fontSize: 11,
          background: '#00000022', borderRadius: 8, padding: '6px 10px',
        }}>
          <span>{label}</span><span style={{ opacity: 0.7 }}>{val}</span>
        </div>
      ))}
    </div>
  )
}

const CARD_META = {
  vote:     { title: '🗳 오늘의 소리 투표', sub: 'VOTE' },
  exhibits: { title: '🏺 전시 현황',        sub: 'EXHIBITS' },
  shop:     { title: '🛍 옷가게',           sub: 'SHOP' },
}

function InfoCard({ kind, onClose }) {
  const layout = CARD_LAYOUT[kind]
  const meta = CARD_META[kind]
  return (
    <div style={{
      position: 'absolute',
      left: `${layout.x * 100}%`, top: `${layout.y * 100}%`,
      width: `${layout.w * 100}%`, height: `${layout.h * 100}%`,
      background: 'linear-gradient(180deg, rgba(74,50,24,0.92), rgba(42,26,10,0.94))',
      border: '3px solid #C8A96E', borderRadius: 16,
      boxShadow: '0 10px 40px #00000088, inset 0 0 0 1px #00000044',
      backdropFilter: 'blur(3px)',
      padding: '12px 16px', color: '#FAF6EE',
      fontFamily: 'Nunito, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 30, overflow: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, opacity: 0.6 }}>{meta.sub}</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{meta.title}</div>
        </div>
        <button onClick={onClose} style={{
          background: '#00000033', border: '1.5px solid #C8A96E77', borderRadius: 8,
          color: '#FAF6EE', width: 26, height: 26, cursor: 'pointer', fontSize: 13, fontWeight: 800,
          flexShrink: 0,
        }}>✕</button>
      </div>
      <CardBody kind={kind}/>
    </div>
  )
}

// cards: 선택. { vote:{render}, exhibits:{render}, shop:{render} } — 실제 게임
// (SoundMuseum.js)이 이미 완성된 투표/전시/상점 로직을 그대로 이 슬롯에 꽂아
// 넣을 때 쓴다. render()는 그 카드의 완성된 내용을 반환하고, 이 컴포넌트는
// CARD_LAYOUT 위치/크기로 감싸고 닫기(✕) 버튼만 얹는다 — 카드 내부 스타일/
// 로직은 건드리지 않는다. cards가 없거나 해당 kind가 없으면(=이 격리
// 테스트 페이지처럼 순수 셸만 검증할 때) 내장 플레이스홀더(InfoCard)로 대체.
export default function LibraryRoom({ autoWalk = null, cards = null, onExit = null }) {
  const containerRef = useRef(null)
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 })
  const { keys } = useKeys()

  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [dir, setDir]         = useState('down')
  const [moving, setMoving]   = useState(false)
  const [nearZone, setNearZone] = useState(null) // 지금 근접한 존 id (프롬프트 표시용)
  const [openCard, setOpenCard] = useState(null) // 열려 있는 카드 종류 (vote/exhibits/shop)

  const posRef = useRef(pos)
  const sizeRef = useRef(roomSize)
  const spawnedRef = useRef(false)
  const nearZoneRef = useRef(null)
  const openCardRef = useRef(null)

  useEffect(() => { nearZoneRef.current = nearZone }, [nearZone])
  useEffect(() => { openCardRef.current = openCard }, [openCard])

  // 방 실측 크기 추적
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // ResizeObserver의 첫 콜백은 비동기라 헤드리스 스크린샷(가상 시간 예산이
    // 짧을 때)에서 한 프레임도 못 받고 캡처되는 경우가 있었다(room 0x0으로
    // 아무것도 안 그려짐) — 마운트 시점에 getBoundingClientRect()로 즉시 한 번
    // 동기 측정해 두면 첫 페인트부터 항상 크기가 잡혀 있다.
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      sizeRef.current = { w: rect.width, h: rect.height }
      setRoomSize({ w: rect.width, h: rect.height })
    }
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      sizeRef.current = { w: width, h: height }
      setRoomSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 방 크기가 처음 잡히면 스폰 위치로 캐릭터 배치 — roomSize(state)가 아니라
  // sizeRef.current(ref)로 조건을 검사한다. 같은 커밋에서 컨테이너 측정
  // effect가 먼저 sizeRef.current를 동기적으로 채워두지만, roomSize state는
  // 다음 리렌더까지 반영이 안 돼서 그걸로 가드하면 이 effect가 커밋 1에서는
  // 그냥 건너뛰고 커밋 2에서야 스폰된다 — 그 사이에 autoWalk 시뮬레이션
  // effect가 (선언 순서상 이 아래에 있어) 커밋 1에서 먼저 실행되면서 아직
  // 스폰 안 된 posRef.current({x:0,y:0} 초기값)를 기준으로 이동을 계산해버려
  // 결과가 완전히 어긋나는 레이스가 있었다.
  useEffect(() => {
    if (spawnedRef.current) return
    const { w: W, h: H } = sizeRef.current
    if (W === 0 || H === 0) return
    const x = SPAWN.xf * W - CHAR_W / 2
    const y = SPAWN.yf * H - CHAR_H / 2
    posRef.current = { x, y }
    setPos({ x, y })
    spawnedRef.current = true
  }, [roomSize])

  // Enter로 카드 열기 / Esc로 닫기 — ZoneMap의 "Enter ↵ 로 전사하기"와 같은 확정
  // 입력. 카드가 안 열려 있을 때 Esc는 ZoneMap의 "Esc = onExit()"와 똑같이 방
  // 자체를 나간다 — 예전엔 투표 탭이 항상 떠 있어서 그 안의 "🗺 월드맵"
  // 버튼이 유일한 탈출구여도 문제 없었지만, 이제 카드가 근접 전엔 아예 안
  // 열려 있어서 이 전역 탈출구가 없으면 플레이어가 갇힌다.
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Enter' && !openCardRef.current && nearZoneRef.current) {
        const z = INTERACTION_ZONES.find(zz => zz.id === nearZoneRef.current)
        if (z) setOpenCard(z.card)
      } else if (e.key === 'Escape') {
        if (openCardRef.current) setOpenCard(null)
        else if (onExit) onExit()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onExit])

  // selftest — 헤드리스 스크린샷에서는 --virtual-time-budget이 setTimeout만
  // 가속하고 requestAnimationFrame은 실제 시간(wall clock)대로 흘러서, 실시간
  // 키 홀드 흉내(setTimeout으로 keys.current 토글)로는 몇 프레임밖에 못 돈다
  // (실측: 4.5초 시퀀스인데 캐릭터가 20px도 못 움직임). 그래서 rAF/실시간과
  // 완전히 무관하게, 같은 물리 계산(stepFrame)을 그냥 동기 for-loop로 N번
  // 돌려서 결과를 한 번에 반영한다 — 실제 플레이(rAF 루프)는 그대로 두고,
  // 이 시뮬레이션은 autoWalk가 있을 때만 별도로 동작. {action:'enter'|'esc'}
  // 스텝은 실제 키 입력 핸들러와 같은 로직을 그대로 흉내낸다.
  const simulatedRef = useRef(false)
  useEffect(() => {
    if (!autoWalk || autoWalk.length === 0) return
    if (simulatedRef.current) return
    const { w: W, h: H } = sizeRef.current
    if (W === 0 || H === 0) return
    simulatedRef.current = true

    let { x, y } = posRef.current
    let curDir = dir
    let curNearZone = null
    let curOpenCard = null

    for (const step of autoWalk) {
      if (step.action === 'enter') {
        if (!curOpenCard && curNearZone) curOpenCard = curNearZone
        continue
      }
      if (step.action === 'esc') {
        curOpenCard = null
        continue
      }
      const frames = Math.max(1, Math.round(step.ms / 16.67))
      for (let i = 0; i < frames; i++) {
        const r = stepFrame({ x, y, dir: curDir, keysDown: { [step.dir]: true }, W, H })
        x = r.x; y = r.y; curDir = r.dir
        const z = zoneAt(x, y, W, H)
        curNearZone = z ? z.id : null
        if (curOpenCard && curNearZone !== curOpenCard) curOpenCard = null
      }
    }

    posRef.current = { x, y }
    setPos({ x, y })
    setDir(curDir)
    setMoving(false)
    setNearZone(curNearZone)
    setOpenCard(curOpenCard)
    nearZoneRef.current = curNearZone
    openCardRef.current = curOpenCard
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWalk, roomSize])

  // 게임 루프 — 실제 키 입력용. autoWalk 시뮬레이션과 동일한 stepFrame()/zoneAt()을 쓴다.
  useEffect(() => {
    if (autoWalk) return // 헤드리스 검증 모드에서는 동기 시뮬레이션이 대신 처리
    let raf, lastTime = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const { w: W, h: H } = sizeRef.current

      if (W > 0 && H > 0) {
        const { x, y } = posRef.current
        const r = stepFrame({ x, y, dir, keysDown: keys.current, W, H, dt })
        if (r.moved) {
          posRef.current = { x: r.x, y: r.y }
          setPos({ x: r.x, y: r.y })
          if (r.dir !== dir) setDir(r.dir)
          setMoving(true)
        } else {
          setMoving(false)
        }

        const z = zoneAt(r.x, r.y, W, H)
        const newNearZone = z ? z.id : null
        if (newNearZone !== nearZoneRef.current) {
          nearZoneRef.current = newNearZone
          setNearZone(newNearZone)
        }
        // 카드가 열려 있는데 그 존을 벗어나면 자동으로 닫힘
        if (openCardRef.current && newNearZone !== openCardRef.current) {
          openCardRef.current = null
          setOpenCard(null)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, autoWalk])

  const { w: W, h: H } = roomSize
  const nearZoneMeta = nearZone ? INTERACTION_ZONES.find(z => z.id === nearZone) : null

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(180deg, #1C120A 0%, #1C120A 32%, #6B4A2E 32%, #4A3218 100%)',
      fontFamily: 'Nunito, sans-serif',
    }}>
      {/* 천장 암전 그라데이션 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '10%',
        background: 'linear-gradient(180deg, #000000aa, transparent)',
      }}/>

      {/* 러그 (장식, 충돌 없음) */}
      {W > 0 && (
        <img src={LIBRARY_DECOR.rug.src} alt="" style={{
          position: 'absolute',
          left: RUG.x * W, top: RUG.y * H, width: RUG.w * W, height: RUG.h * H,
          objectFit: 'contain', imageRendering: 'pixelated', opacity: 0.96,
        }}/>
      )}

      {/* 액자 + 촛대 — 벽난로 위, 순수 장식(벽이라 캐릭터가 애초에 못 감) */}
      {W > 0 && (
        <>
          <img src={LIBRARY_DECOR.painting.src} alt="" style={{
            position: 'absolute', left: '50%', top: '2%', transform: 'translateX(-50%)',
            width: '15%', imageRendering: 'pixelated',
          }}/>
          <img src={LIBRARY_DECOR.candelabra.src} alt="" style={{
            position: 'absolute', left: '32%', top: '3%',
            width: '7%', imageRendering: 'pixelated',
          }}/>
          <img src={LIBRARY_DECOR.candelabra.src} alt="" style={{
            position: 'absolute', left: '61%', top: '3%',
            width: '7%', imageRendering: 'pixelated',
          }}/>
        </>
      )}

      {/* 가구 (충돌 박스 = 시각 rect) */}
      {W > 0 && FURNITURE.map(f => (
        <div key={f.id} style={{
          position: 'absolute',
          left: f.x * W, top: f.y * H, width: f.w * W, height: f.h * H,
        }}>
          <FurniturePiece f={f}/>
        </div>
      ))}

      {/* 캐릭터 */}
      {W > 0 && (
        <div style={{
          position: 'absolute',
          left: pos.x + CHAR_W / 2 - SPRITE_W / 2,
          top: pos.y + CHAR_H - SPRITE_H,
        }}>
          <LibraryChar dir={dir} moving={moving}/>
        </div>
      )}

      {/* 근접 프롬프트 — 카드가 이미 열려 있으면 안 보임(ZoneMap의 "발견!" 말풍선과 같은 자리) */}
      {W > 0 && nearZoneMeta && !openCard && (
        <div style={{
          position: 'absolute',
          left: pos.x + CHAR_W / 2, top: pos.y + CHAR_H - SPRITE_H - 14,
          transform: 'translateX(-50%)',
          background: '#FAF6EEf0', color: '#2A1F0E', border: '2px solid #C8A96E',
          borderRadius: '12px 12px 12px 4px', padding: '6px 11px',
          fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', zIndex: 25,
          boxShadow: '0 4px 12px #00000044', fontFamily: 'Nunito, sans-serif',
        }}>
          {nearZoneMeta.prompt} <span style={{ opacity: 0.55, fontWeight: 700 }}>· Enter ↵</span>
        </div>
      )}

      {/* 카드 — 실제 콘텐츠(cards prop)가 있으면 그걸 CARD_LAYOUT 슬롯 크기로만
          감싸고 닫기 버튼을 얹는다(내부 로직/스타일 그대로). 없으면 내장
          플레이스홀더(InfoCard)로 대체 — 이 격리 테스트 페이지가 그 경로. */}
      {openCard && cards?.[openCard] && (
        <div style={{
          position: 'absolute',
          left: `${CARD_LAYOUT[openCard].x * 100}%`, top: `${CARD_LAYOUT[openCard].y * 100}%`,
          width: `${CARD_LAYOUT[openCard].w * 100}%`, height: `${CARD_LAYOUT[openCard].h * 100}%`,
          zIndex: 30,
        }}>
          {cards[openCard].render()}
          <button onClick={() => setOpenCard(null)} style={{
            position: 'absolute', top: -12, right: -12, zIndex: 31,
            width: 26, height: 26, borderRadius: '50%',
            background: '#2A1F0E', border: '2px solid #C8A96E',
            color: '#FAF6EE', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 3px 10px #00000066', fontFamily: 'Nunito, sans-serif',
          }}>✕</button>
        </div>
      )}
      {openCard && !cards?.[openCard] && (
        <InfoCard kind={openCard} onClose={() => setOpenCard(null)}/>
      )}
    </div>
  )
}
