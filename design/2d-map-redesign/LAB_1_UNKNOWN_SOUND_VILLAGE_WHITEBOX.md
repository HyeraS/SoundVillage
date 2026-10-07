# LAB-1 — 미지의 소리 마을 기준 감사 및 48×36 관측소 whitebox

## 1. 범위와 상태

- 이번 단계는 현재 Lab 감사, 48×36 whitebox, 격리 preview까지만 포함한다.
- production Lab renderer·asset·sound metadata·annotation·Museum·Supabase·participant/session·재화·해금은 변경하지 않는다.
- Music은 `2C-C` 상태를 유지하며 Music의 palette, Garden, Stage, Gate를 Lab에 복사하지 않는다.
- 기존 관측소 콘셉트를 찾았으므로 LAB-1에서 새 ImageGen 콘셉트는 만들지 않았다.
- LAB-2와 production 교체는 whitebox 승인 전 시작하지 않는다.

## 2. 현재 Lab 감사

### 구현과 화면

| 항목 | 현재 production 상태 |
| --- | --- |
| renderer | `components/ZoneMap.js`의 공용 SVG renderer 안에서 `LabDungeonMap`을 사용한다. |
| map data | `components/labDungeonData.js`; Craftpix `Dungeon1.tmx`를 48×36으로 최근접 리샘플링한 정적·물·횃불·함정·prop 레이어다. |
| map size | 48×36 logical tiles, 32px tile, 1536×1152 world pixels |
| camera | 세로 18 tiles(576px) 고정, 화면 비율에 따라 가로 시야 확장; 4:3 기준 24×18 tiles |
| Lab sounds | 전체 169개; Group A 84개, Group B 85개 |
| block 분포 | A `15/15/15/15/15/9`, B `15/15/15/15/15/10`; 두 그룹 모두 6 blocks |
| production filtering | `app/page.js`의 `getGroupSounds`가 참여자 group을 A/B로 필터한다. 연구용 bypass만 169개 전체를 사용한다. |
| test route 주의 | 기존 `/lab-test`는 Lab 169개 전체를 넣으므로 실제 A/B 참여자 화면의 marker 수와 다르다. |
| marker 배치 | 6 blocks를 3열×2행 셀로 나누고 `[2,17,31,46] × [2,18,34]` 경계를 사용한다. 내부 grid line ±1 tile을 피하고 `LAB_FLOOR_CELLS`에만 결정론적으로 배치한다. |
| current spawn | pixel `(757,1024)`에서 시작하며 발 위치 기준 약 tile `(24,32~33)`이다. |
| current exit | 남쪽 경계, player center가 world center `x=768±40px`이고 하단 row에 닿으면 exit confirm이 열린다. |
| interaction | player 22×28px AABB와 marker 중심의 24×24px rect overlap; Enter로 annotation을 연다. |
| collision | 현재 Lab은 player collision mask를 사용하지 않는다. `LAB_FLOOR_CELLS`는 marker spawn whitelist일 뿐이며 player는 외곽 clamp 외에 벽·물·장치와 충돌하지 않는다. |

### 현재 맵 문제

1. 감옥 창살, 함정, 불, 상자, 어두운 석벽과 물길이 `안전한 관측소`보다 공포 던전으로 읽힌다.
2. 원본 dungeon의 방·복도 구조가 Lab의 중앙 관측 landmark와 세 연구실 hierarchy를 제공하지 않는다.
3. 6-block 데이터 격자와 보이는 dungeon 공간의 논리가 다르고, marker가 작은 바닥 조각에 몰려 baseline에서 과밀하게 보인다.
4. 실제 player collision이 dungeon 벽·물과 연결되지 않아 보이는 경계와 이동 경계의 차이가 크다.
5. marker, 횃불, 함정, chest가 유사한 국소 대비로 경쟁하고 특정 위험·보상 의미를 암시한다.
6. 입구→중앙 기준점→실험실의 읽히는 주축과 양방향 loop가 없다.
7. 높은 벽과 복잡한 전경이 player 발, marker, 접근 방향을 가릴 가능성이 높다.
8. 기존 `/lab-test`의 169-marker 화면은 실제 group별 84/85개 session보다 밀도가 과장된 QA 조건이다.

