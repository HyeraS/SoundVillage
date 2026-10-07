# SoundVillage 월드맵 리스킨 구현용 Codex 프롬프트

아래 프롬프트 전체를 새 Codex 작업에 그대로 전달한다.

---

당신은 상용 2D 게임의 환경 아트와 React/Next.js 게임 렌더링을 함께 책임지는 시니어 게임 맵 디자이너 겸 구현 엔지니어다.

## 최종 목표

현재 SoundVillage production 월드맵을 아래 기준 이미지와 시각적으로 최대한 동일하게 리스킨하고, 실제 게임에서 플레이 가능한 상태로 완성하라.

- 최우선 기준 이미지: `design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png`
- 현재 production 구현: `components/WorldMap.js`
- 공통 에셋 등록: `components/AssetRegistry.js`
- 전역 디자인 규칙: `design/2d-map-redesign/DESIGN_BIBLE.md`
- 전역 아트 문법: `design/2d-map-redesign/GLOBAL_ART_LANGUAGE_AND_VILLAGE_IDENTITY.md`

이번 작업은 분석이나 추가 시안 제작만 하는 작업이 아니다. 기준 이미지와 같은 첫인상, 공간 구조, 재료, 색감, 랜드마크 위계가 실제 월드맵 플레이 화면에 나타나도록 에셋 제작, 코드 연결, 충돌 및 카메라 검증, 브라우저 QA까지 완료하라.

## 작업 시작 전에 반드시 할 일

1. 저장소의 `AGENTS.md`를 읽고 준수한다.
2. 이 프로젝트의 Next.js 버전은 일반적인 Next.js와 다를 수 있으므로 코드를 수정하기 전에 `node_modules/next/dist/docs/`에서 이번 작업과 관련된 Client Component, public asset, image/static asset, CSS 관련 문서를 읽는다.
3. `git status --short`로 기존 사용자 변경을 확인한다. 작업 트리가 dirty인 것을 정상으로 간주하고, 기존 변경을 되돌리거나 덮어쓰지 않는다.
4. 다음 파일을 읽고 현재 월드맵의 좌표, draw order, interaction, collision, responsive camera 계약을 파악한다.
   - `components/WorldMap.js`
   - `components/GameEngine.js`
   - `components/AssetRegistry.js`
   - `app/page.js`
5. 기준 이미지와 아래 현재 마을 화면을 직접 열어 비교한다.
   - Animal: `_review/animal-zone-milk-egg-items/01_full_zone_overview.png`
   - Nature: `design/concepts/nature-farm-2026-09-01/verification-v2/nature-v3-product-1440x900.png`
   - Human: `_review/human-community-hall-v2/gameplay-desktop-1440x844.png`
   - Urban: `_review/urban-advanced-city/final-desktop-1920x1080.png`
   - Music: `design/2d-map-redesign/previews/2c-c-music-production/production-overview.png`
   - Lab: `design/2d-map-redesign/previews/lab-2a-r3/r3-desktop.png`
6. 구현 전 현재 월드맵의 데스크톱과 모바일 기준 스크린샷을 저장한다. 이후 같은 위치와 조건으로 before/after를 비교한다.

## 시각적 기준

기준 이미지의 핵심을 임의로 단순화하지 말고 다음 요소를 실제 화면에 재현한다.

### 1. 전체 콘셉트

- 콘셉트 이름은 `Sound Archive Garden / 소리 기록 정원`이다.
- 월드맵은 일곱 번째 테마 마을이 아니라 여섯 마을을 연결하는 밝고 안전한 공용 캠퍼스다.
- 시점은 기존과 동일한 정사영에 가까운 top-down 3/4다.
- 환경은 풍부한 hand-painted pixel-hybrid 스타일로 제작한다.
- 캐릭터, interaction marker, 기능적 edge는 기존 픽셀 스타일처럼 또렷해야 한다.
- 전체 시간대는 밝은 낮과 따뜻한 늦은 오후 사이로 유지한다.
- 공통 광원은 좌상단이며 그림자는 짧고 부드럽게 우하단으로 떨어진다.

### 2. 중앙 도서관과 광장

