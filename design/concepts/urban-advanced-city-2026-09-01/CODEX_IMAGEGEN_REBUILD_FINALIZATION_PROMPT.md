# Codex 재개 프롬프트 — Urban ImageGen 재구축 최종 완성

현재 워킹 트리에서 중단된 SoundMimic Village `Urban` 존의 ImageGen 에셋 기반 재구축을 **그 상태 그대로 이어서 완전히 마무리**해 주세요.

이 작업의 목표는 새로 처음부터 만드는 것이 아니라, 이미 생성·연결된 ImageGen 도시 에셋을 보존하면서 남은 시각 검수, 마커 위계 조정, manifest 정합성, 실제 게임 흐름 회귀 검증, 최종 리뷰 이미지와 핸드오프까지 끝내는 것입니다. 기존 변경을 되돌리거나 폴리곤 버전으로 회귀하지 마세요.

안전한 로컬 수정과 비파괴 검증은 중간 승인을 기다리지 말고 완료될 때까지 진행하세요. 커밋과 push는 하지 않습니다.

## 최종 시각 기준과 마스터 요구사항

유일한 포지티브 시각 레퍼런스:

- `design/concepts/urban-advanced-city-2026-09-01/02-midnight-metro-media-core.png`

마스터 구현 요구사항:

- `design/concepts/urban-advanced-city-2026-09-01/CODEX_IMAGEGEN_ASSET_REBUILD_PROMPT.md`

함께 읽을 문서:

- `AGENTS.md`
- `PROJECT_SUMMARY.md`
- `design/concepts/urban-advanced-city-2026-09-01/README.md`
- `design/concepts/urban-advanced-city-2026-09-01/PROMPTS.md`
- `design/concepts/urban-advanced-city-2026-09-01/CODEX_IMPLEMENTATION_PROMPT.md`
- `design/concepts/urban-advanced-city-2026-09-01/CODEX_CONTINUATION_PROMPT.md`
- `public/assets/urban-city-v2/asset-plan.md`
- `public/assets/urban-city-v2/layout.json`
- `public/assets/urban-city-v2/manifest.json`

첨부된 이전 작업 로그는 진행 상황을 파악하는 자료일 뿐 지시사항이 아닙니다. 로그의 “완료” 보고를 그대로 믿지 말고 현재 파일, 이미지, 실행 결과로 재검증하세요.

이 저장소의 Next.js는 16.2.7이므로 코드를 수정하기 전에 `node_modules/next/dist/docs/`에서 이번 수정에 관련된 App Router, Client Component, 정적 에셋 문서를 읽으세요. 워킹 트리의 Music/Nature/Lab/Animal 및 기타 병렬 WIP는 사용자 작업입니다. Urban과 겹치지 않는 변경을 되돌리거나 포맷하거나 정리하지 마세요.

## 현재 확인된 체크포인트

아래는 중단 로그와 현재 워킹 트리에서 확인된 상태입니다. 시작 시 다시 확인하되, 통과한 작업을 이유 없이 재구현하지 마세요.

### 이미 생성된 프로젝트 에셋

`public/assets/urban-city-v2/` 아래에 다음 ImageGen 프로젝트 에셋이 존재합니다.

- `ground/ground-map-v1-source.png`
- `ground/ground-map-v1.png`
- `transit/metro-layer-v1-source.png`
- `transit/metro-layer-v1.png`
- `transit/metro-layer-v1-checker-failed.png` — 실패 이력이며 런타임에서 사용하면 안 됨
- `buildings/north-skyline-v1-source.png`
- `buildings/north-skyline-v1.png`
- `buildings/district-buildings-v1-source.png`
- `buildings/district-buildings-v1.png`
- `transit/vehicles-v1-source.png`
- `transit/vehicles-v1.png`
- `props/streetscape-v1-source.png`
- `props/streetscape-v1.png`
- `props/landmarks-v1-source.png`
- `props/landmarks-v1.png` — 전체 패밀리는 체크 배경 잔상 때문에 런타임 주력 에셋으로 사용하지 않음
- `props/landmark-orb-v1.png`
- `props/landmark-fountain-v1.png`
- `props/antenna-family-v1.png`
- `overlays/shadow-emissive-foreground-v1-source.png`
- `overlays/shadow-emissive-foreground-v1.png`
- `prompts/`의 8개 생성 프롬프트

