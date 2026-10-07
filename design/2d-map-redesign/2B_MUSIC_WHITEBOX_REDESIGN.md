# 2B — 공통 sound marker 디자인과 Music 마을 whitebox 리디자인

작성일: 2026-08-28  
상태: whitebox 제안 및 격리 preview  
production 반영: 없음  
범위 기준: `SCOPE_AND_CONTEXT_FREEZE.md`

> 2C-A 승인 반영(2026-08-29): Stage 전체는 start FOV에 강제로 넣지 않고 북쪽 상단의 canopy/light 단서만 사용한다. `M06`을 `(14,12)`에서 `(16,8)` upper loop로 옮겨 laptop center active 수를 8→7로 조정했다. 상세 아트 결정은 `2C_A_MUSIC_VISUAL_DIRECTION.md`를 따른다.

## 1. 목표와 비범위

2B는 기존 게임·연구 데이터 계약을 유지하면서 Music 마을의 공간 구조, 동선, 시각 계층과 공통 sound marker 문법을 검증하는 단계다. 최종 일러스트나 production Music 맵을 만들지 않는다.

- 유지: 48×36 tiles, 32px tile, 1536×1152 world, 기존 participant/group/block/progress/Museum/재화/house-decor 흐름
- 생성: 문서, 단순 SVG/CSS whitebox, mock marker 상태, 독립 preview, 검수 캡처
- 제외: Supabase 호출, 실제 annotation·보상, DB/RPC/migration, production map 교체, AI 이미지와 최종 에셋

3초 인식, 화면당 활성 marker 3~7개, 밀도·접근 시간·매력도 수치는 연구 결과가 아닌 provisional 휴리스틱이며 pilot test 후 조정한다.

## 2. 현재 Music 구현 구조

현재 채택된 구현은 `lib/musicVillage.js`의 **layout B — 강변 레코드 거리**와 `components/MusicZoneMap.js`다.

| 항목 | 현재 구현 |
|---|---|
| 논리 크기 | 48×36 tiles, 32px, 1536×1152 |
| gameplay FOV | 24×18 tiles |
| 시작점 | tile `(21, 25)` 부근 |
| 월드맵 출입구 | tile `(21, 34)` 부근 |
| 주요 무대 | `(37, 6)`, 9×7 tiles — 맵 우상단 |
| 중앙 활동 공간 | `(19, 29)` 부근 버스킹 광장 |
| 공간 구조 | 대각선 운하, 3개 다리, 여러 개의 단절된 세로·가로 길 |
| 구역 | 6개 block district: 버스킹, 레코드, 악기, 카페, 페스티벌, DJ |
| 건물 | RECORDS, VINYL, GUITARS, KEYS, RADIO, CAFE, STUDIO, TEA 등 8개 |
| sound 배치 | block별 district의 walkable tile을 결정론적으로 선택 |
| 기준 캡처 | `/music-test`, 그룹 A, block 6/6, 83개 Music sound 전체를 표시한 시각 기준 |

기준 캡처는 일반 참여자의 최초 Block 1 화면이 아니라 모든 block이 열린 테스트 상태다. 따라서 보이는 과밀은 production 첫 진입의 정확한 marker 수가 아니라, 현 시각 체계가 여러 상태를 누적했을 때 생기는 위계 문제의 증거로 사용한다.

## 3. 현재 문제 진단