- 기존의 거대한 회색 직사각형 포장 면을 제거한다.
- 중앙에는 기준 이미지와 같은 따뜻한 크림색 석재의 유기적인 원형 광장을 만든다.
- 도서관 건물은 중앙 방향 기준점이지만 화면을 압도하지 않는 크기로 유지한다.
- 광장 바닥에는 얇고 절제된 동심원형 음파 인레이를 넣는다.
- 도서관 앞에는 명확한 출입구, 열린 접근 공간, 대칭에 가까운 화단과 벤치를 배치한다.
- 음표, 거대한 스피커, 과도한 네온처럼 Music 마을로 오인되는 장식은 사용하지 않는다.

### 3. 길과 공용 정원

- 중앙에서 여섯 마을로 이어지는 방사형 길과 외곽 순환로를 유지한다.
- 기준 이미지처럼 따뜻한 석재 길과 흙길이 완만하게 연결되어야 한다.
- 모든 실제 walkable path는 배경 잔디와 명도 및 edge로 분명하게 구분한다.
- 주 경로의 논리 폭, 입구 접근성, 현재 collision contract를 보존한다.
- 길 위에 나무, 화단, 벤치, 표지판을 배치해 유효 폭을 줄이지 않는다.
- 중앙과 외곽 사이에는 낮은 생울타리, 벤치, 작은 화단, 표지판으로 구성된 공용 정원 벨트를 만든다.

### 4. 여섯 마을 진입부

여섯 진입부는 동일한 면적, 밝기, 랜드마크 중요도를 갖되 바닥 재료, 실루엣, 식생으로 구분한다. 서로 단절된 사각형 바이옴 패치처럼 보이면 실패다. 공용 정원에서 각 마을로 6~10타일에 걸쳐 점진적으로 전환한다.

- 북서 Lab: 청회색 관측소 석재, 얇은 황동 선, 청록 유리, 작은 관측 돔. 공포 던전이나 붉은 경고등 금지.
- 북동 Animal: 올리브 목초지, 곡선형 목책, 둥근 공동 헛간, 낮은 농장 소품. 특정 sound의 정답을 암시하는 동물 배치 금지.
- 동쪽 Urban: 짙은 보행 포장, 청록 횡단 패턴, 각진 가로수와 신호 랜드마크. 월드맵 전체를 야간으로 바꾸지 말고 작은 정적 발광만 허용.
- 서쪽 Nature: 이어지는 개울, 목교, 갈대, 큰 수관과 낮은 물길의 대비. 보이는 물가와 collision 경계를 맞춘다.
- 남서 Human: 따뜻한 벽돌과 크림 석재, 열린 공동체 계단, 차양, 게시판과 화분. 군중과 말풍선 과밀 금지.
- 남동 Music: 크림색 원형 정원 포장, 물결형 캐노피, teal과 절제된 lavender 식재. 악기와 음표를 반복 장식으로 사용하지 않는다.

### 5. 우리 집

- 현재 `HOME` 위치, 진입 hitbox, 집꾸미기 흐름은 보존한다.
- 공용 정원 안의 작은 주거 오솔길과 아늑한 집으로 표현한다.
- 여섯 마을 게이트보다 작고 조용한 위계를 유지한다.

### 6. 색과 밀도

- 전역 기반색: sage green, warm cream stone, honey soil, subdued wood.
- 각 zone 강조색은 해당 진입부 전환 영역에만 제한한다.
- Nature와 Human 화면의 회화적 재료 밀도를 주요 품질 기준으로 사용한다.
- Music의 원형 및 물결형 공간 구조, Lab과 Urban의 정밀한 재료 포인트만 선택적으로 가져온다.
- 중앙 허브와 주 경로에는 충분한 시선 휴식 공간을 남긴다.
- 모든 구역을 꽃, 나무, 파티클로 균일하게 채우지 않는다.

## 보존해야 하는 기능 계약

리스킨을 이유로 다음 기능을 삭제하거나 의미를 바꾸지 않는다.

