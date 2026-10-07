# 2C-B3 — Music 일반 건물 및 저상 환경 prop 제작

작성일: 2026-08-29  
상태: B3 조건부 승인, B3.1 남부 두 건물 입구 수정·검수 완료, 재승인 대기  
production 반영: 없음  
격리 preview: `/music-whitebox-preview`

## 1. 범위와 유지한 승인사항

이번 단계에서는 Record Archive, Listening Cafe, Community Studio, Sound Workshop과 저상 환경 prop family만 제작했다. Production Music renderer, 연구·annotation·Museum·보상·재화·Supabase·participant 상태는 변경하지 않았다.

- Stage: 승인된 **S1 Low double-wave**
- Gate: 승인된 **G1 Open wave rail**, 4×3 visual footprint, 2-tile walkable opening
- Stage 좌표와 start/center/Stage camera 유지
- 시작 방향: World Gate → main spine → Resonance Garden
- 기본 시간대: 밝고 부드러운 늦은 오후
- 32px logical tile, 48×36 map, 정사영에 가까운 top-down 3/4
- Music 팔레트: ground `#AAB490`, variant `#B3BC98`, soil `#B89E7C`, warm stone `#D9C7A8`, muted teal `#668F8A`, soft lavender `#A89BC0`, 제한 warm gold `#C69A45`

## 2. ImageGen concept와 grid asset의 구분

Built-in ImageGen을 한 번 사용해 네 건물을 같은 카메라·팔레트·조명 조건의 2×2 batch로 탐색했다.

- [네 건물 ImageGen concept](../../public/design-previews/music-buildings-props-b3/variants/imagegen-four-building-concept.png)
- 용도: roof silhouette, footprint 인상, plaster/stone/wood 조합 참고
- 제외: 생성 이미지의 원근, 불규칙 texture, 창문 배치, 배경, 식생을 runtime 에셋으로 직접 사용하지 않음

실제 에셋은 정수 world-pixel SVG geometry로 다시 구성하고 RGBA PNG로 rasterize했다. 네 건물과 prop 모두 SVG master와 PNG를 함께 보존한다.

Prompt 핵심은 “동일한 밝은 늦은 오후와 top-down 3/4, 네 건물의 서로 다른 massing·roof·entrance·재료, Stage보다 약한 위계”였고 player, UI, marker, text, 악기, 음표, speaker, microphone, record/disc, neon, night를 제외했다.

## 3. 네 건물 규격

| 건물 | map rect / tile footprint | canvas / anchor | entrance | collision | 재료·silhouette |
|---|---|---|---|---|---|
| Record Archive | x=4, y=4, **8×6** | 256×192 / bottom-center `(128,192)` | 남쪽, clearance x=6, y=10, 3×3 | x=4, y=4, 8×6 | 가장 compact하고 조금 높은 stepped hip roof, plaster·stone 중심의 정돈된 수직/수평 리듬 |
| Listening Cafe | x=35, y=5, **10×5** | 320×160 / bottom-center `(160,160)` | 남쪽, clearance x=38, y=10, 3×3 | x=35, y=5, 10×5 | 가장 낮고 넓은 비대칭 double-curve roof, 넓은 창, plaster·wood 중심의 열린 인상 |
| Community Studio | x=3, y=28, **10×5** | 320×160 / bottom-center `(160,160)` | **동쪽**, door edge x=12, y=28, 1×3; clearance x=13, y=28, 3×3 | x=3, y=28, 10×5 | split-slope roof는 유지하고 동쪽 facade에 문·stone vestibule·동향 step을 결합 |
| Sound Workshop | x=36, y=27, **8×6** | 256×192 / bottom-center `(128,192)` | **서쪽**, door edge x=36, y=28, 1×3; clearance x=33, y=28, 3×3 | x=36, y=27, 8×6 | shed/gable roof는 유지하고 서쪽 facade에 문·stone vestibule·서향 step을 결합 |

일반 건물 최대 footprint는 10×6 이하이고 승인 Stage는 12×7이다. Stage의 넓은 opening·double-wave canopy·navy contrast를 일반 건물에 반복하지 않아 네 건물 모두 landmark보다 시각적으로 약하다. 건물 내부에는 읽을 수 있는 텍스트, 간판, 악기·음표·speaker·microphone·record/disc 아이콘을 넣지 않았다.

### 공통 건물 layer

1. `contact-shadow`
2. `body`
3. `roof`
4. `door-window`
5. `trim`
6. `foreground`
7. `emissive`
8. `collision`
9. `entrance-clearance`

각 건물 폴더의 layer는 동일 canvas와 anchor를 공유한다. 실제 3×3 접근 영역은 건물 canvas 밖까지 이어질 수 있으므로 full-map `guides/entrances-guide`가 최종 검수 기준이다.

