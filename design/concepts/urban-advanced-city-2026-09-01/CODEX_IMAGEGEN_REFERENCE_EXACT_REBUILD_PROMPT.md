# Codex 마스터 프롬프트 — Urban 확정 시안 1:1 에셋 재구축

현재 워킹 트리에서 SoundMimic Village Urban 존을 다시 재구축하세요.

이번 작업의 목표는 “확정 시안과 비슷한 분위기의 도시”가 아닙니다. 아래 확정 시안에 보이는 지도 미술을 실제 게임 월드로 최대한 1:1 이전하고, 시안에 보이는 모든 건축물·교통수단·랜드마크·가로시설을 개별 ImageGen 래스터 에셋으로 만들어 실제 제품 Urban 렌더러가 사용하도록 하는 것입니다.

유일한 포지티브 시각 기준:

- design/concepts/urban-advanced-city-2026-09-01/02-midnight-metro-media-core.png

현재 ImageGen v2 결과와 이전 완료 보고는 시각적 완료 증거가 아닙니다. 현재 비교 이미지에서 다음 문제가 이미 확인되었습니다.

- 외곽 고층 건물과 북측 스카이라인의 밀도가 크게 줄어 있음
- 주요 건물이 시안보다 작고 서로 멀리 떨어져 있어 넓은 빈 주차장처럼 보임
- 중앙 보행축, 도로 굴곡, 광장과 횡단보도 비율이 시안과 다름
- 서측 미디어 광장, 동측 푸드코트, 남동 극장과 버스 베이의 밀도와 세부 배치가 다름
- 가로수, 조명, 플랜터, 키오스크, 차량, 작은 설비가 상당수 생략됨
- 개별 에셋을 시안에서 직접 복원하기보다 큰 패밀리 이미지에서 잘라 확대하여 실루엣과 스케일이 달라짐

따라서 public/assets/urban-city-v2/와 IMAGEGEN_REBUILD_HANDOFF.md의 “완료” 판단을 그대로 이어받지 마세요. 현재 파일은 기능 참고와 롤백 자료일 뿐이며, 시각 품질은 확정 시안과 새로 비교해 판정합니다.

안전한 로컬 수정, ImageGen 생성, 코드 연결, 테스트, 브라우저 검증은 중간 승인을 기다리지 말고 완료 조건을 모두 충족할 때까지 계속하세요. 커밋과 push는 하지 않습니다.

## 1. 성공 조건

다음 조건을 모두 만족해야 완료입니다.

1. HUD와 게임 오버레이를 제외한 art-only 맵을 확정 시안과 같은 크기로 겹쳐 보았을 때 같은 지도라고 즉시 인식됩니다.
2. 주요 건물·전철·역·계단·도로·횡단보도·광장·랜드마크의 위치와 크기가 시안과 사실상 일치합니다.
3. 시안에 보이는 환경 오브젝트가 inventory에 빠짐없이 기록되고, 모든 visible 오브젝트가 ImageGen 기반 PNG 또는 시안에서 보존 추출한 PNG로 렌더됩니다.
4. 현재 v2처럼 큰 빈 공간, 축소된 건물, 단순 주차장, 임의 재배치가 남지 않습니다.
5. 전체 시안 PNG 한 장을 제품 배경으로 붙이는 편법 없이 ground, buildings, metro, vehicles, props, shadow, foreground, emissive 레이어가 분리되어 있습니다.
6. 플레이어가 건물 캐노피, 나무 수관, 전철 플랫폼 전경 뒤로 자연스럽게 들어갑니다.
7. 그림의 바닥 footprint와 실제 collision이 일치하고, 모든 필요한 통로가 열려 있습니다.
8. A/B 각각 83개, 6블록, 수집·annotation·잠금·퇴장·모바일 조작 기능이 유지됩니다.
9. 시각 비교용 overlay, blink, diff heatmap과 수치 검증이 모두 통과합니다.
10. ImageGen이 불가능하거나 시각 게이트를 통과하지 못하면 완료라고 보고하지 않고 정확한 blocker와 남은 asset id를 남깁니다.

## 2. 작업 범위와 보존 규칙

작업 전 처음부터 끝까지 읽으세요.

