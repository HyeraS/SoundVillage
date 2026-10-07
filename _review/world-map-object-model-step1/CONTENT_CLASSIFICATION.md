# World map v4 content classification

## 분류 원칙

에셋의 투명 영역이나 파일 경계가 아니라 gameplay 책임으로 분류한다. 아래 질문 중 하나라도 “예”인 경우에만 독립 logical object 후보가 된다.

- 독립적으로 이동/교체/상태 변경되는가?
- 독립 collision 또는 blocking reason이 필요한가?
- interaction/destination이 있는가?
- 플레이어와 depth/occlusion 관계를 따로 계산해야 하는가?
- camera culling 단위로 분리했을 때 큰 메모리/overdraw 이득이 있는가?

모두 “아니오”이면 꽃, 잔디, 작은 돌의 개수와 무관하게 baked ground 또는 static decoration cluster로 유지한다.

우선순위는 다음과 같다.

- P0: schema/adapter pilot에 반드시 포함
- P1: depth/collision/state 문제 해결에 직접 필요
- P2: 성능 측정 후 선택적으로 분리
- P3: 현재 baked/cluster 유지; 분리하지 않음

## 1. baked ground

### 현재 내용

- 잔디, 도로, 물, 광장 표면, 흙길, 포장 줄눈
- `terrain-underlay-imagegen.png`에서 생성된 12개 960×960 runtime panel
- 항상 먼저 그려지는 480×360 `terrain-preview`

### 왜 이 범주인가

표면 자체는 이동·상호작용·depth sorting 단위가 아니다. terrain panel은 의미 오브젝트가 아니라 전송/컬링을 위한 generated tile이다. WorldObject registry에 12개의 별도 gameplay object로 넣으면 authored 의미 없이 노드만 늘어난다.

### 권장 모델

- authored: `world-ground` 하나 또는 WorldScene-level terrain source
- generated: 12 panel layer records와 preview
- collision: 없음. walkability/collision은 별도 논리 collider projection에서 생성
- minimap: authored guide road를 별도 저비용 vector 표현으로 사용

### 분리 우선순위

P3. 현 패널 구조 유지. Home site나 향후 지역 아트 교체가 필요하면 semantic terrain patch를 `ground` layer로 추가하되, 잔디 한 덩어리마다 object를 만들지 않는다.

## 2. baked static decoration cluster

### 현재 내용

현재 `environment-*` 8개 crop:

- north forest
- west stream forest
- east forest
- central gardens
- southwest garden
- southeast garden
- south-center garden
- south forest

이 안에는 수목, 관목, 꽃, 작은 돌, 벤치/등 일부가 함께 구워져 있다. 현재는 모든 cluster가 `sortY=0`, `environment` layer로 terrain 뒤·gameplay object 앞에 그려진다.

### 왜 이 범주인가

대부분의 내용은 독립 collision/interaction/state가 없고 reference reconstruction을 위한 큰 semantic crop이다. cluster를 모든 식생 개체로 분해하면 다음 비용만 커진다.

- SVG/React node 수와 sort 항목 수
- spatial index entry와 object metadata
- asset request/decoded texture fragmentation
- authoring/QA 표면적

### 권장 모델

- `kind:'static-decoration-cluster'`
- 한 cluster가 필요하면 ground/body/foreground layer를 여러 장 가질 수 있으나 logical id는 하나 유지
- collision은 기본 `none`; 실제로 막아야 하는 나무 몸통/벽만 별도 gameplay object로 승격
- 꽃·잔디·작은 돌·낮은 관목은 `decorative-nonblocking` collider조차 만들 필요가 없다. debug/툴링 목적이 명확할 때만 role을 사용한다.

### 분리 우선순위

- P1: Home site의 이동/제거 대상 벤치, 가로등, 벽/화단 중 실제 depth/collision/state 책임이 생기는 것
- P2: 큰 cluster가 camera를 크게 벗어나도 로드되는 것이 계측으로 확인될 때 cluster 자체를 2–4개로 재분할
- P3: 꽃, 풀, 작은 돌, 바닥 그림자, 낮은 관목

## 3. modular gameplay object

### 현재 필수 대상

- `landmark-lab`
- `landmark-animal`
- `landmark-urban`
- `landmark-music`
- `landmark-human`
- `landmark-nature`
- `landmark-library`
- `landmark-home`

각각 interaction 또는 destination, 명시적 building collider, depth sort가 있으므로 logical object다. 현재 visual은 한 장의 crop이지만 최종 모델에서는 파일 수와 무관하게 한 logical object 아래 다음 layer를 가질 수 있다.

- site/ground apron
- building body
- player 앞에 와야 하는 roof/canopy/front trim
- 상태 overlay/effect

### 선택적 환경 대상

독립 object로 승격할 수 있는 것은 다음뿐이다.

