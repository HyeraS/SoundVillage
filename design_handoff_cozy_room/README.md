# Handoff: 화폐 기반 집 꾸미기(인테리어) 기능

## Overview
SoundMimic Village(Next.js, `HyeraS/new_soundvillage`)에 화폐(♪ 음표)로 소품을 구매해 내 방을 꾸미는 기능을 추가한다.
레퍼런스는 썸원(정면 단면 뷰 · 카테고리 카드 상점)과 동물의 숲(아이템을 손에 들고 원하는 칸에 놓는 배치 방식).
포함 화면: 내 방(보기/편집) · 상점(테마 세트 + 단품) · 보관함 · 벽지/바닥재 교체 · 친구 방 구경 · 구매 획득 팝업.

## About the Design Files
이 번들의 `Cozy Room.dc.html`은 **디자인 레퍼런스**다. 의도한 모양과 동작을 보여주는 HTML 프로토타입이며,
그대로 제품에 넣을 코드가 아니다. 해야 할 일은 이 디자인을 **기존 코드베이스의 환경에 맞게 다시 구현**하는 것:

- Next.js App Router (`app/`), 클라이언트 컴포넌트 + React state
- 스타일은 인라인 style 객체 + `app/globals.css`의 CSS 변수(기존 컴포넌트들이 쓰는 방식과 동일)
- 데이터는 `lib/supabase.js`의 `getClient()`, 화폐는 `lib/currency.js`
- 새 npm 의존성 추가 없이 구현 가능하다(스프라이트 시트 + div 배경 이미지만 사용)

프로토타입을 브라우저로 열어 실제 동작(배치, 구매, 팝업)을 먼저 확인할 것.

## Fidelity
**High-fidelity.** 색·간격·폰트·상호작용이 모두 확정값이다. 아래 문서의 수치를 그대로 쓰면 된다.
단, 프로토타입은 데스크톱/태블릿 1280px 고정 폭으로 그려져 있다. 모바일 대응은 이 문서 범위 밖이며 필요하면 별도로 요청할 것.

---

## Screens / Views

### 1. 내 방 — 보기 모드 (기본)
**Purpose**: 저장된 방을 감상한다. 편집 진입점.

**Layout** (전체 폭 1280px, padding 24px, 배경 `#6E5844` + 8px 격자 패턴)
- 상단 HUD 바: 높이 auto, padding 12/16px, 배경 `#F5EDD8`, border `4px solid #3A2A14`, box-shadow `6px 6px 0 rgba(0,0,0,.35)`
  - 좌: 44x44 아바타 칸(border 3px, 배경 `#E8D8B8`) + 방 이름(19px) + 서브텍스트(12px, `#8B6A3A`) "배치한 소품 N개 · 보유 N종"
  - 우: 잔액 pill(배경 `#FFF7E4`, border 3px, 안에 20x20 `#E9B44C` 코인 + `Press Start 2P` 18px 숫자) → 버튼 4개: 상점(`#E9B44C`) / 보관함 / 친구 방 / ?(42x42)
- 본문: `display:flex; gap:16px`
  - 좌: 방 패널(flex:1) — padding 14px, 같은 카드 스타일. 안에 **스테이지 768x464px**, `margin:0 auto`, `overflow:hidden`, `isolation:isolate; z-index:0`, border 3px
  - 우: 보관함 패널 360x604px (아래 3번 참조)
- 방 패널 하단: 좌측 힌트 텍스트(13px, `#8B6A3A`), 우측 CTA "꾸미기 시작"(16px, `#E9B44C`, shadow `4px 4px 0 #3A2A14`)

**스테이지 구조 (핵심 규격)**
| 항목 | 값 |
| --- | --- |
| 벽 영역 | 상단 0~224px, 12칸 × 2줄, 칸 64px, 줄 높이 112px |
| 바닥 영역 | 224~464px, 12칸 × 5줄, 칸 64px, **줄 깊이 48px** |
| 벽지 | 32x24 타일, `background-size: 128px 96px` (원본 × 4) |
| 바닥재 | 32x32 타일, `background-size: 128px 128px` |
| 걸레받이 | 벽 하단 height 10px, `#8B6347`, border-top `3px solid #6B4327` |
| 스프라이트 배율 | 원본 픽셀 × 4 (`pixelScale` prop으로 3~5 조정) |
| 정렬 | 바닥 아이템은 `bottom = (5 - 1 - row) * 48px`, 칸 폭 기준 가로 중앙 |
| z-index | `row * 10 + 5` (앞줄이 위로) |
| 그림자 | `filter: drop-shadow(0 2px 0 rgba(58,42,20,.22))` |
| 러그 | 바닥 레이어, 2x2칸(128x96px)에 타일을 늘려 채움, z-index 1 |
| 벽 아이템 | `top = row * 112 + (112 - h)/2 + 8` |
| 뒤집기 | `transform: scaleX(-1)` |