## 3. 기존 관측소 콘셉트 분석

기준: `design/concepts/lab-sound-observatory-concept-v1.png` (1448×1086)

### 채택

- 중앙의 원형·방사형 관측 장치를 가장 큰 landmark로 사용한다.
- deep blue stone, teal glass, thin brass line, starlight의 재료 hierarchy를 사용한다.
- 외곽의 서로 다른 연구 bay를 세 독립 실험실 silhouette로 번역한다.
- 고정된 낮은 cyan emissive와 따뜻한 brass task light의 조합을 사용한다.
- 중앙 장치 주위의 열린 회랑과 남쪽 도착 축을 동선 문법으로 사용한다.

### 그대로 복사하지 않음

- 콘셉트는 단일 실내 hall에 가깝고 거의 좌우 대칭이므로 48×36 야외형 마을 구조로 재구성한다.
- 피아노, gramophone, 병 속 생물처럼 sound 정답이나 source를 암시할 수 있는 구체 사물은 제외한다.
- 중앙 장치의 높은 hologram은 player·marker보다 약한 정적 emissive로 낮춘다.
- 이미지 속 텍스트·가구·캐릭터·marker를 future asset에 굽지 않는다.
- 하단 좌우 대칭을 깨고 Signal Lab을 동남쪽에 두어 약 10~15%의 구조적 비대칭과 orientation landmark를 만든다.

## 4. 승인 후보 48×36 구조

좌표는 0-based tile 좌표이며 footprint는 `[x, y, width, height]`다. 한 tile은 32px이다.

| 요소 | tile 좌표 / footprint | 설계 의도 |
| --- | --- | --- |
| village entrance / exit | `[22,35,5,1]` | 기존 남쪽 world 연결 방향 유지, 5-tile opening |
| spawn | `(24,33)` | exit와 2 tiles 떨어져 즉시 재퇴장하지 않음 |
| main spine | `x=23..25`, `y=24..35` | 3-tile 폭 남북 주축; 중앙 장치 방향이 spawn에서 바로 읽힘 |
| central observatory visual footprint | `[18,12,12,13]` | 전체 중심, 원형 방사 landmark |
| central collision core | center `(24,18.5)`, radius 약 `3.35 tiles` | 높은 core만 막고 외곽 ring은 양방향 통행 가능 |
| Archive Lab | `[3,3,13,9]` | 서북쪽 낮고 긴 storage silhouette |
| Archive entrance | `[8,12,3,1]`, approach `[8,12,3,3]` | 남향 3×3 접근 |
| Spectrum Lab | `[31,3,14,10]` | 동북쪽 dome/wedge silhouette |
| Spectrum entrance | `[37,13,3,1]`, approach `[37,13,3,3]` | 남향 3×3 접근 |
| Signal Lab | `[34,22,11,10]` | 동남쪽 수직 relay silhouette, 비대칭 기준점 |
| Signal entrance | `[33,26,1,3]`, approach `[31,26,3,3]` | 서향 3×3 접근 |

### main path와 loop

- 남쪽 입구에서 `x=23..25`의 3-tile spine으로 중앙 ring에 진입한다.
- 중앙 장치 주위에는 약 20×20 tiles 범위의 완만한 observation loop를 둔다.
- loop의 북서·북동·동남 branch가 세 실험실 entrance에 연결된다.
- 서남쪽은 네 번째 건물 대신 quiet observation court로 남겨 대칭을 깨고 marker/prop 밀도 완충 구역으로 사용한다.
- 중앙 core 바깥 ring은 시계/반시계 양방향으로 연결되며 실험실 앞 막다른 길을 만들지 않는다.

## 5. material·building density 계획

