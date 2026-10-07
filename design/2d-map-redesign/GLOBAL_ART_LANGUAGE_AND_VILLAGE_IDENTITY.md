# Sound Village 전역 아트 문법과 마을별 정체성

작성일: 2026-08-29  
상태: 2C-B1 production art 기준  
적용 범위: 월드맵, 여섯 마을, house-decor meta space, 공통 marker·UI  
비범위: 게임 로직, 데이터, Supabase, 실제 경제·연구 프로토콜 변경

## 1. 분리 원칙

Sound Village의 일관성은 모든 공간이 같은 팔레트를 쓰는 데서 나오지 않는다.

- **전역 아트 문법**은 카메라, 32px 격자, 오브젝트 비례, edge, 그림자, 디테일 밀도, foreground, 캐릭터·marker와의 결합 방식을 공유한다.
- **마을별 정체성**은 팔레트, landmark, 경로 형태, 재료, 식생·건축 밀도와 실루엣을 독립적으로 가진다.
- **House-decor**는 여섯 마을 중 하나가 아니라 여러 팔레트와 테마를 수용하는 meta/customization space다. Music을 포함한 특정 마을의 고정 팔레트 기준으로 사용하지 않는다.

## 2. 전체 시스템 정서

모든 공간은 다음 인상을 공유한다.

- cozy, approachable, non-threatening
- readable, polished commercial 2D
- 장식보다 현재 annotation 행동이 우선
- 밝고 안전한 기본 world 명도
- 과도한 발광·입자·반복 애니메이션 없음
- 큰 실루엣과 경로를 먼저 읽고 세부는 가까이서 발견

## 3. 전역 production 아트 문법

### 3.1 카메라·격자·출력

| 항목 | 공통 규칙 |
|---|---|
| 카메라 | 정사영에 가까운 top-down 3/4. 건물 정면은 보이되 원근 수렴과 isometric 좌표 왜곡은 사용하지 않음 |
| 논리 tile | **32×32 world px** 고정 |
| 마을 | 48×36 tiles, 1536×1152 world px |
| 기본 FOV | 24×18 tiles, 768×576 world px |
| runtime asset | 32px 격자에 맞춘 PNG. 현재 canvas가 smoothing 없이 world px로 그리므로 임의 2× runtime 규격을 도입하지 않음 |
| source master | 반복 가능한 geometry는 SVG master를 함께 보존하고 32px PNG로 rasterize |
| 확대·축소 | 정수 배율·nearest-neighbor 우선. `imageSmoothingEnabled=false`, `image-rendering: pixelated`와 호환 |

### 3.2 캐릭터·건물 비례

현재 공통 캐릭터는 world 좌표에서 72×88px로 표시되고 이동 충돌 box는 22×28px다.

- 캐릭터의 발 접점이 통행 tile과 그림자 판단의 기준이다.
- 일반 문은 시각 폭 1.25~1.75 tiles, 높이 1.75~2.5 tiles를 기본 family로 삼는다.
- 문 앞에는 최소 3×3 tiles의 읽을 수 있는 접근 영역을 둔다.
- 일반 건물 footprint는 주요 landmark보다 작고, 보이는 roof 높이는 body 위 2~4 tiles 안에서 변형한다.
- 주요 landmark는 폭 8~12 tiles, 보이는 높이 6~9 tiles 범위를 1차 목표로 사용한다.
- roof·canopy가 통행로 위로 시각적으로 겹칠 때 발·marker·문 접근점을 가리지 않는다.

### 3.3 Edge·outline·그림자

| 요소 | 32px 기준 |
|---|---|
| ground texture | 별도 outline 없음. 재료 경계는 1px 명도 edge 또는 2px 이하의 낮은 그림자로 구분 |
| path edge | 1px highlight + 1px contact/shadow edge. 인접 tile 연결선은 같은 좌표·색을 사용 |
| 배경 prop | 선택적 1px 중간 명도 outline |
| building·foreground | 1px 외곽선, 중요한 겹침부만 2px |
| character·marker | 배경보다 한 단계 강한 1~2px 기능 outline |

- 공통 key light는 **좌상단**이다.
- 작은 prop의 그림자는 우하단 `(+2~6px, +3~8px)`, 건물은 `0.25~0.75 tile` 범위로 제한한다.
- 그림자가 1 tile 이상 통행 경계를 덮거나 path를 비통행처럼 보이게 만들지 않는다.
- ambient occlusion은 접점 주변 8~16% 불투명도의 중성색을 기본으로 하고 넓은 보라색 AO를 사용하지 않는다.

