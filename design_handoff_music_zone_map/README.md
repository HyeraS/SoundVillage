# Handoff: SoundMimic Village — Music Zone 맵 (강변 레코드 거리)

## Overview
SoundMimic Village의 **Music 존 내부 맵**입니다. 플레이어 캐릭터가 2D 픽셀 마을을 걸어다니며 둥둥 떠 있는 소리 아이템(음표·카세트)을 찾고, 근접해서 상호작용하면 **전사(annotation) 패널**이 열립니다. 마을은 다섯 개의 테마 거리(= 블록)로 나뉘고, 한 블록의 아이템을 모두 전사하면 다음 거리가 열리는 구조입니다.

- 톤: 밤 · 네온 · 팝 (동물의 숲 코지 배치 + 신스웨이브 간판)
- 시점: 2D 탑다운 (3D 아님)
- 맵 크기: **48 × 36 타일, 타일 = 32px** → 1536 × 1152 px (Nature 존과 동일 규격)
- 뷰포트: 960 × 600 px, 카메라 줌 ×2 (즉 실제로 보이는 영역은 480 × 300 px 월드 공간)

## About the Design Files
이 번들의 파일은 **HTML/Canvas로 만든 디자인 레퍼런스**입니다. 의도한 모양과 동작을 보여주는 프로토타입이며, 그대로 제품에 붙이는 프로덕션 코드가 아닙니다. 목표는 **이 디자인을 대상 코드베이스(React + Vite + Supabase 등 기존 환경)의 패턴으로 재현**하는 것입니다.

단, 예외가 하나 있습니다: `music-village.js`는 프레임워크 의존성이 없는 순수 ES 모듈(맵 생성 + 충돌 + Canvas 드로잉)이라 **그대로 옮겨서 재사용하는 것을 권장**합니다. 리액트 컴포넌트 쪽(HUD, 전사 패널, 입력 루프)만 코드베이스 컨벤션에 맞게 다시 쓰면 됩니다.

## Fidelity
**High-fidelity.** 색·간격·픽셀 조형·조명 밝기까지 최종안입니다. 드로잉은 32px 그리드 기준의 픽셀 아트로, 하위 픽셀 렌더링을 쓰지 않습니다(`imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`).

구매하신 itch.io 픽셀 에셋 팩은 이 디자인에 포함되지 않았습니다. 타일·건물·소품·캐릭터는 모두 코드로 그린 것이며, **에셋으로 교체하는 지점은 아래 "Assets" 절**에 정리했습니다.

---

## Screens / Views

### 1. Music ZoneMap (메인 뷰)
- **Purpose**: 마을을 걸어다니며 소리 아이템을 발견한다.
- **Layout** (전체 폭 960px, 세로 스택)
  - 상단 HUD 바: 높이 44px, `#1a1033`, 하단 보더 3px `#2b1d4d`
  - 스테이지: 960 × 600 canvas, 배경 `#0f0920`
  - 하단 레전드 바: 높이 40px, `#1a1033`, 상단 보더 3px `#2b1d4d`
  - 외곽: 4px 보더 `#2b1d4d`, radius 6px, 그림자 `0 24px 60px rgba(10,4,30,.55)`
