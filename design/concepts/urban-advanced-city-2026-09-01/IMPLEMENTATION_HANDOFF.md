# Urban `Midnight Metro Media Core` 구현 핸드오프

작성일: 2026-09-02

## 결과 요약

기존 Urban 존을 48×36, 32px 타일 구조와 기존 캐릭터 비율을 유지한 전용 Canvas 존으로 교체했다. 확정 시안 `02-midnight-metro-media-core.png`의 차가운 인디고·네이비·시안 팔레트, 북측 고가 메트로, 외곽 유리 고층 건물, 중앙 보행축, 서측 미디어광장, 동측 유리 푸드코트·환승 공간, 남동 현대 극장·전기버스 베이를 코드 기반 픽셀 드로잉으로 구현했다.

확정 시안 전체를 배경 이미지로 사용하지 않았으며 외부 에셋도 추가하지 않았다. 지면/건축 정적 레이어, 캐릭터, 전경, 마커·잠금 안개 레이어는 독립 Canvas/DOM 레이어로 유지된다.

## 구조와 변경 파일

- `components/UrbanZoneMap.js`
  - Urban 전용 게임 루프, 카메라, DPR 대응 Canvas 3중 레이어, 이동·충돌·수집·퇴장 연동
  - annotation 중 이동/수집/퇴장 입력 잠금
  - 패널 취소 후 같은 아이템을 벗어나기 전까지 재호출하지 않는 dismissed-item cooldown
  - 제품 경로에는 `debugStart`를 전달하지 않음
- `lib/urbanVillageConfig.mjs`
  - 48×36 맵, 건물·철도·도로·횡단보도·소품 collider, 6개 해금 구역
  - 안전 슬롯 생성, 결정론적 farthest-point 분산, BFS 접근성 및 이동 충돌 함수
- `lib/urbanVillage.js`
  - 코드 기반 픽셀 렌더: 젖은 도로 반사, 발광 간판, 유리 파사드·측면 깊이·옥상 구조, 메트로·전동차·캐노피·지지대·계단, 미디어 오브, 푸드코트, 극장, 전기버스/셔틀
  - 활성/근접/완료/잠금 마커와 잠금 안개
- `app/page.js`
  - 실제 `activeZone === 'Urban'` 분기에서 `UrbanZoneMap` 사용
  - 기존 AnnotationPanel/수집/블록/퇴장 흐름을 그대로 연결
- `app/urban-test/page.js`
  - 실제 메타데이터를 쓰는 A/B, block 1–6, entrance/midcity/metro, 완료/리셋, QA 숨김 제어
- `components/ZoneMap.js`
  - 공용 HUD 외형은 바꾸지 않고 Urban 모바일 보정용 명시적 `data-zone-hud-*` hook만 추가
- `components/GameEngine.js`
  - Urban HUD 메타 색상만 시안에 맞는 시안/네이비로 변경
- `scripts/test_urban_production.mjs`
  - 실제 데이터 수, 결정론, 최소 간격, 안전 슬롯, BFS, 잠금, collider 생산 검증
- `package.json`
  - `test:urban-production` 스크립트 추가

## 에셋 출처

- 디자인 기준: 이 저장소의 `02-midnight-metro-media-core.png`, `README.md`, `CODEX_IMPLEMENTATION_PROMPT.md`
- 최종 게임 그래픽: `lib/urbanVillage.js`의 자체 코드 기반 Canvas 픽셀 드로잉
- 외부 다운로드/외부 라이선스 에셋: 없음
- `public/assets/urban-city-v2/`: 생성하지 않음(별도 비트맵 스프라이트가 필요하지 않았음)

## 충돌·스폰 규칙

- 월드: 48×36 tiles, `T=32`
- 남쪽 spawn은 exit trigger와 겹치지 않으며 block 1에서 보행 가능하다.
- 건물, 고가 철도 조각, 가로등/나무/시설/차량은 hard collider다.
- 일반 도로 차선과 철도는 비보행 영역이며 지정 횡단보도·중앙 보행축·메트로 계단만 통과할 수 있다.
- 잠긴 block 타일은 collider와 별도로 `isAccessibleTile`에서 거절한다.
- 해금 구역은 남측 도착광장(1), 남서 문화구역(2), 남동 극장·환승(3), 서측 미디어 콘코스(4), 동측 푸드·환승(5), 북측 메트로 콘코스(6)다.
- A/B 모두 실제 83개를 유지한다. 블록별 개수는 `15/15/15/15/15/8`이다.
- sound set을 정렬한 키와 sound id를 이용한 결정론적 tie-break를 적용한 farthest-point 선택으로 입력 순서가 바뀌어도 같은 좌표를 쓴다.
- 실제 글로우 외곽 반경 10px, 마커 중심 최소 간격 32px를 검증한다. 수집 판정 박스는 시각 마커 축소와 분리해 플레이 감각을 유지한다.
- 안전 슬롯 수용량은 block별 `44/75/60/70/38/16`이다.

## 자동 검증 결과