- AGENTS.md
- PROJECT_SUMMARY.md
- design/concepts/urban-advanced-city-2026-09-01/README.md
- design/concepts/urban-advanced-city-2026-09-01/PROMPTS.md
- design/concepts/urban-advanced-city-2026-09-01/CODEX_IMAGEGEN_ASSET_REBUILD_PROMPT.md
- design/concepts/urban-advanced-city-2026-09-01/CODEX_IMAGEGEN_REBUILD_FINALIZATION_PROMPT.md
- design/concepts/urban-advanced-city-2026-09-01/IMAGEGEN_REBUILD_HANDOFF.md
- public/assets/urban-city-v2/asset-plan.md
- public/assets/urban-city-v2/layout.json
- public/assets/urban-city-v2/manifest.json
- lib/urbanAssetArt.js
- lib/urbanVillage.js
- lib/urbanVillageConfig.mjs
- components/UrbanZoneMap.js
- components/UrbanArtPreview.js
- app/urban-test/page.js
- app/urban-art-preview/page.js
- scripts/test_urban_production.mjs

현재 Next.js 버전의 관련 문서를 node_modules/next/dist/docs/에서 읽은 뒤 코드를 수정하세요.

다음 범위는 절대 훼손하지 않습니다.

- Music, Nature, Lab, Animal, Human, House 및 다른 존
- 다른 기능 감사·보안·연구 관련 미커밋 변경
- 사용자 소유의 기존 미커밋 파일

기존 public/assets/urban-city-v2/는 덮어쓰거나 삭제하지 마세요. 새 작업은 아래에 비파괴적으로 만듭니다.

- public/assets/urban-city-v3/
- _review/urban-advanced-city/imagegen-reference-exact-v3/

v3가 모든 시각·기능 게이트를 통과하기 전까지 제품 로더를 v3로 전환하지 않습니다. 전환 뒤에도 v2는 롤백 자료로 보존합니다.

## 3. 필수 도구 규칙

### ImageGen

반드시 $imagegen 스킬을 읽고 기본 built-in ImageGen 모드만 사용하세요.

- CLI/API fallback으로 임의 전환하지 않습니다.
- 서로 다른 에셋은 각각 별도 ImageGen 호출을 사용합니다.
- 로컬 입력 이미지는 먼저 view_image로 원본 해상도에서 엽니다.
- 생성 결과도 매번 view_image 원본 해상도로 검사합니다.
- 프로젝트에서 채택하는 결과는 public/assets/urban-city-v3/로 복사합니다.
- 기존 결과를 바로 덮어쓰지 않고 후보 버전을 저장한 뒤 비교합니다.
- 투명 스프라이트는 실제 alpha가 있는 transparent PNG여야 합니다.
- ImageGen 실패 시 Canvas, SVG, CSS, 폴리곤 임시 미술로 대체하지 않습니다.

### 브라우저

browser:control-in-app-browser 스킬을 읽고 Gate 4 이후의 시각·게임 검수에 in-app browser를 사용하세요.

### 기계적 이미지 처리

다음 작업은 허용됩니다.

- 정확한 crop
- mask 작성
- 원본에서 변경하지 않을 픽셀의 기계적 보존 합성
- alpha matte 정리
- 투명 여백 제거
- 무손실 PNG 저장
- nearest-neighbor 정수 확대·축소
- atlas packing
- 비교용 overlay, blink, difference heatmap 생성

다음 작업은 금지됩니다.

- 프로그램으로 건물이나 소품을 새로 그리기
- 도형·선·그라디언트로 누락된 미술을 채우기
- 에셋의 가로·세로를 서로 다른 비율로 늘여 시안 위치에 억지로 맞추기
- 체크무늬를 투명 배경인 것처럼 런타임에 사용하기
- 확정 시안 전체를 제품의 단일 background 이미지로 사용하기

## 4. 가장 중요한 제작 원칙

### 새로 해석하지 말고 시안 픽셀을 보존

시안에 이미 보이는 물체를 텍스트만으로 새로 생성하지 마세요.

우선순위는 다음과 같습니다.