- 문/게이트: interaction 또는 열림/닫힘 state가 있을 때
- 벤치: 앉기 interaction 또는 furniture collision이 있을 때
- 벽/울타리: 명시적 collider와 ownership이 필요할 때
- 가로등: 독립 depth/lighting/state가 있을 때
- 나무: 몸통 collider 또는 수관 occlusion을 독립 제어할 때
- 큰 표지판/조형물: interaction, collision, state 중 하나가 있을 때

### 왜 이 범주인가

물리·상호작용·state·depth 중 하나 이상이 독립 lifecycle을 가진다. 하나의 building crop에 정원과 전경이 포함되어 있어도 logical building id는 유지하고 layer만 나눈다.

### 분리 우선순위

- P0: Library pilot
- P1: 나머지 기존 6개 landmark, 그 뒤 Home site 승인 후 Home
- P1: 실제 통행을 막는 벽/울타리/나무 몸통
- P2: interaction 가능한 bench/door/lamp
- P3: 아무 기능이 없는 소형 장식

## 4. foreground / occluder

### 현재 내용

- `foreground-south-gate` 한 장
- 일부 landmark/environment crop 내부에 플레이어를 덮어야 할 가능성이 있는 지붕, 수관, 전면 장식이 아직 body와 함께 있음
- Home 선행안의 optional `home-foreground`

### 왜 이 범주인가

플레이어와의 상대 깊이가 ground/body와 다르다. 그러나 foreground는 독립 gameplay object일 필요가 없다. 대개 부모 object의 visual layer다.

### 권장 모델

- landmark/prop의 `visual.layers[].role:'foreground'` 또는 `'occluder'`
- parent object의 transform/state/provenance 공유
- layer bounds로 2차 culling
- 전역 south gate처럼 여러 object를 덮는 지역 occluder만 독립 `kind:'occluder'`
- `sortY=999999` sentinel 대신 명시적 `renderBand:'foreground'`

### 분리 우선순위

- P1: 플레이어가 건물/수관 앞뒤를 오갈 때 현재 깊이 오류가 실제로 보이는 부분
- P1: 새 Home의 전면 울타리/가로등/관목 끝 중 플레이어를 실제로 가려야 하는 픽셀
- P2: 큰 landmark crop의 지붕/전면부를 분리했을 때 시각 회귀와 texture 비용이 허용되는 경우
- P3: 항상 background에 있어도 문제가 없는 장식

## 현재 콘텐츠 매핑

| 현재 항목 | 논리 분류 | 현재 문제 | 향후 처리 |
|---|---|---|---|
| 12 terrain panels | baked ground generated tiles | panel이 semantic object처럼 보일 수 있음 | `world-ground`의 generated layers로 취급 |
| terrain preview | baked ground fallback | panels와 중첩 draw | 유지하되 readiness 후 visibility/비용은 별도 계측 |
| 8 environment crops | static decoration clusters | 매우 큰 bounds/decoded texture, 일부 foreground 혼재 | cluster 유지, 필요 부분만 layer/prop 승격 |
| 8 destination buildings | modular gameplay objects | visual/destination/collision 분산 | object별 점진 이전 |
| guesthouse | static landmark cluster 또는 noninteractive modular landmark | `landmark-home` asset 재사용, inspection-only | interaction 없는 logical object로 유지; normal visibility 여부 명시 |
| south gate | region foreground/occluder | global sentinel sortY | explicit render band로 이전 |
| authored spoke paths | navigation/minimap semantic data | 실제 BFS route와 혼동 가능 | guide path로 명명 |
| Home status badge | object state presentation | object 밖 UI에만 존재 | state key는 object projection, UI는 consumer 유지 |

## Home site 적용 시 경계

Home 선행 자료의 책임 분리는 WorldObject 모델과 잘 맞는다.

- `home-site-ground`: Home object의 `ground` layer 또는 별도 site object. 접근로/낮은 장식은 nonblocking.
- `home-building`: 같은 Home logical object의 `body` layer.
- `home-foreground`: 필요한 픽셀만 같은 object의 `foreground` layer.
- 이동되는 가로등: 독립 depth/state/collider가 필요하면 별도 prop object.
- 제거/재구성되는 곡선 화단·관목: 한 `static-decoration-cluster` layer. 개별 꽃 object 금지.

Home을 실제 적용하기 전에는 Step 1의 좌표를 production current와 섞지 않는다. 특히 collision right 1774는 후속 half-open collision 시스템이 대체했다.

## 성능 가드레일

- logical object 수 증가는 draw call 증가와 동일하지 않아야 한다.
- pilot 전후 동일 camera에서 normal-mode SVG `<image>` 수가 바뀌지 않는 것이 1차 기준이다.
- multi-layer 분리는 실제 depth/state 요구가 있는 픽셀에만 적용한다.
- cluster 분할은 전송 bytes, decoded RGBA peak, viewport overdraw 중 하나가 측정상 개선될 때만 승인한다.
- minimap은 WorldObject의 전체 visual layer를 복제하지 않고 marker/guide vector projection만 사용한다.
- collider 수는 runtime movement cost를 늘리지 않는다. mask build cost만 증가하고 movement는 계속 1회 bit lookup이다.
