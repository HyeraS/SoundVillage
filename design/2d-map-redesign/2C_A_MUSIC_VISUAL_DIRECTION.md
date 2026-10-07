# 2C-A — Music 마을 비주얼 방향 확정 및 콘셉트 시안

작성일: 2026-08-29  
상태: A/B 비교 완료, Direction B production grammar 승인·2C-B1 정정 반영  
production 반영: 없음  
생성 방식: built-in ImageGen, concept source only

## 1. 목적과 범위

2C-A는 승인된 Music whitebox의 동선과 연구 인터랙션 여백을 유지하면서 최종 아트 언어를 비교하기 위한 단계다. 생성 이미지는 분위기·재료·실루엣 판단용이며 production 배경이나 타일 에셋이 아니다.

전역 일관성은 `GLOBAL_ART_LANGUAGE_AND_VILLAGE_IDENTITY.md`의 카메라·해상도·비례·edge·그림자·detail density로 판단한다. House-decor는 전체 시스템의 meta/customization space이며 Music 팔레트의 기준이 아니다.

- 유지: 48×36, 32px tile, World Gate→Garden→Stage 축, 좌우 단일 loop, 중앙 shortcut, 4개 building mass, 15개 mock marker의 전체 접근성
- 생성: 동일 crop의 A/B styleframe 4장, 방향별 설명 overlay 2장, comparison board 1장, 평가와 후속 에셋 목록
- 제외: production Music map, Supabase, annotation, Skip, Museum, 재화, house-decor, 다른 마을, 실제 collision·interaction 변경

## 2. 승인된 whitebox 결정 반영

### 2.1 Stage 가시성과 시작 화면 단서

- Resonance Stage 전체를 start camera에 넣거나 카메라를 축소하지 않는다.
- World Gate→Garden→Stage 남북축은 유지한다.
- start crop의 상단에는 **Stage의 낮은 파형 캐노피 일부와 제한적인 따뜻한 조명**만 보인다.
- 단서는 “북쪽에 중요한 장소가 있다”는 방향 정보만 주며, marker보다 강한 국소 대비나 반복 애니메이션을 사용하지 않는다.
- 생성 시안의 Stage cue는 concept 제안이다. 실제 production에서는 별도 `stage-canopy`와 `stage-emissive` 레이어로 재제작하고 start FOV에서 가림 여부를 다시 검수한다.

### 2.2 중앙 marker 재배치

격리 preview의 `M06`을 `(14, 12)`에서 **`(16, 8)`**로 이동했다.

| 항목 | 변경 전 | 변경 후 | 효과 |
|---|---:|---:|---|
| laptop 24×18 center active/nearby | 8 | **7** | provisional 상한 안으로 이동 |
| laptop 24×18 start active/nearby | 6 | **6** | 첫 화면 밀도 유지 |
| 총 mock marker | 15 | **15** | 삭제·숨김 없음 |
| 위치 성격 | 중앙 camera의 좌상 loop | upper-left loop의 Stage 접근부 | 중앙 집중을 줄이고 상단 loop에 분산 |

M06은 building·stage collision과 foreground 밖의 기존 loop 위에 남으며 새로운 막다른 길을 만들지 않는다. 직접 spawn 거리는 일부 늘지만 전체 loop 순회선 위의 marker이므로 별도 분기 이동은 추가되지 않는다. 정확한 접근 시간 편차는 production 좌표·pathfinding과 pilot에서 다시 검수한다. 3~7개 기준은 연구 결과가 아니라 provisional 디자인 휴리스틱이다.

### 2.3 비대칭·Garden·건물

- 기능 동선과 좌우 접근 비용은 대칭에 가깝게 유지한다.
- 지붕 높이·footprint 인상, 화단, 벤치, lamp, 식생에만 약 10~15% 시각적 비대칭을 적용한다.
- Resonance Garden의 크기와 shortcut을 보존하며 중앙에는 낮은 화단·바닥 문양·낮은 앉을 오브젝트만 둔다.
- Record Archive, Listening Cafe, Community Studio, Sound Workshop의 4개 mass는 유지하되 지붕·입구·높이·footprint family를 달리한다.
- 특정 악기나 sound source를 건물·marker 여백 주변에 두지 않는다.

## 3. Styleframe 산출물

### Direction A — Cozy illustrated village