ground는 불투명 1536×1152 지면 레이어입니다. metro는 ImageGen이 두 번 체크무늬 RGB 배경을 반환해, 새 그림을 그리지 않는 기계적 배경 제거와 실루엣 분리로 RGBA 런타임 PNG가 만들어졌습니다. 랜드마크도 전체 패밀리의 체크 잔상을 제거한 독립 orb/fountain/antenna PNG가 런타임에 사용됩니다. 이 이력은 삭제하거나 성공으로 위장하지 말고 manifest에 정확히 보존하세요.

### 이미 연결된 코드

- `lib/urbanAssetArt.js`
  - ImageGen PNG 로딩
  - ground, 북측 건물, 구역 건물, metro의 정적 `drawImage` 합성
  - 차량·나무·가로등·플랜터·랜드마크의 y-sort
  - metro front lip과 남측 전경 합성
- `components/UrbanZoneMap.js`
  - 제품 렌더 경로가 `drawUrbanAssetStatic`, `drawUrbanAssetYSort`를 사용
  - `data-urban-asset-renderer="imagegen-v2"`
  - 기존 카메라, 이동, 충돌, 수집, HUD, D-pad, annotation, 퇴장 흐름 유지
- `app/urban-art-preview/page.js`
- `app/urban-test/page.js`
- `app/page.js`의 실제 `activeZone === 'Urban'` 분기
- `scripts/test_urban_production.mjs`
- `package.json`의 `test:urban-production`

구형 `lib/urbanVillage.js`의 `drawUrbanStatic`/`drawUrbanForeground` 함수 정의와 `components/ZoneMap.js`의 예전 Urban 코드가 파일에 남아 있을 수 있지만, 현재 제품 Urban 분기에서는 호출되지 않는 것으로 보입니다. 다른 존과 공유되거나 병렬 WIP와 얽힐 수 있으므로 무조건 삭제하지 말고, 제품 Urban 경로가 신형 ImageGen 렌더러만 사용한다는 것을 검색과 테스트로 증명하세요.

### 현재까지 알려진 검증 결과

- `npm run test:urban-production`: 통과
- A/B 각각 83개
- 블록별 `15/15/15/15/15/8`
- 결정론, 고유 좌표, 안전 슬롯, BFS 접근성, 잠금 충돌 통과
- Urban 변경 파일 targeted ESLint: 이전 실행에서 통과
- `npm run build`: 이전 실행에서 샌드박스 밖 재시도 후 통과, 26개 정적 경로 생성
- 기존 리뷰 이미지:
  - `_review/urban-advanced-city/imagegen-rebuild/gate2-art-preview-1440x844.png`
  - `_review/urban-advanced-city/imagegen-rebuild/gate2-metro-block6-1440x844.png`

이전 폴리곤 버전에서 만든 `_review/urban-advanced-city/final-*.png`와 `IMPLEMENTATION_HANDOFF.md`는 신형 ImageGen 렌더러의 최종 증거가 아닙니다. 새 검수 결과로 대체 증명을 만들어야 합니다.

## 중단 직전의 정확한 작업

마지막 변경은 `lib/urbanVillage.js`의 `drawUrbanMarker`에서 83개 마커가 도시 아트를 덮는 문제를 줄이기 위해 일반 마커를 작고 반투명하게 낮추고, `nearby`/`interacting`만 강조하도록 바꾼 것입니다.

이 변경 후 전체 Gate 2/3/4 검수가 끝나지 않았습니다. 따라서 첫 구현 작업은 마커를 다시 설계하는 것이 아니라, 현재 변경을 실제 브라우저에서 재검수하여 아래 조건을 만족하는지 판단하는 것입니다.

- 일반 active 마커는 작고 차분하며 건축과 랜드마크보다 먼저 보이지 않음
- nearby/interacting 마커와 Enter 안내는 즉시 식별됨
- completed 마커는 약해지지만 상태는 구별됨
- unavailable 마커는 잠금 상태로 분명히 읽히고 active처럼 보이지 않음
- block 1에서 열린 15개가 읽기 좋고, block 6에서 83개가 모두 존재해도 도시 아트를 압도하지 않음
- 수집 판정 크기와 실제 접근성은 시각 크기 축소와 무관하게 유지됨