- **Components**
  - **HUD 좌측**: 14×14 `#b06bff` 사각 + `MUSIC VILLAGE` (Press Start 2P, 11px, letter-spacing .5px) + 레이아웃 이름 (Galmuri11, 12px, `#9d8bc9`)
  - **HUD 중앙**: `블록` 레이블 `#9d8bc9` → 블록 카운터 (Press Start 2P 10px, `#ffd166`) → 진행 바 150×12px, 트랙 `#241a3d` / 보더 2px `#3a2a63` / 필 `linear-gradient(90deg,#ffd166,#ff5fa2)` → `n/8` 카운트
  - **HUD 우측**: `잠금 해제 (L)` 버튼(보더 2px `#6ef2c0`, 텍스트 `#6ef2c0`), `전체 보기 (M)` 버튼(보더 2px `#3a2a63`), 전사 완료 카운터 pill
  - **미니맵**: 스테이지 우상단 12px 오프셋, 192×144 canvas + 6px 패딩, 배경 `rgba(18,10,38,.86)`, 보더 2px `#3a2a63`. 타일 1개 = 4px. 구역 색 오버레이(개방 alpha .3 / 잠김 alpha .85 `#1d1440`), 건물 `#e7d9c4`, 플레이어 `#ff5fa2` 6×6, 카메라 뷰 사각 `rgba(244,236,255,.5)`
  - **조작 힌트 카드**: 좌하단 12px, 배경 `rgba(18,10,38,.86)`, 보더 2px `#3a2a63`, 11px `#9d8bc9`, 줄간 1.5
  - **비네트**: 스테이지 전체에 `radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(12,6,28,.62) 100%)`, pointer-events none
  - **CLICK TO PLAY 오버레이**: 비활성 상태에서 스테이지를 덮음. `rgba(12,6,28,.55)` + 중앙 배지(보더 3px `#b06bff`, Press Start 2P 11px, `vgPulse 1.6s infinite` 투명도 .55↔1)
  - **근접 프롬프트**: 스테이지 하단 26px, 배경 `#1a1033`, 보더 3px `#ff5fa2`, 그림자 `0 0 24px rgba(255,95,162,.45)`, `vgBob 1.4s ease-in-out infinite`(translateY 0 → -4px). 내용: `SPACE`(Press Start 2P 10px `#ffd166`) + `카세트 소리 전사하기` / `음표 소리 전사하기` (13px)
  - **언락 토스트**: 스테이지 상단 80px 중앙, 보더 3px `#6ef2c0`, 그림자 `0 0 28px rgba(110,242,192,.4)`, 3.2초 후 자동 소멸

### 2. 전사 패널 (모달)
- **Purpose**: 발견한 소리를 재생하고 의성어로 표현해 제출한다.
- **Layout**: 스테이지 위 오버레이 `rgba(10,5,24,.82)`, 중앙 정렬. 패널 폭 520px, 배경 `#1a1033`, 보더 4px `#b06bff`, 그림자 `0 20px 60px rgba(0,0,0,.6)`
- **Components**
  - 헤더: 패딩 12/16px, 배경 `#241a3d`, 하단 보더 3px `#3a2a63`. 좌측 `SOUND FOUND` (Press Start 2P 10px `#4de3f0`), 우측 `Music_123456 · Percussion` (11px `#9d8bc9`)
  - 본문 패딩 18/20px, 요소 간 gap 14px
  - 재생 버튼 52×52px, 배경 `#ff5fa2`, 보더 3px `#ffa6cd`, 글리프 `▶` / `||` (Press Start 2P 14px `#1a1033`), hover `#ff85b9`
  - 파형: 28개 바, flex gap 3px, 높이 44px 컨테이너(배경 `#120a26`, 보더 2px `#3a2a63`). 정지 시 바 `#3a2a63`, 재생 시 3개마다 `#4de3f0` / 나머지 `#b06bff`, 높이는 기준값 + sine 요동
  - 의성어 입력: textarea 76px, 배경 `#120a26`, 보더 2px `#3a2a63`, 15px `#f4ecff`, `maxLength=80`, placeholder `예: 딩- 디딩 하고 울리는`, 우하단 `n/80` (11px `#6f5f9a`)
  - 자신감 슬라이더: `min=1 max=5 step=1`, accent `#b06bff`. 라벨 = `전혀 아님 / 조금 맞음 / 보통 / 잘 맞음 / 아주 잘 맞음`, 값 `#ffd166`
  - 버튼 행: `나가기`(flex 1, 배경 `#241a3d`, 보더 3px `#3a2a63`, `#c9bbe8`) / `전사 제출`(flex 2, 배경 `#6ef2c0`, 보더 3px `#a9ffe2`, `#0f2b22`, 700, hover `#8ff7d2`)

