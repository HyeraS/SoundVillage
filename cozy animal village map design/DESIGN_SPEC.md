# Handoff: SoundMimic Village — 동물 마을(Animal Zone) 맵

## Overview
Animal 존 내부 맵의 리스킨 디자인입니다. 플레이어가 2D 픽셀 농장 마을을 걸어다니며 둥둥 떠 있는 **동물 발자국 소리 아이템**을 찾고, 근접해서 SPACE를 누르면 전사(annotation) 패널이 열립니다. 마을은 다섯 개 구역(= 블록)으로 나뉘고, 한 구역의 아이템을 모두 전사하면 다음 구역이 열립니다.

- 톤: 낮 · 코지 · 농장 (동물의 숲류 비대칭 배치 + Tiny Pixel Farm류 우리/밭 구성)
- 시점: 2D 탑다운 (3D 아님)
- 맵 크기: **48 × 36 타일, 타일 = 32px** → 1536 × 1152 px (Nature/Music 존과 동일 규격)
- 뷰포트: 1120 × 660 px, 카메라 줌 ×2 (실제로 보이는 영역 560 × 330 px 월드 공간)
- 레이아웃 2안(A/B)을 같은 엔진에서 생성 — HUD의 `레이아웃 B 보기` 버튼으로 즉시 비교

## About the Design Files
`animal-village.js`는 **프레임워크 의존성이 없는 순수 ES 모듈**(맵 생성 + 충돌 + Canvas 드로잉)입니다. Music 존 핸드오프와 동일한 방침으로 **그대로 옮겨서 재사용하는 것을 권장**합니다. `Animal Village Map.dc.html`(입력 루프·HUD·미니맵·전사 패널)만 코드베이스 컨벤션(React 클래스/훅, 기존 `AnnotationPanel`)에 맞춰 다시 쓰면 됩니다.

## Fidelity
**High-fidelity.** 그래픽은 코드 드로잉이 아니라 **저장소에 이미 들어 있는 구매 에셋(shubibubi "All Things Cozy")을 그대로 크롭해서 씁니다.** 모든 스프라이트 좌표는 `components/AssetRegistry.js`에 이미 등록·검증되어 있는 실측값을 옮긴 것이라 새로 재보정할 필요가 없습니다.

사용 시트: `world/terrain.png`, `world/terrain-town.png`, `world/buildings.png`, `world/town_buildings.png`, `world/barn.png`, `world/coop.png`, `world/greenhouse.png`, `world/farm_items.png`, `world/nature.png`, `world/nature_village/house_cream.png`, `world/animals/*.png`(13종), `world/player_{body,clothes,hair}.png`.

> 디자인 파일 안에서는 `setAssetBase('public/assets/')`가 기본값입니다. Next 앱에 이식할 때 **`setAssetBase('/assets/')` 한 줄만 바꾸면** 됩니다.

---

## Screens / Views

### 1. Animal ZoneMap (메인 뷰)
- 상단 HUD 바 (배경 `#f7f0dd`, 하단 보더 3px `#d8c9a6`)
  - 좌: `← 월드맵` 버튼(`onExit`), `ANIMAL VILLAGE` (Press Start 2P 11px), 레이아웃 이름 (Galmuri11 12px `#8a7752`)
  - 중: `구역` 라벨 → 블록 카운터 (`#c98a3c`) → 진행 바 170×12px (트랙 `#e3d6b6` / 보더 2px `#b79b6b` / 필 `linear-gradient(90deg,#ffd166,#8fbf5a)`) → `n/8`
  - 우: `레이아웃 A/B 보기`, `전체 보기 (M)`, `🐾 전사 완료 n` pill