- ground는 arrival basalt, radial brass inlay, Archive slate, Spectrum blue stone, Signal teal stone, quiet court의 여섯 material zone으로 나눈다.
- 넓은 단색 면 대신 base/highlight/shadow/contact 4단계와 tile 내부 0~3개 저대비 detail을 사용한다.
- 세 실험실 모두 foundation, body, roof/dome, overhang, contact shadow, foreground cutout을 갖는다.
- 중앙 장치와 prop은 같은 형태를 반복하지 않고 dome, wedge, relay, low instrument plinth의 silhouette family로 나눈다.
- 9개의 중저밀도 prop blocker를 비대칭 배치하며 main spine·entrance·marker clearance에는 두지 않는다.
- 환경 emissive는 정적·저면적으로 유지하고 활성 marker의 이중 ring이 항상 더 높은 국소 대비를 갖는다.

## 6. sound slot 수용 계획

실제 participation 화면은 A 또는 B 한 그룹만 사용하므로 85개가 동시 최대다. 연구용 전체 169개 bypass는 production과 동일한 session 조건이 아니며, LAB-1 slot 수용 기준은 A/B 각각이다.

| Block | 공간 | A 필요 | B 필요 | 안전 slot | 최소 여유 |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Arrival / first observation | 15 | 15 | 18 | +3 |
| 2 | Quiet court | 15 | 15 | 18 | +3 |
| 3 | Archive court | 15 | 15 | 18 | +3 |
| 4 | North observatory ridge | 15 | 15 | 18 | +3 |
| 5 | Spectrum court | 15 | 15 | 18 | +3 |
| 6 | Signal court / south radial edge | 9 | 10 | 18 | +8 |
| 합계 | 6 regions | 84 | 85 | 108 | A +24 / B +23 |

- 각 slot은 marker 중심 1-tile static clearance와 한 방향 2-tile 접근을 만족한다.
- spawn에서 가장 가까운 Block 1 후보는 `(26,32)`로 Manhattan 3 tiles이며 main spine 옆에 있다.
- main spine, spawn 3×3, exit, 세 entrance approach, 중앙 관측소 visual footprint에는 slot을 두지 않는다.
- preview의 Group A/B 및 Block 1~6 전환은 실제 개수와 완료/활성/잠금 marker 밀도를 별도로 보여준다.

## 7. collision·foreground·clearance 결과

### Collision guide

- 충돌 후보는 2-tile 외곽 boundary, 세 실험실 footprint, 중앙 장치의 높은 core, 9개 낮은 장치 blocker다.
- 남쪽 `[22,35,5,1]` gate는 외곽 collision에서 제외한다.
- preview BFS에서 spawn으로부터 1,047 walkable tiles가 연결됐다.
- 세 entrance approach, exit, 108 slots가 모두 spawn에서 도달 가능하다.
- LAB-2/production 단계에서는 이 guide를 별도 logical collision data로 만들고 painted bitmap에서 역추론하지 않는다.

### Foreground guide

- Archive roof 상단 2.25 tiles, Spectrum dome 상단 2.75 tiles, Signal 서쪽 canopy 2.25 tiles, 중앙 장치 upper cap 2 tiles만 foreground 후보로 둔다.
- foreground 후보는 entrance 3×3, main spine, slot 중심과 겹치지 않도록 분리한다.
- 실제 asset 제작 때 overhang은 walkable 영역 안쪽 최대 1.5 tiles 규칙으로 다시 잘라낸다.

### Clearance

- marker: 중심 주변 1 tile + 주 접근 방향 2 tiles
- entrance: 세 곳 모두 3×3 tiles
- spawn: 3×3 reserved area
- observatory: 높은 core와 낮은 walkable ring 분리
- visual edge와 collision edge 차이는 production 적용 시 0.5 tile 이하로 다시 검증한다.

정적 검증: `node design/2d-map-redesign/tools/test_lab_whitebox_preview.mjs` → PASS, 108 slots, warning 0.

## 8. 격리 preview

경로: `/lab-whitebox-preview`

격리 조건:

- production `ZoneMap`, `labDungeonData`, `sound_metadata.json` import 없음
- Supabase, annotation, reward, participant/session state, Museum, sound playback 없음
- audited A/B count만 preview-local config에 snapshot으로 보관
- mock character와 중립적인 mock sound marker만 사용
- grid, collision, foreground, marker clearance, grayscale, material-density toggle
- 전체 지도, 입구, 중앙 장치, 세 실험실 camera focus
- desktop 24×18 및 mobile landscape 18×12 viewport