| 관찰된 문제 | 플레이 경험 영향 | annotation 연구 영향 | 디자인 원인 | whitebox 해결책 | 검증 방법 |
|---|---|---|---|---|---|
| 시작 화면에서 가장 큰 Festival Stage가 보이지 않고 아래 버스킹 구조가 중심처럼 읽힘 | 어디가 중심인지 첫 판단이 느림 | 첫 marker 탐색 부담이 annotation 진입 장벽으로 전이 | spawn `(21,25)`와 stage `(37,6)`의 거리, 비대칭 극단 배치 | stage를 북쪽 중앙으로 옮기고 spawn→정원→stage 시선축 형성 | 시작 focus 3초 인식 테스트 *(provisional)* |
| 기준 화면에 note·tape marker가 장식과 함께 매우 많이 보임 | 수집 대상 우선순위가 흐려짐 | sound 선택보다 시각 탐색·오클릭이 늘 수 있음 | all-block test, 다수의 발광 glyph, 구역 장식도 같은 neon 사용 | 공통 이중 링+파형 glyph, 현재 block/근거리 강조, 완료·비활성 감쇠 | camera별 활성 수와 첫 클릭 정확도 기록 |
| 중앙 무대, 일반 건물, lamp, 음표가 비슷한 발광 강도로 경쟁 | landmark와 interaction을 동시에 놓침 | 목표 위치 오인과 성급한 선택 가능 | neon 색을 건물·소품·marker에 광범위하게 공유 | landmark는 큰 massing, marker는 가장 높은 국소 대비, 장식은 정적 저채도 | grayscale·thumbnail 비교 |
| 운하와 다리 때문에 경로가 여러 번 끊겨 보임 | 우회와 막힌 길 예측이 어려움 | sound당 이동 비용 편차와 피로 증가 가능 | 대각선 water strip과 세 개 bridge가 route를 분절 | 하나의 닫힌 순환 동선과 중앙 shortcut으로 단순화 | spawn→marker 5개 경로 추적, 막다른 길 수 0 확인 |
| stage가 우상단 가장자리에 붙어 있음 | 화면 가장자리 landmark가 일부 camera에서 사라짐 | 첫 관문으로서 방향 학습이 약함 | landmark가 중심축이 아닌 district 하나로 취급됨 | 북쪽 중앙 12×7 mass로 이동, 어느 접근축에서도 정면 읽힘 | start/center/stage 세 focus에서 landmark silhouette 확인 |
| 건물 수와 roof/sign 디테일이 많고 크기·형태가 다양함 | 상용 게임다운 풍부함은 있으나 구조를 빨리 읽기 어려움 | 배경 의미가 sound 표현을 프라이밍할 수 있음 | GUITARS/KEYS 등 구체적 source label과 상징 반복 | 4개 mass로 축소하고 archive/cafe/studio/workshop처럼 중립 명칭 사용 | 구체적 sound 원천 암시 독립 검토 |
| 음표·테이프·스피커·악기 소품이 전역 반복 | 테마파크처럼 보이고 interaction glyph와 장식 혼동 | 특정 source·표현을 암시할 위험 | Music 정체성을 사물 수로 표현 | 리듬 있는 path, 원형 garden, lighting axis로 테마 표현 | 장식 제거 후에도 Music 정체성 식별률 측정 |
| 길 폭은 일부 넓지만 교차점마다 시각적 중심이 다름 | 진행 방향을 매번 다시 판단 | 초기 학습 과정이 길어짐 | street와 plaza가 별개 사각형으로 이어짐 | 3-tile 이상 순환 path, 중앙 garden, 남북 spine | 교차점 1초 방향 선택 테스트 *(provisional)* |
| 화면 가장자리 건물·전경·조명이 촘촘함 | playable edge와 장식 edge가 혼동 | marker 가림과 접근 실패 가능 | edge까지 prop·building이 채워짐 | 좌우 quiet buffer와 남쪽 foreground 금지대 | foreground/collision overlay로 marker 겹침 0 확인 |
| 다른 마을보다 neon·움직임·구체 오브젝트가 강함 | 해금 후에도 Music을 선호할 가능성 | 여섯 마을 선택 편향 가능 | 첫 마을 역할을 시각적 보상량으로 표현 | 색은 유지하되 움직임·강한 발광을 marker에 제한 | 마을 간 매력도 pilot 비교 |

## 4. Whitebox 공간 구조

### 4.1 핵심 개념

**“남쪽 입구에서 공명 정원을 지나 북쪽 무대로 이어지는 단일 순환형 청취 정원.”**

악기 상점의 양이 아니라 반복되는 곡선, 원형 정원, 균일한 조명축과 큰 무대 실루엣으로 Music 정체성을 만든다.

### 4.2 zone 배치

