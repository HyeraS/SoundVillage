# 2C-B1 — Music ground/path/Garden 첫 제작 batch

작성일: 2026-08-29  
상태: B1 기반 승인, 2C-B2 입력으로 확정  
production 반영: 없음  
적용 범위: 전역 아트 문법, Music ground/path/Garden, World Gate 접근 footprint, 격리 preview

## 1. 최종 아트 방향

**Direction B production grammar + 밝은 공통 base-world 명도 + Music 고유 팔레트**를 적용했다.

- B에서 채택: 32px의 명료한 edge, 모듈형 tile family, 레이어 분리, 모바일 가독성, 기존 pixel character와의 결합 방식.
- B에서 제외: 야간, 넓은 보라 shadow, neon·club·cyberpunk 인상, lamp·window 과발광.
- A에서 참고만 유지: softness, 낮은 식생 밀도, 열린 공간 처리.
- 이번 batch의 기본광: 조명에 의존하지 않는 **밝은 부드러운 늦은 오후**. 이는 밝은 낮과 함께 승인 가능한 기본 명도 범위이며, 야간판은 이후 event layer다.

House-decor는 Music의 팔레트 근거가 아니다. 전역 카메라·비례·edge·그림자·detail density만 공유하는 meta/customization space로 분리했다.

## 2. 전역 문법 적용 결과

- 정사영에 가까운 top-down 3/4 구조와 48×36 map을 유지했다.
- logical tile과 runtime raster를 **32×32 world px**로 맞췄다.
- ground, path, 저상 Garden, guide를 분리했다.
- path는 색상뿐 아니라 1px highlight와 1~2px contact edge로 ground와 구분한다.
- texture는 tile edge에서 떨어진 내부에만 두고, 높은 foreground는 만들지 않았다.
- collision·marker clearance는 bitmap으로 추론하지 않고 별도 guide로 보존했다.
- 전체 map에는 emissive를 사용하지 않았다. 이후 marker가 가장 높은 국소 대비를 유지할 수 있다.

상세 공통 규칙은 [GLOBAL_ART_LANGUAGE_AND_VILLAGE_IDENTITY.md](GLOBAL_ART_LANGUAGE_AND_VILLAGE_IDENTITY.md)에 기록했다.

## 3. Music 고유 팔레트

| 역할 | 색 | 용도 |
|---|---|---|
| 저채도 녹지 | `#AAB490` | 주 ground |
| 밝은 녹지 변형 | `#B3BC98` | 낮은 내부 detail |
| 보조 토양 | `#B89E7C` | 건물 footprint 주변 material zone |
| warm stone | `#D9C7A8` | main loop, spine, shortcut |
| muted teal | `#668F8A` | 낮은 공명 motif |
| soft lavender | `#A89BC0` | 제한적인 Music 특징점 |
| warm gold | `#C69A45` | World Gate·Stage 접근의 제한 accent |

Music 정체성은 팔레트만이 아니라 단일 loop, 반복 curve, 중앙 shortcut, Resonance Garden과 접근축의 리듬으로 표현했다. teal·lavender·gold는 다른 마을에 강제하지 않는다.

## 4. 실제 규격과 파일 구성

현재 `GameEngine`과 `ZoneMap`의 논리 tile은 32px, map은 1536×1152, 기본 FOV는 768×576이다. `MusicZoneMap`은 canvas smoothing을 끄고 CSS `image-rendering: pixelated`를 사용한다. 따라서 임의 2× runtime 규격을 만들지 않았다.

- runtime-ready raster: RGBA PNG, 32×32, `runtimeScale: 1`
- editable master: 동일 grid의 SVG
- atlas: 8 columns × 5 rows, 37 tiles
- atlas preview만 nearest-neighbor 2×로 확대
- manifest: palette, tile 좌표, group, scale 기록

경로:

- `public/design-previews/music-ground-path-b1/tiles/`
- `public/design-previews/music-ground-path-b1/music-ground-path-b1-atlas.png`
- `public/design-previews/music-ground-path-b1/music-ground-path-b1-atlas.svg`
- `public/design-previews/music-ground-path-b1/music-ground-path-b1-manifest.json`

이 폴더는 격리 preview 전용이며 production Music renderer에서 import하지 않는다.

## 5. 생성·정리한 에셋

| family | 수량 | 내용 |
|---|---:|---|
| Ground | 9 | grass 5, soil 4 |
| Path edge | 16 | N/E/S/W exposed-edge bitmask 전 조합 |
| Curve | 4 | NE, ES, SW, WN |
| Garden/approach | 8 | ring H/V, shortcut, center motif, flowerbed H/V, Gate approach, Stage approach |
| **합계** | **37** | 32px RGBA PNG + SVG atlas |