현재 `markerStateFor`가 `unavailable`을 반환할 때 `drawUrbanMarker`가 그 상태를 별도로 처리하는지도 확인하세요. 잠긴 마커가 일반 active와 같은 색·불투명도로 렌더되면 수정하고, 잠금 안개 아래의 아주 약한 비활성 표식 또는 기존 게임 규칙과 일치하는 표현으로 낮추세요. 아이템을 삭제하거나 데이터에서 숨겨 테스트를 속이지 마세요.

## 가장 중요한 원칙: 기존 ImageGen 에셋 보존

현재 에셋을 처음부터 다시 생성하지 마세요. 먼저 각 런타임 PNG와 실제 합성 화면을 원본 해상도로 검사하고, 시점·알파·잘림·픽셀 굵기·색감 또는 합성 결함이 실제로 확인된 에셋만 수정하세요.

추가 이미지 생성이 정말 필요한 경우에만 `$imagegen` 스킬의 기본 built-in 모드를 사용합니다.

- 확정 시안을 `Image 1: positive composition and style reference`로 명시
- distinct asset마다 별도 호출
- 기존 에셋의 특정 결함만 바꾸는 작은 단일 변경 프롬프트 사용
- 투명 스프라이트는 실제 transparent background와 alpha 요구
- 출력은 원본 크기로 `view_image` 검수
- 채택한 프로젝트 에셋을 `$CODEX_HOME`에만 남기지 말고 `public/assets/urban-city-v2/`로 복사
- 기존 파일을 바로 덮어쓰지 말고 `-v2` 후보로 저장해 비교한 뒤 채택
- built-in 도구 실패 시 CLI/API로 임의 전환하지 않음. CLI fallback은 사용자가 명시적으로 승인한 경우에만 사용

ImageGen이 불가능하면 Canvas 사각형, SVG, CSS 도형 또는 폴리곤 임시 미술로 대체하지 마세요. 남은 결함과 필요한 에셋을 체크포인트로 보고해야 합니다.

## 남은 필수 작업 1 — manifest와 에셋 정합성 완성

현재 `manifest.json`은 실제 생성·검수된 파일 중 여러 항목의 `review.status`가 아직 `planned`이며, landmarks 항목도 실제 런타임이 사용하는 독립 PNG들과 정확히 일치하지 않습니다. 실제 상태를 기준으로 수정하세요.

- north skyline, district buildings, vehicles, streetscape, overlay의 실제 크기·alpha·검수 상태 기록
- landmarks를 orb/fountain/antenna 런타임 파일 기준의 개별 manifest entry로 분리하거나 동등하게 정확히 표현
- 사용하지 않는 `landmarks-v1.png`와 checker 실패 파일은 실패/보관 이력으로 명시하고 runtime asset으로 오인되지 않게 함
- 각 런타임 파일의 존재, dimensions, alpha/opaque 역할을 자동 검증
- `lib/urbanAssetArt.js`의 source crop이 이미지 경계 안인지 검증
- 모든 destination rect가 월드 경계 안인지 검증
- 실제 로더 URL과 manifest runtime file이 일치하는지 검증
- 생성 프롬프트와 source 파일 경로, 기계적 변환 이력을 보존

`scripts/test_urban_production.mjs` 또는 Urban 전용 별도 테스트에 위 에셋 검증을 추가하세요. 단순히 파일이 존재하는지만 보지 말고 PNG 헤더/크기와 manifest 정합성을 검사하세요. 새 의존성이 필요 없다면 추가하지 마세요.

## 남은 필수 작업 2 — 진짜 아트 전용 전체 맵 프리뷰

현재 `/urban-art-preview`는 `UrbanZoneMap`에 빈 sounds를 전달할 뿐, HUD·D-pad·플레이어·입구 cue가 남아 있고 카메라가 전체 48×36 맵을 보여주지 않습니다. 마스터 요구사항의 “아트 전용 전체 맵” 기준을 아직 충족하지 않습니다.