| 공간 | tile 범위/중심 | 역할 |
|---|---|---|
| World Gate | x22–26, y33–35 | 월드맵 연결과 명확한 남쪽 출입구 |
| Spawn | `(24, 31~32)` | 입구와 겹치지 않되 첫 방향이 북쪽으로 읽히는 시작점 |
| 남북 spine | x22–26, y22–34 | 입구→정원 연결, 첫 marker 배치 |
| Resonance Garden | x17–31, y14–22 | 중앙 기준점, 좌우 loop 재결합, 짧은 shortcut |
| Main loop | 좌 x10–19 / 우 x29–38, y10–29 | marker를 순차적으로 만나는 닫힌 순환 동선 |
| Resonance Stage | x18–30, y3–10 | 가장 큰 landmark, 북쪽 동선 종점이자 방향 기준 |
| Quiet Garden | x2–9, y12–25 | 저밀도 휴식·시선 회복, marker 없음/최소 |
| Rest Buffer | x39–46, y12–25 | foreground와 active path 사이 완충 |
| 4개 building mass | 좌상·우상·좌하·우하 각 10×6 | 도시적 경계와 구역감, 진입축을 가리지 않음 |
| foreground guide | 남서·남동 edge | 장식 허용 영역이지만 marker·주 경로 금지 |

### 4.3 동선

```text
                     [ RESONANCE STAGE ]
                         ╱         ╲
       [Archive] ───────╯           ╰─────── [Listening Cafe]
                    ╭───────────────────╮
                    │   main loop       │
          Quiet     │  ╭─────────────╮  │     Rest
          Garden    │  │ Resonance   │  │     Buffer
                    │  │   Garden    │  │
                    │  ╰──────┬──────╯  │
       [Studio] ────╰─────────┼─────────╯──── [Workshop]
                              │
                           [Spawn]
                        [ WORLD GATE ]
```

- 주 동선은 돌아서 원점으로 이어지는 단일 loop다.
- 중앙 garden이 좌우 loop 사이 shortcut이 된다.
- 막다른 길은 만들지 않는다.
- marker와 출입구는 겹치지 않으며 stage 내부는 collision 영역이다.
- 첫 marker는 spawn 북쪽 2~3타일 안에서 보인다.

## 5. 건물 massing과 landmark 위계

| 순위 | mass | 표현 원칙 |
|---:|---|---|
| 1 | Resonance Stage, 12×7 | 가장 큰 실루엣, 낮은 빈도의 파형 조명; marker보다 강한 발광 금지 |
| 2 | Resonance Garden, 14×8 | 열린 원형 바닥과 낮은 중앙 구조, 시야를 막지 않음 |
| 3 | Archive/Cafe/Studio/Workshop, 각 10×6 | 같은 footprint family, cyan/pink 두 tone만 사용 |
| 4 | Quiet/Rest buffers | 저채도, 정적, marker·출입구 없음 |

건물 명칭은 특정 sound의 정답 원천을 직접 암시하지 않는 중립적 기능 명칭을 쓴다. 문과 계단의 실제 구현은 2C 이후 layer 설계에서 collision과 함께 검증한다.

## 6. 공통 sound marker whitebox

모든 상태는 32px tile 안에서 중심 glyph를 읽을 수 있게 하고 실제 터치 hit area는 최소 44 CSS px를 확보한다. Music 외피는 cyan/purple 받침에만 적용하며 재화인 “공명 조각”의 비대칭 판 실루엣을 사용하지 않는다.

