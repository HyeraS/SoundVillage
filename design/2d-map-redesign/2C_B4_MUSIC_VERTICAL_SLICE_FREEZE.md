# 2C-B4 — Music Vertical Slice 최종 동결 검수

작성일: 2026-08-29  
상태: B1–B3.1 통합 검수 완료, 사용자 동결 결정 대기  
production 반영: 없음  
격리 preview: `/music-whitebox-preview`

## 1. 동결 후보

이번 B4는 새 에셋을 설계하지 않고 승인된 다음 조합을 하나의 Music vertical slice로 검수했다.

- 48×36 tiles, 32×32 world px, 1536×1152 canvas
- 밝고 부드러운 늦은 오후
- B1 ground/path, 단일 loop, central shortcut, Resonance Garden
- Stage `S1 Low double-wave`
- Gate `G1 Open wave rail`, 4×3 visual footprint, 2-tile opening
- Record Archive 남향 입구
- Listening Cafe 남향 입구
- Community Studio 동향 입구
- Sound Workshop 서향 입구
- B3.1의 footprint, collision, door edge, 3×3 entrance clearance
- 승인된 저밀도 prop family와 27개 placement
- 15개 mock marker 좌표와 9개 상태 계약

[최종 overview](previews/2c-b4-music/final-overview.png)

## 2. B3.1 보존 확인

| 항목 | 결과 | 근거 |
|---|---|---|
| Community Studio | 보존 | 10×5, split roof, 동향 door edge `x=12,y=28,1×3`, clearance `x=13,y=28,3×3` |
| Sound Workshop | 보존 | 8×6, asymmetric roof, 서향 door edge `x=36,y=28,1×3`, clearance `x=33,y=28,3×3` |
| collision footprint | 보존 | B3.1 manifest와 동일, 변경 0 tiles |
| prop placement | 보존 | B3.1 manifest의 27개 placement를 그대로 참조 |
| marker 좌표 | 보존 | 15개, `M06=(16,8)` 포함, 삭제·이동 없음 |

[네 건물 입구 montage](previews/2c-b4-music/building-entrance-montage.png)

## 3. B1–B3.1 통합 정합

| 검사 | 판정 | 관찰 근거 |
|---|---|---|
| 광원·contact shadow | 통과 | 좌상단 key light와 짧은 우하단 shadow가 Stage, Gate, 건물, prop에서 일치 |
| outline·edge | 통과 | 건물·landmark 1px 중심, 기능 marker 1–2px 강화; 배경보다 marker가 강함 |
| 재료 tone | 통과 | warm stone은 path/step, plaster는 body, wood는 opening/platform 역할로 일관 |
| teal·lavender·gold 위계 | 통과 | teal/lavender는 마을 정체성, gold는 handle/trim/nearby 상태의 제한 accent |
| landmark 위계 | 통과 | Stage가 가장 큰 mass이며 Gate는 열린 rail로 Stage와 경쟁하지 않음 |
| 일반 건물 family | 통과 | 네 roof silhouette는 구분되지만 outline·재료·명도 범위가 같음 |
| 식생 family | 통과 | Garden, Gate, Stage와 edge cluster가 같은 foliage/stone 문법을 공유 |
| 해상도·선명도 | 통과 | SVG master와 RGBA PNG가 정수 world-pixel canvas를 공유 |
| alpha·canvas·anchor | 통과 | 103개 PNG의 logical size·RGBA 검증 통과; 모든 주요 asset bottom-center anchor 일치 |
| draw order | 통과 | ground→shadow→structure→prop→foreground→emissive→character→marker/UI로 분해 가능 |

[B1–B3.1 layer hierarchy](previews/2c-b4-music/b1-b3-layer-hierarchy-diagram.png)

## 4. 전체 composition

- World Gate에서 main spine, Garden, Stage로 이어지는 남북축이 전체 map과 start crop에서 유지된다.
- Garden의 좌우 loop와 central shortcut은 색뿐 아니라 밝은 stone 면과 edge 형태로 분리된다.
- Stage approach는 Garden shortcut의 연장이지만 Stage stair/opening으로 종점이 명확하다.
- Stage는 폭과 navy opening으로 우세하고 일반 건물은 낮은 채도·작은 mass로 후퇴한다.
- Gate는 시작 방향을 설명하지만 Stage의 wave canopy와 같은 면적·강도를 반복하지 않는다.
- 저밀도 prop는 quiet buffer를 보존하며 marker pad나 입구를 장식으로 채우지 않는다.
- 악기·음표·speaker·concert 장비를 환경 source로 사용하지 않아 annotation 표현을 직접 프라이밍하지 않는다.