Urban 제품 컴포넌트를 위험하게 복제하지 않는 최소 변경으로 다음을 구현하세요.

- `/urban-art-preview`에서 HUD, D-pad, 플레이어, 소리 마커, 잠금 안개, 입구 cue, 모달, QA 컨트롤이 보이지 않음
- 48×36 전체 월드가 4:3 비율로 한 화면에 nearest-neighbor 방식으로 맞춰짐
- ground, static buildings, metro, 모든 y-sort props, landmarks, 필요한 foreground/emissive가 실제 제품과 같은 배치로 모두 합성됨
- 제품 `/urban-test`와 `/` 동작에는 영향 없음
- `data-urban-asset-renderer="imagegen-v2"` 또는 동등한 QA hook으로 준비 완료와 에셋 오류를 확인 가능

필요하면 `UrbanZoneMap`에 명시적인 `artPreview`/`renderMode` prop을 추가하거나, `lib/urbanAssetArt.js`의 동일 draw 함수를 재사용하는 작은 전용 preview component를 만드세요. DOM 순서 선택자나 제품 화면을 CSS로 억지로 잘라내는 방식은 피하세요.

## 남은 필수 작업 3 — 에셋 contact sheet와 확정 시안 비교

프로젝트에 이미 저장된 PNG만 사용해 다음 검수 이미지를 만드세요. 이는 새 미술 생성이 아니라 기계적 배치·합성 산출물입니다.

- `_review/urban-advanced-city/imagegen-rebuild/asset-contact-sheet-buildings.png`
- `_review/urban-advanced-city/imagegen-rebuild/asset-contact-sheet-transit-props.png`
- `_review/urban-advanced-city/imagegen-rebuild/reference-vs-art-preview.png`

contact sheet는 투명 에셋을 체크가 아닌 중립 단색 배경 위에 올리고 파일명/역할이 식별되도록 구성하세요. 원본 에셋을 변형하거나 다시 그리지 마세요.

`reference-vs-art-preview.png`는 왼쪽에 확정 시안, 오른쪽에 HUD 없는 전체 맵 프리뷰를 같은 표시 크기로 배치합니다. 시안 안의 원래 HUD/캐릭터/소리 오브와 실제 art-only 월드를 혼동하지 말고, 구조와 미술만 비교하세요.

비교 시 다음을 직접 판정하세요.

- 북측 고가 메트로, 전동차 5량, 중앙 역·계단의 위치와 비율
- 외곽 고층 유리 건물의 밀도와 야간 창문 리듬
- 중앙 남북 보행축, 횡단보도와 도로 곡선
- 서측 미디어 오피스·홀로그램 orb
- 동측 유리 푸드코트·환승 공간
- 중앙 시안 빛기둥/분수
- 남서 문화 오피스와 남동 곡면 극장·전기버스 베이
- 차량, 가로수, 가로등, 플랜터, 안테나의 배치
- 네이비·인디고·블루그레이·시안 중심 팔레트, 제한된 바이올렛과 따뜻한 창문
- 단색 사각형/격자/폴리곤 느낌이 제품 화면에서 사라졌는지

배치 seam, 소스 crop 잘림, 비정상 stretch, 체크무늬 잔상, 흰 halo, 투명 경계 오염이 보이면 해당 crop/배치/알파만 수정하고 다시 캡처하세요. 확정 시안과 픽셀 단위 동일성은 요구하지 않지만, 같은 장소와 미술 방향으로 즉시 인식되어야 합니다.

## 남은 필수 작업 4 — Gate 2와 Gate 3 브라우저 검수

`browser:control-in-app-browser` 스킬 지침을 읽고 in-app browser를 사용하세요. 기존 서버가 실행 중이면 재사용하고 중복 서버나 `.next` 출력 경합을 만들지 마세요.

### Gate 2 — art preview

- `/urban-art-preview`
- 전체 맵 4:3 art-only 렌더
- 에셋 로딩 오류 0
- 모든 주요 장소가 보임
- console error/warn와 hydration 오류 0

### Gate 3 — `/urban-test`

다음을 각각 확인하세요.

- Group A / Group B
- block 1 / block 4 / block 6
- entrance / midcity / metro
- 1440×844
- 1920×1080
- 390×844 모바일 세로