- 스테이지 1120 × 660 canvas
  - **현재 블록 안내 배너** — 상단 중앙, 구역 색 스와치 + `지금 열린 구역 — {이름}`
  - **미니맵** — 우상단, 192×144 (타일 1개 = 4px). 지형색 / 구역 오버레이(개방 alpha .22, 잠김 `#e6e2d4` alpha .8) / 건물 `#7a5a3a` / 플레이어 `#d9463f` / 카메라 뷰 사각
  - **조작 힌트 카드** — 좌하단
  - **구역 레전드** — 우하단, 5개 구역 색 + 이름(+`(잠김)`)
  - 비네트 `radial-gradient(120% 92% at 50% 45%, transparent 45%, rgba(48,38,16,.34) 100%)`
  - `CLICK TO PLAY` 오버레이 / 근접 프롬프트(`SPACE` + `{카테고리} 소리 전사하기`) / 언락 토스트(3.2초)
- 전사 패널: Music 존과 동일 구조, 팔레트만 농장 톤(`#fffaf0` 배경 / `#8fbf5a` 보더 / `#c98a3c` 강조)

---

## Interactions & Behavior

| 입력 | 동작 |
|---|---|
| 스테이지 클릭 | 인스턴스 활성화(`av-activate` 커스텀 이벤트로 한 번에 하나만) |
| ↑←↓→ / WASD | 이동. 2.4px/frame, 대각선 ÷1.41 |
| SPACE | 근접 아이템(46px 이내) 전사 패널 열기 |
| ESC | 패널 닫기 |
| M | 전체 보기 ↔ 걷기 모드 |

- 걷기 애니메이션: 8프레임 100ms (`Character v.2` 팩 규격 — 열 0~7이 한 걸음 주기)
- 아이템 부유 `sin(t/380 + phase) × 5px`, 스파클 `sin(t/200 + phase) > 0.4`
- 카메라: 플레이어 중심, 맵 경계 클램프
- 미니맵 260ms 스로틀
- 플레이어 위치는 state가 아니라 인스턴스 필드 + rAF 루프에서 갱신 (60fps setState 금지)

---

## 맵 데이터 구조 (`animal-village.js`)

```js
buildVillage('A') → {
  variant, label,
  terrain: number[36][48],  // 0 잔디 1 흙길 2 광장 3 물 4 밭 5 다리
  colliders: [{x, y, w, h, tag}],       // 픽셀 단위 AABB
  sprites:   [{spec, px, py, scale, sort}],  // y정렬 합성(건물·나무·동물·소품)
  fences, crops, detail, bridges, buildings, pens, fields, orchards,
  districts: [{block, name, area:{x,y,w,h}, neon}],
  items:     [{id, tx, ty, block, neon, cat, phase, collected}],
  spawn: {x, y},
  walkable(tx, ty),
}
```

### 레이아웃 A — 농장 안뜰
입구(남중앙) → 세로 대로 → 마을 광장(허수아비·벤치·건초) → 북쪽 헛간/사일로/닭장/온실. 서쪽에 젖소·돼지 우리, 남쪽에 밀밭, 동쪽에 연못 + 가로 목교, 광장 좌우에 과수원 2곳.

| 블록 | 이름 | 색 |
|---|---|---|
| 1 | 마을 광장 | `#ffd166` |
| 2 | 북쪽 헛간 | `#7cd06a` |
| 3 | 연못가 풀밭 | `#63c6f2` |
| 4 | 서쪽 우리 | `#ff9f6b` |
| 5 | 남쪽 작물밭 | `#c58bff` |

### 레이아웃 B — 연못 고리길
중앙 연못을 감싸는 고리 도로 + 세로 목교. 고리 바깥 네 모서리에 농가/헛간/닭장/온실을 두고 우리를 방사형으로 배치, 남쪽 어귀에 마을회관.

| 블록 | 이름 | 색 |
|---|---|---|
| 1 | 마을 어귀 | `#ffd166` |
| 2 | 서쪽 목장 | `#ff9f6b` |
| 3 | 연못 안뜰 | `#63c6f2` |
| 4 | 동쪽 방목장 | `#7cd06a` |
| 5 | 북쪽 언덕 | `#c58bff` |