---

## Interactions & Behavior

| 입력 | 동작 |
|---|---|
| 스테이지 클릭 | 해당 인스턴스 활성화(키 입력 수신). `mv-activate` 커스텀 이벤트로 한 번에 하나만 활성 |
| ↑←↓→ / WASD | 이동. 속도 2.4px/frame, 대각선은 ÷1.41 |
| SPACE | 근접 아이템(44px 이내) 전사 패널 열기 |
| ESC | 패널 닫기 |
| M | 전체 보기 ↔ 걷기 모드 |
| L | 전 구역 개방 ↔ 순차 언락 (디버그) |

- **애니메이션**: 걷기 4프레임 (110ms/프레임, 팔·다리 오프셋 ±1px). 아이템 부유 = `sin(t/380 + phase) × 5px`, 스파클은 `sin(t/200 + phase) > 0.4`일 때 표시. 네온 글로우는 정적(깜빡임 없음).
- **카메라**: 플레이어 중심, 맵 경계에서 클램프. 전체 보기 모드에서는 맵 전체가 들어가도록 줌 계산 후 중앙 정렬.
- **미니맵 갱신**: 260ms 스로틀.
- **블록 클리어**: 현재 블록 아이템을 모두 전사하면 `unlocked += 1`, 토스트 표시, 다음 구역 구름 제거.
- **로딩 상태**: 엔진 모듈은 동적 import. 로드 전에는 레이아웃 이름이 `로딩 중`.

## State Management
```
active: boolean        // 이 맵이 키 입력을 받는지
near: Item | null      // 근접 아이템
panel: Item | null     // 열린 전사 패널의 아이템
text: string           // 의성어 (80자 제한)
conf: 1..5             // 자신감
playing: boolean       // 재생 중 (파형 애니메이션)
collected: number      // 전사 완료 총계
unlocked: 1..5         // 개방된 블록
toast: string          // 언락 토스트
overview: boolean      // 전체 보기
freeRoam: boolean      // 전 구역 개방(디버그). 제품에서는 false로 시작
```
플레이어 위치 `{x, y, dir}`는 **state가 아니라 ref/인스턴스 필드**로 두고 rAF 루프에서 직접 갱신해야 합니다. 60fps setState는 금물.

데이터 페칭: 아이템은 현재 시드 기반으로 생성됩니다. 실제 게임에서는 `SOUND_ITEMS.Music`(존별 사운드 목록)을 받아 `{id, tx, ty, block, cat, kind}` 형태로 매핑하세요. 제출 시 `onSubmit({sound_id, zone, sub_category, expression_text, confidence})` 콜백이 호출되며, 여기에 기존 Supabase `annotations` insert를 연결합니다.

## Design Tokens

### 색 (엔진 `PAL` 객체와 동일)
```
night      #232049   기본 배경
grass      #3b3a72   grassAlt #413f7d   grassDark #332f63
cobble     #4b4585   cobbleAlt #544d92  cobbleDark #3d3873   // 벽돌 인도
brick      #6b5a92   brickAlt  #7a6aa1                        // 경계석/석축
plaza      #5a4f96   plazaAlt  #635891
water      #2f3f8c   waterLit  #4c62c4
wood       #7c5a63   woodLit   #9a707a
lamp       #ffd9a0   warm      #ffb45c                        // 조명
pink #ff6fae   cyan #63e6f2   yellow #ffd166   mint #7cf2c4   violet #b678ff
ink        #1a1638   white     #f6efff
```
UI 전용 색: 패널 `#1a1033`, 서브 패널 `#241a3d`, 입력 배경 `#120a26`, 보더 `#3a2a63` / `#2b1d4d`, 본문 텍스트 `#f4ecff`, 보조 텍스트 `#9d8bc9` / `#c0b1e4`, 비활성 `#6f5f9a`

