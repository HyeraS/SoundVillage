# Music Production Handoff Spec

작성일: 2026-08-29  
입력 버전: B1 `2C-B1-v1`, B2 `2C-B2-v1`, B3.1 `2C-B3.1-v1`, B4 `2C-B4-v1`  
상태: production 미적용, handoff 명세만 완료

## 1. 목적과 권위

이 문서는 승인된 Music visual slice를 이후 production renderer에 적용할 때 필요한 asset, 좌표, draw order, collision/interaction 대조 항목을 고정한다. Production code, runtime asset, annotation 또는 연구 데이터는 이번 B4에서 변경하지 않았다.

권위 순서:

1. 연구·제품 불변 조건: `RESEARCH_DESIGN_CONSTRAINTS.md`, `SCOPE_AND_CONTEXT_FREEZE.md`
2. 전역 렌더 문법: `GLOBAL_ART_LANGUAGE_AND_VILLAGE_IDENTITY.md`
3. 시각·좌표 승인: B1, B2, B3.1 source manifest
4. 통합 index와 검증: `public/design-previews/music-vertical-slice-b4/manifest.json`
5. Production runtime의 실제 collision·interaction: 적용 단계에서 측정·승인 후 권위 확정

B4 manifest는 source manifest 내용을 복사하지 않고 경로와 승인 variant를 참조하는 integration index다.

## 2. Source manifest

| 영역 | source |
|---|---|
| ground/path | `public/design-previews/music-ground-path-b1/music-ground-path-b1-manifest.json` |
| Stage/Gate | `public/design-previews/music-landmarks-b2/manifest.json` |
| 건물/prop | `public/design-previews/music-buildings-props-b3/manifest.json` |
| 통합 index | `public/design-previews/music-vertical-slice-b4/manifest.json` |

승인 variant는 Stage `S1`, Gate `G1`, buildings/props `2C-B3.1-v1`이다. S2와 G2는 비교 자료이며 production 후보가 아니다.

## 3. Ground/path mapping

### 승인 source

- master: `music-ground-path-b1-atlas.svg`
- runtime-size atlas: `music-ground-path-b1-atlas.png`
- full composition reference: `music-ground-path-map.svg/.png`
- tile family: grass 5, soil 4, path edge bitmask 16, curve 4, Garden/approach 8
- tile: 32×32 RGBA, runtime scale 1, smoothing off

### Production renderer 대응 후보

| 승인 요소 | 현재 production 후보 | 적용 원칙 |
|---|---|---|
| grass/soil variants | `drawGround()` terrain fill | atlas tile로 교체하되 variant는 결정론적으로 배치 |
| main loop/spine | `layoutB().streets/plazas` | 기존 canal/street geometry를 재사용하지 않고 승인 B1 geometry로 별도 mapping |
| Garden ring/shortcut | 현재 대응 없음 | B1 전용 geometry와 tile family 추가 필요 |
| Gate/Stage approach | 현재 entrance label/stage terrain | visual approach와 runtime walkable mask를 분리 |
| full map PNG | 현재 offscreen static canvas | 단일 충돌 source로 사용 금지; composition reference 또는 background layer 후보 |

Walkability를 PNG alpha나 palette로 추론하지 않는다. B1의 full-map image는 시각 source이며 실제 collision/walkable data는 production에서 별도로 정의한다.

## 4. Landmark mapping

### Resonance Stage S1

| 항목 | 값 |
|---|---|
| map rect | `x=576,y=96,w=384,h=224` |
| tile footprint | `x=18,y=3,12×7` |
| local anchor | bottom-center `(192,224)` |
| map anchor | `(768,320)` |
| collision | `x=18,y=3,12×5` |
| approach | `x=23,y=10,3×3` |
| facing | south |

Production layer 후보:

1. `contact-shadow`
2. `base-platform`
3. `rear-body`
4. `opening`
5. `canopy-s1`
6. `trim`
7. `front-stair`
8. `foreground`
9. `emissive`

`collision`, `approach`, `canopy-visibility`는 guide이며 participant 화면에 포함하지 않는다.

### World Gate G1

| 항목 | 값 |
|---|---|
| map rect | `x=704,y=1024,w=128,h=96` |
| tile footprint | `x=22,y=32,4×3` |
| local anchor | bottom-center `(64,96)` |
| map anchor | `(768,1120)` |
| left post collision | `x=22,y=32,1×3` |
| opening/walkable | `x=23,y=32,2×3` |
| right post collision | `x=25,y=32,1×3` |

Production layer 후보:

1. `contact-shadow`
2. `posts`
3. `rail-g1`
4. `trim`
5. `foreground`
6. `emissive`