### 충돌
- 플레이어 히트박스는 **발밑 20 × 14px**(`PLAYER_BOX`). 스프라이트 전체가 아니라 하단만 막습니다 — 탑다운 원근에서 자연스럽게 보이는 핵심.
- 건물은 **하단 66%만** 막습니다(지붕 뒤로 걸어 들어갈 수 있음).
- `moveWithCollision(v, pos, dx, dy)` — X/Y축 **분리 판정**이라 벽에 붙어도 미끄러집니다.
- 태그: `building`, `fence`, `crop`, `tree`, `bush`, `rock`, `prop`, `water`, `edge`. 다리 타일은 물 충돌에서 제외.
- `showColliders` 프롭으로 AABB 오버레이 디버그.

### 자연스러움 규칙 (디자인 의도 — 리팩터 시 깨뜨리지 말 것)
1. **길↔잔디 경계 페더링** — `featherEdges()`가 경계 타일에 흙/풀 색 2~4px 점을 서로 물리게 뿌립니다. 직선 경계가 그대로 드러나면 타일맵처럼 보입니다.
2. **잔디는 단색 + 텍스처 타일 + 새싹 스캐터** — 구매 시트의 잔디 오토타일은 전부 "섬" 모양이라 그대로 반복하면 체크무늬가 생깁니다(저장소에 이미 기록된 기존 결론). `#83924C` 바탕 + 이음매 없는 안쪽 타일 + 새싹 7종.
3. **나무 밀도는 가장자리 편향** — `edgeBias()`가 맵 테두리로 갈수록 확률을 78%까지 올려 숲으로 마을을 감쌉니다. 길 인접 타일(`nearPath`)에는 큰 나무를 심지 않습니다.
4. **건물은 흙 앞마당 위에** — 잔디 위에 건물만 얹으면 떠 보입니다. 각 건물 발밑에 3타일 높이 흙 앞마당을 깝니다.
5. **과수원은 격자로** — 자연 스캐터와 대비되는 규칙적 2타일 간격 식재가 "사람이 경작한 땅"을 읽히게 합니다.
6. **밭은 밀 아이콘 + 고랑** — 3행마다 통로를 비워 통행 가능, 나머지 행만 충돌.
7. **연못은 blob** — 각도별 반지름 wobble(`fillBlob`)로 사각형처럼 보이지 않게 하고, 물가 잔디에는 돌 밀도를 올립니다.

### 렌더 파이프라인 (성능상 중요)
1. **정적 레이어 1회 렌더** — `drawStatic(ctx, village)`를 1536×1152 오프스크린 canvas에 한 번만. 잔디 → 길/광장/밭 → 경계 페더링 → 고랑 → 물/다리 → 물가 돌 → 잔디 디테일 → 작물 → 울타리 → y정렬 스프라이트 → 팻말.
2. **매 프레임** — 오프스크린 blit → 아이템 → 플레이어 → 잠금 구름 → (옵션) 충돌 박스.

---

## Assets
`loadAssets()`가 26개 시트를 프리로드한 뒤 `buildVillage`/`drawStatic`을 호출해야 합니다. 좌표는 전부 `components/AssetRegistry.js`의 기존 등록값과 동일하므로, 원하면 하드코딩 대신 그 파일을 import해서 주입하도록 바꿔도 됩니다.

동물 스프라이트는 걷기 시트의 첫 프레임(정면 대기)만 정적 소품으로 사용합니다 — 이 프로젝트엔 동물 AI가 없습니다.

---

## 게임 로직 연결 (반드시 지킬 것)
소리 수집/블록 언락/진행도 계산은 **디자인 대상이 아닙니다.** 이 맵은 다음 두 지점만 기존 로직에 물리면 됩니다.

