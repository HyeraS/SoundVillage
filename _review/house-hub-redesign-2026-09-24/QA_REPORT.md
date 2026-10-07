# 우리 집 생활 허브 리디자인 검증 보고서

검증일: 2026-09-24 (Asia/Seoul)

## 결과

우리 집을 좌상단 외곽에서 중앙 광장 서쪽 생활권으로 이전했다. 시작점에서 직선 12.042타일, 실제 보행 경로 13.997타일이며 데스크톱과 390×844 모바일 첫 화면에서 집의 실루엣과 안내 단서를 확인할 수 있다. 일반 플레이 모드에서도 `gameplay` 랜드마크가 렌더링되고, 집 에셋·목적지·충돌·보행 마스크·공간 인덱스·미니맵·카메라 컬링·상호작용 위치가 같은 좌표계를 사용한다.

## 수정 전 기준선

- 시작점: `{ tx: 60, ty: 47 }`
- 이전 집: `{ tx: 18, ty: 12, w: 8, h: 10 }`, 접근점 `{ x: 818, y: 694 }`
- 직선거리: 약 43타일. 실제 도로 이동은 그보다 길었다.
- 일반 플레이의 `[data-object-id="landmark-home"]`: 0개
- `worldLayer=objects`의 동일 오브젝트: 1개
- 집은 지형 패널의 구운 이미지로만 보였고 독립 오브젝트/충돌/상호작용 구조와 불일치했다.
- 공유 토큰 실패는 콘솔 오류만 남겼으며 QA 공유 흐름에서는 빈 URL이 만들어질 수 있었다.

수정 전 이미지는 이미 보존돼 있던 다음 검토 캡처를 원본 그대로 복제해 기준선으로 고정했다. `before/01-world-overview.png`와 `before/02-old-home-arrival.png`는 `_review/world-map-reference-match-v2`, `before/03-interior-screen.png`는 `_review/world-map-production-integration` 출처다.

## 부지와 공간 위계

- 새 건물 영역: `{ tx: 48, ty: 46, w: 8, h: 9 }`
- 현관 접근점: `{ x: 1664, y: 1792 }`
- 시각 경계: `x=1440..1888`, `y=1368..1752`
- 충돌 경계: `x=1536..1792`, `y=1472..1752`
- 현관 앞 보행·집결 여유: 40px
- 중앙 도로 여유: 최소 4타일
- 이전 건물은 상호작용 없는 `landmark-guesthouse`로 재분류해 좌상단 공간의 시각적 공백을 막았다.

정확한 수치는 `site-selection.json`에 기록했다.

## 에셋과 렌더링

- 새 집은 기존 지도에서 잘라낸 재사용 이미지가 아니라, 현재 리스킨의 픽셀 밀도·투시·조명·색온도를 기준으로 만든 투명 랜드마크 원본이다.
- 원본: `design/world-map-v4/source-assets/landmark-home-player-hub-v1.png`
- 런타임: `public/assets/world/sound-archive-garden-v4/runtime/landmark-home-hub.webp`
- 바닥·도로·잔디는 terrain, 집은 gameplay, 가림 요소는 기존 foreground 체계를 유지한다.
- 상태는 `default`, `decorating`, `invite-ready`, `visitor`로 확장 가능하며 최소 요구인 기본/초대 가능 상태를 현관등·상태 비콘으로 구분한다.
- 런타임 빌더가 WebP를 만든 뒤 manifest를 제거된 PNG로 되돌리던 파이프라인 오류도 수정했다. 재실행 검증은 `verify-materialized-runtime`, 30개 에셋, 7,439,806 bytes로 통과했다.

## 온보딩·집꾸미기·초대

- 최초 진입 카드가 집을 개인 생활 허브로 설명하고 약 12타일 거리와 꾸미기→초대 흐름을 안내한다.
- HUD와 미니맵에서 `우리 집 · 꾸미기` 의미를 유지하고, 초대 가능 상태를 별도 표시한다.
- 집 앞 ENTER와 모바일 `↵ 입장` 버튼이 같은 hotspot을 사용한다.
- 모바일 버튼은 44×44px이고 아이콘 추측 없이 텍스트와 `우리 집 들어가기` 접근성 이름을 제공한다.
- 가구 4개 진행도를 초대 해금 조건과 연결했다.
- 공유 URL은 `ready` 상태이면서 비어 있지 않을 때만 복사할 수 있다.
- QA 무토큰 상태와 네트워크 실패 상태는 URL/복사 버튼을 렌더링하지 않고 각각 이유와 재시도 동작을 표시한다.

## 브라우저 직접 플레이

- 데스크톱 1280×720: 일반 모드 집 오브젝트 1개, 실패 에셋 0개, 자동 보행 도착, ENTER 진입 성공.
- 모바일 390×844: 첫 화면 식별, HUD 텍스트, 44×44 터치 진입, 실내 진입 성공.
- objects 모드: 새 집 1개와 구 부지 게스트하우스 1개, 새 집 layer=`gameplay`, assetId=`landmark-home-hub`.
- 초대 QA: URL 0개, 복사 버튼 0개.
- 토큰 오류 QA: URL 0개, 복사 버튼 0개, 재시도 버튼 1개, 사용자 오류 문구 확인.
- 콘솔: error 0, warning 0. 실패한 월드 에셋 요청 0.

DOM/상태 측정 원본은 `browser-validation.json`, 캡처는 `after/`에 있다.

## 자동 회귀 테스트

모두 PASS:

- `npm run lint`
- `npm run test:world-home-hub`
- `npm run test:world-home-visual`
- `npm run test:world-v4-assets`
- `npm run test:world-v4-collision`
- `npm run test:world-production`
- `npm run test:world-camera`
- `npm run test:world-authored-routes`
- `npm run test:world-minimap`
- `npm run build:world-v4-runtime-assets` (materialized runtime 검증)

충돌/보행 검사 결과는 walkable/reachable 634,273, disconnected 0, pinch 0, movement samples 104,624다. 카메라는 1280, 1440, 390, 844 폭 시나리오를 통과했다. Home authored route는 4 waypoints, 77 frames로 도착했다.

시각 회귀는 새 집과 이전 집 마커 주변만 허용 영역으로 두고 비교했다. 허용 영역 밖 평균 절대 오차는 6.4284/255, 변경 픽셀 비율은 0.6673%, 의도한 영역 변경 픽셀은 4,537로 PASS했다. 세부 결과와 차이 히트맵은 `metrics/visual-regression.json`, `metrics/difference-heatmap.png`에 있다.
