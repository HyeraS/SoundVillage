# 2C-B2 — Resonance Stage 및 World Gate 에셋 제작

작성일: 2026-08-29  
상태: 비교 에셋·검수 완료, 사용자 선택 및 start-FOV 충돌 결정 대기  
production 반영: 없음  
격리 preview: `/music-whitebox-preview`

## 1. 범위와 B1 승인사항

이번 단계에서는 Resonance Stage와 World Gate만 제작했다. 네 일반 건물, 전체 식생·bench·lamp·prop family, production Music map은 변경하지 않았다.

- 시간대: **밝고 부드러운 늦은 오후**
- ground `#AAB490`, variant `#B3BC98`, soil `#B89E7C`
- warm stone `#D9C7A8`, muted teal `#668F8A`, soft lavender `#A89BC0`, warm gold `#C69A45`
- Direction B의 32px modular grammar는 유지
- 야간, 넓은 보라 shadow, neon, concert/club 장비는 제외
- House-decor는 Music 팔레트의 근거가 아닌 meta/customization space

## 2. Garden motif와 Gate pad 수정

Garden 중심의 닫힌 원·점선 원·겹친 ring을 제거했다. 대체 motif는 서로 중심이 어긋난 짧은 teal/lavender 파형, 끊긴 짧은 띠와 바닥 방향 변화다.

- 닫힌 원과 이중 ring 없음
- 높은 object 없음
- shortcut과 marker clearance 유지
- active marker보다 낮은 opacity와 대비

[Garden 수정 전·후](previews/2c-b2-music/garden-motif-before-after.png)

World Gate pad의 강한 gold 외곽선은 3px stone edge로 교체했다. Gold는 작은 중앙 trim에만 남겼다.

[Gate pad 수정 전·후](previews/2c-b2-music/gate-pad-before-after.png)

## 3. ImageGen과 grid 정리의 구분

Built-in ImageGen은 silhouette와 재료 비교 참고에만 사용했다.

- [Stage S1/S2 concept](../../public/design-previews/music-landmarks-b2/variants/imagegen-stage-s1-s2-concept.png)
- [Gate G1/G2 concept](../../public/design-previews/music-landmarks-b2/variants/imagegen-gate-g1-g2-concept.png)

Prompt 핵심은 동일 카메라·동일 footprint·밝은 늦은 오후, warm plaster/stone/wood, 제한 teal/lavender/gold, player·marker·UI·text·instrument·note·speaker·neon·night 제외였다. 첫 Gate 호출은 연결 오류로 결과가 생성되지 않아 같은 built-in mode에서 동일 제약으로 한 번 재시도했다.

ImageGen 결과를 production-compatible asset으로 직접 사용하지 않았다. 실제 비교 에셋은 SVG에서 정수 world-pixel 좌표로 재구성하고 RGBA PNG로 rasterize했다. Perspective, 비대칭 창문, 배경과 생성 texture는 가져오지 않았다.

## 4. Resonance Stage 규격

| 항목 | 값 |
|---|---|
| map footprint | x=18–30, y=3–10 |
| pixel rect | x=576, y=96, 384×224px |
| tile footprint | 12×7 |
| local anchor | bottom-center `(192,224)` |
| map anchor | `(768,320)` |
| face/opening | 남쪽 |
| collision | x=18, y=3, 12×5 tiles |
| approach clearance | x=23, y=10, 3×3 tiles |

Whitebox의 12×7 footprint와 남북 중심축을 변경하지 않았다. Stage 내부·후면 5 tile depth는 collision guide이며, 남쪽 3×3 접근 guide는 별도다.

### 레이어

1. `contact-shadow`
2. `base-platform`
3. `rear-body`
4. `opening`
5. `canopy-s1` 또는 `canopy-s2`
6. `trim`
7. `front-stair`
8. `foreground`
9. `emissive`
10. `collision`
11. `approach`
12. `canopy-visibility`