`collision`, `interaction`, `opening-guide`, full-map marker clearance는 guide이며 production visual layer에서 제외한다.

## 5. Building mapping

| 건물 | map rect | canvas / anchor | collision | entrance / clearance |
|---|---|---|---|---|
| Record Archive | `x=4,y=4,8×6` | `256×192 / (128,192)` | `4,4,8×6` | south / `6,10,3×3` |
| Listening Cafe | `x=35,y=5,10×5` | `320×160 / (160,160)` | `35,5,10×5` | south / `38,10,3×3` |
| Community Studio | `x=3,y=28,10×5` | `320×160 / (160,160)` | `3,28,10×5` | east, door `12,28,1×3` / `13,28,3×3` |
| Sound Workshop | `x=36,y=27,8×6` | `256×192 / (128,192)` | `36,27,8×6` | west, door `36,28,1×3` / `33,28,3×3` |

각 building layer:

`contact-shadow → body → roof → door-window → trim → foreground → emissive`

`collision`과 `entrance-clearance` 파일은 runtime visual에 포함하지 않는다. Interaction trigger는 door 그림의 opaque pixel이 아니라 명시적 tile/rect data로 구현한다.

## 6. Prop와 vegetation mapping

승인 prop asset과 placement는 B3.1 manifest의 `props`와 `placements`가 권위다. Handoff 문서에서 좌표를 복제 관리하지 않는다.

포함 family:

- flowerbed, bench, planter, lamp
- shrub, low tree
- Garden resonance object
- Gate/Stage low vegetation
- foreground edge cluster

적용 규칙:

- placement 27개를 기본판으로 유지한다.
- marker 중심 1 tile과 주 접근 방향 2 tiles를 침범하지 않는다.
- 건물 3×3 entrance clearance를 침범하지 않는다.
- Garden, Gate, Stage vegetation은 같은 family로 유지한다.
- Pilot 근거 없이 density를 늘리지 않는다.
- foreground edge cluster는 logical collision을 새로 만들지 않는다.

## 7. 통합 draw order

Production 권장 순서:

1. ground base / soil
2. path, loop, spine, Garden, approach tile
3. contact shadow
4. Stage/Gate base, body, opening, posts
5. building body
6. roof, canopy, rail, door/window, trim
7. low prop와 vegetation, y-sort가 필요한 개체
8. foreground cutout/overhang
9. environment emissive
10. character
11. sound marker와 interaction label
12. HUD/annotation UI

Collision, interaction, entrance, marker clearance guide는 개발·QA overlay에서만 마지막에 표시한다. Participant build의 visual draw order에 포함하지 않는다.

[draw-order diagram](previews/2c-b4-music/b1-b3-layer-hierarchy-diagram.png)

## 8. Collision과 interaction handoff

### 적용 전 필수 측정

| 항목 | 목표 | 현재 상태 |
|---|---|---|
| visual edge ↔ runtime collision | 차이 ≤0.5 tile | preview guide만 통과, production 미측정 |
| Gate opening | 2×3 tile 전 구간 통행 | preview 승인, real player input 미연결 |
| Gate post | 좌우 1×3 collision | preview 승인, runtime mask 미연결 |
| Stage | rear 12×5 collision, south 3×3 approach | preview 승인, runtime corner test 필요 |
| 네 건물 | manifest collision 유지 | preview 승인, runtime corner test 필요 |
| 네 entrance | 3×3 접근 + trigger 방향 | preview 승인, runtime trigger 미연결 |
| marker | 중심 1 tile + 주 접근 2 tiles | static overlap 0, real interaction radius 미연결 |
| foreground | foot/marker/door 가림 0 | static 통과, moving character test 필요 |

### Player box 불일치

- B2–B4 시각 검수 reference hitbox: 22×28
- 현재 `lib/musicVillage.js`: `PLAYER_BOX = { w:20, h:14 }`
- 현재 visual character: 72×88

2C-C는 값을 자동 변경하지 말고 먼저 현재 `GameEngine`/`ZoneMap` 공통 collision 계약과 Music 전용 box를 대조해야 한다. 선택된 권위값으로 Gate post, Stage corner, 네 building corner, marker interaction을 다시 측정한다.

### Marker interaction

현재 production은 item 중심의 24×24 rect와 player box overlap으로 근접을 판정한다. 승인 preview는 시각적 1+2 tile clearance를 정의한 것이며 interaction radius 변경 승인이 아니다. 2C-C에서 다음을 분리한다.

- visual clearance: B4 manifest 유지
- runtime pickup/annotation trigger: 현재 데이터 계약 유지 또는 별도 승인
- marker state renderer: 9개 시각 상태를 실제 저장 상태와 연결하기 전 상태 mapping 문서 작성

