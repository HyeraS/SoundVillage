# SoundVillage 월드맵 기준 이미지 완전 일치 구현용 Codex 프롬프트

아래 프롬프트 전체를 새 Codex 작업에 그대로 전달한다.

---

당신은 상용 2D 게임의 시니어 환경 아티스트이자 React/Next.js 게임 렌더링 엔지니어다.

## 작업 목표

현재 구현된 SoundVillage 월드맵 리스킨 v1을 다시 수정하여 아래 기준 이미지와 **구도, 밀도, 도로 형태, 건물 위치와 크기, 식생, 재료, 색감까지 동일하게 보이는 월드맵**을 실제 production 게임에 구현하라.

최우선 기준 이미지:

`design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png`

현재 구현 결과:

`_review/world-map-reskin-v1/06-full-map-overview.png`

현재 비교 이미지:

`_review/world-map-reskin-v1/10-reference-vs-runtime.png`

이 작업에서 기준 이미지는 단순한 mood board나 참고 자료가 아니다. **최종 화면의 source of truth**다. 임의로 단순화하거나 “게임플레이 가독성을 위해” 식생, 곡률, 랜드마크, 광장 크기, 공간 밀도를 줄이지 마라. 기능적 충돌이 있으면 기준 이미지에 가까운 시각을 유지하면서 collision과 interaction을 다시 설계하라.

분석 문서나 새로운 시안만 만들고 멈추지 말고, production 코드와 에셋을 수정한 뒤 브라우저에서 실제 플레이 검증까지 완료하라.

## 현재 v1이 실패한 이유

현재 결과는 기준 이미지와 동일한 맵이 아니다. 아래 문제를 전부 해결해야 한다.

1. 기준 이미지의 큰 원형 순환로 대신 기존 직각형·U자형 길이 남아 있다.
2. 기준 이미지의 중앙 이중 원형 정원과 방사형 구도가 축소·단순화되었다.
3. 기준 이미지는 화면 전역이 나무, 화단, 돌, 울타리, 수변으로 연결되어 있지만 runtime은 넓은 빈 잔디가 대부분이다.
4. 기준 이미지의 건물은 환경 속에 결합되어 있지만 runtime은 작은 landmark PNG가 빈 잔디 위에 놓인 스티커처럼 보인다.
5. Nature의 연속된 개울·폭포·다리 대신 별도의 연못과 작은 gateway가 분리되어 있다.
6. 각 지역의 전환이 경로와 조경에 의해 자연스럽게 이어지지 않고 작은 타원색 영역으로만 표시된다.
7. 중앙 도서관, 외곽 건물, 길, 나무의 상대적 크기와 간격이 기준 이미지와 다르다.
8. 현재 `10-reference-vs-runtime.png`는 두 이미지를 같은 crop과 scale로 정규화하지 않아 정확한 비교 자료가 아니다.

현재 QA 보고서의 “without reproducing the reference one-to-one”이라는 판단은 이번 목표와 정반대다. 이번 작업은 one-to-one에 최대한 가까운 재현이 목적이다.

## 시작 전에 반드시 수행할 일

1. 저장소의 `AGENTS.md`를 읽고 준수한다.
2. 코드를 수정하기 전에 `node_modules/next/dist/docs/`에서 현재 Next.js 버전의 Client Component, public asset, CSS/static asset 관련 문서를 읽는다.
3. `git status --short`를 확인한다. 기존 변경은 사용자 작업이므로 되돌리거나 덮어쓰지 않는다.
4. 다음 파일을 읽어 현재 v1 구현과 gameplay 계약을 파악한다.
   - `components/WorldMap.js`
   - `components/AssetRegistry.js`
   - `components/GameEngine.js`
   - `app/globals.css`
   - `scripts/verify-world-map-reskin.mjs`
   - `_review/world-map-reskin-v1/QA_REPORT.md`
   - `_review/world-map-reskin-v1/ASSET_SOURCES.md`
5. 기준 이미지와 runtime 전체 맵 이미지를 원본 해상도로 직접 열어 육안 비교한다.
6. 현재 v1을 보존 가능한 fallback으로 취급한다. 기존 v1 파일을 삭제하거나 덮어쓰지 말고 `sound-archive-garden-v2` 에셋과 새 코드 경로를 만든다.

## 가장 중요한 구현 전략: 기준 이미지 자체를 실제 환경 아트로 사용

이번에는 기준 이미지를 보고 비슷한 오브젝트를 새로 생성해서 재조립하지 마라. 그것이 v1의 가장 큰 실패 원인이다.

기준 이미지 전체를 실제 월드 아트의 기반으로 사용한다.