2026-09-02 최신 워킹 트리 기준:

- `npm run test:urban-production`: PASS
  - A 83 / B 83
  - `15/15/15/15/15/8`
  - 역순 입력 결정론, 중복 좌표 없음
  - 실제 마커 반경 기준 간격 및 행/열 집중도 제한
  - 맵 경계, solid, road lane, rail, water, 출입구/병목 회피
  - 각 해금 단계의 모든 보행 타일과 아이템이 남쪽 spawn에서 BFS 접근 가능
  - spawn/exit 비중첩
  - 잠긴 block 이동 차단, 해금 후 이동 허용
- Urban targeted ESLint: PASS
  - `components/UrbanZoneMap.js`
  - `lib/urbanVillage.js`
  - `lib/urbanVillageConfig.mjs`
  - `app/urban-test/page.js`
  - `scripts/test_urban_production.mjs`
- `npm run build`: PASS
  - Next.js 16.2.7, 25개 정적 route 생성, `/urban-test` 포함
  - Node의 `module.register()` deprecation warning만 출력
- `npm run lint`: FAIL, `72 problems (57 errors, 15 warnings)`
  - `.next-nature-qa`, 기존 `AnnotationPanel`, `LibraryRoom`, `ZoneMap`, 다른 테스트/참조 디렉터리 등 Urban 범위 밖의 선행 문제
  - Urban targeted lint에는 오류/경고 없음

## 브라우저 검증 결과

Next.js 프로덕션 빌드를 `http://localhost:3101`에서 실행하고 in-app browser로 검증했다.

### `/urban-test`

- 1440×844: entrance block 1, midcity block 4, metro block 6 확인
- 1920×1080: 넓은 viewport의 카메라 clamp와 중앙 도심 확인
- 390×844: 한 줄 모바일 HUD, 숨겨진 QA 제어, D-pad, 세로 카메라 확인
- Group A/B, block 1/6, entrance/metro, 83/83 완료 모달 확인
- 실제 조작에서 block 1은 중앙축 `y=25`에서 차단되고 block 4 해금 후 `y=23`까지 통과함
- Canvas 3장은 1440×844 viewport에서 각각 CSS stage에 맞춰 1440×788 bitmap으로 동기화됨. `image-rendering: pixelated`, 정수 bitmap 크기, DPR 상한 2를 사용함.
- 콘솔 error/warning/hydration/ResizeObserver 오류: 0

### 실제 `/` 제품 경로

- `ALLAUDIO_A` / Group A
  - 로그인 → WorldMap → Urban 포털 → 실제 `UrbanZoneMap` 진입 PASS
  - block 1의 `Motorcycle · URB_77669` 접근 및 Enter → AnnotationPanel 열림 PASS
  - 제출 없이 ✕로 닫은 뒤 Urban 0/83 유지, 같은 아이템 즉시 재호출 없음 PASS
  - ESC → WorldMap 복귀 PASS
- `ALLAUDIO_B` / Group B
  - 로그인 → WorldMap → Urban 포털 → 실제 `UrbanZoneMap` 진입 PASS
  - block 1의 `Engine · Urban_384119` 접근 및 Enter → AnnotationPanel 열림 PASS
  - 제출 없이 ✕로 닫은 뒤 Urban 0/83 유지, 같은 아이템 즉시 재호출 없음 PASS
  - ESC → WorldMap 복귀 PASS
- 연구용 전체 접근 계정은 제품 경로에서 6/6이므로 잠금 자체는 `/urban-test` 실제 이동과 production test로 검증했다.
- Supabase를 오염시키지 않기 위해 AnnotationPanel 제출/건너뛰기는 실행하지 않았다.

## 최종 리뷰 산출물

- `_review/urban-advanced-city/final-entrance-block1-1440x844.png`
- `_review/urban-advanced-city/final-midcity-block4-1440x844.png`
- `_review/urban-advanced-city/final-metro-block6-1440x844.png`
- `_review/urban-advanced-city/final-desktop-1920x1080.png`
- `_review/urban-advanced-city/final-mobile-390x844-block1.png`
- `_review/urban-advanced-city/final-root-worldmap-to-urban.png`
- `_review/urban-advanced-city/final-root-annotation-panel.png`

## 알려진 제한과 병렬 WIP

- 실제 데이터 제출은 의도적으로 하지 않았으므로 Supabase insert/update 이후의 성공 UI는 이번 검증 범위 밖이다.
- 전체 lint의 기존 오류는 Urban 범위 밖이며 수정하지 않았다.
- `components/GameEngine.js`의 전역 `SPEED` 3.9→5.85 변경은 Urban 작업 시작 전에 이미 존재한 미커밋 병렬 WIP다. Urban 작업이 만든 변경이 아니므로 요청대로 되돌리지 않았다. Urban은 현재 공용 SPEED를 소비한다.
- 워킹 트리의 Music/Nature/Lab/Animal 및 기타 미커밋 변경은 보존했다.
- 커밋과 push는 수행하지 않았다.