### 구역(블록) 액센트
```
1 버스킹 광장   #ff6fae
2 레코드 거리   #63e6f2
3 악기 골목     #ffd166
4 카페 거리     #7cf2c4
5 페스티벌 무대 #b678ff
```

### 타이포그래피
- `Press Start 2P` — HUD 레이블·카운터·배지 (10~11px, 대문자 라틴 전용)
- `Galmuri11` — 한글 본문·버튼·패널 (11 / 12 / 13 / 14 / 15px, 700은 강조)
- Canvas 내부 텍스트: `bold Npx "Courier New", monospace` (구역 팻말 13px, 간판 11px, LIVE 16px)

### 간격 / 형태
- 타일 32px, 스프라이트 정렬은 항상 정수 픽셀 (`Math.round`)
- 보더 두께 2px(보조) / 3px(구획) / 4px(외곽)
- radius는 사실상 0 (외곽 6px만) — 픽셀 아트 톤 유지
- 그림자: 접지 `rgba(24,20,65,.34~.4)`, 네온 글로우는 radial-gradient alpha .12~.42

---

## 맵 데이터 구조 (`music-village.js`)

```js
buildVillage('B') → {
  variant, label,
  terrain: number[36][48],   // 0 grass 1 street 2 plaza 3 water 4 stage 5 bridge
  colliders: [{x, y, w, h, tag}],   // 픽셀 단위 AABB
  props:     [{type, tx, ty, neon, block, tone}],
  items:     [{id, tx, ty, block, neon, cat, kind, phase, collected}],
  districts: [{block, name, area:{x,y,w,h}, neon}],
  buildings: [{id, x, y, w, h, label, wall, wallLit, roof, roofLit, neon, roofKind, extras, awning}],
  stage, busking, water, bridges, fences, strings,
  spawn: {x, y},             // 픽셀
  walkable(tx, ty),
}
```

### 충돌
- 플레이어 히트박스는 **발밑 20 × 14px** (`PLAYER_BOX`). 스프라이트 전체가 아니라 하단만 막습니다 — 탑다운 원근에서 자연스럽게 보이는 핵심.
- `moveWithCollision(v, pos, dx, dy)` — X축과 Y축을 **분리 판정**해서 벽에 붙어도 미끄러집니다. 대각선 이동 중 한 축이 막혀도 다른 축은 살아있어야 합니다.
- 충돌 대상 태그: `building`, `stage`, `busking`, `fence`, `water`, `edge`, 그리고 각 소품 타입명. 다리(`bridges`) 구간은 물 충돌에서 제외돼 통행 가능합니다.
- `showColliders` 프롭으로 AABB를 `rgba(255,95,162,.7)` 선으로 오버레이해 디버그할 수 있습니다.

### 렌더 파이프라인 (성능상 중요)
1. **정적 레이어 1회 렌더** — `drawStatic(ctx, village, {neon})`를 1536×1152 오프스크린 canvas에 한 번만 그립니다. 지면 → 구역 색 오버레이 → 가로등 빛 웅덩이 → 울타리 → 버스킹 정자 → 무대 → (건물+소품 y정렬 합성) → 스트링 라이트 → 구역 팻말 순서.
2. **매 프레임** — 오프스크린을 카메라 오프셋만큼 `drawImage`로 blit → 아이템 → 플레이어 → 잠금 구름 → (옵션) 충돌 박스.
3. `neon` 값이 바뀔 때만 정적 레이어를 다시 렌더합니다.