1. 확정 시안에서 보이는 원래 픽셀과 실루엣을 그대로 보존
2. 해당 오브젝트의 타이트한 reference crop을 입력으로 사용해 배경만 제거
3. UI, 마커, 플레이어 또는 다른 물체에 가려진 부분만 ImageGen으로 최소 복원
4. 복원 결과에서 변경이 필요하지 않은 원본 픽셀은 기계적으로 다시 합성하여 원본과 동일하게 유지
5. 시안에 존재하지 않는 새 디자인을 창작하지 않음

ImageGen edit는 한 번에 한 가지 변경만 요청합니다. 반복 edit가 보존 대상까지 바꾸면 채택하지 않습니다.

### 입력 이미지의 역할을 매번 명시

각 호출에서 가능한 입력 역할:

- Image 1: finalized full-map positive composition and style reference
- Image 2: exact tight crop of the target object from Image 1; primary shape, pixels, material and color reference
- Image 3: approved neighboring context crop; scale and lighting reference only
- Edit target: the latest accepted target sprite or restoration patch

현재 v2 runtime 화면은 ImageGen의 포지티브 입력으로 사용하지 않습니다. 비교가 필요하면 negative diagnostic reference only라고 명시하고 복제 금지 요소를 적습니다.

## 5. Phase A — 시안 좌표계와 완전한 오브젝트 inventory

에셋을 생성하기 전에 시안을 원본 해상도로 분석하고 아래 파일을 먼저 작성하세요.

- public/assets/urban-city-v3/reference/reference-analysis-overlay.png
- public/assets/urban-city-v3/reference/non-world-overlay-mask.png
- public/assets/urban-city-v3/reference/evaluable-art-mask.png
- public/assets/urban-city-v3/inventory.json
- public/assets/urban-city-v3/layout.json
- public/assets/urban-city-v3/manifest.json
- public/assets/urban-city-v3/asset-plan.md

### 5.1 시안 영역 분리

시안에서 다음은 월드 아트가 아니라 게임 오버레이입니다.

- 상단 HUD
- 좌하단 D-pad
- 하단 입구 버튼
- 플레이어 캐릭터
- 6개의 대표 사운드 오브

각 영역을 non-world-overlay-mask.png에 정확히 기록하세요. 그 밖의 픽셀은 모두 월드 미술 후보입니다.

상단 HUD 때문에 가려진 북측 월드와 플레이어·마커·버튼 아래에 가려진 부분은 “보이지 않는 원본”으로 표시하고, 나중에 최소 범위 ImageGen 복원 대상으로 관리합니다. 보이지 않는 부분을 임의로 기존 v2에서 복사하지 않습니다.

### 5.2 instance 단위 inventory

inventory.json은 카테고리 이름만 나열하지 않습니다. 시안에서 식별되는 모든 instance에 고유 id를 부여합니다.

각 entry에 최소한 다음을 기록하세요.

- id
- category
- referenceBounds: 시안 원본 픽셀 좌표
- worldBounds: v3 월드 픽셀 좌표
- sourceCrop
- visiblePixelMask
- occludedBy
- layer: ground, shadow, static, y-sort, foreground, emissive
- anchorX, anchorY
- collision footprint
- foreground/occlusion region
- extraction 또는 restoration 필요 여부
- source 파일, prompt 파일, candidate 파일, accepted runtime 파일
- review status와 rejection 이유

reference-analysis-overlay.png에는 모든 id와 bounding box가 보이게 번호를 붙입니다. 이 overlay를 직접 눈으로 검토하여 누락된 물체가 없을 때만 다음 단계로 갑니다.

### 5.3 최소 inventory

아래 목록은 최소 범위입니다. 시안에서 더 발견되면 반드시 추가합니다.

#### Ground와 도로

- 전체 암청색 도로 바탕
- 중앙 남북 보행축
- 중앙 동서 보행 연결부
- 서측과 동측의 곡선 도로
- 북측 역 전면 포장
- 남측 입구 포장과 양측 rail
- 각 건물의 보도·기단 주변 포장
- 버스 베이와 차량 정차선
- 모든 횡단보도
- 차선, 정지선, 방향 화살표
- 연석, 배수구, 맨홀, 점검구
- 젖은 도로의 제한된 시안 반사