`ground-path-material-concept.png`은 built-in ImageGen으로 만든 재료·곡선 참고판이다. 전체 map이나 production tile이 아니며 player, marker, UI, 건물, 텍스트를 포함하지 않는다. 실제 37개 에셋은 SVG geometry를 32px grid로 정리해 결정론적으로 rasterize했다.

ImageGen prompt 요약: bright soft-late-afternoon material swatch board, muted grass/soil/warm stone, restrained teal/lavender/gold, orthographic-like 2D game material samples, seamless tile intent; no night, neon, map, building, character, marker, UI, text, currency, instrument or note.

## 6. 타일 연결 규칙

### Ground

- 같은 material의 모든 variant는 네 변의 base pixel을 동일하게 유지한다.
- detail은 tile edge에서 안쪽으로 물려 배치한다.
- variant는 좌표 hash나 수동 분산으로 배치하고 같은 index를 5회 이상 연속시키지 않는다.

### Main path

`path-edge-X`의 X는 exposed edge bitmask다.

- N=`1`, E=`2`, S=`4`, W=`8`
- 예: `path-edge-5`는 N+S edge, `path-edge-A`는 E+W edge, `path-edge-F`는 네 edge가 노출된다.
- 이웃 path와 연결되는 변에는 exposed bit를 넣지 않는다.
- NE/ES/SW/WN curve는 32px 중점에서 연결되며 같은 warm-stone centerline과 edge tone을 사용한다.
- T junction·교차점은 exposed-edge bitmask 조합으로 만들고, loop/Garden/Gate/Stage 연결부는 전용 approach tile을 위에 배치한다.

Walkable/non-walkable 판정은 tile 색이나 alpha가 아니라 별도 collision/walkable data가 최종 권위다.

## 7. Resonance Garden

- whitebox의 외곽 ring, 내부 edge, 남북 shortcut을 유지했다.
- center motif는 낮은 바닥 원과 끊긴 teal ring으로 구성해 높은 occluder를 만들지 않았다.
- 화단 edge는 낮은 H/V family만 제작했다.
- bench와 낮은 장식은 이번 batch에서 배치 guide만 허용하고 완성 prop은 만들지 않았다.
- Garden marker 주변 최소 1 tile, 주 접근 방향 2 tiles를 비우는 guide를 별도 overlay로 확인했다.

## 8. World Gate 접근 footprint

완성 Gate asset은 제작하지 않았다.

- 남쪽 main spine과 연결되는 warm-stone pad
- 시작 바닥을 나타내는 얕은 teal arc
- Gate가 들어갈 4×2.5 tile 범위의 footprint guide
- 양쪽 foreground 금지 band
- 첫 marker의 1 tile/2 tile clearance ring

Gate body, post, canopy, emissive와 collision 확정은 2C-B2 입력으로 남겼다.

## 9. 격리 preview

경로: `/music-whitebox-preview`

이 route는 production navigation에 연결하지 않았고 game data, Supabase, annotation, reward module을 import하지 않는다. 다음 검수 기능을 제공한다.

- whitebox / 2C-B1 ground-path 전환
- 48×36 전체, laptop 24×18, mobile portrait 14×25, mobile landscape 28×13
- start / Garden center / Stage approach camera
- grid, collision, foreground, marker, clearance on/off
- grayscale, seam 강조, repetition overlay
- 기존 15개 mock marker와 9개 상태 비교

## 10. 검수 결과

### 구조·marker

- loop, spine, shortcut, World Gate→Garden→Stage 방향을 유지했다.
- marker 15개를 삭제하거나 숨기지 않았고 `M06=(16,8)`을 유지했다.
- 활성/근접 marker 수: laptop start **6**, center **7**, stage approach **3**.
- building·Stage collision과 marker 1/2 tile clearance는 별도 guide로 중첩 확인할 수 있다.
- production collision 수치는 변경하지 않았으므로 실제 ≤0.5 tile 정합은 production 적용 전 다시 측정해야 한다.

### Seam·반복

- 37개 PNG가 모두 RGBA 32×32인지 기계적으로 확인했다.
- grass 5 variant의 top/right/bottom/left border pixel이 각각 동일함을 확인했다.
- curve는 32px 변의 중앙 연결점을 공유한다.
- tile grid와 variant 색 overlay로 전체 반복을 검사했다. 현재의 저대비 내부 detail에서 강한 줄무늬나 checkerboard는 발견되지 않았다.

### Desktop·mobile·grayscale

- 24×18 start/center/Stage crop에서 main route와 shortcut이 분리되어 읽힌다.
- 14×25 portrait에서 World Gate 접근축과 Garden 중심이 한 축으로 유지된다.
- 28×13 landscape에서 Garden ring과 좌우 loop가 합쳐지지 않는다.
- grayscale에서도 warm-stone path가 ground보다 밝고 contact edge가 남는다.
- 야간 조명 없이 방향을 읽을 수 있고 배경 발광은 없다.