### 건물 조형 규칙 (레퍼런스 대응)
직선 박스를 피하기 위해 건물 하나를 **세 덩어리**로 구성합니다.
- **본체** — 벽돌 결 + 좌측 하이라이트 + 우측 음영 + 하단 석재 기단, 좌우 모서리에 크기가 번갈아 어긋나는 돌 코너 블록(퀀)
- **측면 윙** — 본체보다 한 단 낮고 좁게 삐져나오며 자체 지붕을 가짐
- **타워 베이** — 본체보다 높이 솟고, 원형 오쿨루스 창 + 뾰족 지붕 + 첨탑 장식. 좌/우 배치는 `b.x % 2`로 건물마다 갈림
- **지붕** — 아래로 갈수록 급격히 벌어지는 오목 곡면 맨사드(`inset = topInset × (1 − t^2.2)`), 대각 엇갈림 지붕널, 좌우로 크게 나온 처마 + 서까래, 마루 크레스팅, 경사면 도머
- **창** — 계단식 아치 캡 + 창틀 + 세로/가로 창살 + 창대·인방 + 양옆 슬랫 셔터. 점등 여부는 `(col + row×2 + b.x) % 4 !== 0`로 섞어 균일함을 깨뜨립니다
- **현관** — 벽 안쪽으로 파인 오목 포치에 아치문, 양쪽 랜턴, 4단 계단, 난간
- **간판** — 어닝 위(`y + h − 98`)에 네온 박스 사인 + 가게별 돌출 간판(레코드판·기타·커피컵·건반 트림)

## Assets
현재 모든 그래픽은 **코드로 그린 것**입니다(외부 이미지 0개). 구매한 itch.io 픽셀 팩으로 교체할 때 손댈 지점:

| 교체 대상 | 현재 함수 | 교체 방법 |
|---|---|---|
| 지면 타일 | `drawGround()` 내 terrain 코드별 분기 | 타일셋 스프라이트를 32×32 단위로 `drawImage` |
| 건물 | `drawBuilding()` | 건물 스프라이트 1장으로 대체하고, 위치는 `b.x/b.y` 유지 |
| 소품 | `PROP_DRAW[type]` (18종) | 타입명 → 스프라이트 좌표 맵으로 치환 |
| 캐릭터 | `drawPlayer()` | 4방향 × 4프레임 시트로 교체. 현재 `p.dir`, `moving`, `frame` 인터페이스 그대로 사용 가능 |
| 아이템 | `drawItem()` | 음표/카세트 스프라이트 + 글로우는 코드 유지 권장 |

폰트: Google Fonts `Press Start 2P`, `Galmuri11`.

## Files
| 파일 | 내용 |
|---|---|
| `music-village.js` | 맵 생성 · 충돌 · Canvas 드로잉 엔진. 의존성 없는 순수 ES 모듈 — 그대로 이식 권장 |
| `Music Village Map.dc.html` | 맵 컴포넌트 (입력 루프, HUD, 미니맵, 전사 패널). 로직 클래스는 파일 하단 `<script data-dc-script>` 안 |
| `음악 마을 맵.dc.html` | 위 컴포넌트를 감싼 프레젠테이션 페이지 (설명·구현 노트) |
| `support.js` | 프로토타입 런타임. 이식 대상 아님 |

---

## 구현 순서 제안
1. `music-village.js`를 그대로 프로젝트에 복사. `buildVillage('B')`가 반환하는 객체 형태를 확인한다.
2. 960×600 canvas 하나와 rAF 루프를 가진 `MusicZoneMap` 컴포넌트를 만든다. 정적 레이어 오프스크린 캐싱을 먼저 붙인다.
3. 키 입력 + `moveWithCollision` 연결. `showColliders`로 충돌이 맞는지 확인한다.
4. 아이템 배열을 실제 `SOUND_ITEMS.Music`으로 교체. `block_size`는 제품 기준(15)으로 올린다 — 목업은 화면 확인용으로 8개만 스폰한다.
5. 근접 판정 → 기존 `AnnotationPanel` 재사용(또는 위 스펙대로 새로 구현) → `annotations` insert 연결.
6. 블록 클리어 조건과 언락 연출을 기존 진행 상태 저장 로직에 연결. `freeRoam` / `unlockAll`은 개발용 플래그로 남기고 기본값 `false`.
7. 마지막에 itch.io 에셋으로 드로잉 함수를 교체한다. 이 순서를 지키면 에셋 교체가 게임 로직에 영향을 주지 않는다.