1. **아이템 소스 교체** — 현재 `spawnItems()`가 구역별 8개를 시드 기반으로 스폰합니다. 제품에서는 `SOUND_ITEMS.Animal`(그룹/블록 필터를 통과한 목록)을 받아 `{id, tx, ty, block, cat}`로 매핑하세요. 배치 후보 판정(`walkable` + collider 회피 + 최소 간격 3타일)은 그대로 재사용하면 됩니다. 제품 `block_size`는 15.
2. **제출 콜백** — `onSubmit({sound_id, zone:'Animal', sub_category, expression_text, confidence})`에 기존 Supabase `annotations` insert를 연결. 블록 클리어/언락은 기존 `unlockedBlock` 상태를 그대로 쓰고, 여기 목업 state는 버리세요.

`onExit`은 월드맵 복귀(`screen: 'world'`)에 연결합니다.

## Files
| 파일 | 내용 |
|---|---|
| `animal-village.js` | 맵 생성 · 충돌 · Canvas 드로잉 엔진. 의존성 없는 순수 ES 모듈 — 그대로 이식 권장 |
| `Animal Village Map.dc.html` | 맵 컴포넌트 (입력 루프, HUD, 미니맵, 전사 패널) |
| `public/assets/world/**` | 저장소에서 그대로 복사해 온 구매 에셋(추가 구매·재크롭 불필요) |

## 남은 작업 / 알려진 항목

| 항목 | 상태 |
|---|---|
| 연못 물 타일 | **해결** — `AssetRegistry.NATURE_VILLAGE_TILESET.waterFull`(terrain.png 96,224,32,32)은 연잎·기포 줄이 섞여 있어 반복 타일링하면 논처럼 보입니다. 알파+색상 스캔으로 물 픽셀 100%인 16×16 순정 구역 **terrain.png (736,0,16,16)** 을 찾아 이걸 씁니다(2색, 6×6 반복에서 이음매 없음 확인). 제품 이식 시 이 좌표를 `AssetRegistry`에 `pondWater`로 등록하는 걸 권장 |
| 연못 둔치/프린지/얕은 물 띠/수련잎 | 코드 드로잉(의도적) — 스프라이트로 존재하지 않는 레이어이고, 레퍼런스의 "흙 둔치 + 잔디 스캘럽" 느낌을 타일로는 낼 수 없습니다 |
| 다리 데크 | **코드 드로잉 — 교체 여지 있음.** 현재 `drawBridge()`가 판자/난간을 `fillRect`로 그립니다. terrain.png 안에 실제 목교/부두 스프라이트가 있습니다(알파 스캔 실측): **가로 부두 긴 구간 (70,720,90,26)**, **3판 데크 블록 (9,713,25,27)**, 낱장 판자 (4,680,26,11), 세로 난간 조각 (37,680,33,25). `bridgeRailing`(96,704,32,32)은 가로 전용이라 세로로 쌓으면 사다리처럼 보입니다 — 세로 다리를 유지하려면 (9,713,25,27) 데크 블록을 반복 타일링하는 쪽이 정석입니다 |
| 우리 게이트 시인성 | 게이트 스프라이트(`FENCE_GATE`)가 레일과 거의 같아 보여 입구가 눈에 안 띕니다. 충돌은 정상(열려 있음) — 팻말이나 흙길 한 칸을 게이트 앞에 붙이면 해결 |

## 구현 순서 제안
1. `animal-village.js`를 `lib/animalVillage.js`로 복사하고 `setAssetBase('/assets/')`.
2. `ZoneMap.js`의 Animal 분기를 이 엔진으로 교체 — 먼저 오프스크린 정적 레이어 캐싱부터.
3. 키 입력 + `moveWithCollision` 연결, `showColliders`로 충돌 확인.
4. `spawnItems`를 실제 `SOUND_ITEMS.Animal` 매핑으로 교체(위 1번).
5. 근접 판정 → 기존 `AnnotationPanel` 재사용 → `annotations` insert.
6. 블록 언락을 기존 `unlockedBlock`/`collectedIds`에 연결. 목업의 `unlocked` state 제거.
7. 레이아웃 A/B 중 확정안만 남기고 `swapLayout` 버튼 제거.