## 4. Prop family와 배치 규칙

| category | asset | 규격 | 역할과 제한 |
|---|---|---:|---|
| flowerbeds | `flowerbed-low-a` | 64×32 | 낮은 stone edge와 작은 비고대비 꽃 cluster |
| benches | `bench-low-a` | 64×32 | Garden 내부에 재조합 가능한 낮은 목재 bench |
| planters | `planter-low-a` | 32×32 | 건물 edge용 단일 tile family |
| lamps | `lamp-low-a` | 32×64 | 작은 정적 window-tone emissive, marker보다 약함 |
| vegetation | `shrub-low-a`, `tree-low-a` | 32×32, 64×64 | main spine·Garden·spawn을 피해 바깥 soil patch에 배치 |
| garden | `garden-resonance-low` | 64×32 | 비대칭 높이의 짧은 teal bar. 동심원·점선 ring·orb 없음 |
| gate vegetation | `gate-vegetation-low` | 64×32 | Gate post와 2-tile opening 밖의 낮은 식생 |
| stage vegetation | `stage-vegetation-low` | 64×32 | Stage 양옆의 낮은 edge cluster, opening과 M06 clearance 회피 |
| foreground | `foreground-edge-cluster` | 96×64 | 화면 좌우 하단 edge에만 배치, marker·문·발 접점 회피 |

Prop는 marker 중심 1 tile에 들어가지 않으며 주 접근 방향 2 tile 안의 outline clutter를 제한했다. 기계적 rect/circle 검사 결과 **prop–marker 1-tile overlap 0건**, **prop–건물 entrance 3×3 overlap 0건**이다. 좌우 배치는 같은 이동 비용을 유지하고, 모양·간격만 약 10–15% 비대칭으로 구성했다.

## 5. Footprint·collision·entrance 검수

- [전체 B3 overview](previews/2c-b3-music/overview-b1-b2-b3.png)
- [B1+B2 / B1+B2+B3 비교](previews/2c-b3-music/b2-b3-comparison.png)
- [건물 silhouette 비교](previews/2c-b3-music/building-silhouette-comparison.png)
- [collision guide](previews/2c-b3-music/collision-guide.png)
- [3×3 entrance clearance guide](previews/2c-b3-music/entrance-clearance-guide.png)
- [marker clearance guide](previews/2c-b3-music/marker-clearance-guide.png)
- [foreground guide](previews/2c-b3-music/foreground-guide.png)

모든 collision rect는 manifest의 정수 tile rect와 visual canvas가 일치한다. 네 entrance는 각각 별도 3×3 guide를 가지며 prop가 접근 영역을 침범하지 않는다. B3.1에서 Community Studio는 동향, Sound Workshop은 서향으로 바꾸고 두 문이 중앙 동선을 향하도록 했다. Door edge, step/vestibule, foreground와 접근 화살표를 같은 방향으로 정렬했으며 footprint와 roof silhouette는 유지했다.

## 6. Marker 대비와 캐릭터 occlusion

- active·nearby·interacting·submitting·completed·error marker는 roof, lamp, flower, Garden object보다 강한 outline과 국소 대비를 유지한다.
- lamp와 창 emissive는 정적·저 opacity이고 네 건물 emissive alpha pixel 합은 전체 1536×1152의 약 **0.3942%**다.
- Garden object는 비대칭 bar silhouette라 marker의 이중 ring·파형 glyph와 구분된다.
- 72×88 mock character와 22×28 reference hitbox 기준으로 Studio 동쪽 접근과 Workshop 서쪽 접근에서 발 접점·문·foreground가 겹치지 않는다.
- [Studio 동쪽 / Workshop 서쪽 실제 접근 비교](previews/2c-b3-music/south-building-entrances-character-comparison.png)

## 7. Desktop·mobile·grayscale·emissive-off 검수

- [laptop start](previews/2c-b3-music/laptop-start.png)
- [laptop center](previews/2c-b3-music/laptop-center.png)
- [laptop Stage approach](previews/2c-b3-music/laptop-stage-approach.png)
- [mobile portrait start](previews/2c-b3-music/mobile-portrait-start.png)
- [mobile landscape center](previews/2c-b3-music/mobile-landscape-center.png)
- [mobile portrait Studio 동향 입구](previews/2c-b3-music/mobile-portrait-studio-east-entrance.png)
- [mobile landscape Workshop 서향 입구](previews/2c-b3-music/mobile-landscape-workshop-west-entrance.png)
- [grayscale](previews/2c-b3-music/grayscale.png)
- [Studio 동향 입구 grayscale](previews/2c-b3-music/studio-east-entrance-grayscale.png)
- [Workshop 서향 입구 grayscale](previews/2c-b3-music/workshop-west-entrance-grayscale.png)
- [emissive off](previews/2c-b3-music/emissive-off.png)
- [actual browser desktop UI](previews/2c-b3-music/browser-preview-b3-desktop-1440.png)