#### 북측 메트로

- 서측 고가 레일 deck
- 중앙 역 deck와 유리 캐노피
- 동측 고가 레일 deck
- 모든 지지 기둥과 하부 그림자
- 플랫폼 전면 난간과 시안 안전선
- 중앙의 넓은 계단
- 역 출입구와 문
- 전동차 선두 차량
- 전동차 중간 차량 3량
- 전동차 후미 차량
- 차량 연결부, 문, 창문, 조명
- 플레이어를 덮어야 하는 metro front lip

#### 건축물

- 북서 helipad 고층 타워
- 북서 타워와 이어지는 서측 외곽 파사드
- 메트로 뒤편 서측 스카이라인 모듈 전부
- 메트로 뒤편 중앙 미디어 스크린 건물
- 메트로 뒤편 동측 스카이라인 모듈 전부
- 북동 곡면 유리 타워
- 북동 타워와 이어지는 동측 외곽 파사드
- 서중앙 위성 안테나 미디어 오피스
- 동중앙 내부 테이블이 보이는 유리 푸드코트
- 푸드코트 동측의 낮은 부속 건물
- 남서 문화·업무 복합 건물
- 남동 곡면 극장·미디어홀
- 지도 좌우 가장자리에서 보이는 모든 부분 파사드
- 각 건물의 옥상 HVAC, 덕트, 태양광 패널, 위성 접시, 안테나
- 각 건물의 입구, 캐노피, 창문, 미디어 패널, 화단

#### 랜드마크와 미디어 장치

- 서측 광장 홀로그램 orb와 기단
- 중앙 시안 빛기둥/분수와 기단
- 위성 접시
- 모든 독립 미디어 스크린
- 모든 키오스크와 세로형 디지털 안내판
- 극장 전면의 필름 릴 심볼과 포스터 패널

#### 차량과 이동 설비

- 북측 5량 전동차
- 서측 도로의 승용차
- 북동 곡선 도로의 승용차
- 남서 건물 앞 차량
- 동측 버스 베이의 긴 전기버스 2대
- 남동 야외 좌석 옆 청색·주황 셔틀/버스
- 시안에서 추가로 보이는 모든 차량
- e-스쿠터 또는 자전거 도크
- 충전기와 작은 교통 제어함

#### 가로시설과 식재

- 시안에서 보이는 모든 가로수 instance
- 모든 사각·원형 플랜터와 낮은 관목
- 모든 가로등
- 모든 볼라드와 난간
- 모든 벤치
- 모든 신호함·분전함·점검함
- 모든 버스 정류장 시설
- 모든 야외 테이블과 의자
- 모든 화단과 작은 경계석
- 남측 전경 수목과 rail

동일 에셋을 재사용할 수는 있지만, inventory에는 모든 placement instance가 있어야 합니다. 시안에서 실루엣이나 방향이 다른 물체는 별도 sprite variant를 만듭니다.

## 6. Phase B — canonical clean map 복원

시안의 비월드 오버레이를 제거한 검수용 canonical map을 만드세요.

출력:

- public/assets/urban-city-v3/reference/canonical-map-art-source.png
- public/assets/urban-city-v3/reference/canonical-map-art-runtime.png
- public/assets/urban-city-v3/reference/restoration-log.json

규칙:

1. HUD, D-pad, 입구 버튼, 플레이어, 각 사운드 오브를 한꺼번에 지우지 않습니다.
2. 서로 떨어진 영역은 각각 별도 ImageGen edit 호출로 복원합니다.
3. 각 호출은 “이 mask 내부만 복원하고 나머지 픽셀·구도·건물·도로·조명은 바꾸지 말라”고 명시합니다.
4. ImageGen 출력 전체를 그대로 채택하지 않습니다. 요청한 mask 내부 패치만 원본에 기계적으로 합성합니다.
5. mask 밖 픽셀은 원본과 pixel-identical이어야 합니다.
6. 복원 패치는 주변 도로, 보도, rail, 수목, 건물 구조가 자연스럽게 이어져야 합니다.
7. restoration-log.json에 각 mask, prompt, 결과, 채택 범위와 검수 결과를 기록합니다.