- 120×90 논리 타일 월드
- 기존 `TILE` 좌표계
- 30×22 타일 추적 카메라와 반응형 화면 처리
- `Animal`, `Lab`, `Urban`, `Nature`, `Music`, `Human`의 현재 방향과 portal interaction
- 중앙 도서관 진입
- 우리 집 진입과 house-decor 흐름
- 잠금, 해금, 진행률, Music-first 진행 규칙
- 키보드, 터치, 방향키 이동
- 현재 캐릭터 및 duo participant 표시
- hover/near 상태, `ENTER` 진입, 목표 카드와 접근성 라벨
- 분석 이벤트, Supabase, annotation, 투표, 재화, 출석, 퀘스트 로직

`MAP_W`, `MAP_H`, `VIEW_TW`, `VIEW_TH`, portal destination 및 entry hitbox는 특별한 기술적 문제가 없는 한 변경하지 않는다. 길의 시각 형태를 다듬을 수는 있지만 보이는 길과 실제 collision 사이의 차이는 최대 0.5타일 이내로 유지한다.

## 에셋 제작 및 연결 규칙

- 기준 이미지를 단순히 화면 위에 한 장의 스크린샷으로 덮지 않는다.
- 플레이어, UI, 라벨, marker, 진행 상태를 배경 이미지에 굽지 않는다.
- 필요한 경우 `imagegen` 스킬을 사용해 기준 이미지와 일치하는 환경 에셋을 제작한다. 생성 이미지의 왜곡된 문, 창문, 울타리, 텍스트, 원근 오류는 그대로 사용하지 말고 정리한다.
- 최종 production 에셋은 `public/assets/world/sound-archive-garden-v1/` 아래에 새 파일로 저장한다.
- 최소한 다음 레이어를 분리한다.
  - 반복 가능한 ground/path 재료
  - 중앙 도서관 및 광장
  - 여섯 zone gateway landmark
  - 공용 및 zone별 vegetation/props
  - 플레이어보다 앞에 그려질 foreground canopy/arch
  - 선택, 잠금, 완료 등 runtime 상태 효과
- PNG에는 한글 라벨이나 UI 텍스트를 굽지 않는다.
- 모든 에셋은 투명 가장자리, halo, 잘린 그림자, 배경색 잔여물을 검사한다.
- `AssetRegistry.js`에 크기, anchor, source rectangle 또는 개별 경로를 명시적으로 등록한다.
- nearest-neighbor 또는 프로젝트에서 승인된 현재 렌더 방식으로 표시하고, 에셋마다 서로 다른 임의 배율을 사용하지 않는다.
- foreground와 collision은 bitmap 색을 읽어 추론하지 말고 별도 논리 데이터로 관리한다.

## 상태 표현

- 잠김: 낮은 채도, 정적 잠금 배지, 닫힌 느낌의 gate. 활성 portal과 같은 맥동 금지.
- 현재 목적지: 선택한 길의 edge 또는 표지에만 절제된 zone accent를 사용한다.
- 진입 가능: 기존 공통 `EnterCue`의 의미와 접근성을 유지하되 새 아트에 맞게 시각적으로 통합한다.
- 완료: 진행 바 또는 작은 완료 배지로 표현하며 강한 발광을 사용하지 않는다.
- Music-first 상태: Music 경로에만 안내가 나타나되 건물 크기와 장식 예산은 다른 마을과 동일하게 유지한다.
- 모든 마을 해금 후에는 여섯 진입부의 대비와 시각적 보상성을 동등하게 만든다.

## 구현 순서

1. 현재 월드맵의 레이어, 좌표, 카메라, collision, portal 상태를 문서화한다.
2. 기준 이미지에 맞는 120×90 전체 composition guide를 만든다.
3. 바닥, 원형 중앙 광장, 방사형 길, 외곽 순환로를 먼저 구현한다.
4. 도서관과 공용 정원을 구현하고 캐릭터 크기 및 출입구를 검증한다.
5. 여섯 진입부를 한 번에 연결하되 각 zone의 전환과 랜드마크를 독립 레이어로 만든다.
6. 우리 집과 오솔길을 연결한다.
7. 잠금, 선택, hover, 진행률, 완료 상태를 연결한다.
8. foreground, 그림자, 소품 밀도와 seam을 정리한다.
9. 데스크톱과 모바일에서 실제 이동, 진입, 카메라, collision을 검증한다.
10. 기준 이미지와 동일 조건 캡처를 나란히 비교해 색감, 랜드마크 비율, 길 형태, 밀도를 반복 조정한다.

