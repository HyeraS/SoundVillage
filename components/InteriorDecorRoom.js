'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import InteriorRoom, { computePopoverAnchor, COLS, ROWS, WALL_ROWS } from '@/components/InteriorRoom'
import {
  INTERIOR_CATALOG, INTERIOR_CATEGORIES, INTERIOR_SETS,
  getInteriorDailyDeal, getInteriorItem, getInteriorPrice,
  STARTER_WALLPAPER_ID, STARTER_FLOOR_ID,
} from '@/lib/interiorCatalog'
import { getCurrencyBalance } from '@/lib/currency'
import { getRoom, saveRoom, getOwnedInteriorItems, purchaseInteriorItem, purchaseInteriorSet } from '@/lib/interiorDecor'
import { useDuoSession } from '@/lib/duoSession'

/* ─────────────────────────────────────────────
   픽셀 버튼 — README "버튼 상호작용" 스펙(hover 1px 이동+그림자 강화,
   active 2px 눌림)을 인라인 style 객체로 구현. 프로젝트 관례(StartPanel.js 등)와
   동일하게 CSS :hover 클래스 대신 React state로 처리한다.
───────────────────────────────────────────── */
const TONES = {
  default: { bg: 'var(--beige)', hoverBg: 'var(--panel-bright)', color: 'var(--text-dark)', shadow: 3 },
  accent: { bg: 'var(--interior-accent)', hoverBg: 'var(--interior-accent-hover)', color: 'var(--text-dark)', shadow: 4 },
  confirm: { bg: 'var(--interior-confirm)', hoverBg: 'var(--interior-confirm-hover)', color: 'var(--panel-bright)', shadow: 3 },
  danger: { bg: 'var(--interior-danger)', hoverBg: 'var(--interior-danger-hover)', color: 'var(--panel-bright)', shadow: 3 },
}

function PixelButton({ tone = 'default', onClick, children, disabled, style }) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const t = TONES[tone]
  const shadow = active ? Math.max(1, t.shadow - 2) : hover ? t.shadow + 1 : t.shadow
  const translate = active ? '2px,2px' : hover ? '-1px,-1px' : '0,0'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        fontFamily: "'Gothic A1', sans-serif", fontWeight: 700, fontSize: 15,
        padding: '11px 18px', border: '3px solid var(--text-dark)',
        background: disabled ? 'var(--beige-dark)' : (hover ? t.hoverBg : t.bg),
        color: disabled ? 'var(--text-light)' : t.color,
        boxShadow: disabled ? 'none' : `${shadow}px ${shadow}px 0 var(--text-dark)`,
        transform: disabled ? 'none' : `translate(${translate})`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >{children}</button>
  )
}

/* 보관함 카드 하나 — README "3. 보관함 패널" 스펙 그대로.
   타일류(벽지/바닥재/러그)는 60x60 작은 스와치로, 나머지는 원본 비율을 살려
   최대 62px 안에 맞춘다(k = min(3, 62/nw, 62/nh), Cozy Room.dc.html의 tray 계산과 동일). */
function TrayCard({ item, active, applied, editable, onClick }) {
  const isTile = item.kind === 'wallpaper' || item.kind === 'floor' || item.layer === 'rug'
  const k = isTile ? null : Math.min(3, 62 / (item.nw || 16), 62 / (item.nh || 16))
  const meta = applied ? '사용 중' : (active ? '손에 들었어요' : (isTile ? '방 전체' : `${item.fw || 1}×${item.fh || 1}칸`))
  const metaColor = (applied || active) ? 'var(--interior-confirm)' : 'var(--text-light)'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
        background: 'var(--panel-bright)',
        border: `3px solid ${active ? 'var(--interior-accent)' : 'var(--border-warm)'}`,
        boxShadow: active ? '0 0 0 3px var(--interior-accent) inset' : 'none',
        paddingBottom: 6,
        opacity: editable ? 1 : 0.72,
      }}
    >
      <div style={{ height: 74, display: 'grid', placeItems: 'center', padding: 6 }}>
        {isTile ? (
          <div style={{
            width: 60, height: 60, imageRendering: 'pixelated',
            border: '2px solid var(--brown)',
            backgroundImage: `url(${item.src})`, backgroundSize: '30px 30px',
          }} />
        ) : (
          <div style={{
            width: Math.round((item.nw || 16) * k), height: Math.round((item.nh || 16) * k),
            backgroundImage: `url(${item.src})`, backgroundSize: '100% 100%', imageRendering: 'pixelated',
          }} />
        )}
      </div>
      <div style={{
        fontSize: 12, fontFamily: "'Gothic A1', sans-serif", fontWeight: 700, lineHeight: 1.25,
        minHeight: 30, textAlign: 'center', padding: '0 4px', color: 'var(--text-dark)',
      }}>{item.name}</div>
      <div style={{ fontSize: 10.5, fontFamily: "'Gothic A1', sans-serif", textAlign: 'center', color: metaColor }}>{meta}</div>
    </div>
  )
}

/* 상점 단품 카드 — README "4. 상점 모달" 단품 그리드 스펙(6열, 썸네일 80px,
   가격 Press Start 2P 10px, 특가는 SALE 도장). */
function ShopItemCard({ item, price, isDeal, poor, busy, onClick }) {
  const isTile = item.kind === 'wallpaper' || item.kind === 'floor' || item.layer === 'rug'
  const k = isTile ? null : Math.min(3, 66 / (item.nw || 16), 70 / (item.nh || 16))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--panel-bright)', border: '3px solid var(--border-warm)', paddingBottom: 8 }}>
      <div style={{ height: 80, display: 'grid', placeItems: 'center', padding: 6, position: 'relative' }}>
        {isTile ? (
          <div style={{ width: 64, height: 64, border: '2px solid var(--brown)', backgroundImage: `url(${item.src})`, backgroundSize: '32px 32px', imageRendering: 'pixelated' }} />
        ) : (
          <div style={{ width: Math.round((item.nw || 16) * k), height: Math.round((item.nh || 16) * k), backgroundImage: `url(${item.src})`, backgroundSize: '100% 100%', imageRendering: 'pixelated' }} />
        )}
        {isDeal && (
          <div style={{
            position: 'absolute', top: 2, right: 2, fontFamily: "'Press Start 2P', monospace", fontSize: 8,
            padding: '4px 5px', background: 'var(--interior-danger)', color: 'var(--panel-bright)', border: '2px solid var(--text-dark)',
          }}>SALE</div>
        )}
      </div>
      <div style={{ fontSize: 11.5, fontFamily: "'Gothic A1', sans-serif", fontWeight: 700, textAlign: 'center', minHeight: 28, lineHeight: 1.25, padding: '0 4px' }}>{item.name}</div>
      <PixelButton
        tone="accent" onClick={onClick} disabled={poor || busy}
        style={{ margin: '0 8px', fontFamily: "'Press Start 2P', monospace", fontSize: 10, padding: '9px 4px' }}
      >♪ {price}</PixelButton>
    </div>
  )
}