## 9. 현재 production과 승인 preview 차이

| 분류 | 현재 production | 승인 preview | 분류 |
|---|---|---|---|
| ground/path | night indigo, canal/bridge, fragmented streets | bright ground, single loop, spine, Garden shortcut | production 적용 시 필수 |
| landmark | Stage `x=37,y=6,9×7`, busking `x=19,y=29` | Stage `x=18,y=3,12×7`, central Garden; 별도 busking mass 없음 | production 적용 시 필수 |
| World Gate | `ENTRANCE x=21,y=34` label/radius, visual Gate 없음 | G1 4×3, center x24, 2-tile opening | 적용 전 추가 확인 필요 |
| 일반 건물 | 8개, 구체 sign와 instrument/source extras | 4개 중립 건물, 승인 silhouette/entrance | production 적용 시 필수 |
| prop/vegetation | district별 절차 생성, speaker/light rig/instrument props | 고정 저밀도 27 placement, neutral low props | production 적용 시 필수 |
| foreground | fence/string light/vignette 중심, 분리 cutout 없음 | building/landmark/edge foreground asset | production 적용 시 필수 |
| emissive | neon sign, light pool, item glow, string light | 정적 저 opacity mask, marker보다 약함 | production 적용 시 필수 |
| camera/FOV | player-follow 24×18, spawn `(21,25)` | 검수 FOV 24×18, start center x24/y29, Gate→Garden 축 | 적용 전 추가 확인 필요 |
| collision/walkable | canal/building/busking/fence 기반 procedural collider | Stage/Gate/네 건물 정수 guide, B1 별도 walkable 필요 | 적용 전 추가 확인 필요 |
| marker/UI | note/tape, bob/glow, done alpha, block fog | 9-state ring/glyph/label grammar | production 적용 시 필수 |
| asset loading | Canvas drawing functions, static offscreen canvas | SVG master + RGBA PNG layers/atlas | 적용 전 추가 확인 필요 |
| draw order | static canvas→items→fog; PixelChar DOM; vignette DOM | 명시적 layer stack, marker/UI 최상위 | production 적용 시 필수 |
| guide/comparison | 없음 | collision/clearance/concept/montage | preview 전용, production 제외 |
| night/event | night가 현재 base | 밝은 늦은 오후가 base; night는 별도 후보 | 향후 event layer |
| annotation/Museum/reward | 현재 production 계약 | B4에서 import·변경 없음 | 현재 디자인 범위 밖 |

## 10. Production에서 제외할 파일

- `guides/` 아래 collision, interaction, entrance, marker clearance, foreground guide
- `mock-character.*`
- `variants/`의 ImageGen concept reference
- `design/2d-map-redesign/previews/`의 모든 montage/comparison/scorecard image
- S2 Stage와 G2 Gate variant
- B1 seam/repetition/tile-grid 검수 overlay
- B4 integration manifest의 review image 경로

이 파일은 QA와 handoff 근거로 보존하지만 participant-facing renderer에서 로드하지 않는다.

## 11. 연구·기능 비변경 조건

2C-C가 승인되더라도 시각 적용만으로 다음을 변경할 권한은 생기지 않는다.

- Music-first와 Block 1의 그룹별 15 sound 완료 조건
- participant/group/session, sound metadata, block 진행
- annotation 저장·panel·technical failure·skip 정책
- Museum 후보 집계와 반대 그룹 검증
- Supabase/DB/SQL/RPC
- reward, currency, house-decor
- 다른 다섯 마을과 월드맵

현재 production의 known research mismatch는 별도 기능/연구 작업이다. Visual renderer 적용과 한 commit/단계로 묶지 않는다.

## 12. 2C-C 시작 전 결정

2C-C 실행 프롬프트에는 최소 다음 결정을 명시해야 한다.

1. B4 visual slice 동결 승인 여부
2. B1 tile atlas를 runtime tile renderer로 사용할지, 승인 full-map background를 분리 layer로 사용할지
3. production의 20×14 player box와 22×28 reference 중 runtime collision 권위
4. 승인 spawn/Gate 중심축과 현재 `ENTRANCE`/spawn 좌표 migration 방식
5. 기존 실제 sound 배치를 승인 loop에 재배치하는 결정론적 규칙과 group/block 검증 계획
6. 9-state marker를 현재 annotation/save/error state에 연결하는 별도 mapping 범위
7. production 적용 후 desktop/mobile real-input collision test 환경

이 결정 전에는 production Music renderer, collision, interaction 또는 asset import를 변경하지 않는다.