1. `01-sound-archive-garden-reference.png`를 edit target으로 사용한다.
2. 이미지 중앙에 구워진 플레이어 캐릭터만 정밀하게 제거하고 주변 원형 석재 문양을 복원한다.
3. 텍스트, UI, marker를 새로 추가하지 않는다.
4. 건물, 도로, 나무, 개울, 꽃, 울타리, 그림자, 광장 구도는 변경하지 않는다.
5. 원본과 정확히 같은 4:3 구도를 유지한다.
6. 필요하면 deterministic 2× upscale을 만들어 최소 `2896×2172`의 clean master를 사용한다. 비율을 찌그러뜨리거나 crop하지 않는다.
7. 고해상도 보강을 위해 ImageGen을 사용해야 한다면 `precise-object-edit` 방식으로 사용하고, “구도·건물·길·식생을 바꾸지 말고 플레이어만 제거하며 디테일을 고해상도로 복원”하도록 지시한다. 새롭게 재구성하거나 새로운 랜드마크를 생성하지 않는다.
8. 편집 결과를 원본에 정렬해 overlay 비교한다. 플레이어 제거 영역 외에서 큰 구조가 움직였으면 해당 결과는 폐기한다.

clean master를 다음 경로에 새로 저장한다.

`public/assets/world/sound-archive-garden-v2/world-base-clean.png`

전체 환경을 기존처럼 수십 개의 독립 랜드마크 PNG로 다시 조립하지 않는다. **완전히 동일한 첫인상을 얻기 위해 clean full-map base layer를 우선 사용한다.**

단, 다음 요소는 full-map base에 굽지 않는다.

- 플레이어와 duo 캐릭터
- portal label, 잠금 배지, 진행률, hover/Enter cue
- 목표 카드와 HUD
- 선택 경로 강조
- 움직이는 효과 및 상태 효과

## 좌표와 레이아웃 변경 권한

이전 프롬프트와 달리 기존 portal 좌표, `PATH_TILES`, `RING_TILES`, `MUSEUM`, `HOME`, 장식 좌표를 절대 조건으로 고정하지 않는다. 기준 이미지의 구도와 맞추기 위해 아래 항목을 수정할 수 있다.

- 여섯 portal의 월드 좌표와 hitbox
- 중앙 도서관의 visual footprint와 interaction rectangle
- Home 위치와 접근 경로
- spawn 위치
- 방사형 길과 순환로의 centerline
- water/obstacle/tree/building collision
- foreground occlusion 영역
- camera overview용 framing

다만 아래 의미 관계는 유지한다.

- 중앙: Sound Library
- 상단 중앙: Lab
- 우상단: Animal
- 오른쪽: Urban
- 우하단: Music
- 좌하단: Human
- 왼쪽: Nature
- 좌상단의 별도 소형 건물: Home으로 사용
- 하단 중앙 아치: 월드의 장식적 진입 게이트로 사용

기존 Home 위치를 유지하기 위해 기준 이미지와 다른 장소에 집을 추가하지 마라. 기준 이미지의 좌상단 건물을 Home 진입 대상으로 연결한다.

## 기준 이미지에서 반드시 그대로 재현할 공간

### 중앙 허브

- 화면 중심의 크림색 도서관
- 도서관을 감싸는 넓은 동심원 석재 광장
- 중앙 원형 문양
- 광장 좌우의 대칭 벤치, 낮은 식재, 램프
- 광장 바깥의 타원형 정원 섬과 순환로
- 도서관 정면에 위치한 플레이어 spawn

### 전체 길 구조

- 중앙 광장을 둘러싼 큰 원형 순환로
- 각 목적지로 자연스럽게 갈라지는 곡선형 방사로
- 북쪽 Lab과 Animal 방향으로 갈라지는 길
- 오른쪽 Urban 방향 연결로
- 왼쪽 Nature 개울 방향 연결로
- 좌하단 Human과 우하단 Music으로 이어지는 곡선로
- 하단 중앙 아치로 이어지는 짧은 진입로

기준 이미지에는 직각으로 반복되는 긴 U자 도로가 없다. runtime에도 남기지 않는다.

### 환경 밀도

- 화면 외곽은 거의 연속된 숲 경계로 감싼다.
- 중앙 정원과 외곽 랜드마크 사이에도 나무 군집, 꽃, 바위, 울타리, 화단을 충분히 배치한다.
- 빈 잔디는 시선 휴식을 위한 소규모 영역으로만 남기고 화면 대부분을 차지하지 않게 한다.
- 기준 이미지의 오브젝트 밀도와 실루엣 분포를 그대로 따른다.
- 동일 나무 PNG를 일정 간격으로 반복해 도장 찍힌 패턴처럼 보이게 하지 않는다.

### 지역별 환경 결합