| 상태 | 형태 | 색 | 테두리 | glyph | 애니메이션 | 라벨 | 데스크톱 | 모바일 | 접근성·구별 기준 |
|---|---|---|---|---|---|---|---|---|---|
| locked | 닫힌 원형 받침 | 중성 회보라 | 긴 dash 단일 링 | 자물쇠 `▣` | 없음 | 잠김/조건 | focus 시 조건만 | 탭 시 조건 sheet | 폐쇄 glyph+긴 dash, active cyan 금지 |
| unavailable | 빈 원형 받침 | 저채도 라벤더 | 짧은 dash 링 | 빈 diamond `◇` | 없음 | 현재 block 아님 | hover/focus 설명 | 탭 설명 | locked와 dash 길이·glyph·문구 분리 |
| active | 이중 원형 링 | cyan | 실선 이중 링 | 파형 `≈` | 느린 호흡형 | sound 듣기 | 근접 가능 | 탭 가능 | 가장 높은 국소 대비, 재화 silhouette 금지 |
| nearby/interactable | 이중 링+외곽 강조 | warm yellow+cyan | 굵은 실선 | 파형 `≈` | 밝기 1회성 강조 | `E 듣기`/`탭하여 듣기` | E/Enter/click | 44px tap | text+굵기+색 세 단서 |
| interacting | 고정 이중 링 | 연보라 | 실선 | pause `Ⅱ` | map animation 감쇠 | annotation panel | 패널 focus | bottom sheet focus | active 맥동 제거, 패널 제목 제공 |
| submitting | 원형 진행 링 | yellow | 짧은 dash | 회전 `↻` | 회전, reduced-motion 정적 | 저장 중 | 입력 disabled | 입력 disabled | aria-live busy, skip 없음 |
| completed | 채운 원형 | 청회색 | 얇은 실선 | check `✓` | 없음 | 완료 | 읽기 전용 | 읽기 전용 | active보다 낮은 대비·움직임 0 |
| save-error | 경고 원형 | coral | 점선/깨진 링 | `!` | 없음 | 저장되지 않음 | 재시도/맵 복귀 | 큰 재시도/복귀 | 결과 미반영 문구, 완료 check 금지 |
| technical-audio-error | 끊긴 원형 | orange | 긴 dash+break | 끊긴 파형 `≁` | 없음 | 오디오 오류 | 재시도/복귀/문의 | 동일, 44px | annotation/skip 아님을 평문으로 설명 |

### 상태 위계

`nearby > active > error/submitting > interacting > unavailable/locked > completed`

오류는 의미상 중요하지만 반복 맥동으로 active marker보다 지속적으로 강해지지 않는다. completed는 다음 미완료 sound 발견을 방해하지 않는다. 색을 제거해도 ring 패턴, fill, glyph, label로 구별한다.

## 7. Marker 배치 원칙

- preview에는 15개 mock marker를 loop와 central shortcut에 배치해 Music Block 1 규모를 공간적으로 검토한다.
- 실제 sound metadata나 production 좌표를 import하지 않는다.
- 첫 marker는 spawn에서 북쪽으로 보이며 출입구 hit area와 겹치지 않는다.
- marker 중심 주변 1 tile, 주 접근 방향 2 tiles를 비운다.
- building collision, stage collision, foreground guide 안에는 marker를 넣지 않는다.
- 특정 악기·source를 암시하는 장식 바로 옆에 marker를 두지 않는다.
- camera별 active 3~7개는 provisional 목표다. preview 초기 상태는 여러 상태 비교를 위해 active/completed/locked/unavailable을 혼합한다.
- 필수 marker를 숨겨 수를 맞추지 않고 camera focus, block 상태 감쇠, 완료 상태 약화로 과밀을 줄인다.

예상 초기 active/nearby 표시 수:

| viewport / focus | 예상 수 | 판정 |
|---|---:|---|
| 24×18 laptop · start | 6 | provisional 범위 |
| 24×18 laptop · center | 7 | provisional 범위; 2C-A에서 M06을 upper loop로 재배치 |
| 24×18 laptop · stage | 3 | provisional 범위 |
| 14×25 mobile portrait · start/center | 6 | provisional 범위 |
| 14×25 mobile portrait · stage | 3 | provisional 범위 |
| 28×13 mobile landscape · start | 4 | provisional 범위 |
| 28×13 mobile landscape · center | 6 | provisional 범위 |
| 28×13 mobile landscape · stage | 3 | provisional 범위 |

전체-map overview는 gameplay camera가 아니라 배치 검토 화면이므로 3~7 기준을 적용하지 않는다.

## 8. 레이어와 collision 구조