결정론적 map 캡처에서 desktop/laptop/mobile crop, grayscale, emissive-off, character, collision/entrance/marker clearance를 확인했다. SVG와 PNG의 logical size·anchor가 일치하고 검수한 46개 PNG는 모두 RGBA다. Grayscale에서 path/ground와 building body/roof 경계가 남고, emissive-off에서도 door·window·Stage opening을 읽을 수 있다.

실제 Next.js 16.2.7 개발 서버의 `/music-whitebox-preview`를 in-app browser에서 열어 기본 B3 desktop 화면과 DOM을 확인했다. Browser console warning/error는 0건이었다. 개발 서버에는 in-app browser가 사용하는 `192.0.0.2` origin의 HMR 요청을 차단했다는 경고가 1종 기록됐지만 page GET은 계속 200이었고 렌더링에는 영향을 주지 않았다. Preview 범위를 넘는 `next.config.js` 변경은 하지 않았다. 이후 로컬 URL에 대한 브라우저 보안 정책이 토글 클릭과 viewport 변경을 차단하여 이를 우회하지 않았고, 해당 상태들은 위의 동일 source 기반 결정론적 캡처와 정적 검사로 검수했다.

## 8. 격리 preview 기능

`/music-whitebox-preview`에 다음을 추가했다.

- Whitebox / B1+B2 / B1+B2+B3 전환
- 네 건물 개별 on/off
- prop category 9종 개별 on/off
- 공통 building shadow/body/roof/door-window/trim/foreground/emissive toggle
- 기존 Stage/Gate layer toggle 유지
- collision, entrance clearance, marker clearance, foreground, grayscale, emissive, character toggle
- 전체/laptop/mobile viewport와 start/center/Stage/네 건물 focus

Route는 production Music renderer, Supabase, annotation, Museum, reward, currency, participant state를 import하지 않는다.

## 9. 파일 구성

Asset root: `public/design-previews/music-buildings-props-b3/`

- `buildings/<building>/`: SVG+PNG layers, composite, emissive-off composite
- `props/<category>/`: SVG master + RGBA PNG
- `guides/`: collision, entrance, marker, foreground, 72×88 mock character
- `variants/`: ImageGen four-building concept source
- `manifest.json`: canvas, anchor, footprint, collision, entrance, placement, draw order

생성기: `design/2d-map-redesign/tools/generate_music_buildings_props_b3.js`  
검수 캡처: `design/2d-map-redesign/previews/2c-b3-music/`

## 10. Production 비변경 확인

이번 단계에서 `lib/musicVillage.js`, `components/MusicZoneMap.js`, annotation·Museum·Supabase·participant·group·session·reward·currency·house-decor와 다른 다섯 마을 파일을 수정하지 않았다. 기존 worktree의 사용자 변경과 untracked 파일을 되돌리거나 삭제하지 않았고 Git commit, branch, push, merge, rebase, stash를 실행하지 않았다.

## 11. 잔여 위험과 다음 승인 선택

1. 실제 production collision/walkable mask와 visual edge의 ≤0.5 tile 정합은 production 적용 단계에서 별도 측정해야 한다.
2. Community Studio 동향·Sound Workshop 서향 문은 B3.1 static 검수에서 중앙 동선을 향해 읽힌다. 실제 이동 입력과 interaction trigger가 연결되는 production 적용 단계에서는 door edge와 trigger 방향을 다시 대조해야 한다.
3. 현재 prop density는 marker 우선성을 위한 저밀도 1차안이다. Pilot에서 공간이 지나치게 비어 보인다는 결과가 있을 때만 clearance 밖의 variant를 추가한다.
4. Browser 정책 때문에 자동 클릭으로 모든 UI 조합을 재캡처하지 못했다. Production 적용 전 또는 브라우저 정책이 허용되는 환경에서 B1+B2/B3 전환과 각 toggle을 한 번 더 수동 확인하는 것을 권장한다.
5. `192.0.0.2` 테스트 origin의 HMR 경고는 격리 preview transport에 한정된다. 이를 없애기 위한 Next config 변경은 이번 preview-only 단계에 포함하지 않았다.

다음 결정은 **B3.1의 Community Studio 동향 입구와 Sound Workshop 서향 입구를 승인할지**다. 승인 전에는 production Music map에 적용하지 않는다.