- Nature: 왼쪽 가장자리에서 시작해 내부로 이어지는 연속 개울, 작은 폭포, 바위 둔치, 갈대, 목교를 기준 이미지 위치와 비율로 구현한다.
- Human: 좌하단에 벽돌 바닥, 다층 건물, awning, 야외 테이블과 화분이 하나의 작은 광장으로 묶여야 한다.
- Music: 우하단에 원형 포장, 곡선 건물, 청록 canopy, lavender 화단, 아치형 정원이 통합되어야 한다.
- Urban: 오른쪽에 어두운 포장 블록, 건물, cyan 신호 장치, street tree가 하나의 도시 블록처럼 결합되어야 한다.
- Animal: 우상단에 둥근 barn, 곡선 울타리, 초지, 낮은 농장 소품이 하나의 방목 구역을 이뤄야 한다.
- Lab: 상단 중앙에 돔 관측소, 계단, 기둥, 램프와 암석 배경이 하나의 관측소 부지를 이뤄야 한다.
- Home: 좌상단 작은 건물과 마당을 기준 이미지 그대로 유지하고 실제 Home 진입을 연결한다.

각 지역을 작은 원형 tint나 독립된 sticker asset 하나로 대체하면 실패다.

## 렌더링 구조

- 월드 논리 크기 `120×90`, `TILE`, 기존 30×22 tracking camera 계약은 유지한다.
- `world-base-clean.png`를 월드 좌표 `0,0`에서 `120*TILE × 90*TILE` 크기로 정확히 렌더한다.
- aspect ratio는 모두 4:3이며 `preserveAspectRatio="none"`으로 찌그러뜨리지 않는다. 소스와 월드의 비율이 같으므로 비례 확대만 한다.
- 전체 맵 배경 위에 player, duo, interaction, portal states를 별도 layer로 렌더한다.
- 필요한 경우 나무 수관, 아치, 건물 처마 일부만 별도의 foreground alpha layer로 추출하여 플레이어보다 앞에 그린다.
- foreground를 새로 그려 기준 이미지와 달라지게 만들지 말고 full-map master에서 동일 위치를 마스크로 추출한다.
- 현재 v1의 독립 landmark, 반복 ground pattern, sparse border forest가 기준 이미지와 충돌하면 v2에서는 사용하지 않는다.
- 기존 v1 에셋은 삭제하지 않되 production v2 렌더에서 보이지 않게 한다.

## Interaction과 collision 재구축

기준 이미지에 맞춰 interaction 좌표와 collision을 재작성한다.

- 건물의 보이는 문 또는 계단 앞에 portal interaction rectangle을 둔다.
- 각 portal은 최소 두 방향에서 접근 가능해야 한다.
- 도서관 spawn은 정면 원형 광장에 둔다.
- Home은 좌상단 건물의 문 앞에서 진입한다.
- 물, 절벽, 건물 body, 밀집 수목, 울타리는 비통행으로 처리한다.
- 보이는 열린 길, 광장, 다리는 통행 가능해야 한다.
- invisible wall이 길 안쪽으로 들어오거나 플레이어가 물·건물 위를 걷지 않게 한다.
- 기존 연구, 잠금, 진행률, Music-first, `onEnterZone`, `onEnterMuseum`, `onEnterHouse`, analytics 이벤트의 의미와 호출 계약은 유지한다.
- gameplay 기능을 보존한다는 이유로 기준 이미지와 다른 위치에 건물을 남겨두지 않는다. 로직을 새 위치에 연결한다.

## UI와 상태 표시

- HUD, 목표 카드, 모바일 방향키는 환경 이미지에 굽지 않는다.
- portal label은 건물 위를 덮지 않도록 문 근처 또는 접근 지점에 배치한다.
- 기본 full-map QA 이미지에서는 UI와 label을 숨길 수 있는 development-only capture flag를 제공한다.
- 일반 플레이에서는 잠금, 현재 목적지, 진행률, Enter cue가 기존과 동일하게 동작해야 한다.
- 상태 효과는 기준 이미지의 건물과 정원을 가리지 않게 작고 절제되게 표현한다.

## 시각 비교 절차

새 runtime 결과를 “비슷해 보인다”는 주관적 판단으로 승인하지 않는다.

1. development-only clean capture 모드에서 다음을 숨긴다.
   - HUD
   - 방향키
   - objective card
   - player 및 duo
   - portal label, progress, Enter cue
2. 카메라를 전체 120×90 월드에 정확히 맞춘다.
3. 결과를 기준 이미지와 동일한 `1448×1086` 크기로 crop 및 resize한다.
4. 두 이미지를 같은 크기로 좌우 배치한 `reference-vs-runtime-normalized.png`를 만든다.
5. 50% alpha overlay와 absolute-difference heatmap도 만든다.
6. 플레이어를 제거한 작은 영역을 제외하고 건물, 길, 물길, 숲 경계가 겹치는지 확인한다.
7. 차이가 크면 완료하지 말고 asset alignment, world coordinate, crop, scale을 다시 수정한다.