- [Garden / Stage crop](previews/2c-music/direction-a-garden-stage.png)
- [World Gate / Start crop](previews/2c-music/direction-a-world-gate.png)
- [설명 overlay](previews/2c-music/direction-a-annotated.png)

부드러운 hand-painted ground와 식생, 밝은 열린 공간, 둥근 massing을 탐색한 concept다. Production 방향으로 채택하지 않으며 **softness, 낮은 식생 밀도와 열린 공간 처리**의 참고 자료로 유지한다. 시안의 cream·pastel은 house-decor나 Music에 강제할 전역 팔레트가 아니다.

### Direction B — Polished pixel-inspired village

- [Garden / Stage crop](previews/2c-music/direction-b-garden-stage.png)
- [World Gate / Start crop](previews/2c-music/direction-b-world-gate.png)
- [설명 overlay](previews/2c-music/direction-b-annotated.png)

픽셀 cluster를 연상시키는 선명한 roof·door·path 경계, 제한 팔레트와 반복 가능한 표면 family를 사용한다. 지나치게 저해상도인 pixel art가 아니라 32px 타일로 재해석하기 쉬운 고해상도 concept다. **Modular production grammar는 채택하지만 시안의 야간·넓은 보라 shadow·과발광은 채택하지 않는다.**

### 비교 보드

- [A/B/whitebox comparison board](previews/2c-music/comparison-board.png)

Whitebox와 A/B를 같은 크기의 두 crop으로 배치했다. 점수는 의사결정 보조값이며 자동 확정 기준이 아니다.

## 4. A/B 비교

| 항목 | Direction A | Direction B |
|---|---|---|
| 건물 | 둥근 painted mass, 친근하고 주거적 | roof·door·window family가 분명하고 모듈화 용이 |
| 식생 | 손으로 칠한 듯한 풍부한 softness | 작은 cluster와 제한 변형으로 축소 가독성 우수 |
| 조명 | 크림·황금 ambient가 자연스러움 | 국소 lamp와 window highlight를 통제하기 쉬움 |
| 길 | 따뜻한 석재가 편안하지만 tile seam 재설계 필요 | straight/curve/edge tile로 분해하기 쉬운 경계 |
| 기존 캐릭터 | painted 배경과 pixel 캐릭터의 해상도 차이를 별도 조정해야 함 | 현재 pixel character와 silhouette·edge가 가장 안정적 |
| 전역 rendering grammar | painted texture와 pixel character 결합 규칙을 별도 설계해야 함 | 32px edge·비례·shadow·asset family와 가장 잘 맞음 |
| 월드맵 | 현재 밝은 pixel 월드와 정서 연결은 좋으나 edge 언어 차이 큼 | tile·roof 언어가 가깝지만 현재 시안의 밤 명도는 낮춰야 함 |
| 32px/mobile | 중간 디테일은 읽히나 painted curve와 texture 단순화 필요 | crisp boundary와 limited texture로 가장 적합 |
| 타 마을 확장 | 재료·팔레트 차이로 풍부한 변형 가능 | 공통 tile/prop 문법을 여섯 마을에 확장하기 쉬움 |

## 5. 장점과 위험

### A 장점

- 첫 마을의 부드러움, 낮은 식생 밀도와 열린 공간을 잘 보여준다.
- 낮은 Garden과 열린 Stage가 상용 cozy game 수준으로 자연스럽게 읽힌다.
- 강한 네온 없이 Music 정체성을 파형 canopy와 길의 리듬으로 표현한다.
- marker가 올라갈 밝고 단순한 바닥 여백이 충분하다.

### A 위험

- 곡선 길과 hand-painted texture를 production 32px tile·collision 경계에 맞게 다시 설계해야 한다.
- 현재 pixel character가 배경에서 지나치게 날카롭거나 작아 보일 수 있다.
- 생성 이미지의 꽃·창문·roof 디테일은 반복 가능한 에셋 family로 직접 재제작해야 한다.
- 풍부한 식생을 그대로 따르면 foreground와 marker 여백을 침범할 수 있다.

### B 장점

- 32px 타일, 모바일 축소, 기존 pixel character와의 결합이 가장 안정적이다.
- ground·roof·door·lamp를 개별 모듈로 분리하기 쉽다.
- 길과 비통행 영역의 경계가 명료하고 marker용 빈 공간도 잘 보존된다.
- 공통 아트 문법을 다른 다섯 마을에 적용하기 쉽다.