/* 테마 세트 카드 — 상단 118px 프리뷰(벽지 배경 + 러그/펫 등 썸네일 겹침) +
   태그 + 이름/설명 + CTA. thumbs 배치는 Cozy Room.dc.html의 themeSets 계산을
   그대로 옮김(타일류는 하단 스트립, 나머지는 가로로 나란히). */
function ThemeSetCard({ set, owned, busy, onClick }) {
  const wpItem = getInteriorItem(set.items[0])
  const thumbs = set.items.slice(1).map((id, k) => {
    const it = getInteriorItem(id)
    const isTile = it.kind === 'floor' || it.layer === 'rug'
    const kk = Math.min(3, 58 / (it.nh || 16))
    return isTile ? (
      <div key={id} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 44,
        backgroundImage: `url(${it.src})`, backgroundSize: '48px 48px', imageRendering: 'pixelated',
        borderTop: '3px solid var(--brown-dark)',
      }} />
    ) : (
      <div key={id} style={{
        position: 'absolute', bottom: 6, left: 60 + k * 62,
        width: Math.round((it.nw || 16) * kk), height: Math.round((it.nh || 16) * kk),
        backgroundImage: `url(${it.src})`, backgroundSize: '100% 100%', imageRendering: 'pixelated', zIndex: 2,
      }} />
    )
  })
  return (
    <div style={{ border: '3px solid var(--text-dark)', background: 'var(--panel-bright)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        position: 'relative', height: 118, borderBottom: '3px solid var(--text-dark)',
        backgroundImage: `url(${wpItem.src})`, backgroundSize: '96px 72px', imageRendering: 'pixelated',
      }}>
        {thumbs}
        <div style={{
          position: 'absolute', top: 6, left: 6, fontSize: 11, padding: '3px 7px',
          background: 'var(--interior-danger)', color: 'var(--panel-bright)', border: '2px solid var(--text-dark)',
        }}>{set.tag}</div>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 15, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800 }}>{set.name}</div>
        <div style={{ fontSize: 11.5, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', lineHeight: 1.5, minHeight: 32 }}>{set.desc}</div>
        <PixelButton tone={owned ? 'confirm' : 'accent'} onClick={onClick} disabled={busy} style={{ fontSize: 12.5, padding: 10 }}>
          {owned ? '방에 적용하기' : `♪ ${set.price} · 세트로 데려오기`}
        </PixelButton>
      </div>
    </div>
  )
}