canonical map은 좌표·비교·추출 기준입니다. 제품에서 단일 배경으로 사용하지 않습니다.

원본 시안의 실제 map art 영역과 HUD가 차지한 영역을 측정한 뒤, 종횡비를 임의로 찌그러뜨리지 않는 하나의 좌표 변환을 정합니다. 현재 48×36, TILE=32가 시안과 맞지 않으면 잘못된 v2 구성을 보존하지 말고 월드 크기·타일 그리드·카메라를 조정할 수 있습니다. 단, 플레이와 6블록 접근성은 새 좌표계에 맞춰 다시 증명해야 합니다.

## 7. Phase C — ground-only plate

canonical map에서 건물·전철·차량·나무·소품·그림자·발광을 제거한 ground-only plate를 만드세요.

출력:

- public/assets/urban-city-v3/ground/ground-only-source.png
- public/assets/urban-city-v3/ground/ground-only-runtime.png
- public/assets/urban-city-v3/ground/removal-mask.png
- public/assets/urban-city-v3/prompts/ground-restoration.md

한 번에 전체 물체를 지우지 말고 공간 구역별로 복원합니다.

- north metro
- northwest
- northeast
- west media plaza
- east food court
- southwest culture
- southeast cinema/transit
- central spine
- south entrance

각 구역도 원본에서 보이는 ground 픽셀을 보존하고, 물체 아래 가려졌던 표면만 복원합니다. 복원된 도로선과 포장 패턴은 물체를 다시 올렸을 때 밖으로 삐져나오지 않아야 합니다.

## 8. Phase D — 모든 오브젝트의 개별 에셋 제작

### 8.1 생성 방식

시안에 보이는 각 오브젝트는 다음 순서로 만듭니다.

1. canonical map에서 target object의 타이트한 crop과 visible-pixel mask를 만듭니다.
2. crop을 view_image로 원본 해상도에서 확인합니다.
3. built-in ImageGen edit로 target만 남기고 실제 transparent background를 요청합니다.
4. 필요한 경우 가려진 뒤쪽·아래쪽 실루엣만 별도 single-change edit로 복원합니다.
5. 원본에서 이미 보이던 픽셀은 accepted output 위에 기계적으로 다시 합성하여 보존합니다.
6. alpha edge, halo, checker residue, 잘림을 원본 해상도에서 검사합니다.
7. shadow, emissive, foreground가 분리되어야 하는 오브젝트는 별도 PNG로 나눕니다.
8. 해당 오브젝트를 정확한 worldBounds에 배치한 isolated overlay를 만들어 canonical map과 겹쳐 봅니다.
9. 위치·크기·실루엣이 맞을 때만 manifest status를 accepted로 바꿉니다.

### 8.2 금지된 패밀리 시트 방식

서로 다른 건물 여러 개를 새 한 장에 다시 그려 놓고 임의 crop하는 방식은 사용하지 않습니다. 현재 v2의 north-skyline, district-buildings, streetscape처럼 큰 패밀리 plate를 축소·확대해 쓰는 방식이 시안 불일치의 주요 원인입니다.

허용되는 sprite sheet는 다음 조건을 모두 만족할 때뿐입니다.

- 이미 승인된 개별 sprite를 기계적으로 pack한 atlas
- 각 sprite의 원본 크기와 alpha가 유지됨
- sprite 사이 여백과 manifest crop이 자동 검증됨
- atlas 자체를 ImageGen으로 한 번에 생성하지 않음

### 8.3 각 에셋에 필요한 파일

각 주요 오브젝트 id마다 가능한 범위에서 아래 파일을 유지합니다.

- sources/<id>-reference-crop.png
- masks/<id>-visible-mask.png
- candidates/<id>-candidate-vN.png
- accepted/<category>/<id>.png
- prompts/<id>.md

각 prompt 파일에는 입력 이미지의 역할, 변경 대상, 보존 대상, 출력 형태, reject 조건을 기록합니다.

## 9. ImageGen 호출용 기본 프롬프트

아래 구조를 각 에셋에 맞게 구체화하세요. 그대로 모든 물체에 복사하지 말고 target의 정확한 실루엣·재질·방향·reference bounds를 추가합니다.