[camera contact sheet](previews/2c-b4-music/camera-contact-sheet.png)

## 5. Marker 상태와 대비

검수한 상태:

`Locked / Unavailable / Active / Nearby / Interacting / Submitting / Completed / Save error / Technical audio error`

- 각 상태는 color 외에 outer ring 패턴, inner ring/fill, glyph, label로 구분된다.
- Active는 cyan double ring, Nearby는 더 굵은 warm outline, Completed는 filled check로 위계가 다르다.
- Save error와 Technical audio error는 `!`와 끊긴 파형 glyph 및 서로 다른 dash pattern을 사용한다.
- lamp, flowerbed, Garden object에는 marker와 같은 이중 ring·glyph·호흡형 motion이 없다.
- grayscale에서도 locked/unavailable, active/completed, 두 오류 상태의 glyph와 ring 차이가 남는다.
- 15개 marker 중심 1 tile과 주 접근 방향 2-tile guide는 건물 collision·entrance와 겹치지 않는다.

[marker state contrast montage](previews/2c-b4-music/marker-state-contrast-montage.png)

실제 preview UI에서 `M01`을 Save error와 Technical audio error로 전환했을 때 각각 `저장 오류 · mock`, `오디오 기술 오류 · mock` panel이 나타났고 실제 저장·skip 요청은 발생하지 않았다.

## 6. Character·입구·foreground

72×88 mock character와 bottom-center foot contact를 다음 8개 위치에서 확인했다.

1. World Gate opening
2. Garden shortcut
3. Stage 3×3 approach
4. Record Archive 남향 입구
5. Listening Cafe 남향 입구
6. Community Studio 동향 입구
7. Sound Workshop 서향 입구
8. foreground edge cluster 인접 위치

Door, step, Stage stair, Gate post, low prop와 캐릭터 발 접점 사이에 시각 occlusion은 없다. Foreground edge 검수 캐릭터의 foot point는 건물 collision 바깥에 두었으며 edge cluster가 발을 가리지 않는다.

[character foot-contact montage](previews/2c-b4-music/character-foot-contact-montage.png)

주의: 승인된 시각 검수 reference hitbox는 22×28이지만 현재 production `musicVillage.js`의 `PLAYER_BOX`는 20×14다. B4에서 코드를 바꾸지 않았으며 2C-C 전에 어떤 값을 runtime 권위로 삼을지 확인해야 한다.

## 7. Viewport·상태 검수

### 실제 `/music-whitebox-preview` UI

Next.js 16.2.7 개발 서버와 in-app browser에서 다음을 직접 전환했다.

| UI 조합 | 결과 |
|---|---|
| B1+B2 ↔ B1+B2+B3 | 두 batch 전환 정상 |
| laptop start | active/nearby 6 |
| laptop center | active/nearby 7 |
| laptop Stage | active/nearby 3 |
| mobile portrait start | active/nearby 6 |
| mobile landscape center | active/nearby 6 |
| grayscale | class 전환 정상, path/marker 형태 유지 |
| emissive off | 환경 emissive 제거 후 동선·door·opening 유지 |
| collision/entrance/clearance | 세 overlay 동시 전환 정상 |
| Save error / Technical audio error | mock panel 문구와 상태 전환 정상 |
| browser console | warning/error 0건 |

### 동일 source 기반 결정론적 합성

실제 UI의 48×36 source manifest와 같은 asset/layer를 사용해 다음을 생성했다.

- full overview와 24×18 start/center/Stage/네 건물 crop
- mobile portrait start와 Studio east entrance
- mobile landscape center와 Workshop west entrance
- 320×180 full-map 축소
- grayscale 및 environment emissive-off
- collision, entrance/interaction, marker clearance
- character foot-contact montage

[mobile/320 montage](previews/2c-b4-music/mobile-320-montage.png)  
[grayscale/emissive-off](previews/2c-b4-music/grayscale-emissive-off-comparison.png)  
[collision/entrance/marker clearance](previews/2c-b4-music/collision-entrance-marker-clearance-montage.png)

320×180에서 Stage, 네 building mass, loop, Garden, Gate와 active marker의 큰 실루엣은 유지된다. 작은 marker label은 읽기용이 아니라 위치·상태 silhouette 검수 대상으로 취급한다.

## 8. 정적 정합 측정

통합 index 생성 시 다음을 기계적으로 확인했다.