### B 위험

- 현재 시안은 밤·보라 명도가 강해 첫 마을이 어두운 클럽처럼 느껴질 가능성이 있다.
- 시안 자체는 기본 world 명도보다 어두워 밝은 낮·늦은 오후 palette로 다시 제작해야 한다.
- 기존 Music 맵의 야간·보라 정체성을 과도하게 계승하면 다른 마을보다 시각적으로 강해질 수 있다.
- 실제 제작에서는 밝은 공통 base-world 명도 위에 Music 전용 muted teal·soft lavender·제한 warm gold를 적용해야 한다.

## 6. 정정된 12개 항목 평가

House-decor 팔레트 일치를 평가 기준에서 제거하고 **전역 rendering grammar와의 일관성**으로 교체했다. Music 정체성은 별도 항목으로 유지한다. 5점은 해당 목표에 더 적합함을 뜻하며 `sound source 프라이밍`은 5점일수록 위험이 낮다.

| 검수 항목 | A | B | 근거 |
|---|---:|---:|---|
| 동선 가독성 | 5 | 5 | 두 방향 모두 loop·shortcut·spine 경계가 분명 |
| 중심 랜드마크 위계 | 5 | 4 | A의 Stage mass가 더 따뜻하고 자연스럽게 우세; B는 건물 contrast와 경쟁 가능 |
| Music 정체성 | 4 | 4 | 두 방향 모두 loop·curve·Garden·canopy를 사용하며 production palette는 별도 적용 |
| sound source 프라이밍 안전성 | 5 | 5 | 두 방향 모두 악기·음표·speaker와 marker를 제외 |
| marker가 올라갈 여백 | 5 | 5 | Garden·start pad·주 경로가 비어 있음 |
| 모바일 축소 가독성 | 4 | 5 | B의 crisp cluster와 제한 texture가 우세 |
| 기존 캐릭터와 일관성 | 3 | 5 | B가 pixel density와 edge 언어에 가까움 |
| 전체 시스템 rendering grammar 일관성 | 3 | 5 | B가 32px edge·pixel character·shadow·asset 분해 규칙에 적합 |
| 32px tile 적용 가능성 | 3 | 5 | B가 모듈 경계와 repeat texture에 적합 |
| 레이어·에셋 분해 용이성 | 3 | 5 | B의 roof/path/object 경계가 선명 |
| 여섯 마을 공통 언어 확장 | 4 | 5 | B의 제한 tile/prop grammar가 재사용에 유리 |
| 상용 게임 수준 완성도 | 5 | 4 | A는 styleframe 자체 polish가 높고 B는 palette 보정 필요 |
| **합계** | **49/60** | **57/60** | 정정 기준으로 재계산; 점수만으로 자동 확정하지 않음 |

## 7. 권장 방향

**Direction B production grammar + 밝은 공통 base-world 명도 + Music 고유 팔레트**를 승인 방향으로 사용한다.

근거:

1. 48×36·32px tile, 모바일, 기존 pixel character와의 결합 위험이 가장 낮다.
2. collision·foreground·emissive·building asset을 분리하기 쉽다.
3. 다른 다섯 마을에도 같은 tile/prop family 문법을 확장할 수 있다.
4. B의 야간·보라 시안은 구조 참고 자료로만 유지하고 기본 Music은 밝은 낮 또는 부드러운 늦은 오후로 새로 제작한다.
5. Music 팔레트는 중립 회갈색·저채도 녹색·warm stone을 base로 하고 muted teal·soft lavender·제한 warm gold를 마을 전용 accent로 사용한다.

Direction A는 production palette가 아니라 softness, 식생 밀도, 열린 공간 처리의 참고 자료다. 야간 Music은 향후 별도 event layer 후보이며 기본판에 포함하지 않는다.

## 8. AI 생성 결과의 사용 구분

### Concept에서 유지 가능한 요소

- World Gate→Garden→Stage의 시선축과 crop framing
- 낮은 Garden, 열린 shortcut, 좌우 loop의 큰 비례
- 4개 building이 동일 상자가 되지 않는 roof·footprint variation 방향
- A의 softness·열린 공간 처리와 B의 crisp boundary·modularity
- Stage 전체가 아닌 top-edge canopy/light cue
- marker를 위한 바닥의 negative space

### 실제 production용으로 재생성·재설계할 요소