각 layer는 같은 384×224 canvas와 anchor를 공유해 preview에서 독립적으로 켜고 끌 수 있다. 3×3 approach와 start-FOV 검수는 full-map guide를 추가로 사용한다.

## 5. S1/S2 비교

[동일 조건 S1/S2 비교](previews/2c-b2-music/stage-s1-s2-comparison.png)

| 기준 | S1 — Low double-wave | S2 — Restrained triple-wave |
|---|---|---|
| 실루엣 | 넓고 낮은 두 rhythm | 세 개의 얕은 rhythm |
| 모바일 | 가장 단순하고 안정적 | 작은 화면에서 굴곡 밀도가 증가 |
| Music 정체성 | 구조적으로 충분하나 절제됨 | 더 명시적임 |
| 위험 | 일반 awning처럼 보일 가능성 | scallop·놀이공원 천막처럼 읽힐 가능성 |
| 위계 | 열린 마을 무대 | Stage의 장식성이 더 강함 |

Codex 권장안은 **S1**이다. 12-tile landmark의 폭과 opening을 가장 빠르게 읽을 수 있고, 첫 마을의 친근함을 유지하면서 marker보다 시각적으로 앞서지 않는다.

## 6. World Gate 규격

기존 4×2.5 guide와 비교해 정수 tile collision·opening을 기록할 수 있는 **4×3 visual footprint**를 채택했다. Main spine 폭과 첫 marker 좌표는 바꾸지 않았다.

| 항목 | 값 |
|---|---|
| map footprint | x=22–26, y=32–35 |
| pixel rect | x=704, y=1024, 128×96px |
| tile footprint | 4×3 |
| local anchor | bottom-center `(64,96)` |
| left post collision | x=22, y=32, 1×3 tiles |
| opening/walkable | x=23, y=32, 2×3 tiles |
| right post collision | x=25, y=32, 1×3 tiles |

중앙 opening의 아래쪽 통행 영역은 64px 전체가 alpha-clear하며 두 post만 collision이다. Gate 앞 3×3 접근 영역과 M01의 1/2 tile clearance guide가 구조물과 겹치지 않는다.

### 레이어

1. `contact-shadow`
2. `posts`
3. `rail-g1` 또는 `canopy-g2`
4. `trim`
5. `foreground`
6. `emissive`
7. `collision`
8. `interaction`
9. `opening-guide`
10. full-map `marker-clearance-overlay`

## 7. G1/G2 비교

[동일 조건 G1/G2 비교](previews/2c-b2-music/gate-g1-g2-comparison.png)

| 기준 | G1 — Open wave rail | G2 — Shallow wave canopy |
|---|---|---|
| 통과성 | opening 너머가 가장 잘 보임 | opening은 명확하지만 상부 면적이 큼 |
| Music 정체성 | rail의 구조 rhythm으로 절제 | teal canopy로 더 강함 |
| Stage 위계 | 경쟁하지 않음 | S2와 함께 쓰면 wave 면적이 반복됨 |
| 모바일 | 두 post와 2-tile opening이 즉시 분리 | canopy가 portal header처럼 읽힐 가능성 |

Codex 권장안은 **G1**이다. 시작점에서 통행 가능성이 가장 명확하고 Stage와 위계 경쟁이 없다.

Gate composite에서 exact gold-tone pixel을 visible pixel과 비교한 값은 G1 약 0.72%, G2 약 0.12%다. 반투명 edge까지 고려해도 승인 목표 10%보다 충분히 낮고 ground pad의 gold 경계는 없다.

## 8. Palette·재료·emissive

- body: warm plaster `#E2D3B8`, warm stone `#D9C7A8`
- platform: wood `#A97856`, highlight `#C28E64`
- Stage opening: 제한된 navy `#3F4358`
- canopy/rail: muted teal·soft lavender
- trim: 낮은 opacity의 warm gold
- key light: 좌상단, contact shadow: 짧은 우하단

