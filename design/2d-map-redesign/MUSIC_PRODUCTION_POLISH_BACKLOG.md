# Music Production Polish Backlog

## 상태와 범위

- Music production은 현재 `2C-C`를 안정적인 체크포인트로 유지한다.
- `2C-R1`은 시각 품질 비교용 preview와 향후 backlog만 만든다.
- R1-A/R1-B는 production에 적용하지 않았으며, R2 및 production 에셋 재제작도 시작하지 않았다.
- 기존 Music renderer, runtime asset, manifest, collision, sound slot, marker 상태는 그대로 유지한다.
- 다음 우선 작업은 Music 후속 작업이 아니라 **미지의 소리 마을(Lab)** 이다.

## 현재 production Music 진단

| 항목 | 현재 상태 | 향후 조정 방향 |
| --- | --- | --- |
| 단일 beige 면 | 넓은 이동 가능 영역이 하나의 beige 면처럼 읽혀 광장·길·마당의 용도가 분리되지 않는다. | 주 동선, 건물 앞 apron, Garden, Stage 전면을 명도·입자·경계 재료로 구분한다. |
| ground/path 재료 밀도 | 지면의 작은 클러스터, 마모, 이음, 가장자리 변화가 부족해 큰 면이 비어 보인다. | 저대비 재료 디테일을 단계적으로 추가하되 collision 경계를 흐리지 않는다. |
| 건물 깊이 | foundation, roof thickness, overhang, 전경 가림 요소가 약해 건물이 지면 위의 평면 도형처럼 보인다. | 기단·처마·지붕 단차·전경 식재를 공통 문법으로 만들고 출입구는 항상 명확히 유지한다. |
| 캐릭터 대비 환경 밀도 | 실제 캐릭터의 pixel/detail density가 환경보다 높아 캐릭터와 배경이 서로 다른 제작 단계처럼 보인다. | 캐릭터의 cluster 크기와 대비를 기준으로 환경의 중간 크기 디테일을 보강한다. |
| 좌우 대칭과 prop 반복 | 좌우 구조와 prop 배치 반복이 강해 탐색 중 위치 구분과 생활감이 약하다. | 기능별 비대칭 landmark와 2~3종 prop 변형을 두되 핵심 loop는 보존한다. |
| Garden 중간 밀도 | 잔디와 외곽 식재 사이의 중간 높이·중간 크기 요소가 부족하다. | 낮은 관목, 화단 경계, 작은 그늘, 마모 흔적을 추가해 빈 면을 연결한다. |

## R1-A / R1-B 비교

### R1-A — warm organic late afternoon

- honey limestone, clay, sage, teal, lavender 계열의 따뜻하고 유기적인 방향이다.
- 식재와 생활 소품이 자연스럽고 Garden의 중간 밀도가 가장 좋다.
- 처마와 기단이 부드럽게 연결되어 아늑하지만, Music 고유의 구조적 리듬보다 일반적인 cottage village 인상이 앞설 위험이 있다.
- 늦은 오후 조명이 예쁘지만 production 전역의 시간대·명도 규칙과 충돌할 수 있다.

### R1-B — crisp rhythmic clear daylight

- dusty coral/clay band, 반복되는 paving rhythm, post·slat·baffle의 구조적 문법이 Music 정체성을 더 잘 만든다.
- 밝은 지면과 차가운 그림자의 분리가 강해 Gate, Stage, 건물 전면과 loop 판독성이 좋다.
- civic/acoustic plaza 분위기가 분명하고 실제 캐릭터·marker와의 대비도 안정적이다.
- 가장자리 디테일이 과밀해지거나 길의 band가 지나치게 경직될 수 있으므로 production 단계에서는 밀도 상한이 필요하다.

### 향후 참고 결론

- Music polish가 다시 승인될 경우 **R1-B의 명도 구조와 리듬 문법을 기준 후보**로 삼는다.
- R1-A에서는 Garden의 부드러운 식재, 유기적인 가장자리, 따뜻한 생활감만 선택적으로 참고한다.
- 이 결론은 방향 제안이며 production 승인이나 적용 결정이 아니다.

## Lab 완성본과 비교해 조정할 전역 항목

- 캐릭터 대비 환경의 pixel cluster 크기와 detail density 비율
- ground/path/building 사이의 공통 명도 단계와 그림자 농도
- foundation, roof thickness, overhang, foreground occlusion의 공통 규칙
- 출입구·통과 가능 경계·collision 경계의 시각적 표현
- prop 변형 개수, 반복 간격, 비대칭 landmark 배치 원칙
- 모바일 landscape FOV에서 유지할 최소 여백과 최대 장식 밀도
- 마을별 조명 시간대와 색온도 차이를 허용할 범위
- marker와 캐릭터가 복잡한 배경에서도 읽히는 대비 기준

## Music에만 적용할 후보

- 중앙 loop와 건물 앞 apron에 음향의 반복감을 추상화한 paving band 사용
- Stage canopy, rear wall, foundation의 깊이와 공연 공간 hierarchy 강화
- World Gate 중앙 통로의 개방감과 도착 축을 유지하면서 측면 구조 보강
- Record Archive, Listening Cafe, Community Studio, Sound Workshop의 재료·지붕·마당 정체성 분리
- 음표·악기·스피커·카세트 같은 직접 아이콘 대신 slat, resonance panel, rhythm joint 같은 추상 조형 사용
- Garden에 중간 높이 식재와 작은 쉼터를 보강하되 shortcut 폭과 시야는 유지
- 좌우 prop 반복을 줄이고 네 건물 접근 방향마다 고유 landmark 배치

## 아직 production에 적용하지 않은 R1 제안

- R1-A/R1-B의 지면 재료, 색상, 조명, 식재, prop, 건물 외관 전부
- R1-B 기반과 R1-A 식재를 결합하는 절충안
- foundation·roof·overhang·foreground 보강안
- Garden·Stage·Gate의 밀도 및 hierarchy 변경안
- renderer 또는 runtime asset 교체

위 항목은 모두 preview/backlog 상태다. Lab 완성 후 전역 기준을 비교하고 명시적인 재개 승인이 있을 때만 별도 단계로 검토한다.

## 수동 검수 체크리스트

macOS 자동 입력 제약으로 이번 R1에서 실행하지 않는다. 미검수 상태는 R1 preview 완료의 blocker가 아니다.

- [ ] spawn에서 Gate 통과
- [ ] loop 시계 방향 완주
- [ ] loop 반시계 방향 완주
- [ ] Garden shortcut 통과
- [ ] Stage 전면 접근
- [ ] 네 건물 entrance 주변 이동
- [ ] 모든 주요 corner에서 끼임 여부
- [ ] marker 접근과 Enter prompt
- [ ] 출구 복귀

## R1 reference

- `previews/2c-r-music-quality-recovery/r1-a-full-map.png`
- `previews/2c-r-music-quality-recovery/r1-b-full-map.png`
- `previews/2c-r-music-quality-recovery/r1-a-r1-b-full-map-comparison.png`
- `previews/2c-r-music-quality-recovery/legacy-current-r1a-r1b-equal-viewport.png`
- `previews/2c-r-music-quality-recovery/current-r1a-r1b-material-density.png`
- `previews/2c-r-music-quality-recovery/r1-a-detail-sheet.png`
- `previews/2c-r-music-quality-recovery/r1-b-detail-sheet.png`