**스프라이트 렌더 방식(중요)**: `<img src>`가 아니라 `<div>` + `background-image: url(...); background-size: 100% 100%; image-rendering: pixelated`로 그린다.
`image-rendering: pixelated`는 전역(`img, div[data-sprite]`)으로 한 번 지정할 것. 픽셀 아트가 흐려지면 안 된다.

### 2. 내 방 — 편집 모드
**Purpose**: 소품을 놓고, 옮기고, 치운다.

- 스테이지 위에 격자 오버레이 2개(벽 12x2, 바닥 12x5)를 `display:grid`로 얹는다. 각 칸: `border 1px dashed rgba(58,42,20,.35)`, 배경 `rgba(255,255,255,.07)`, hover 시 `rgba(255,255,255,.22)`
- 손에 든 소품이 있으면 hover 중인 칸에 **고스트 프리뷰**(`opacity:.55; pointer-events:none`)
- 칸 클릭 → 그 칸에 배치. 벽장식을 바닥 칸에 놓으려 하면 토스트 "벽장식은 벽에만 놓을 수 있어요"(반대도 동일)
- 놓인 소품 클릭 → `outline: 3px solid #E9B44C; outline-offset: 2px` + 소품 위에 팝오버(배경 `#F5EDD8`, border 3px, shadow `3px 3px 0`): **뒤집기 / 옮기기 / 치우기**(`#C97C6B`)
  - 옮기기 = 방에서 제거하고 다시 손에 듦(툴 상태로 복귀)
- 하단 버튼: "되돌리기"(저장 시점으로 복원) / "저장하기"(`#7FA65C`)
- 벽지·바닥재 카드는 칸 클릭 없이 **선택 즉시 방 전체 적용** + 토스트

### 3. 보관함 패널 (우측 고정, 360x604px)
- 헤더: 제목 17px + "N종 보유"(12px)
- 카테고리 탭 8개: `벽지 / 바닥재 / 러그 / 큰가구 / 소파·의자 / 소품 / 벽장식 / 펫`
  - 버튼: padding 7/10px, border `3px solid #3A2A14`, 선택됨 = 배경 `#3A2A14` + 글자 `#F5EDD8`, 미선택 = 배경 `#F5EDD8` + 글자 `#8B6347`
  - 탭 바 배경 `#EDE2C6`, 하단 border `3px solid #C8A96E`
- 아이템 그리드: 3열, gap 10px. 카드 = 배경 `#FFF7E4`, border `3px solid #C8A96E`(손에 들었으면 `#E9B44C` + inset 링), 썸네일 칸 74px, 이름 12px, 메타 10.5px
  - 메타 문구: `사용 중`(초록 `#7FA65C`) / `손에 들었어요` / `2×1칸` / `방 전체`
  - 보기 모드에서는 카드 `opacity:.72`, 클릭 시 토스트로 "꾸미기 시작을 누르면…"
- 빈 카테고리: "이 카테고리에 가진 아이템이 없어요. / 상점에서 데려와 볼까요?"
- 푸터(배경 `#EDE2C6`): 좌측 상태 문구, 우측 "전부 치우기"

### 4. 상점 모달
- 딤 `rgba(30,20,10,.62)`, 카드 1020px, 최대높이 88vh, `animation: rise .18s ease`
- 헤더 배경 `#E9B44C`, 제목 20px, 우측 잔액 pill + 닫기(38x38)
- **테마 세트** 3열 카드: 상단 118px 프리뷰(테마 벽지를 배경으로 타일 + 바닥/러그/펫 썸네일을 겹쳐 놓음) + 태그(인기/신규/한정, `#C97C6B`) + 이름/설명 + CTA
  - 미보유: `♪ 1,180 · 세트로 데려오기`(`#E9B44C`) / 보유: `방에 적용하기`(`#7FA65C`)
  - 세트 구매 = 미보유 아이템만 지급 + 세트가 차감 → 벽지/바닥 교체, 러그 교체, 펫/소품 배치, 편집 모드 진입
- **단품** 6열 그리드: 썸네일 80px, 이름, 가격 버튼(`Press Start 2P` 10px). 잔액 부족 시 버튼 `#E8D8B8` + 글자 `#A09080`
- 오늘의 특가: 카드 우상단 `SALE` 도장(`#C97C6B`, 8px), 가격 40% 할인