실제로 이동하여 최소한 다음을 검증하세요.

- 건물 foundation 충돌
- 차량 또는 버스 충돌
- 나무/가로등/플랜터 충돌
- 북측 rail 구조 충돌과 열린 중앙 계단 통과
- 잠긴 블록 진입 차단과 해금 후 통과
- 캐릭터가 나무 수관, metro front lip, 남측 전경과 올바르게 앞뒤로 겹침
- 카메라 clamp와 DPR/픽셀 선명도
- 모바일 D-pad와 좁은 화면 HUD
- 근접 마커 강조, Enter 수집, 완료 상태

최종 스크린샷은 현재 마커 수정 후 다시 만들어 다음 이름으로 저장하세요.

- `_review/urban-advanced-city/imagegen-rebuild/entrance-block1-1440x844.png`
- `_review/urban-advanced-city/imagegen-rebuild/midcity-block4-1440x844.png`
- `_review/urban-advanced-city/imagegen-rebuild/metro-block6-1440x844.png`
- `_review/urban-advanced-city/imagegen-rebuild/desktop-1920x1080.png`
- `_review/urban-advanced-city/imagegen-rebuild/mobile-390x844-block1.png`

QA 컨트롤은 최종 이미지에서 숨기세요. 기존 `gate2-*.png`는 삭제하지 말고 이력으로 보존합니다.

## 남은 필수 작업 5 — Gate 4 실제 루트 게임 흐름

이전 폴리곤 렌더러에서 검증했던 결과를 신형 ImageGen 렌더러 검증으로 재사용하지 마세요. 실제 `/` 제품 경로에서 새로 확인합니다.

`ALLAUDIO_A`, `ALLAUDIO_B` 각각 다음을 검증하세요.

1. 로그인
2. WorldMap 진입
3. Urban 포털까지 이동
4. 실제 `UrbanZoneMap` 진입
5. `data-urban-asset-renderer="imagegen-v2"`, 83개 items, 현재 block 확인
6. 캐릭터 이동과 최소 3종 충돌 확인
7. 활성 소리 아이템 접근과 Enter 수집
8. AnnotationPanel 열림
9. 제출하지 않고 닫았을 때 Urban으로 정상 복귀하고 완료 수가 잘못 증가하지 않음
10. 같은 아이템이 벗어나기 전에 즉시 재호출되지 않음
11. ESC 또는 남쪽 입구를 통한 WorldMap 복귀

Supabase를 오염시킬 수 있는 제출/건너뛰기는 기존 연구용 안전 관례가 확실하지 않으면 실행하지 마세요. 패널 열기·취소까지 검증하고 제한을 보고하면 됩니다.

다음을 새로 저장하세요.

- `_review/urban-advanced-city/imagegen-rebuild/root-worldmap-to-urban.png`
- `_review/urban-advanced-city/imagegen-rebuild/root-annotation-panel.png`

## 자동 검증과 빌드

최종 수정 뒤 반드시 다시 실행하세요.

- `npm run test:urban-production`
- Urban 변경 파일 targeted ESLint:
  - `components/UrbanZoneMap.js`
  - `lib/urbanVillage.js`
  - `lib/urbanVillageConfig.mjs`
  - `lib/urbanAssetArt.js`
  - `app/urban-test/page.js`
  - `app/urban-art-preview/page.js`
  - Urban 관련 신규 테스트/컴포넌트
- `npm run build`
- 필요 시 전체 `npm run lint`

빌드가 Turbopack 로컬 포트 제한으로 샌드박스에서 실패하면, 이전처럼 승인된 환경에서 같은 명령을 재실행하세요. 오류 원인을 코드 실패와 환경 제한으로 구분하세요. 전체 lint의 기존 무관 오류를 고치지 말고 Urban 변경으로 생긴 문제와 분리해 보고하세요.

Urban 테스트가 최종적으로 증명해야 하는 항목:

- A/B 각 83개와 블록별 `15/15/15/15/15/8`
- 결정론, 좌표 중복 없음, 최소 간격, 각 해금 단계 BFS 접근성
- 건물/철도/차량/가로시설 충돌과 열린 통로
- spawn/exit 비중첩
- manifest와 실제 runtime URL 정합성
- 모든 필수 runtime PNG 존재, 올바른 dimensions와 alpha 역할
- 모든 source crop과 destination rect가 경계 안
- 제품 `UrbanZoneMap`이 ImageGen asset renderer를 사용
- 구형 visible polygon renderer가 제품 Urban 경로에서 호출되지 않음

## 문서 정리

현재 `design/concepts/urban-advanced-city-2026-09-01/IMPLEMENTATION_HANDOFF.md`는 “최종 그래픽이 코드 기반 Canvas 픽셀 드로잉”이라고 기록한 이전 폴리곤 버전의 역사적 문서입니다. 이를 신형 완료 증거로 사용하지 마세요.

새 문서를 작성하세요.

- `design/concepts/urban-advanced-city-2026-09-01/IMAGEGEN_REBUILD_HANDOFF.md`

다음을 포함합니다.

- 최종 구조와 변경 파일
- ImageGen built-in 모드 사용 사실과 각 에셋/prompt/source/runtime 파일
- metro와 landmark의 체크 배경 실패 및 기계적 알파 복구 이력
- 실제 사용/미사용 에셋 구분
- manifest, crop, anchor, y-sort, collision, foreground 규칙
- 마커 시각 위계와 수집 판정 분리
- A/B 83개, 6블록, 스폰/잠금/접근성 검증
- Gate 2/3/4 브라우저 검수 결과
- 테스트, targeted lint, build, 전체 lint 결과
- Supabase 제출 여부와 알려진 제한
- 최종 review 이미지 경로

필요하면 기존 `IMPLEMENTATION_HANDOFF.md` 상단에 신형 ImageGen 핸드오프를 가리키는 짧은 superseded 안내만 추가할 수 있지만, 과거 이력을 삭제하거나 대규모로 다시 쓰지 마세요.

## 완료 조건

다음이 모두 충족될 때만 완료로 보고하세요.

- 확정 시안과 같은 차가운 `Midnight Metro Media Core`로 즉시 인식됨
- 건물, 도로, 전철, 차, 버스, 나무, 가로등, 플랜터, 안테나, 랜드마크가 실제 ImageGen 래스터 에셋으로 보임
- 제품 Urban 화면에서 구형 사각형/폴리곤 visible art가 호출되지 않음
- asset manifest가 실제 파일과 일치하고 실패/알파 복구 이력이 정직하게 기록됨
- `/urban-art-preview`가 HUD 없는 전체 맵 아트 프리뷰임
- contact sheet와 확정 시안 비교 이미지가 존재함
- 마커가 도시를 압도하지 않으면서 모든 실제 사운드가 수집 가능함
- A/B 83개, 6블록, 충돌, y-sort, 잠금, annotation, 퇴장에 회귀가 없음
- 데스크톱과 모바일 브라우저 검수 완료
- 자동 테스트, targeted lint, production build 통과
- 신형 ImageGen 렌더러 기준 최종 스크린샷과 `IMAGEGEN_REBUILD_HANDOFF.md`가 존재함
- 다른 존과 병렬 WIP를 훼손하지 않음

ImageGen 한도, 브라우저 접근, 서버, 외부 연결 또는 필수 입력 때문에 완료할 수 없다면 폴리곤으로 타협하거나 완료라고 말하지 마세요. 완료된 항목, 마지막 통과 Gate, 실패 원인, 다음 정확한 명령/파일을 `IMAGEGEN_REBUILD_HANDOFF.md`의 체크포인트 섹션에 기록하고 최종 답변에서 blocker로 보고하세요.

## 최종 답변 형식

최종 답변에는 다음만 간결하게 포함하세요.

1. 중단 상태에서 이어서 완료한 내용
2. 최종 시각 품질과 마커 위계 개선
3. 수정 파일 및 최종 ImageGen 에셋/manifest
4. A/B 83개·6블록·충돌·접근성·y-sort 검증
5. 실제 루트 A/B 게임 흐름 검증
6. 테스트·targeted lint·build 결과
7. contact sheet, 비교 이미지, 최종 스크린샷, 핸드오프 문서 경로
8. 남은 제한 또는 정확한 blocker