Stage+Gate emissive mask의 non-zero pixel은 1536×1152 전체의 약 **0.058%**다. 5% 예산보다 낮고 모두 정적·저 opacity이며 light가 없어도 opening과 path가 읽힌다. Preview에서 emissive layer를 독립적으로 끌 수 있다.

## 9. Draw order와 파일

공통 draw order:

1. B1 ground/path
2. contact shadow
3. base/body/posts
4. opening
5. canopy/rail
6. trim
7. stair
8. foreground overhang
9. emissive
10. collision/interaction/clearance guide
11. character
12. sound marker와 UI

파일 root: `public/design-previews/music-landmarks-b2/`

- `stage/`: S1/S2 composites, emissive-off composites, 12개 SVG+PNG layers
- `gate/`: G1/G2 composites, emissive-off composites, 9개 SVG+PNG layers
- `guides/`: collision/interaction, Stage approach, marker clearance, canopy visibility, 72×88 mock character
- `variants/`: ImageGen concept reference 2개
- [manifest.json](../../public/design-previews/music-landmarks-b2/manifest.json): pixel size, tile footprint, anchor, collision, opening, draw order

## 10. Preview와 검수 결과

격리 route `/music-whitebox-preview`에는 다음이 추가됐다.

- Stage off/S1/S2
- Gate off/G1/G2
- Stage 8개 visual layer toggle
- Gate 5개 visual layer toggle
- emissive, collision, interaction, marker clearance, foreground, grayscale, character toggle
- whitebox/B1+B2, desktop/mobile, start/center/Stage camera
- 실제 renderer와 동일한 표시 크기 72×88px·발 접점의 비저장 mock character

브라우저에서 S1/G1 desktop과 S2/G2 mobile을 전환하고 collision·interaction·clearance, grayscale, emissive-off를 확인했다. Console warning/error는 없었다. Preview는 Supabase, annotation, Museum, reward, currency, participant state와 production Music renderer를 import하지 않는다.

### Desktop·mobile

- 24×18 Stage camera: Stage opening, stair와 canopy silhouette 유지
- 24×18 center: Garden shortcut과 Stage 접근축 유지
- 14×25 portrait start: Gate의 두 post와 중앙 2-tile opening 분리
- 28×13 landscape center: Garden ring path와 shortcut 분리
- grayscale: body/opening/path 명도 위계 유지
- emissive off: 통행·opening·landmark 인지 유지

### Character·occlusion

- mock character: 72×88px, 실제 `ZoneMap` 표시 크기와 동일
- reference hitbox: 22×28px
- Gate test foot: `(768,1008)`, Gate visual top y=1024보다 16px 앞
- Stage test foot: `(784,416)`, 3×3 approach guide 남단
- Gate foreground는 foot를 가리지 않고 중앙 opening을 침범하지 않는다.
- Stage stair/foreground는 approach character의 발 접점을 가리지 않는다.

## 11. Start-FOV canopy 충돌

요구사항과 현재 승인 whitebox 좌표 사이에 수치 충돌이 있다.

- laptop start camera: y=18–36 tiles
- Stage visual footprint: y=3–10 tiles
- 두 영역 사이: 8 tile 이상의 비가시 간격

따라서 **Stage footprint·카메라·FOV를 유지하면 실제 Stage canopy 일부가 start FOV 상단에 보일 수 없다.** 이를 숨기기 위해 canopy를 비정상적으로 8 tiles 이상 늘이거나 위치를 변경하지 않았다.

- [실제 start crop — canopy 비가시](previews/2c-b2-music/start-fov-stage-canopy-cue-conflict.png)
- [Stage camera canopy visibility guide](previews/2c-b2-music/stage-camera-canopy-visibility-guide.png)

후속 선택지는 다음 중 하나다.