### 5. 획득 팝업
- 딤 `rgba(30,20,10,.7)`, 카드 400px, `animation: popin .32s cubic-bezier(.34,1.56,.64,1)`
- `NEW ITEM`(13px, letter-spacing 2px) → 150x150 프레임(배경 `#FFF7E4`, `box-shadow: inset 0 0 0 4px #E8D8B8`) 안에 스프라이트(× 4배, `bob` 애니메이션)
- 이름 20px + "♪ 280을 썼어요. 남은 음표 960개"
- 버튼 2개: `보관함에 넣기` / `바로 놓기`(`#7FA65C` — 편집 모드 진입 + 해당 카테고리 탭으로 이동 + 손에 들기)

### 6. 친구 방
- `친구 방` 버튼으로 토글. 별도 고정 레이아웃(친구의 room 데이터)을 읽기 전용으로 렌더
- 우상단 배지 "루미의 방 · 구경 중", 하단 버튼 `내 방으로` / `칭찬 남기기`(`#C97C6B`)
- 편집 격자·팝오버 없음. 소품 클릭 시 토스트만

### 7. 도움말 모달
560px 카드. 규칙 5줄(음표 획득 → 배치 → 팝오버 → 벽지/바닥은 전체 적용 → 저장 전 되돌리기 가능).

---

## Interactions & Behavior
- **배치 플로우**: 카드 클릭(`tool = itemId`) → 칸 hover(고스트) → 칸 클릭(배치, `tool = null`, 새 소품 선택 상태)
- **가로 넘침 방지**: `col = min(col, 12 - footprintWidth)`
- **토스트**: 화면 하단 중앙 고정, 배경 `#3A2A14`, 글자 `#F5EDD8`, border `3px solid #F5EDD8`, 2.2초 후 사라짐
- **애니메이션**: `bob`(아바타·획득 아이템, 2.6s / 1.6s ease-in-out infinite, ±3px), `popin`(.32s 스프링), `rise`(.18s, 10px 상승 + fade)
- **버튼 상호작용**: hover = 1px 왼쪽위로 이동 + shadow +1px, active = 2px 오른쪽아래 + shadow 1px (픽셀 버튼 눌림감)
- **모달 열 때** 선택 상태 해제(팝오버가 모달 위로 뜨는 것 방지). 스테이지에 `isolation:isolate` 필수
- **저장/취소**: 편집 진입 시 현재 room을 깊은 복사해 두고, 되돌리기는 그 스냅샷으로 복원. 저장 시 스냅샷 갱신 + 서버 저장

## State Management
```js
mode      : 'view' | 'edit' | 'friend'
room      : { wallpaper: itemId, floor: itemId, items: [ {uid, itemId, layer, col, row, flip} ] }
saved     : room 스냅샷(되돌리기용)
tool      : itemId | null      // 손에 든 소품
selected  : uid | null         // 방에서 고른 소품
hover     : { layer, col, row } | null
cat       : 카테고리 탭
balance   : number             // participant_currency.balance
owned     : itemId[]           // 보관함
modal     : null | 'shop' | 'help'
reward    : { id, msg } | null
toast     : string
```

**이벤트**
```
chooseTool(itemId)   placeAt(layer, col, row)   selectPlaced(uid)
flip(uid)  pickUp(uid)  store(uid)
setWallpaper(id)  setFloor(id)
purchase(itemId)  purchaseSet(setId)  applySet(setId)
saveRoom(room)  resetRoom()
```

**서버 연동 (Supabase, 기존 패턴 그대로)**
- 잔액: `lib/currency.js`의 `getCurrencyBalance(participantId)`
- 구매: `purchaseOutfit`과 동일한 순서를 따르는 `purchaseInterior({participantId, itemId, price})`를 새로 만든다
  1. 잔액 사전 확인 → 2. `participant_interior_items` insert(PK 중복 = 이미 보유, 과금 안 함) → 3. `currency_transactions` insert(`type:'spend_interior'`, amount 음수) → 4. `increment_currency_balance` RPC로 차감
  - 가격은 서버/클라 단일 출처(`lib/interiorCatalog.js`)에서만 읽는다 — `lib/shopCatalog.js`의 `SHOP_PRODUCTS` 주석과 동일한 원칙