/* 상점 모달 — README "4. 상점 모달" 스펙. 테마 세트 3열 + 단품 6열 그리드. */
function ShopModal({ balance, owned, dailyDeal, busy, onClose, onBuyItem, onBuySet }) {
  const shopItems = useMemo(() => INTERIOR_CATALOG.filter(i => !owned.includes(i.id)), [owned])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,.62)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 32 }}>
      <div style={{
        width: 1020, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: 'var(--beige)', border: '4px solid var(--text-dark)', boxShadow: '10px 10px 0 rgba(0,0,0,.4)',
        animation: 'rise 0.18s ease both',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '4px solid var(--text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--interior-accent)' }}>
          <div style={{ fontSize: 20, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800 }}>인테리어 상점</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--panel-bright)', border: '3px solid var(--text-dark)', fontFamily: "'Press Start 2P', monospace", fontSize: 14 }}>♪ {balance}</div>
            <button type="button" onClick={onClose} style={{ fontFamily: "'Gothic A1', sans-serif", fontSize: 16, width: 38, height: 38, background: 'var(--beige)', border: '3px solid var(--text-dark)', color: 'var(--text-dark)', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <div style={{ fontSize: 15, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800, marginBottom: 10 }}>
            테마 세트 <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-mid)' }}>· 한 번에 방 전체를 바꿔요</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
            {INTERIOR_SETS.map(set => (
              <ThemeSetCard key={set.id} set={set} owned={set.items.every(id => owned.includes(id))} busy={busy} onClick={() => onBuySet(set.id)} />
            ))}
          </div>
          <div style={{ fontSize: 15, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800, marginBottom: 10 }}>
            단품 <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-mid)' }}>· 오늘의 특가는 도장이 붙어 있어요</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
            {shopItems.map(item => {
              const price = getInteriorPrice(item.id, dailyDeal)
              return (
                <ShopItemCard
                  key={item.id} item={item} price={price}
                  isDeal={dailyDeal.productId === item.id}
                  poor={balance < price}
                  busy={busy}
                  onClick={() => onBuyItem(item)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* 획득 팝업 — README "5. 획득 팝업" 스펙. */
function RewardPopup({ reward, onClose, onPlace }) {
  const item = getInteriorItem(reward.id)
  const isTileLike = item.kind === 'wallpaper' || item.kind === 'floor' || item.layer === 'rug'
  const k = isTileLike ? null : Math.min(4, 120 / (item.nw || 16), 120 / (item.nh || 16))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,.7)', display: 'grid', placeItems: 'center', zIndex: 80 }}>
      <div style={{
        width: 400, padding: '26px 24px', background: 'var(--beige)', border: '4px solid var(--text-dark)',
        boxShadow: '10px 10px 0 rgba(0,0,0,.4)', textAlign: 'center', animation: 'popIn 0.32s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        <div style={{ fontSize: 13, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', letterSpacing: 2 }}>NEW ITEM</div>
        <div style={{
          margin: '14px auto', width: 150, height: 150, display: 'grid', placeItems: 'center',
          background: 'var(--panel-bright)', border: '3px solid var(--text-dark)', boxShadow: 'inset 0 0 0 4px var(--beige-dark)',
        }}>
          {isTileLike ? (
            <div style={{ width: 120, height: item.kind === 'wallpaper' ? 90 : 120, border: '3px solid var(--brown)', backgroundImage: `url(${item.src})`, backgroundSize: '100% 100%', imageRendering: 'pixelated' }} />
          ) : (
            <div style={{
              width: Math.round((item.nw || 16) * k), height: Math.round((item.nh || 16) * k),
              backgroundImage: `url(${item.src})`, backgroundSize: '100% 100%', imageRendering: 'pixelated',
              animation: 'bob 1.6s ease-in-out infinite',
            }} />
          )}
        </div>
        <div style={{ fontSize: 20, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800, marginBottom: 6 }}>{item.name}</div>
        <div style={{ fontSize: 13, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 16 }}>{reward.msg}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <PixelButton onClick={onClose} style={{ flex: 1, fontSize: 14, padding: 12 }}>보관함에 넣기</PixelButton>
          <PixelButton tone="confirm" onClick={onPlace} style={{ flex: 1, fontSize: 14, padding: 12 }}>바로 놓기</PixelButton>
        </div>
      </div>
    </div>
  )
}

/* 초대(공유 링크) 모달 — 예전 house-decor(HouseDecorRoom.js)의 ?house= 링크
   방식을 그대로 재사용. 진짜 실시간 동시 접속이 아니라, 상대가 이 링크로
   들어오면 내가 저장해 둔 방을 읽기전용으로 보는 방식(async 방문). */
function InviteModal({ inviteUrl, onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,.62)', display: 'grid', placeItems: 'center', zIndex: 70, padding: 32 }}>
      <div style={{
        width: 460, padding: '22px 24px', background: 'var(--beige)', border: '4px solid var(--text-dark)',
        boxShadow: '10px 10px 0 rgba(0,0,0,.4)', textAlign: 'center', animation: 'rise 0.18s ease both',
      }}>
        <div style={{ fontSize: 13, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', letterSpacing: 2 }}>HOUSE INVITATION</div>
        <div style={{ fontSize: 20, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800, margin: '8px 0' }}>우리 집에 놀러 올래?</div>
        <div style={{ fontSize: 12.5, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 16 }}>
          지금 접속해 있으면 친구가 월드맵에서 나와 실시간으로 같이 돌아다닐 수 있어요. 자리를 비웠을 땐 꾸며진 방을 읽기 전용으로 구경만 할 수 있어요(가구는 못 옮겨요).
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 8px 8px 14px', background: 'var(--panel-bright)', border: '3px solid var(--border-warm)', marginBottom: 14 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', textAlign: 'left' }}>{inviteUrl}</span>
          <PixelButton tone={copied ? 'confirm' : 'default'} onClick={copy} style={{ fontSize: 12, padding: '9px 12px', flexShrink: 0 }}>{copied ? '복사됨' : '복사'}</PixelButton>
        </div>
        <PixelButton onClick={onClose} style={{ width: '100%' }}>닫기</PixelButton>
      </div>
    </div>
  )
}

function deepClone(room) {
  return JSON.parse(JSON.stringify(room))
}

/* 칸 점유(fw×fh) 계산 — lib/interiorCatalog.js 주석의 "fw·fh(칸 점유)"를 실제로
   충돌 검사에 쓴다. col은 오른쪽으로, row는 놓은 칸을 아랫변으로 위쪽으로
   fh칸만큼 뻗어나간다(러그 렌더 방식과 동일 — rugStyle의 bottom/height 계산 참고). */
function footprintOf(it, col, row) {
  const fw = it.fw || 1
  const fh = it.fh || 1
  return { colStart: col, colEnd: col + fw - 1, rowStart: row - fh + 1, rowEnd: row }
}
function footprintsOverlap(a, b) {
  return a.colStart <= b.colEnd && b.colStart <= a.colEnd && a.rowStart <= b.rowEnd && b.rowStart <= a.rowEnd
}

const ROOM_READY_COUNT = 4 // 예전 house-decor(HouseDecorRoom.js)의 INVITE_READY_COUNT와 동일한 개념

/* ─────────────────────────────────────────────
   집꾸미기 방 — 상태·이벤트 컨테이너(design_handoff_cozy_room의 Component 클래스에
   대응). InteriorRoom(순수 스테이지 렌더)을 감싸서 mode/room/saved/tool/selected/
   hover/cat/owned/balance/modal/reward를 들고 있는다. 방문 모드가 아니면 마운트
   시 lib/interiorDecor.js/lib/currency.js로 참여자의 실제 잔액·보유 아이템·저장된
   방을 불러오고, 구매(purchaseInteriorItem/Set)와 저장(saveRoom)도 실제로
   호출한다 — scripts/interior_decor_schema.sql이 아직 실행되지 않았다면 그
   함수들이 에러를 삼키고 빈 값을 돌려주므로(구매는 "오류가 발생했어요" 토스트,
   저장은 "저장에 실패했어요" 토스트), 스키마 실행 전에는 그 상태 그대로 정직하게
   보인다 — 스키마를 실행하면 코드 변경 없이 바로 실제로 저장되기 시작한다.

   visitorMode=true면 완전히 읽기 전용으로 바뀐다 — participantId가 아니라
   "그 사람이 실제로 저장한 방"(또는 스키마 미실행 시 FRIEND_ROOM 픽스처)을
   initialRoom으로 받는다고 가정하고, 편집/상점/초대를 전부 숨기고 배지 +
   내 방으로/칭찬 남기기만 남긴다(README "6. 친구 방" 스펙).
───────────────────────────────────────────── */
export default function InteriorDecorRoom({
  initialRoom, initialOwned = [], initialBalance = 1240, participantId = 'AUDIOTEST',
  visitorMode = false, visitorName = '친구', visitorParticipantId, onLeaveVisit, onCurrencyChange, onExit,
  onPartnerLeftScreen,
}) {
  // 방문 모드는 호출부(예: app/interior-test/page.js)가 그 사람이 실제로 저장한
  // 방을 이미 비동기로 읽어와서 initialRoom으로 넘겨준다 — 여기선 그대로 쓰면
  // 된다. 내 방(방문 아님)은 이 컴포넌트가 직접 실제 데이터를 불러온다(아래
  // refresh 이펙트) — initialRoom/initialOwned/initialBalance는 그 경우엔
  // 안 쓰인다(로딩 중 화면에도 아무것도 안 보여준다, 654행 근처 loaded 가드 참고).
  const [loaded, setLoaded] = useState(visitorMode)

  // 4단계(집 안 실시간 동기화) — WorldMap과 같은 lib/duoSession.js를 그대로
  // 쓴다. 채널은 항상 "이 방의 주인" 기준(duo:<호스트 참여자ID>)이라, 방
  // 주인이 자기 방에 있을 때도(자기 자신과 자동 pairing, WorldMap과 동일한
  // 관례) 방문객이 들어왔을 때도 같은 채널에서 만난다. 방문객도 이제 실제
  // 앱(app/page.js)에서는 StartPanel로 참여자ID/그룹을 먼저 받으므로
  // visitorParticipantId로 넘어온다 — presence 키도 이 진짜ID를 쓴다.
  // (interior-test 같은 검증 라우트가 그 값 없이 그냥 부를 수도 있으니,
  // 안 넘어온 경우에만 이 세션 한정 임시 id로 대체한다.)
  const [ephemeralVisitorId] = useState(() => `visitor-${Math.random().toString(36).slice(2, 10)}`)
  const duoScreen = `interior:${visitorMode ? visitorName : participantId}`
  const { partnerId, partnerPos, sendPosition } = useDuoSession(
    visitorMode ? visitorName : participantId,
    visitorMode ? (visitorParticipantId || ephemeralVisitorId) : participantId,
  )
  // 방 주인 쪽에서 보는 방문객 이름표는 실제 partnerId(=방문객이 입력한
  // 참여자ID)를 그대로 쓴다 — 아직 presence가 안 잡혔을 때만 일반 라벨.
  const partnerLabel = visitorMode ? visitorName : (partnerId || '방문객')

  // 방문객 전용 — 호스트가 이 방을 나가서 다른 화면(주로 월드맵)으로
  // 옮겨가면, 방문객은 여기 방 안에 그대로 남아서 더 이상 안 보이던 문제가
  // 있었다("방에서만 같이 움직여짐"). 호스트의 broadcast screen이 이 방
  // (duoScreen)과 달라지면 호출부(app/page.js)에 알려서, 그 화면으로 같이
  // 옮겨가게 한다 — 실제로 어디로 어떻게 옮길지는 호출부가 결정한다.
  useEffect(() => {
    if (!visitorMode || !onPartnerLeftScreen) return
    if (partnerPos && partnerPos.screen && partnerPos.screen !== duoScreen) {
      onPartnerLeftScreen(partnerPos.screen)
    }
  }, [visitorMode, onPartnerLeftScreen, partnerPos, duoScreen])

  const [mode, setMode] = useState('view') // 'view' | 'edit' (visitorMode일 땐 항상 읽기 전용으로 취급)
  const [room, setRoom] = useState(() => (visitorMode ? deepClone(initialRoom) : null))
  const [saved, setSaved] = useState(() => (visitorMode ? deepClone(initialRoom) : null))
  const [tool, setTool] = useState(null)
  const [selected, setSelected] = useState(null)
  const [hoverCell, setHoverCell] = useState(null)
  const [toast, setToast] = useState('')
  const [owned, setOwned] = useState(() => (visitorMode ? initialOwned : []))
  const [cat, setCat] = useState('큰가구')
  const [balance, setBalance] = useState(() => (visitorMode ? initialBalance : 0))
  const [modal, setModal] = useState(null) // null | 'shop' | 'invite'
  const [reward, setReward] = useState(null) // { id, name, msg } | null
  const dailyDeal = useMemo(() => getInteriorDailyDeal(), [])
  const nextUidRef = useRef(100)
  const toastTimerRef = useRef(null)

  // 내 방 실제 데이터 로드 — 방문 모드가 아닐 때만. lib/interiorDecor.js가
  // 이미 purchaseOutfit과 같은 패턴(잔액 확인→보유기록→거래기록→RPC 차감)으로
  // 준비돼 있었는데 지금까지 이 컴포넌트가 실제로 호출을 안 하고 있었다 —
  // 이번에 연결한다. getRoom/getOwnedInteriorItems는 스키마가 아직 없거나
  // (scripts/interior_decor_schema.sql 미실행) 저장된 적 없는 참여자에겐
  // 에러를 삼키고 null/[]를 돌려주므로, 그 경우 "빈 방 + 무료 시작 벽지·바닥재"로
  // 시작한다(STARTER_WALLPAPER_ID/STARTER_FLOOR_ID).
  useEffect(() => {
    if (visitorMode || !participantId) return
    let cancelled = false
    Promise.all([
      getCurrencyBalance(participantId),
      getOwnedInteriorItems(participantId),
      getRoom(participantId),
    ]).then(([bal, dbOwned, savedRoom]) => {
      if (cancelled) return
      const nextOwned = Array.from(new Set([STARTER_WALLPAPER_ID, STARTER_FLOOR_ID, ...dbOwned]))
      const nextRoom = savedRoom ?? { wallpaper: STARTER_WALLPAPER_ID, floor: STARTER_FLOOR_ID, items: [] }
      const maxUid = nextRoom.items.reduce((m, i) => Math.max(m, i.uid || 0), 0)
      nextUidRef.current = Math.max(100, maxUid + 1)
      setBalance(bal)
      setOwned(nextOwned)
      setRoom(deepClone(nextRoom))
      setSaved(deepClone(nextRoom))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [participantId, visitorMode])
  const [purchasing, setPurchasing] = useState(false)
  const purchasingRef = useRef(false) // 리렌더 전에 두 번째 클릭이 들어와도 balance/owned 클로저가 낡은 값을 또
  // 읽고 이중 지급하는 걸 막는 재진입 잠금. purchasing(state)은 버튼을 즉시
  // disabled로 만들어 화면상으로도 다시 못 누르게 한다.

  // 실행취소 스택 — 편집 세션(꾸미기 시작~저장/되돌리기) 동안 완결된 동작
  // (배치/뒤집기/옮기기/치우기/전체치우기/세트적용) 하나하나를 한 단계로 쌓는다.
  // "되돌리기"(cancelEdit)는 세션 시작 시점 전체로 되감는 것과 별개로, 방금 한
  // 동작 하나만 무르고 싶을 때 쓴다. startEdit/cancelEdit/saveEdit에서 비운다.
  const [history, setHistory] = useState([])
  // pickUpSelected로 든 소품을 placeAt으로 다시 놓기 전까지는 "이동" 하나를
  // 한 단계로 취급한다 — pickUpSelected가 이미 이전 상태를 스냅샷해 뒀으므로
  // placeAt에서 또 찍으면 이동 하나가 되돌리기 두 번짜리가 돼버린다.
  const movePendingRef = useRef(false)
  const pushHistory = useCallback(() => {
    setHistory(prev => prev.concat([deepClone(room)]).slice(-50))
  }, [room])

  const say = useCallback(msg => {
    setToast(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2200)
  }, [])
  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  const isEdit = !visitorMode && mode === 'edit'
  const placedCount = room ? room.items.length : 0
  const isReady = placedCount >= ROOM_READY_COUNT
  const readyProgress = Math.min(100, Math.round((placedCount / ROOM_READY_COUNT) * 100))
  const inviteUrl = typeof window === 'undefined'
    ? ''
    : `${window.location.origin}${window.location.pathname}?house=${encodeURIComponent(participantId)}`
  const praiseFriend = useCallback(() => say(`${visitorName}에게 칭찬을 남겼어요`), [say, visitorName])

  // isEdit 가드는 여기서 걸지 않는다 — Cozy Room.dc.html의 chooseTool도 가드가
  // 없고, 호출부(보관함 카드 클릭)가 대신 검사한다. 이래야 획득 팝업의
  // "바로 놓기"(placeReward)처럼 "편집 모드 진입 + 손에 들기"를 한 클릭 안에서
  // 같이 처리할 때, 방금 바뀐 mode를 다시 읽는 상태 갱신 타이밍 문제가 안 생긴다.
  const chooseTool = useCallback(id => {
    const it = getInteriorItem(id)
    if (it.kind === 'wallpaper' || it.kind === 'floor') {
      pushHistory()
      setRoom(prev => ({ ...prev, [it.kind === 'wallpaper' ? 'wallpaper' : 'floor']: id }))
      setTool(null)
      setSelected(null)
      movePendingRef.current = false
      say(it.name + '을(를) 방 전체에 입혔어요')
      return
    }
    movePendingRef.current = false
    setSelected(null)
    setTool(prev => (prev === id ? null : id))
  }, [say, pushHistory])

  const placeAt = useCallback((layer, col, row) => {
    if (!tool) { setSelected(null); return }
    const it = getInteriorItem(tool)
    const wantWall = it.layer === 'wall'
    if (wantWall !== (layer === 'wall')) {
      say(wantWall ? '벽장식은 벽에만 놓을 수 있어요' : '이 소품은 바닥에 놓아요')
      return
    }
    const fw = it.fw || 1
    const fh = it.fh || 1
    const maxRow = (wantWall ? WALL_ROWS : ROWS) - 1
    const c = Math.min(col, COLS - fw)
    const r = Math.max(row, Math.min(fh - 1, maxRow))
    const fp = footprintOf(it, c, r)
    const blocked = room.items.some(p => {
      if (p.layer !== it.layer) return false
      return footprintsOverlap(fp, footprintOf(getInteriorItem(p.itemId), p.col, p.row))
    })
    if (blocked) { say('이미 다른 소품이 놓여 있어요'); return }
    if (!movePendingRef.current) pushHistory()
    movePendingRef.current = false
    const uid = nextUidRef.current++
    setRoom(prev => ({ ...prev, items: prev.items.concat([{ uid, itemId: tool, layer: it.layer, col: c, row: r, flip: false }]) }))
    setSelected(uid)
    setTool(null)
    setHoverCell(null)
  }, [tool, say, room, pushHistory])

  const selectPlaced = useCallback(uid => {
    if (!isEdit) { say('꾸미기 시작을 누르면 소품을 옮길 수 있어요'); return }
    if (tool) {
      // 소품을 손에 든 채로 이미 놓인 다른 소품의 스프라이트를 클릭한 경우 —
      // 예전엔 그냥 선택 모드로 넘어가면서 손에 든 소품을 조용히 놓쳐버렸다
      // (그 칸이 비어 보이는 부분을 노려 클릭해도, 큰 소품일수록 스프라이트가
      // 칸 전체를 덮어서 실제로는 항상 이 경로를 타게 된다 — 사용자 입장에선
      // "놓으려고 눌렀는데 갑자기 다른 게 선택되고 손에 든 게 사라졌다"로
      // 보인다). 같은 칸을 클릭한 것과 같으니 placeAt의 충돌 검사를 그대로
      // 태워서 "이미 다른 소품이 놓여 있어요"로 일관되게 안내하고, 들고 있던
      // 소품도 그대로 손에 남는다.
      const target = room.items.find(i => i.uid === uid)
      if (target) { placeAt(target.layer, target.col, target.row); return }
    }
    setSelected(prev => (prev === uid ? null : uid))
    setTool(null)
  }, [isEdit, say, tool, room, placeAt])

  const mutateSelected = useCallback(fn => {
    pushHistory()
    setRoom(prev => ({ ...prev, items: prev.items.map(i => (i.uid === selected ? fn(i) : i)).filter(Boolean) }))
  }, [selected, pushHistory])

  const selectedItem = room ? room.items.find(i => i.uid === selected) || null : null

  const flipSelected = useCallback(() => mutateSelected(i => ({ ...i, flip: !i.flip })), [mutateSelected])
  const pickUpSelected = useCallback(() => {
    if (!selectedItem) return
    const itemId = selectedItem.itemId
    mutateSelected(() => null)
    movePendingRef.current = true
    setSelected(null)
    setTool(itemId)
    say('놓을 칸을 눌러 주세요')
  }, [selectedItem, mutateSelected, say])
  const storeSelected = useCallback(() => {
    mutateSelected(() => null)
    movePendingRef.current = false
    setSelected(null)
    say('보관함으로 넣었어요')
  }, [mutateSelected, say])

  const undoLast = useCallback(() => {
    if (history.length === 0) return
    setRoom(history[history.length - 1])
    setHistory(prev => prev.slice(0, -1))
    setSelected(null)
    setTool(null)
    movePendingRef.current = false
    say('방금 동작을 취소했어요')
  }, [history, say])

  // ESC로 맨 위에 떠 있는 오버레이부터 하나씩 닫는다 — 획득 팝업 > 상점/초대
  // 모달 > 소품 선택 팝오버 순. 편집 중이 아니고 닫을 것도 없으면(방문 모드가
  // 아닐 때만) 마지막으로 onExit — 예전 HouseDecorRoom과 동일한 "ESC로 나가기"
  // 관례를 따른다. 편집 중엔 실수로 나가버리면 안 되니 그 전엔 안 나간다.
  // 편집 중(오버레이가 없을 때)엔 Cmd/Ctrl+Z로 실행취소도 누를 수 있다.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (reward) { setReward(null); return }
        if (modal) { setModal(null); return }
        if (selected) { setSelected(null); return }
        if (!visitorMode && !isEdit) onExit?.()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && isEdit && !modal && !reward) {
        e.preventDefault()
        undoLast()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reward, modal, selected, isEdit, undoLast, visitorMode, onExit])

  const startEdit = useCallback(() => {
    setSaved(deepClone(room))
    setHistory([])
    movePendingRef.current = false
    setMode('edit')
  }, [room])
  const cancelEdit = useCallback(() => {
    setRoom(deepClone(saved))
    setTool(null)
    setSelected(null)
    setHistory([])
    movePendingRef.current = false
    setMode('view')
  }, [saved])
  const saveEdit = useCallback(async () => {
    // 실패하면(스키마 미실행/네트워크 오류 등) 편집 모드를 빠져나가지 않는다 —
    // 여기서 view로 돌려버리면 화면상으론 "저장됨"처럼 보이지만 실제로는
    // 서버에 반영이 안 된 채로 편집 세션(되돌리기 스냅샷/실행취소 스택)만
    // 날아가서, 사용자가 다시 손댈 방법이 없어진다.
    const ok = await saveRoom({ participantId, room })
    if (!ok) { say('저장에 실패했어요. 다시 시도해주세요'); return }
    setSaved(deepClone(room))
    setTool(null)
    setSelected(null)
    setHistory([])
    movePendingRef.current = false
    setMode('view')
    say('방을 저장했어요')
  }, [room, say, participantId])

  const clearRoom = useCallback(() => {
    pushHistory()
    setRoom(prev => ({ ...prev, items: [] }))
    setSelected(null)
    movePendingRef.current = false
    say('소품을 모두 보관함에 넣었어요')
  }, [say, pushHistory])

  // 세트의 벽지/바닥/러그/기타 아이템을 방에 실제로 적용 — 구매 여부와
  // 무관하게(이미 보유한 세트를 "방에 적용하기"로 다시 씌울 때도 재사용).
  // 러그는 기존 것을 빼고 새로 하나만 두고, 그 외는 고정된 기본 위치에 놓는다
  // (Cozy Room.dc.html의 applySet과 동일).
  const applySet = useCallback(setId => {
    pushHistory()
    const set = INTERIOR_SETS.find(s => s.id === setId)
    setRoom(prev => {
      let items = prev.items.slice()
      let wallpaper = prev.wallpaper
      let floor = prev.floor
      let uid = nextUidRef.current
      set.items.forEach(id => {
        const it = getInteriorItem(id)
        if (it.kind === 'wallpaper') wallpaper = id
        else if (it.kind === 'floor') floor = id
        else if (it.layer === 'rug') {
          items = items.filter(i => i.layer !== 'rug')
          items.push({ uid: uid++, itemId: id, layer: 'rug', col: 4, row: 3, flip: false })
        } else {
          items.push({ uid: uid++, itemId: id, layer: it.layer, col: it.layer === 'wall' ? 6 : 10, row: it.layer === 'wall' ? 0 : 4, flip: false })
        }
      })
      nextUidRef.current = uid
      return { ...prev, wallpaper, floor, items }
    })
    setMode('edit')
    setModal(null)
  }, [pushHistory])

  // 단품 구매 — lib/interiorDecor.js의 purchaseInteriorItem 호출(purchaseOutfit과
  // 동일한 패턴: 잔액 확인→보유기록→거래기록→RPC 차감을 서버에서 원자적으로 처리).
  // 실패 사유별 안내는 components/SoundMuseum.js의 옷가게 handleBuy와 동일한 분기.
  const handleBuyItem = useCallback(async item => {
    if (purchasingRef.current) return
    purchasingRef.current = true
    setPurchasing(true)
    try {
      const price = getInteriorPrice(item.id, dailyDeal)
      if (owned.includes(item.id)) { say('이미 보관함에 있어요'); return }
      if (balance < price) { say(`음표가 ${price - balance}개 더 필요해요`); return }
      const result = await purchaseInteriorItem({ participantId, itemId: item.id, price })
      if (result.ok) {
        setBalance(result.newBalance)
        setOwned(prev => prev.concat([item.id]))
        setReward({ id: item.id, name: item.name, msg: `♪ ${price}을 썼어요. 남은 음표 ${result.newBalance}개` })
        onCurrencyChange?.()
      } else if (result.reason === 'insufficient_funds') {
        setBalance(result.balance)
        say(`음표가 ${result.price - result.balance}개 더 필요해요`)
      } else if (result.reason === 'already_owned') {
        setOwned(prev => (prev.includes(item.id) ? prev : prev.concat([item.id])))
        say('이미 보관함에 있어요')
      } else {
        say('구매 중 오류가 발생했어요. 다시 시도해주세요')
      }
    } finally {
      purchasingRef.current = false
      setPurchasing(false)
    }
  }, [owned, balance, dailyDeal, say, participantId, onCurrencyChange])

  // 세트 구매 — 이미 다 갖고 있으면 과금 없이 바로 적용, 아니면
  // purchaseInteriorSet이 미보유 아이템만 지급하고 세트가만 1회 차감한다.
  const handleBuySet = useCallback(async setId => {
    if (purchasingRef.current) return
    purchasingRef.current = true
    setPurchasing(true)
    try {
      const set = INTERIOR_SETS.find(s => s.id === setId)
      const need = set.items.filter(id => !owned.includes(id))
      if (need.length === 0) {
        applySet(setId)
        say(`${set.name} 테마를 방에 적용했어요`)
        return
      }
      if (balance < set.price) { say(`음표가 ${set.price - balance}개 더 필요해요`); return }
      const result = await purchaseInteriorSet({ participantId, setId, ownedIds: owned })
      if (result.ok) {
        setBalance(result.newBalance)
        setOwned(prev => Array.from(new Set(prev.concat(result.grantedItemIds || []))))
        applySet(setId)
        say(`${set.name} 테마를 방에 적용했어요`)
        onCurrencyChange?.()
      } else if (result.reason === 'insufficient_funds') {
        setBalance(result.balance)
        say(`음표가 ${result.price - result.balance}개 더 필요해요`)
      } else {
        say('구매 중 오류가 발생했어요. 다시 시도해주세요')
      }
    } finally {
      purchasingRef.current = false
      setPurchasing(false)
    }
  }, [owned, balance, applySet, say, participantId, onCurrencyChange])

  const closeReward = useCallback(() => setReward(null), [])
  const placeReward = useCallback(() => {
    if (!reward) return
    const id = reward.id
    setReward(null)
    setModal(null)
    setMode('edit')
    setCat(getInteriorItem(id).cat)
    chooseTool(id)
  }, [reward, chooseTool])

  let popoverNode = null
  if (selectedItem && isEdit) {
    const catalogItem = getInteriorItem(selectedItem.itemId)
    const anchor = computePopoverAnchor(selectedItem, catalogItem, 4)
    popoverNode = (
      <div style={{
        position: 'absolute', left: anchor.left, top: anchor.top,
        display: 'flex', gap: 6, padding: 6,
        background: 'var(--beige)', border: '3px solid var(--text-dark)',
        boxShadow: '3px 3px 0 rgba(0,0,0,.35)', zIndex: 90,
      }}>
        <PixelButton onClick={flipSelected} style={{ fontSize: 13, padding: '7px 10px' }}>뒤집기</PixelButton>
        <PixelButton onClick={pickUpSelected} style={{ fontSize: 13, padding: '7px 10px' }}>옮기기</PixelButton>
        <PixelButton tone="danger" onClick={storeSelected} style={{ fontSize: 13, padding: '7px 10px' }}>치우기</PixelButton>
      </div>
    )
  }

  const hint = visitorMode
    ? `${visitorName} 방은 구경만 할 수 있어요. 칭찬을 남기면 ${visitorName}에게 음표가 쌓여요.`
    : isEdit
      ? (tool ? '방의 칸을 누르면 그 자리에 놓여요. 벽장식은 벽 칸에만 놓입니다.' : '보관함에서 소품을 고르거나, 놓인 소품을 눌러 옮기세요.')
      : '오늘의 방이에요. 꾸미기 시작을 누르면 칸이 나타나요.'

  const trayItems = useMemo(
    () => owned.map(id => getInteriorItem(id)).filter(item => item && item.cat === cat),
    [owned, cat],
  )
  const panelTitle = visitorMode ? `${visitorName}의 소품` : (isEdit ? '보관함 · 놓을 소품 고르기' : '보관함')
  const panelSub = `${owned.length}종 보유`
  const panelFoot = visitorMode
    ? `${visitorName}의 방을 구경하는 중이에요`
    : isEdit
      ? (tool ? `${getInteriorItem(tool).name}을(를) 들고 있어요` : '카드를 눌러 소품을 손에 드세요')
      : '꾸미기 시작을 누르면 배치할 수 있어요'

  if (!loaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300,
        fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', fontSize: 14,
      }}>불러오는 중…</div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* HUD 바 — README 헤더 스펙 중 상점/초대 진입에 필요한 요소만(잔액 pill +
          상점/초대 버튼). 방문 아바타/방 이름/도움말 버튼은 해당 기능이 구현되는
          단계에서 추가한다. visitorMode일 땐 전부 숨기고 구경 중 배지만 보여준다. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '12px 16px', background: 'var(--beige)', border: '4px solid var(--text-dark)',
        boxShadow: '6px 6px 0 rgba(0,0,0,.35)',
      }}>
        {visitorMode ? (
          <div style={{ fontSize: 15, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800 }}>
            🚪 {visitorName}의 방 · 구경 중
          </div>
        ) : (
          <>
            {onExit ? (
              <PixelButton onClick={onExit} title="월드맵으로 나가기 (편집 중이 아닐 땐 ESC로도)">← 나가기</PixelButton>
            ) : <div />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                background: 'var(--panel-bright)', border: '3px solid var(--text-dark)',
              }}>
                <span style={{
                  width: 20, height: 20, background: 'var(--interior-accent)', border: '2px solid var(--text-dark)',
                  display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: "'Press Start 2P', monospace",
                }}>♪</span>
                <span style={{ fontSize: 18, fontFamily: "'Press Start 2P', monospace", letterSpacing: -1 }}>{balance}</span>
              </div>
              <PixelButton
                tone={isReady ? 'confirm' : 'default'} disabled={!isReady}
                onClick={() => setModal('invite')}
                title={isReady ? undefined : `가구를 ${ROOM_READY_COUNT}개 이상 놓으면 초대할 수 있어요`}
              >{isReady ? '초대' : `초대 (${placedCount}/${ROOM_READY_COUNT})`}</PixelButton>
              <PixelButton tone="accent" onClick={() => setModal('shop')}>상점</PixelButton>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* 방 패널 — 스테이지 + 힌트/버튼 줄이 같은 카드 안에 있다(README 마크업) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          position: 'relative', padding: 14,
          background: 'var(--beige)', border: '4px solid var(--text-dark)',
          boxShadow: '6px 6px 0 rgba(0,0,0,.35)',
        }}>
          <InteriorRoom
            room={room}
            pixelScale={4}
            isEdit={isEdit}
            tool={tool ? getInteriorItem(tool) : null}
            hoverCell={hoverCell}
            onHoverCell={(layer, col, row) => setHoverCell({ layer, col, row })}
            onClickCell={placeAt}
            selectedUid={selected}
            onSelectItem={selectPlaced}
            popover={popoverNode}
            duoScreen={duoScreen}
            sendPosition={sendPosition}
            partnerPos={partnerPos}
            partnerLabel={partnerLabel}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)', maxWidth: 520 }}>{hint}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {visitorMode ? (
                <>
                  <PixelButton onClick={onLeaveVisit}>내 방으로</PixelButton>
                  <PixelButton tone="danger" onClick={praiseFriend} style={{ padding: '11px 20px' }}>칭찬 남기기</PixelButton>
                </>
              ) : isEdit ? (
                <>
                  <PixelButton onClick={undoLast} disabled={history.length === 0} title="방금 한 동작 하나만 취소해요 (Cmd/Ctrl+Z)">실행 취소</PixelButton>
                  <PixelButton onClick={cancelEdit}>되돌리기</PixelButton>
                  <PixelButton tone="confirm" onClick={saveEdit} style={{ padding: '11px 22px' }}>저장하기</PixelButton>
                </>
              ) : (
                <PixelButton tone="accent" onClick={startEdit} style={{ fontSize: 16, padding: '12px 26px' }}>꾸미기 시작</PixelButton>
              )}
            </div>
          </div>

          {/* 공개 준비 카드 — 예전 house-decor의 "친구를 맞을 준비 중이에요" 진행률
              카드와 같은 개념. 가구 ROOM_READY_COUNT개 이상 놓아야 위 HUD의 "초대"가
              풀린다. 친구 방을 보는 중일 땐 의미가 없으니 숨긴다. */}
          {!visitorMode && (
            <div style={{
              marginTop: 12, padding: '10px 12px', border: '3px solid var(--border-warm)',
              background: isReady ? 'rgba(127,166,92,.12)' : 'var(--panel-dim)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 20 }}>{isReady ? '🎉' : '🛠️'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, fontFamily: "'Gothic A1', sans-serif", fontWeight: 700 }}>
                    <span>{isReady ? '친구를 초대할 준비가 됐어요!' : '친구를 맞을 준비 중이에요'}</span>
                    <span style={{ color: 'var(--text-mid)' }}>{readyProgress}%</span>
                  </div>
                  <div style={{ marginTop: 6, height: 8, background: 'var(--beige-dark)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${readyProgress}%`, background: 'var(--interior-confirm)', transition: 'width .3s' }} />
                  </div>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)' }}>
                가구 {ROOM_READY_COUNT}개를 놓으면 초대 링크를 만들 수 있어요(놓인 소품 {placedCount}개).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 보관함 패널 — README "3. 보관함 패널" 스펙(360×604, 카테고리 탭 8개, 3열 그리드) */}
      <aside style={{
        width: 360, flex: 'none', background: 'var(--beige)', border: '4px solid var(--text-dark)',
        boxShadow: '6px 6px 0 rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', height: 604,
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: '4px solid var(--text-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 17, fontFamily: "'Gothic A1', sans-serif", fontWeight: 800 }}>{panelTitle}</div>
          <div style={{ fontSize: 12, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)' }}>{panelSub}</div>
        </div>

        <div style={{
          padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 6,
          borderBottom: '3px solid var(--border-warm)', background: 'var(--panel-dim)',
        }}>
          {INTERIOR_CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { setCat(c); setTool(null); setSelected(null) }}
              style={{
                fontFamily: "'Gothic A1', sans-serif", fontWeight: 700, fontSize: 12.5,
                padding: '7px 10px', border: '3px solid var(--text-dark)', cursor: 'pointer',
                background: cat === c ? 'var(--text-dark)' : 'var(--beige)',
                color: cat === c ? 'var(--beige)' : 'var(--brown)',
              }}
            >{c}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {trayItems.length === 0 ? (
            <div style={{
              padding: '40px 16px', textAlign: 'center', fontSize: 13,
              fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-light)', lineHeight: 1.7,
            }}>
              이 카테고리에 가진 아이템이 없어요.<br />상점에서 데려와 볼까요?
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {trayItems.map(item => {
                const active = tool === item.id
                const applied = (item.kind === 'wallpaper' && room.wallpaper === item.id) || (item.kind === 'floor' && room.floor === item.id)
                return (
                  <TrayCard
                    key={item.id}
                    item={item}
                    active={active}
                    applied={applied}
                    editable={isEdit}
                    onClick={() => {
                      if (isEdit) { chooseTool(item.id); return }
                      say(visitorMode ? `${visitorName} 방은 구경만 할 수 있어요` : '꾸미기 시작을 누르면 소품을 놓을 수 있어요')
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>

        <div style={{
          padding: '10px 12px', borderTop: '3px solid var(--border-warm)', background: 'var(--panel-dim)',
          display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, fontFamily: "'Gothic A1', sans-serif", color: 'var(--text-mid)' }}>{panelFoot}</div>
          {!visitorMode && (
            <button
              type="button"
              onClick={clearRoom}
              style={{
                fontFamily: "'Gothic A1', sans-serif", fontWeight: 700, fontSize: 12,
                padding: '8px 12px', border: '3px solid var(--brown)', color: 'var(--brown)',
                background: 'var(--beige)', cursor: 'pointer',
              }}
            >전부 치우기</button>
          )}
        </div>
      </aside>

      </div>

      {modal === 'shop' && (
        <ShopModal
          balance={balance}
          owned={owned}
          dailyDeal={dailyDeal}
          busy={purchasing}
          onClose={() => setModal(null)}
          onBuyItem={handleBuyItem}
          onBuySet={handleBuySet}
        />
      )}

      {modal === 'invite' && (
        <InviteModal inviteUrl={inviteUrl} onClose={() => setModal(null)} />
      )}

      {reward && (
        <RewardPopup reward={reward} onClose={closeReward} onPlace={placeReward} />
      )}

      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 40, transform: 'translateX(-50%)',
          padding: '12px 20px', background: 'var(--text-dark)', color: 'var(--beige)',
          border: '3px solid var(--beige)', fontSize: 14, zIndex: 120,
          fontFamily: "'Gothic A1', sans-serif", fontWeight: 700,
          animation: 'rise 0.18s ease both',
        }}>{toast}</div>
      )}
    </div>
  )
}