- 모든 ground/path tile과 edge transition
- Stage와 네 building의 실제 footprint, door, roof, shadow
- 모든 창문, lamp, bench, flower bed, tree·shrub family
- foreground cutout, emissive, collision, interaction guide
- 생성 이미지의 불규칙한 paving, 창문, 식생 반복과 세부 ornament

네 생성 이미지를 production background로 사용하거나 서로 정확히 정렬된 layer로 간주하지 않는다.

## 9. 2C-B 개별 에셋 목록

스타일 승인 후 아래 항목만 분리 제작한다.

### Ground·path

- base grass/soil 3~5 변형
- north-south spine: straight, edge, transition
- main loop: straight, inner/outer curve, junction
- Resonance Garden paving: outer ring, inner edge, shortcut, low center motif
- World Gate approach와 stage approach transition
- walkable/non-walkable visual edge guide

### Landmark·buildings

- Resonance Stage: base/platform, stair, canopy/roof, rear mass, shadow, door/opening
- Record Archive: body, distinct roof, entrance, window family, shadow
- Listening Cafe: body, distinct curved/awning roof, entrance, window family, shadow
- Community Studio: lower/wider body, entrance, roof, window family, shadow
- Sound Workshop: taller/asymmetric body, entrance, roof, window family, shadow
- 각 건물의 collision footprint·door alignment reference

### Garden·objects·vegetation

- low flower-bed straight/curve/corner variants
- low seating/bench 2~3 variants
- planter, low resonant garden object, non-readable neutral plaque base
- lamp post off/on variants와 warm pool mask
- shrub 3~5 variants, low tree 2~3 variants, edge canopy cutout
- World Gate modular posts, wave rail/canopy, gate light

### Emissive·foreground·functional guides

- Stage wave-light static base와 저빈도 emissive frame
- lamp/window emissive masks
- south edge foreground clusters, building roof foreground cutouts
- 48×36 collision guide, walkable mask, door/gate interaction guide
- marker clearance guide와 15개 marker 좌표 sheet
- 공통 sound marker 이중 ring·파형 glyph의 9개 상태 asset/code spec

플레이어, NPC, UI, 텍스트, marker, 재화는 배경·building 이미지에 굽지 않는다.

## 10. 사용자가 선택해야 할 사항

1. Direction B production grammar 위에 정리한 2C-B1 ground/path palette와 edge를 승인할지
2. 기본 Music 시간대를 밝은 낮과 부드러운 늦은 오후 중 어느 쪽으로 고정할지
3. Stage canopy의 crisp stepped 곡선 강도
4. 네 building의 roof variation 강도와 전체 비대칭 허용 수준
5. 2C-B1 승인 뒤 Stage와 World Gate 중 2C-B2 제작 우선순위

## 11. 생성 프롬프트 기록

공통 prompt set:

- use case: `stylized-concept`, game environment styleframe
- camera: orthographic-like top-down 3/4, landscape 4:3, no perspective convergence
- structure: approved whitebox axis, Garden, single loop, shortcut, Stage and four building masses
- Direction A: soft hand-painted 2D, rounded silhouette; production palette가 아닌 softness·open-space reference
- Direction B: polished pixel-inspired, crisp cluster-like edge, limited palette, repeatable 32px-compatible texture
- Crop 1: Garden, shortcut, loop, Stage lower mass and silhouette
- Crop 2: World Gate, empty spawn/marker pad, north spine, partial lower buildings, top-edge Stage cue
- common exclusions: marker, currency, player, NPC, UI, text, readable signs, collision, interaction, instruments, notes, speakers, logos, watermark

원본은 built-in ImageGen으로 각각 독립 생성했으며 프로젝트 경로에 복사해 보존했다.

## 12. 변경 확인

- production Music map과 `lib/musicVillage.js`, `components/MusicZoneMap.js`는 수정하지 않았다.
- annotation·Skip·Museum·Supabase·participant/group/session·재화·house-decor를 수정하지 않았다.
- 격리 preview의 mock `M06` 좌표와 이 문서·preview 산출물만 추가·변경했다.
- Git commit, branch, push, merge, rebase, stash를 실행하지 않았다.

2C-A 비교는 종료되었고 Direction B production grammar가 승인되었다. 2C-B1 ground/path/Garden 승인 전에는 Stage·World Gate 완성 에셋이나 production 적용으로 넘어가지 않는다.