| 레이어 | whitebox 내용 | 2C 전달 원칙 |
|---|---|---|
| background | 외곽 야간 tone과 quiet buffer | 원경·하늘빛, interaction 없음 |
| ground | 32px grid, loop, spine, garden | walkable mask와 시각 경계 정렬 |
| buildings | 4개 mass와 stage | 문·shadow·roof를 분리 |
| objects | 후속 bench/lamp 위치 guide | marker 주변 여백 침범 금지 |
| foreground | 남서·남동 guide | 발 위치·길·marker를 가리지 않음 |
| emissive | stage 파형, 길의 낮은 조명, marker | marker가 최고 국소 대비 |
| collision guide | building, stage, quiet buffer의 mock overlay | production collision과 별도 승인 |
| interaction guide | marker 중심/여백, gate | 실제 sound·API와 분리 |

preview의 collision overlay는 시각 가이드일 뿐 production collision을 변경하지 않는다.

## 9. 기존안과 whitebox 비교

| 항목 | 기존 강변 레코드 거리 | 제안 whitebox |
|---|---|---|
| landmark | 우상단 stage, 시작 화면에서 불명확 | 북쪽 중앙 stage와 남북 시선축 |
| 동선 | 운하·다리·여러 street 조각 | 단일 loop + 중앙 shortcut |
| 건물 | 8개, 구체 상점·악기 sign | 4개 mass, 중립 기능 명칭 |
| 중심 | 버스킹 광장과 festival stage가 경쟁 | Resonance Garden과 Stage의 2단 위계 |
| marker | note/tape와 neon 장식 혼재 | 공통 이중 링·파형 glyph·상태별 ring 문법 |
| edge | 건물·소품·전경 밀도 높음 | quiet/rest buffer와 foreground 금지대 |
| Music 표현 | 악기·음표·neon 사물 반복 | path rhythm, 원형 정원, 조명축, stage mass |
| 모바일 | production camera 기반 | portrait/landscape viewBox와 44px control 검토 |

## 10. 격리 preview

- route: `/music-whitebox-preview`
- 파일: `app/music-whitebox-preview/page.js`, `page.module.css`
- production main route에서 링크하지 않음
- import: React state와 CSS Module만 사용; game data, production Music map, Supabase, annotation, reward module import 없음
- 상태 조작: marker 선택 후 9개 mock 상태 수동 전환
- viewport: 1536×1152 overview, 24×18 laptop, 14×25 mobile portrait, 28×13 mobile landscape
- camera focus: start, center, stage
- layer toggle: grid, buildings, collision guide, foreground guide, markers