### 3.4 색·명도·재료

- 마을당 기본 재료색 4~6개와 제한 accent 1~2개를 사용한다.
- 한 material family는 기본, highlight, shadow, contact의 3~5 tone으로 정리한다.
- 기본 world는 밝은 낮 또는 부드러운 늦은 오후 범위에서 시작한다.
- path는 인접 ground보다 명도 대비가 명확해야 하며 색상 차이만으로 구분하지 않는다.
- non-walkable obstacle은 path보다 어둡거나 edge가 강해야 한다.
- village accent는 마을 정체성을 만들지만 UI·marker의 기능 대비를 빼앗지 않는다.
- 야간·축제·계절 조명은 기본 팔레트가 아니라 교체 가능한 event layer다.

### 3.5 Texture detail 밀도

- 32px ground tile 내부의 작은 detail은 0~3개를 기본으로 한다.
- tile edge 3px 안쪽에는 반복 seam을 만드는 고유 점·금·그림자를 두지 않는다.
- ground variant는 같은 base edge를 공유하고 내부 detail만 바꾼다.
- 한 화면에서 같은 식생·돌·균열이 5회 이상 연속 반복되면 variant index를 바꾼다.
- marker 중심 1 tile 안은 고대비 texture를 비우고 주 접근 방향 2 tiles는 outline clutter를 제한한다.

### 3.6 Foreground·collision·interaction

| 항목 | 규칙 |
|---|---|
| foreground overhang | walkable 영역 안으로 최대 1.5 tiles. 캐릭터 발·marker glyph·문을 가리지 않음 |
| collision 차이 | 보이는 경계와 실제 경계 차이 목표 ≤0.5 tile |
| marker clearance | 중심 주변 최소 1 tile, 주 접근 방향 2 tiles |
| 입구 clearance | 문·gate 앞 3×3 tiles |
| 높은 object | Garden·spawn·marker clearance와 main spine에 배치 금지 |

Collision, walkable mask와 interaction 영역은 bitmap 색을 읽어 추론하지 않고 별도 논리 guide로 유지한다.

### 3.7 Emissive·animation

- 환경 emissive 면적은 화면의 5% 이하를 목표로 한다.
- 활성 sound marker가 가장 높은 국소 대비를 갖는다.
- landmark emissive는 낮은 빈도 또는 정적이며 marker보다 밝게 맥동하지 않는다.
- 독립 환경 animation은 화면당 0~4개, 최대 6개를 1차 휴리스틱으로 사용한다.
- active marker만 제한적인 호흡형 motion을 쓰고 completed·locked는 움직이지 않는다.
- `prefers-reduced-motion`에서는 기능을 잃지 않는 정적 상태를 제공한다.

### 3.8 모바일·축소

- 320×180 축소에서 main path, landmark, player와 active marker 실루엣이 유지되어야 한다.
- 모바일 실제 화면에서 path edge와 shortcut이 합쳐지지 않아야 한다.
- UI touch target은 최소 44 CSS px이고 background asset의 시각 크기와 분리한다.
- 작은 texture를 늘려 가독성을 보완하지 않고 큰 명도 면과 edge를 우선한다.

## 4. UI·marker와 배경 관계

- Marker는 background bitmap, ground tile, building 이미지에 굽지 않는다.
- Sound marker의 이중 ring·파형 glyph는 마을 외피가 달라도 공통 상태 문법을 유지한다.
- 재화는 marker와 실루엣·ring·motion을 공유하지 않는다.
- 배경의 teal·lavender·gold는 marker 상태색과 같은 크기·ring 형태·호흡 motion을 사용하지 않는다.
- annotation panel이 열리면 환경 animation과 emissive를 감쇠할 수 있어야 한다.

## 5. 마을별 독립 정체성