- 방 저장: `participant_room` 테이블에 `room` JSONB upsert(participant_id 유니크)
- 필요한 새 스키마(참고: `scripts/shop_schema.sql` 형식을 따를 것)
```sql
create table participant_interior_items (
  participant_id text not null,
  item_id        text not null,
  acquired_at    timestamptz default now(),
  primary key (participant_id, item_id)
);
create table participant_room (
  participant_id text primary key,
  room           jsonb not null,
  updated_at     timestamptz default now()
);
```
- 오늘의 특가: `lib/shopCatalog.js`의 `getDailyDeal` 방식(날짜 문자열 해시)을 인테리어 카탈로그에 그대로 재사용. 할인율 40%

## Design Tokens
`app/globals.css`의 기존 변수를 그대로 쓴다. 새로 필요한 값만 추가:

| 용도 | 값 |
| --- | --- |
| 배경(데스크) | `#6E5844` |
| 패널 | `--beige #F5EDD8` |
| 패널 밝은 면 | `#FFF7E4` |
| 패널 어두운 면 | `--beige-dark #E8D8B8`, 탭 바 `#EDE2C6` |
| 외곽선 | `--text-dark #3A2A14` (4px 카드 / 3px 요소) |
| 보조 외곽선 | `--border-warm #C8A96E` |
| 강조(화폐·CTA) | `#E9B44C` (hover `#F2C468`) |
| 확정/적용 | `#7FA65C` (hover `#8FB86A`) |
| 삭제·태그 | `#C97C6B` (hover `#D98D7C`) |
| 나무 | `--brown #8B6347`, `--brown-dark #6B4327` |
| 본문 보조 텍스트 | `--text-mid #8B6A3A`, 흐린 텍스트 `--text-light #A09080` |
| 카드 그림자 | `6px 6px 0 rgba(0,0,0,.35)` / 버튼 `3px 3px 0 #3A2A14` |
| border-radius | **0 (전부 각진 픽셀 UI)** |
| 간격 | 6 / 10 / 12 / 14 / 16 / 24px |
| 타이포 | 한글 `Gothic A1` 700·800 (12 / 13 / 15 / 17 / 19 / 20px), 숫자·라벨 `Press Start 2P` (8 / 10 / 14 / 18px) |

> 한글 픽셀 폰트는 안정적인 CDN을 못 찾아 `Gothic A1` 굵기 + 두꺼운 각진 테두리로 레트로 톤을 냈다.
> 둥근모/갈무리 같은 폰트 파일을 직접 넣을 수 있으면 `Gothic A1`만 교체하면 된다(레이아웃 영향 없음).

## Assets
- 원본: `source/global.png` (4320x3440 인테리어 픽셀 타일셋, 사용자 제공)
- 잘라낸 스프라이트 40종: `assets/*.png` → 코드베이스에서는 `public/assets/interior/`로 옮길 것
- 재추출: `python extract_interior_sprites.py source/global.png public/assets/interior` (좌표 테이블이 스크립트 안에 있음)
- 아바타: `assets/avatar.png` — 리포의 `public/assets/world/player_body/hair/clothes.png` 첫 프레임(32x32, 정면 idle)을 합성한 것. 실제 구현에서는 착용 중인 outfit 스프라이트로 실시간 합성하는 편이 좋다
- 카탈로그(이름·가격·카테고리·칸 크기 `fw/fh`·원본 픽셀 `nw/nh`)는 `Cozy Room.dc.html`의 `CATALOG` 배열에 전부 들어 있다. 이 배열을 `lib/interiorCatalog.js`로 그대로 옮기는 것이 가장 빠르다
- 테마 세트 3종(`SETS`)과 기본 방 배치(`DEFAULT_ROOM`), 친구 방(`FRIEND_ROOM`)도 같은 파일에 있다

## Files
- `Cozy Room.dc.html` — 디자인 프로토타입(브라우저에서 바로 열림). 하단에 데이터 모델·이벤트·그리드 규격 요약 포함
- `assets/` — 스프라이트 40종 + avatar.png
- `source/global.png` — 원본 타일셋
- `extract_interior_sprites.py` — 스프라이트 재추출 스크립트

## 구현 순서 제안
1. `lib/interiorCatalog.js`(카탈로그·세트·가격·특가) + 스프라이트를 `public/assets/interior/`로 이관
2. 스테이지 렌더만 먼저 — 하드코딩된 `DEFAULT_ROOM`을 정확한 그리드 규격으로 그려서 픽셀 정렬 확인
3. 편집 모드(격자·고스트·배치·팝오버) + 로컬 state 저장/되돌리기
4. 보관함 패널 + 벽지/바닥 전체 적용
5. 상점 모달 + `purchaseInterior` + 획득 팝업 (스키마 2개 추가)
6. 방 저장/불러오기(`participant_room`), 마지막에 친구 방 읽기 전용