## 9. desktop/mobile 검수 기준

### Desktop 24×18

- 입구 focus에서 main spine과 중앙 관측 장치 방향을 동시에 읽을 수 있어야 한다.
- 중앙 focus에서 양방향 ring과 세 branch의 분기가 보이고 활성 marker가 emissive보다 강해야 한다.
- 각 Lab focus에서 독립 silhouette와 entrance 3×3가 명확해야 한다.
- Block 1의 활성 marker 15개가 한 camera에 모두 몰리지 않고 arrival 양측으로 분산되어야 한다.

### Mobile landscape 18×12

- entrance focus에서 spawn, 첫 marker 방향, 3-tile spine이 유지되어야 한다.
- central focus에서 장치 전체보다 player path와 ring edge 판독을 우선한다.
- 각 실험실 focus에서 entrance와 최소 한 branch 방향이 함께 보여야 한다.
- 320×180 축소에서도 main path, active marker, building mass가 서로 다른 명도로 남아야 한다.

### LAB-1 실제 preview 검수 결과

- Desktop 1440×900: 전체·입구·중앙·Archive·Spectrum·Signal focus 전환 정상
- Desktop entrance viewBox: `384 576 768 576` = 24×18 tiles
- Mobile 390×844: single-column layout, 지도→QA panel 순서 유지
- Mobile entrance viewBox: `480 768 576 384` = 18×12 tiles
- Mobile focus viewBox: 중앙 `480 384 576 384`, Archive `32 128 576 384`, Spectrum `928 128 576 384`, Signal `896 672 576 384`
- Group A Block 6 상태 수량: done 75, active 9, locked 0
- Group B Block 1 상태 수량: done 0, active 15, locked 70
- grayscale 적용 확인; collision·foreground·clearance·material-density toggle 정상
- browser console warning/error 0
- Next.js 16.2.7 production build 통과, `/lab-whitebox-preview` static route 생성 확인

## 10. 향후 생성 이미지·에셋 분리 계획

LAB-2가 승인될 경우 다음을 각각 SVG master + RGBA PNG로 만든다.

1. `background`: 외곽 night/starlight buffer, interaction 없음
2. `ground`: 여섯 material zone, radial path, brass inlay, seam-safe variants
3. `building`: Archive/Spectrum/Signal body·foundation·roof·door
4. `observatory`: 낮은 ring, 높은 core, dome/wedge 장치
5. `props`: low instrument plinth·cable joint·storage family; 최소 3 variants
6. `foreground`: roof/dome/canopy/upper cap cutout
7. `emissive`: 제한된 static cyan/teal/brass light
8. `guide`: collision, entrance, interaction, marker clearance; runtime visual에서 제외

Marker, player, UI, text, sound/category icon은 어떤 environment asset에도 굽지 않는다.

## 11. production 적용 전 사용자 승인 사항

- 48×36 macro layout와 남쪽 entrance/spawn 위치
- 중앙 관측 장치 footprint, 높은 core 크기, walkable ring
- Archive/Spectrum/Signal 세 실험실의 위치·silhouette·entrance 방향
- 서남 quiet court를 포함한 10~15% 비대칭
- Group A/B 108-slot 계획과 6개 block 공간 배정
- deep blue·teal·brass·starlight 방향과 emissive 상한
- foreground 후보 범위와 collision guide
- desktop 24×18 / mobile 18×12 camera framing

승인 전에는 LAB-2 에셋 제작, production Lab renderer 분리·교체, sound/annotation/DB 변경을 시작하지 않는다.

## 12. 승인 후 LAB-2 범위

`LAB-2—미지의 소리 마을 비주얼 방향 및 분리 에셋 제작`은 승인된 whitebox 좌표를 고정한 상태에서 두 개 이하의 시각 방향을 비교하고, 선택된 방향의 `background/ground/building/observatory/props/foreground/emissive/guide` preview asset을 제작하는 단계다. ImageGen을 사용하더라도 mood·material·silhouette reference로만 사용하며 production Lab 교체와 runtime collision 연결은 포함하지 않는다.