1. whitebox와 카메라를 보존하고 “start-FOV canopy cue” 요구를 제거한다. **권장**
2. start focus/camera framing을 별도 승인 후 북쪽으로 이동한다.
3. Stage와 무관한 원거리 방향 cue를 별도 환경 layer로 설계한다. 이를 실제 canopy로 표기하지 않는다.

## 12. 주요 캡처

- [Stage S1](previews/2c-b2-music/stage-s1-full.png) / [Stage S2](previews/2c-b2-music/stage-s2-full.png)
- [Gate G1](previews/2c-b2-music/gate-g1-full.png) / [Gate G2](previews/2c-b2-music/gate-g2-full.png)
- [Overview S1+G1](previews/2c-b2-music/overview-s1-g1.png)
- [Overview S2+G2](previews/2c-b2-music/overview-s2-g2.png)
- [Laptop start](previews/2c-b2-music/laptop-start.png)
- [Laptop center](previews/2c-b2-music/laptop-center.png)
- [Laptop Stage](previews/2c-b2-music/laptop-stage-approach.png)
- [Mobile portrait](previews/2c-b2-music/mobile-portrait-start.png)
- [Mobile landscape](previews/2c-b2-music/mobile-landscape-center.png)
- [Grayscale](previews/2c-b2-music/grayscale.png)
- [Emissive off](previews/2c-b2-music/emissive-off.png)
- [Collision/interaction](previews/2c-b2-music/collision-interaction-overlay.png)
- [Marker clearance](previews/2c-b2-music/marker-clearance-overlay.png)
- [Gate character foot-contact](previews/2c-b2-music/character-scale-foot-contact-start.png)
- [Stage character occlusion](previews/2c-b2-music/character-stage-occlusion-camera.png)
- [실제 browser desktop](previews/2c-b2-music/browser-preview-s1-g1-desktop.png)
- [실제 browser mobile guides](previews/2c-b2-music/browser-preview-s2-g2-mobile-guides.png)

## 13. Codex 권장 조합과 사용자 선택

권장 조합은 **S1 Low double-wave Stage + G1 Open wave rail Gate**다.

- 두 구조 모두 opening과 접근 방향이 가장 빨리 읽힌다.
- 같은 wave motif를 쓰되 Stage는 넓은 면, Gate는 열린 rail이라 위계와 실루엣이 겹치지 않는다.
- 모바일에서 가장 안정적이다.
- concert/portal/theme-park 인상을 피하고 annotation marker의 기능 대비를 보존한다.

사용자가 승인해야 할 항목:

1. Stage S1 또는 S2
2. Gate G1 또는 G2
3. `S1+G1` 권장 조합의 palette·trim·emissive 강도
4. Gate 4×3 footprint와 정수 tile collision/opening
5. start-FOV 충돌 해결안 1/2/3

## 14. 2C-B3 입력 조건과 정확한 범위

위 다섯 항목 승인 뒤에만 `2C-B3—네 일반 건물 및 저상 환경 prop 제작`으로 이동한다.

2C-B3 범위:

- Record Archive, Listening Cafe, Community Studio, Sound Workshop의 body/roof/door/window/shadow/collision guide
- 건물마다 다른 roof·height·entrance silhouette, 동일 global rendering grammar
- 낮은 bench, flowerbed, planter, shrub와 제한 lamp family
- foreground cutout, marker·door clearance, desktop/mobile occlusion 검수

2C-B3 범위 밖:

- production Music map 적용
- annotation·Skip·Museum·Supabase·participant/group/session·재화·house-decor 변경
- 다른 다섯 마을
- 전체 event/night layer

## 15. 변경 안전성

- `lib/musicVillage.js`, `components/MusicZoneMap.js`와 production Music map을 수정하지 않았다.
- 애플리케이션 데이터·연구 로직·Supabase를 수정하지 않았다.
- 기존 사용자 작업을 삭제·되돌리기·stash하지 않았다.
- commit, branch, push, merge, rebase를 실행하지 않았다.