| 마을 | 고유 팔레트 | Landmark | 경로 형태 | 주요 재료 | 밀도·장식 | 프라이밍 금지 | 구분 실루엣 |
|---|---|---|---|---|---|---|---|
| Animal | grass `#6F9E52`, soil `#B98555`, cream `#F2E3BA`, orange `#D98C45` | 공동 돌봄 헛간 | 완만한 목책 loop와 흙길 | 목재, 흙, 낮은 돌 | 중저밀도 목초지·연못 | marker 옆 특정 동물·먹이·울음 source | 낮고 둥근 roof, 완만한 fence |
| Human | brick `#B86655`, apricot `#E8A04A`, textile `#C85C78`, cream `#F6E4C8` | 공동 회관·열린 계단 광장 | 작은 광장과 연결 골목 | 벽돌, 회벽, 직물 | 중밀도 생활 흔적 | 군중·말풍선·행동이 표현 정답 암시 | 겹친 eave, awning, stepped plaza |
| Nature | leaf `#3F8057`, dew `#67B7B0`, sky `#83A9D8`, lime `#CDEB88` | 순환 샘 | 유기적 loop와 deck, 명료한 edge | 식생, 물, 목재 deck, stone | edge는 풍부하되 path는 저밀도 | marker 옆 특정 weather·water·fire source | vertical canopy와 낮은 water band |
| Urban | asphalt `#4E5966`, stone `#A8A292`, glass `#6C94A8`, yellow `#F2C14E` | 중앙 환승·신호 landmark | 직교 보행로와 읽히는 crossing | stone, metal, glass | 고밀도 mass + 교차점 buffer | 차량·경보·공사 source를 marker 옆에 직접 배치 | 각진 vertical block, 반복 window rhythm |
| Music | ground `#AAB490`, soil `#B89E7C`, warm stone `#D9C7A8`, teal `#668F8A`, lavender `#A89BC0`, gold `#C69A45` | Resonance Stage·Garden | 단일 loop, 반복 curve, central shortcut | warm stone, plaster, wood, low planting | 중밀도, 열린 marker pad | 악기·음표·speaker·concert source | circular Garden, wave canopy, rhythmic spacing |
| Lab | deep blue `#173B5E`, teal `#2B7180`, brass `#E2B44D`, starlight `#D8E8F4` | 원형 spectrum observatory | radial observation loop | dark stone, glass, brass | 중밀도 정밀 장치 | 공포 함정·뼈·붉은 경고·정답 암시 계기 | dome, spectrum wedge, thin brass line |

팔레트 값은 마을 간 역할을 보여주는 production 시작점이며 화면·파일럿 검수 후 버전 관리한다. 한 마을의 accent를 다른 마을에 전역 강제하지 않는다.

## 6. Music B1 전용 적용 규칙

- Direction B에서 채택: crisp 32px boundary, modular tile/prop family, 모바일 가독성, 캐릭터 compatibility, 레이어 분해성.
- 채택하지 않음: 야간, 넓은 보라 shadow, 창문·lamp 과발광, cyberpunk·club 인상.
- 기본 시간대: 밝은 낮 또는 부드러운 늦은 오후.
- Music 정체성: 색만이 아니라 loop, curve, Garden, wave canopy, rhythmic spacing으로 전달.
- Warm gold는 World Gate footprint guide, Stage approach, 소수 accent에만 사용한다.
- Dark navy·purple은 작은 contact shadow와 이후 roof detail에만 제한한다.

## 7. House-decor meta space

House-decor는 다양한 마을 재화로 얻은 물품과 여러 사용자 팔레트를 수용하는 중립적 customization 공간이다.

- 전역 카메라·해상도·outline·그림자·비례·detail density는 공유한다.
- Music의 teal·lavender·gold나 다른 마을의 팔레트를 기본값으로 강제하지 않는다.
- 가구·벽지·계절 테마가 바뀌어도 캐릭터 발 접점, object footprint, UI 대비는 전역 문법을 따른다.
- 마을과 house-decor의 일관성 평가는 색 일치가 아니라 rendering grammar와 interaction readability로 판단한다.

## 8. 공통 검수 게이트

- [ ] 32px edge와 동일 재료 seam이 맞는다.
- [ ] 24×18 FOV와 모바일에서 main path가 유지된다.
- [ ] marker clearance와 문·gate 접근 영역을 침범하지 않는다.
- [ ] collision과 시각 경계 차이가 0.5 tile 이하이다.
- [ ] background emissive가 active marker보다 강하지 않다.
- [ ] 기본 map이 야간 조명 없이도 읽힌다.
- [ ] 마을 팔레트는 독립적이고 전역 grammar는 공유된다.
- [ ] house-decor 팔레트를 특정 마을의 기준으로 사용하지 않는다.