실행:

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/music-whitebox-preview`를 연다. 다른 포트를 사용하는 경우 dev server가 표시한 로컬 주소에 같은 path를 붙인다.

## 11. 검수 시나리오

1. overview에서 loop가 끊기지 않고 stage·garden·gate가 3단계로 읽히는지 확인한다.
2. laptop/start에서 gate→spawn→첫 marker→garden 방향이 읽히는지 확인한다.
3. laptop/center에서 M06 재배치 후 7개 marker가 유지되는지 확인한다.
4. mobile portrait의 start/center/stage focus에서 marker와 panel이 잘리지 않는지 확인한다.
5. mobile landscape에서 touch control과 길이 foreground에 가리지 않는지 확인한다.
6. marker 하나를 9개 상태로 바꾸며 glyph·ring·fill·label이 색 없이도 달라지는지 확인한다.
7. collision과 foreground overlay를 켜 marker·gate·main path와 겹침이 없는지 확인한다.
8. save-error·technical-audio-error가 completed로 오인되지 않고 mock panel에 실제 미저장 의미가 나타나는지 확인한다.

## 12. Acceptance criteria

- [x] 시작 focus에서 중앙 정원 방향과 첫 marker가 식별된다. 실제 3초 기준은 provisional이며 사용자·pilot 검수가 남아 있다.
- [x] 주 동선이 하나의 loop로 읽히고 막다른 길이 없다.
- [x] stage가 가장 큰 landmark지만 active marker보다 강한 발광을 쓰지 않는다.
- [x] 15개 mock marker가 building/stage collision, foreground, gate와 겹치지 않는다.
- [x] 9개 marker 상태가 색 외에 glyph·ring·fill·label로 구별된다.
- [x] active가 completed보다 강하고 locked가 active로 보이지 않는다.
- [x] 모바일 control은 최소 44 CSS px이며 portrait/landscape map frame과 mock panel을 스크롤해 확인할 수 있다.
- [x] preview에 Skip UI가 없다.
- [x] preview가 실제 game data·Supabase·annotation·reward·Museum module을 import하거나 호출하지 않는다.
- [x] production Music map과 기존 사용자 파일을 수정하지 않는다.

## 13. 시각 검수 결과

로컬 격리 preview를 실행해 아래처럼 확인했다. 활성 marker 3~7개와 3초 인식은 연구 결과가 아닌 1차 휴리스틱이므로 pilot 후 조정한다. 전체 overview의 11개 표시는 gameplay FOV가 아니므로 해당 수치 판정에서 제외했다.

| 환경 | 결과 | 발견 사항 | 조정 |
|---|---|---|---|
| 1536×1152 overview | 통과 | stage→garden→gate의 남북축, loop, 4개 building mass가 한눈에 읽힘. 전체 맵이라 활성 11개 표시 | gameplay 밀도 판정에서는 제외 |
| 일반 laptop / 24×18 | 통과 | start focus 활성 6개 유지. Stage 전체 대신 북쪽 canopy/light 단서를 쓰기로 승인됨. 현재 preview 좌표 계산에서 center focus는 7개 | M06 `(14,12)`→`(16,8)`; 저장된 2B start 캡처는 재배치 전 기준 화면으로 보존 |
| mobile portrait / 14×25 | 통과 | start focus 활성 6개, garden→spawn→World Gate 축과 marker 간격 확인. 페이지 스크롤 뒤 map·inspector 모두 접근 가능 | preview 전용 control은 production HUD 판단에서 제외 |
| mobile landscape / 28×13 | 통과 | center focus 활성 6개, 짧은 높이에서도 loop·garden·marker glyph가 읽힘 | inspector는 map 아래 흐름 유지 |

추가 상태 검수에서 선택 marker를 locked, unavailable, active, nearby, interacting, submitting, completed, save-error, technical-audio-error로 전환했다. save-error와 technical-audio-error는 완료 표시가 아니라 각각 `저장 오류 · mock`, `오디오 기술 오류 · mock` 안내로 나타났고 실제 저장·skip은 발생하지 않았다. collision·foreground overlay를 함께 켰을 때 15개 marker와 building/stage/gate 금지 영역의 겹침은 없었다. 브라우저 warning/error log도 없었다.

저장 캡처:

- `previews/music-whitebox-overview-desktop.png`
- `previews/music-whitebox-laptop-start.png`
- `previews/music-whitebox-mobile-portrait-start.png`
- `previews/music-whitebox-mobile-landscape-center.png`

## 14. 2C-A 승인으로 확정된 항목

1. 북쪽 Stage–Garden–남쪽 World Gate 축과 좌우 단일 loop·중앙 shortcut을 유지한다.
2. 기능적 이동 비용은 유지하고 지붕·화단·나무·벤치·조명에 10~15% 시각적 비대칭만 적용한다.
3. Resonance Garden 크기와 낮은 중앙 구조를 유지한다.
4. 4개 building mass와 중립 명칭을 유지하되 footprint·높이·roof·입구를 다르게 한다.
5. marker 이중 ring·파형 glyph와 상태별 ring 문법을 유지한다.
6. M06을 upper loop로 옮겨 laptop center를 7개로 낮추고 총 15개·start 6개를 유지한다.
7. Stage 전체는 start FOV에 넣지 않고 canopy·wave·light 일부만 북쪽 목적지 단서로 사용한다.

남은 A/B 스타일·명도·silhouette·2C-B 첫 제작 batch 선택은 `2C_A_MUSIC_VISUAL_DIRECTION.md`에 기록한다.