## 시각적 합격 조건

다음 조건을 모두 만족할 때만 완료로 보고한다.

- 처음 3초 안에 중앙 도서관과 여섯 방향의 길 구조가 읽힌다.
- 기준 이미지처럼 중앙에 원형 크림 석재 광장과 도서관이 존재한다.
- 거대한 회색 직사각형 포장 면이 남아 있지 않다.
- 여섯 진입부가 올바른 방향에 있고 실루엣과 재료만으로 서로 구분된다.
- 전환 구간이 사각형 바이옴 패치나 잘라 붙인 콜라주처럼 보이지 않는다.
- 전체는 밝고 따뜻한 공용 정원이지만 Lab과 Urban의 정체성도 사라지지 않는다.
- 캐릭터와 portal marker가 환경 디테일에 묻히지 않는다.
- 동일 재료 tile seam, 반복 무늬, 잘린 그림자, 투명 halo가 눈에 띄지 않는다.
- 320×180 축소와 흑백 상태에서도 길, 플레이어, 도서관, 가까운 portal이 구분된다.
- 장식이 entry hitbox, 주 경로, 터치 UI, 목표 카드를 가리지 않는다.

## 기능적 합격 조건

- 여섯 마을, 도서관, 우리 집에 실제로 진입할 수 있다.
- 모든 portal에 최소 두 방향에서 접근할 수 있다.
- 보이는 길과 collision이 일치한다.
- 카메라 경계에서 빈 영역, 떨림, 잘못된 crop이 없다.
- 데스크톱, 모바일 세로, 모바일 가로에서 HUD와 컨트롤이 겹치지 않는다.
- 기존 annotation, progress, lock, quest, attendance, house-decor 흐름에 회귀가 없다.
- lint, 관련 unit test, production build가 통과한다. 기존 실패가 있다면 이번 변경과의 관련성을 구분해 보고한다.

## 필수 검수 산출물

`_review/world-map-reskin-v1/`에 다음 자료를 저장한다.

- `01-before-desktop.png`
- `02-after-library-desktop.png`
- `03-after-nature-gateway.png`
- `04-after-urban-gateway.png`
- `05-after-music-gateway.png`
- `06-full-map-overview.png`
- `07-mobile-portrait.png`
- `08-mobile-landscape.png`
- `09-grayscale.png`
- `10-reference-vs-runtime.png`
- collision 및 portal 접근 검증 결과
- 사용하거나 새로 만든 에셋 목록과 출처

최종 비교 이미지는 단순히 파일을 생성하는 데 그치지 말고 직접 열어 육안 검수한다. 기준 이미지와 차이가 크면 첫 결과에서 멈추지 말고 수정한다.

## 작업 금지

- 분석 보고서나 Markdown만 작성하고 구현을 끝내지 않는 것
- 기준 이미지와 무관한 새로운 콘셉트로 재해석하는 것
- 기존 마을 맵을 함께 리스킨하는 것
- 관련 없는 사용자 변경을 정리하거나 되돌리는 것
- `git reset --hard`, `git checkout --`, 광범위한 파일 삭제
- emoji, 임시 사각형, 단색 SVG placeholder를 최종 production 아트로 남기는 것
- UI, player, marker, Korean text를 환경 이미지에 굽는 것
- collision 검증 없이 예쁘게 보이는 스크린샷만 제출하는 것
- 임의로 portal 위치나 연구 진행 로직을 바꾸는 것

## 완료 보고 형식

최종 답변에는 다음만 명확히 정리한다.

1. 실제로 변경한 월드맵 요소
2. 새로 만든 주요 에셋과 경로
3. 보존한 gameplay 계약
4. 실행한 테스트와 결과
5. 기준 이미지 대비 남아 있는 차이 또는 제한
6. 가장 대표적인 runtime 검수 이미지 링크

안전한 범위 안에서 필요한 판단은 스스로 내리고, 구현과 검증을 끝까지 진행하라. 사용자에게 중간 선택을 요구해야만 하는 중대한 디자인 분기가 없다면 질문만 하고 멈추지 마라.

---