가능한 이미지 도구가 있다면 다음 목표를 사용한다.

- normalized clean capture SSIM: `0.95 이상`
- 평균 RGB absolute error: `8/255 이하`
- 기준 이미지의 주요 랜드마크 중심점 위치 오차: 이미지 폭 또는 높이의 `1% 이하`
- 주요 도로 외곽선 위치 오차: `1타일 이하`

도구 제약으로 지표를 계산하지 못하면 overlay와 diff heatmap을 직접 열어 같은 수준인지 육안 검수한다. 흰 여백, 서로 다른 crop, 서로 다른 scale 상태의 비교 이미지는 검수 자료로 인정하지 않는다.

## 기능 합격 조건

- `120×90` 월드와 `30×22` tracking camera가 동작한다.
- 여섯 마을, 도서관, Home에 실제 Enter 진입이 된다.
- Music-first 잠금과 해금 후 상태가 유지된다.
- 키보드와 터치 이동이 모두 동작한다.
- 카메라 경계에 빈 띠, 잘못된 crop, stretch가 없다.
- player와 duo가 새 collision에서 막히거나 건물·물 위를 걷지 않는다.
- desktop, mobile portrait, mobile landscape에서 HUD가 겹치지 않는다.
- annotation, progress, quest, attendance, Supabase, house-decor 로직을 변경하지 않는다.
- lint, 관련 테스트, production build가 통과한다.

## 새 검수 산출물

기존 `_review/world-map-reskin-v1/` 결과를 덮어쓰지 않는다. 다음 경로를 사용한다.

`_review/world-map-reference-match-v2/`

반드시 다음 파일을 만든다.

- `01-reference-clean.png`
- `02-runtime-clean-normalized.png`
- `03-reference-vs-runtime-normalized.png`
- `04-overlay-50.png`
- `05-diff-heatmap.png`
- `06-runtime-full-map-with-interactions.png`
- `07-library-gameplay.png`
- `08-nature-gameplay.png`
- `09-human-gameplay.png`
- `10-music-gameplay.png`
- `11-lab-gameplay.png`
- `12-animal-gameplay.png`
- `13-urban-gameplay.png`
- `14-home-gameplay.png`
- `15-mobile-portrait.png`
- `16-mobile-landscape.png`
- `visual-metrics.json`
- `collision-portal-validation.json`
- `QA_REPORT.md`
- `ASSET_SOURCES.md`

각 이미지 파일은 생성 후 직접 열어 확인한다.

## 금지 사항

- 기준 이미지를 참고만 하고 새로운 레이아웃을 만드는 것
- 기존 직각 경로와 portal 좌표를 유지하기 위해 시안 구도를 희생하는 것
- 독립 landmark atlas만 새로 생성해 빈 잔디 위에 배치하는 것
- 식생 밀도를 임의로 크게 낮추는 것
- small tint ellipse로 지역 전환을 대신하는 것
- 현재 v1 결과를 조금 다듬은 뒤 완료라고 보고하는 것
- 기준 이미지와 runtime을 서로 다른 크기와 crop으로 비교하는 것
- gameplay 가독성을 이유로 기준 이미지의 원형 길과 조경 구조를 제거하는 것
- UI, 플레이어, label, marker를 full-map background에 굽는 것
- 기존 v1 에셋이나 사용자 변경을 삭제하는 것
- 관련 없는 파일을 정리하거나 되돌리는 것
- `git reset --hard`, `git checkout --`, 광범위한 삭제
- 테스트와 육안 검수 없이 완료를 선언하는 것

## 완료 보고

최종 답변에는 다음을 명확하게 보고한다.

1. 기준 이미지를 runtime full-map base로 어떻게 변환했는지
2. 기준 이미지에 맞춰 변경한 portal, Home, spawn, collision 좌표
3. 보존한 gameplay 및 데이터 계약
4. 정규화한 시각 비교 이미지 링크
5. SSIM, 평균 오차, landmark 위치 오차 결과
6. 브라우저 진입 및 모바일 검증 결과
7. 기준 이미지와 아직 다른 부분이 있다면 정확한 위치와 이유

기준 이미지와 큰 차이가 남아 있으면 “완료”라고 보고하지 말고 계속 수정한다. 이번 작업의 성공 기준은 코드 변경량이나 테스트 통과가 아니라, 사용자가 기준 이미지와 runtime 전체 맵을 나란히 보았을 때 같은 맵이라고 인식하는 것이다.

---