---

Use case: background-extraction 또는 precise-object-edit

Asset type: production-ready 2D game sprite for the SoundMimic Village Urban zone

Input images:
- Image 1 is the finalized full Urban map and the sole positive composition/style reference.
- Image 2 is the exact crop of TARGET_ID from Image 1 and is the primary geometry, pixel, color, material, lighting and scale reference.
- Image 3, if present, is surrounding context for placement and lighting only.

Primary request:
Isolate and reconstruct only TARGET_ID as a standalone sprite. Preserve the visible pixels, silhouette, proportions, orientation, roof/panel/window details, color placement and lighting from Image 2. Restore only the small portions hidden by neighboring objects or game overlays.

Style and camera:
Orthographic top-down 2D pixel art matching Image 1 exactly. Match its camera angle, pixel density, crisp edge thickness, cool navy/indigo/blue-gray materials, cyan glass and restrained violet/warm light.

Output:
One complete uncropped object on a genuinely transparent background with preserved alpha. Keep natural transparent padding. Preserve the specified anchor and footprint.

Must preserve:
- visible source pixels and distinctive silhouette
- exact facing direction and aspect ratio
- object-specific windows, doors, panels, roof equipment and emissive accents
- the lighting direction and pixel-cluster texture from Image 2

Change only:
- remove surrounding map/background pixels
- reconstruct only the object portions hidden in the source

Avoid:
- redesigning or simplifying the object
- changing camera angle or perspective
- isometric, 3D, vector or smooth painting
- blur, soft antialiasing, glow halo or painted checkerboard
- extra objects, people, sound markers, UI, text, logos, watermark
- baked ground outside the object’s own shadow
- cropping any edge

Reject the result if it does not align with Image 2 when placed back at the recorded coordinates.

---

복원 패치 프롬프트에는 위 구조와 별도로 “mask 밖은 절대 변경하지 않음”을 반복합니다.

## 10. Phase E — 정확한 배치와 렌더러

manifest와 layout을 단일 진실 공급원으로 사용하세요.

각 runtime asset entry에 포함할 필드:

- id, file, sourceCrop, referenceBounds, worldBounds
- nativePixels와 runtimePixels
- anchorX, anchorY
- zLayer와 ySort
- collisionRects
- foregroundRects
- shadowFile, emissiveFile, foregroundFile
- promptFile, sourceReferenceFile
- generation mode와 accepted candidate
- alpha role
- review status

렌더 순서:

1. ground-only
2. ground decals와 road markings
3. static shadows
4. building/metro bases
5. y-sort 가능한 차량·수목·가로시설·랜드마크
6. sound marker와 player
7. building canopy·tree crown·platform lip·south rail foreground
8. emissive와 제한된 atmospheric overlay
9. HUD

필수 규칙:

- imageSmoothingEnabled=false
- 정수 좌표와 일관된 uniform scale
- 비균일 stretch 금지
- referenceBounds에서 계산한 위치를 임의 미관 조정으로 옮기지 않음
- current v2 crop 상수를 새 에셋에 억지로 재사용하지 않음
- 제품 Urban 경로에서 old v2 또는 visible polygon art가 호출되지 않음
- concept PNG 자체가 runtime URL에 들어가지 않음

시안의 형태를 맞추기 위해 필요하면 BUILDINGS, PROPS, ROAD_LANES, CROSSWALKS, METRO, collision, block regions, safe slots와 카메라 설정을 다시 작성하세요. 기존 테스트를 통과시키기 위해 잘못된 위치를 유지하지 않습니다. 새 배치에 맞춰 테스트를 갱신하고 기능 불변 조건을 다시 증명합니다.

## 11. Phase F — 시각 정합성 자동 검증

시각 검증 스크립트를 추가하세요.

권장 파일:

- scripts/test_urban_reference_exact.mjs
- scripts/render_urban_reference_comparison.mjs 또는 동등한 기존 도구

생성할 리뷰 이미지:

- _review/urban-advanced-city/imagegen-reference-exact-v3/reference-clean.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/art-only-runtime.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/reference-vs-runtime.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/reference-runtime-overlay-50.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/reference-runtime-blink.gif
- _review/urban-advanced-city/imagegen-reference-exact-v3/reference-runtime-diff-heatmap.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/inventory-overlay.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/contact-sheet-buildings.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/contact-sheet-metro-vehicles.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/contact-sheet-props.png
- _review/urban-advanced-city/imagegen-reference-exact-v3/contact-sheet-overlays.png

### 정량 게이트

시안의 비월드 오버레이와 ImageGen으로 복원한 보이지 않는 영역은 evaluable mask에서 제외하거나 별도로 표시합니다.

나머지 비교 가능한 영역에서 다음을 검사하세요.

- 주요 건물·역·계단·orb·분수·버스 베이 bounding box 위치 오차: reference 표시 크기 기준 각 축 4px 이하
- 주요 오브젝트 폭·높이 오차: 2% 이하
- 주요 오브젝트 silhouette IoU: 0.90 이상
- 기준 좌표로 역변환한 뒤 evaluable 영역 구조 유사도: SSIM 0.92 이상을 목표로 함
- 비균일 scale을 사용한 sprite: 0개
- manifest에 없는 visible placement: 0개
- inventory status가 accepted가 아닌 runtime object: 0개
- checker residue, 흰 halo, crop 잘림, alpha 오염: 0개

SSIM을 계산할 기존 도구가 없다면 새 대형 의존성을 추가하지 말고, 사용 가능한 ImageMagick 또는 작은 무의존/기존 의존 스크립트로 masked RMSE와 edge overlap을 함께 기록하세요. 수치 하나가 실제 육안 품질을 대신하지 않습니다.

정량 게이트가 실패하면 전체를 다시 생성하지 말고 차이를 가장 크게 만드는 asset id부터 하나씩 수정합니다.

### 육안 게이트

50% overlay와 blink를 원본 해상도로 직접 보고 다음을 판정합니다.

- 외곽 건물 윤곽이 깜박일 때 흔들리지 않음
- 전철 5량, 역과 계단이 같은 위치·크기
- 중앙 광장 폭과 도로 곡선이 같은 위치
- 네 주요 구역 건물이 같은 footprint와 밀도
- 모든 큰 랜드마크와 차량이 같은 위치
- 소품 밀도가 시안보다 눈에 띄게 비지 않음
- HUD를 제외하면 전체 장면의 무게 중심과 여백이 동일

“같은 테마” 또는 “같은 장소로 보임”만으로 통과시키지 않습니다. 위치·크기·밀도 차이가 분명하면 실패입니다.

## 12. Phase G — art-only 및 게임 브라우저 검증

### Gate 1 — asset

- 모든 accepted PNG 원본 해상도 확인
- alpha, halo, checker, crop 확인
- 카테고리별 contact sheet 확인
- manifest/runtime URL/dimensions 검증

### Gate 2 — art-only

/urban-art-preview가 v3 에셋만 사용하도록 하세요.

- HUD, player, marker, lock fog, D-pad, entrance cue 없음
- 전체 월드를 한 화면에 표시
- reference와 동일한 art crop과 표시 크기로 비교
- console error/warn, hydration error, asset error 0

Gate 2는 정량·육안 비교가 모두 통과해야 합니다. 여기서 실패하면 게임 검증으로 넘어가지 않습니다.

### Gate 3 — /urban-test

반드시 실제 입력으로 확인합니다.

- Group A와 B
- block 1, 4, 6
- entrance, midcity, metro
- 1440×844
- 1920×1080
- 390×844
- 건물, metro support, 차량, 버스, 나무, 플랜터, 가로등 충돌
- 중앙 계단과 횡단보도 통과
- 잠긴 block 차단과 해금 후 통과
- 나무 수관, 건물 캐노피, metro lip, 남측 rail y-sort
- 카메라 clamp와 DPR
- 모바일 D-pad
- marker active, nearby, interacting, completed, unavailable

### Gate 4 — 실제 제품

실제 /에서 ALLAUDIO_A와 ALLAUDIO_B 각각:

1. 로그인
2. WorldMap
3. Urban 포털 이동
4. v3 renderer 진입
5. 83 items와 block 확인
6. 최소 3종 collision 확인
7. 서로 다른 active sound 접근
8. Enter
9. AnnotationPanel 열림
10. 제출하지 않고 닫기
11. 완료 수가 잘못 증가하지 않음
12. 같은 item 즉시 재호출 없음
13. ESC 또는 남쪽 입구로 WorldMap 복귀

Supabase 연구 데이터 관례가 확실하지 않으면 제출·건너뛰기를 실행하지 않습니다.

## 13. 보존할 기능 불변 조건

- A/B 각각 83개
- 블록별 15/15/15/15/15/8
- sound_id, group, block, AnnotationPanel 계약 유지
- 결정론적 배치와 좌표 중복 없음
- 각 해금 단계에서 모든 active item까지 BFS 접근 가능
- spawn과 exit가 collision 또는 item과 겹치지 않음
- 잠긴 영역 진입 차단
- 보도·광장·횡단보도·중앙 계단·남쪽 입구 이동 가능
- WASD/방향키와 짧은 key tap
- 모바일 D-pad
- annotation 중 입력 잠금
- ESC/남쪽 출구
- marker 시각 크기와 28×28 상호작용 판정의 분리

시안에 그려진 6개 사운드 오브는 월드 아트가 아니라 개념적 게임 오버레이입니다. runtime의 실제 83개 marker를 시안 이미지에 굽지 않습니다.

## 14. 테스트와 build

최종 수정 뒤 실행:

- npm run test:urban-production
- 새 reference exact 시각 검증 테스트
- Urban 변경 파일 targeted ESLint
- npm run build
- 필요 시 npm run lint

Urban 테스트가 추가로 증명할 것:

- v3 manifest의 모든 runtime PNG 존재
- PNG dimensions와 alpha 역할 일치
- source crop과 destination bounds 유효
- 모든 inventory placement가 manifest에 연결됨
- concept PNG와 v2 파일이 제품 v3 loader에 없음
- old polygon renderer가 제품 Urban 경로에서 호출되지 않음
- y-sort와 foreground layer가 누락되지 않음
- visual comparison metric과 anchor tolerance 통과

전체 lint의 Urban 외 기존 오류는 수정하지 말고 분리 보고합니다.

## 15. 핸드오프와 체크포인트

새 문서:

- design/concepts/urban-advanced-city-2026-09-01/IMAGEGEN_REFERENCE_EXACT_V3_HANDOFF.md

포함할 내용:

- 이전 v2가 시안과 달랐던 구체적 원인
- reference coordinate transform
- overlay 제거와 canonical 복원 이력
- 전체 inventory 개수와 카테고리별 accepted/rejected 수
- 모든 ImageGen prompt/source/candidate/runtime 경로
- ground 복원 방식
- object extraction과 hidden-region restoration 방식
- manifest, anchor, collision, y-sort, foreground 규칙
- visual metric 결과와 육안 판정
- Gate 1/2/3/4 결과
- A/B 실제 제품 흐름
- 테스트, lint, build
- Supabase 제출 여부
- 남은 제한

ImageGen 한도, 도구 오류, 필수 입력 누락 또는 시각 게이트 실패로 중단되면 핸드오프의 체크포인트에 다음을 정확히 적습니다.

- 마지막으로 통과한 phase와 gate
- accepted asset id 목록
- rejected 또는 미생성 asset id 목록
- 마지막 ImageGen prompt와 결과 경로
- 실패 이유
- 다음 실행이 시작할 정확한 파일과 명령

ImageGen이 막혔는데 임시 미술로 대체하거나, 정량·육안 Gate 2가 실패했는데 “완료”라고 쓰지 않습니다.

## 16. 최종 응답 형식

완료 시 다음만 간결하게 보고하세요.

1. 시안 1:1 재구축 결과와 이전 v2 대비 핵심 개선
2. 생성·추출한 전체 asset 수와 카테고리
3. v3 manifest와 renderer 전환
4. visual metric, overlay/blink 육안 결과
5. A/B 83개·6블록·collision·접근성·y-sort
6. 실제 루트 A/B 결과
7. 테스트·targeted lint·build
8. review 이미지와 handoff 경로
9. 남은 제한 또는 blocker

커밋과 push는 하지 마세요.