- B1/B2/B3.1 PNG 103개: canvas size 일치, alpha channel 존재, 103/103 통과
- 공통 palette key: ground, soil, stone, stone highlight/shade, teal, lavender, gold 일치
- Stage, Gate, 네 건물 anchor: bottom-center 일치
- prop–entrance 3×3 overlap: 0
- marker 1-tile–Stage/Gate/building collision overlap: 0
- marker 1-tile–building entrance overlap: 0
- Gate opening: 2×3 tiles, 양측 1×3 post collision
- Stage collision: 12×5, approach: 3×3

검증 결과는 통합 [manifest](../../public/design-previews/music-vertical-slice-b4/manifest.json)에 기록했다.

## 9. 최종 B4 scorecard

이 표는 Music visual slice에 적용 가능한 항목을 `통과 / 조건부 통과 / 미통과`로 판정한다. Pilot 기반 휴리스틱과 production runtime 연결은 정적 시안만으로 확정하지 않는다.

| 항목 | 판정 | 근거 / 조건 |
|---|---|---|
| main path 가독성 | 통과 | Gate→spine→Garden→Stage, loop와 shortcut이 color/grayscale/320에서 유지 |
| landmark 위계 | 통과 | Stage > Garden > Gate/일반 건물; Gate가 Stage와 경쟁하지 않음 |
| 네 건물 silhouette 구분 | 통과 | stepped, curved, split, asymmetric roof가 축소에서도 구분 |
| 입구 방향과 접근성 | 통과 | 남/남/동/서 방향, 문·step·character foot point 일치 |
| marker 우선순위 | 조건부 통과 | preview 9-state 대비는 통과; production renderer에는 아직 상태 체계 미적용 |
| 모바일 가독성 | 조건부 통과 | 정적 portrait/landscape와 preview control은 통과; production touch HUD와 실제 기기 pilot 필요 |
| grayscale 가독성 | 통과 | path/ground, building edge, marker glyph/ring 구분 유지 |
| 캐릭터 호환성 | 조건부 통과 | 72×88 시각 검수 통과; production 20×14 collision과 승인 reference 22×28 차이 확인 필요 |
| collision/visual edge 준비도 | 조건부 통과 | preview 정수 guide는 일치; production mask와 ≤0.5 tile runtime 측정 미실시 |
| Music 정체성 | 통과 | loop, Garden, wave canopy, rhythmic spacing으로 표현; 구체 source icon 없음 |
| concert·club·놀이공원 위험 | 통과 | 낮/늦은 오후, 제한 emissive, S1/G1 절제 silhouette |
| annotation source 프라이밍 | 통과 | 악기·음표·speaker·읽을 수 있는 source sign 없음 |
| 전역 문법 확장성 | 통과 | 32px, SVG+RGBA PNG, 공통 edge/shadow/anchor 규칙 |
| production layer 분해 | 통과 | ground/structure/foreground/emissive/guide가 독립 파일로 존재 |
| 3초 인식·실사용 pilot | 조건부 통과 | 제작자 정적 검수만 완료; 5명 이상 blind pilot은 미실시 |

**미통과: 0개. 조건부 통과: 5개.** 조건은 디자인 silhouette 변경이 아니라 production runtime 측정과 pilot 검수다.

## 10. 연구 안전성 해석

- B4 preview는 production renderer, Supabase, annotation, Museum, reward, currency, participant state를 import하거나 호출하지 않는다.
- Production 및 연구 로직을 수정하지 않았으므로 B4 때문에 새 연구 회귀는 생기지 않았다.
- 다만 `MAP_REVIEW_SCORECARD.md`가 기록한 기존 production의 voluntary skip 경로, Museum 임계값 4/행 수 집계, 후보 조회의 명시적 반대 그룹 검증 부재는 B4로 해결되지 않았다.
- 따라서 **이 문서는 visual slice 동결 판단 자료이지 현재 production 전체의 연구 안전성 승인서가 아니다.** 2C-C를 작성할 경우 이 기존 불일치를 별도 연구/기술 gate로 계속 표시해야 한다.

## 11. 동결 범위와 다음 결정

동결 대상으로 제안하는 것은 B1–B3.1의 시각·공간 기준과 B4 통합 index다. Production Music map은 자동 변경하지 않는다.

사용자 결정은 다음 두 가지를 분리한다.

1. 이 Music vertical slice를 최종 디자인 기준으로 동결할지
2. 별도 단계 `2C-C — Production Music Map 적용`의 실행 프롬프트 작성을 시작할지

2C-C 실행, production code 변경 또는 runtime collision 변경은 명시적 승인 전 시작하지 않는다.