### Character 호환성

- 32px world grid와 smoothing-off renderer에 맞춰 캐릭터 72×88px와 해상도 언어가 충돌하지 않는다.
- 22×28px 이동 collision box보다 path가 충분히 넓다.
- 실제 캐릭터 발 접점·roof occlusion은 Stage/건물 layer가 생기는 B2 이후 다시 확인한다.

## 11. 검수 캡처

- [전체 overview](previews/2c-b1-music/ground-path-overview.png)
- [laptop start](previews/2c-b1-music/laptop-start.png)
- [laptop center](previews/2c-b1-music/laptop-center.png)
- [laptop Stage 접근](previews/2c-b1-music/laptop-stage-approach.png)
- [mobile portrait start](previews/2c-b1-music/mobile-portrait-start.png)
- [mobile landscape center](previews/2c-b1-music/mobile-landscape-center.png)
- [grayscale](previews/2c-b1-music/grayscale-overview.png)
- [tile seam 강조](previews/2c-b1-music/tile-seam-emphasis.png)
- [반복 pattern](previews/2c-b1-music/repetition-check.png)
- [marker clearance](previews/2c-b1-music/marker-clearance-overlay.png)
- [whitebox/new art 비교](previews/2c-b1-music/whitebox-new-art-comparison.png)
- [32px atlas 2× nearest preview](previews/2c-b1-music/asset-atlas-2x-nearest.png)
- [ImageGen material concept](previews/2c-b1-music/ground-path-material-concept.png)

## 12. 공통 규칙과 Music 전용 규칙

### 다른 마을에 재사용할 공통 규칙

- 32px grid, SVG master + 32px PNG raster
- edge bitmask, centered curve connection, material tone family
- 내부 detail만 바꾸는 seam-safe ground variant
- 좌상단 광원, 낮은 AO, 제한 texture
- ground/path/building/foreground/guide 분리
- marker 1 tile + 접근 방향 2 tile clearance
- mobile·grayscale·seam·repetition 검수 절차

### Music에만 적용할 규칙

- muted green/soil/warm-stone + teal/lavender/제한 gold 팔레트
- 단일 순환 loop, 반복 curve, Resonance Garden과 central shortcut
- World Gate→Garden→Stage의 남북 rhythm
- wave canopy와 제한 공명 motif
- 악기·음표·speaker·concert source를 marker 주변에 두지 않음

## 13. B2 착수 시 확정·수정된 사항

- 기본 시간대는 **밝고 부드러운 늦은 오후**로 확정했다.
- ground `#AAB490`, variant `#B3BC98`, soil `#B89E7C`, warm stone `#D9C7A8`, teal `#668F8A`, lavender `#A89BC0`, gold `#C69A45`를 production 기반으로 승인했다.
- Garden center의 닫힌 원·점선 ring은 marker 문법과 혼동될 수 있어 B2에서 비대칭 짧은 파형과 끊긴 rhythm 띠로 교체했다.
- World Gate pad의 강한 gold 외곽선은 stone edge로 교체하고 gold는 작은 trim으로 제한했다.
- Gate visual footprint는 B2 비교에서 정수 tile 기준 4×3으로 정리했다.
- production 적용 전 실제 collision/walkable mask와 visual edge의 ≤0.5 tile 정합 측정은 여전히 남아 있다.

## 14. 2C-B2 입력 조건과 정확한 범위

2C-B1 승인 뒤에만 `2C-B2—Resonance Stage 및 World Gate 에셋 제작`으로 이동한다.

입력 조건:

- 위 palette·시간대·path edge·Garden·Gate footprint 승인
- 기존 whitebox Stage footprint와 start crop의 부분 canopy cue 유지 여부 승인
- Stage canopy의 stepped curve 강도 승인
- Gate와 Stage의 collision/door 기준 좌표 확정

2C-B2 범위:

- Resonance Stage의 base/platform, opening, roof/canopy, shadow, 제한 emissive, collision guide
- World Gate의 post, wave rail/canopy, opening, shadow, 제한 light, collision·interaction guide
- start/center/Stage 및 desktop/mobile occlusion 검수

2C-B2에서도 네 일반 건물, production Music 적용, annotation·Museum·Supabase·재화·house-decor·다른 마을은 범위 밖이다.

## 15. 변경 안전성

- production Music map, renderer와 application data를 수정하지 않았다.
- Stage·World Gate 완성본과 네 건물 완성 에셋을 제작하지 않았다.
- annotation, Skip, Museum, Supabase, participant/group/session, 재화, 연구 데이터를 수정하지 않았다.
- 기존 사용자 파일을 삭제·되돌리기·stash하지 않았다.
- commit, branch, push, merge, rebase를 실행하지 않았다.
