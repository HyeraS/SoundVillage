# SoundVillage 월드맵 순차 안정화·개선 최종 보고서

작성일: 2026-09-21  
결과: **완료 — production build, 필수 회귀 테스트, 8개 목적지 실브라우저 도달, 6개 마을 진입·복귀가 통과했다.**

## 0. 기준선과 작업 트리 보호

- 시작 시 `git status --short`를 기록하고 기존 dirty 변경을 사용자 소유로 취급했다. 관련 없는 파일을 되돌리거나 포맷하지 않았다.
- production DB write가 없는 `natureQa=1` dry-run 경로만 브라우저 검증에 사용했다.
- 기준 캡처: `00-baseline/screenshots/`
- 기준 보고서: `00-baseline/baseline-report.md`
- 기준 관찰:
  - 일반 카메라: 고정 `960×704` viewBox + `slice`
  - 시작 이미지: 20개, 66,819,562 bytes(63.72 MiB), 예상 decoded RGBA 212.33 MiB
  - 전체 manifest: 30개, 115,739,525 bytes(110.38 MiB), 예상 decoded RGBA 375.33 MiB
  - Nature 자동 이동은 foot 약 `(1317.3, 1430.0)`에서 `terrain:reference-mask`에 막혀 미도착했다.
  - `lib/animalVillageSunflowerConfig.mjs`는 현재 작업 트리에 존재했고 전용 테스트 8개가 통과했다.

## 1. 전체 앱 빌드·실행

- Next.js 16.2.7의 로컬 문서에서 client boundary, image, CLI/build 옵션을 확인한 뒤 구현했다.
- 기본 Turbopack `next build`는 깨끗한 프로세스에서도 `Creating an optimized production build ...`에서 두 차례 3분 이상 무출력 정지했다.
- Next 16 공식 CLI 옵션인 `next build --webpack`을 `npm run build`에 적용했다.
- 최종 빌드: **PASS**, webpack compile 1.17초, 29개 static page 생성 완료.
- 루트 `/` 시작 화면과 QA 월드맵을 새 개발 서버에서 실제 렌더링했다. 최종 화면에 Next 오류 오버레이가 없고 `data-failed-asset-count=0`이었다.

## 2. 반응형 카메라

`lib/worldMapCamera.mjs`에 순수 카메라 계산을 분리했다. 화면 비율과 HUD 높이를 반영해 한 축의 FOV를 유지하고 다른 축을 확장하며, 최종 viewBox로 월드 경계를 clamp한다. SVG는 `xMidYMid meet`를 사용하므로 비균등 stretch나 `slice` crop이 없다.

| viewport | 변경 전 실제 노출 추정(타일) | 변경 후 viewBox(타일) |
|---|---:|---:|
| 1280×720 | 약 30×15.6 | 42.41×22 |
| 1440×900 | 약 30×17.6 | 37.54×22 |
| 390×844 | 약 10.9×22 | 20×40.41 |
| 844×390 | 약 30×11.9 | 45.49×18 |

- 중앙, 네 모서리, 8개 목적지 안전 영역 순수 함수 테스트: PASS
- 변경 후 캡처: `02-camera/screenshots/`

## 3. 길·충돌·목적지 경로

- 4px clearance mask를 단일 권위 데이터로 사용해 spawn에서 한 번 BFS하고, 실제 `moveWorldPlayer()`로 검증·단순화한 production route를 생성한다.
- 목적지 상호작용은 240×192 body overlap 대신 foot 기준 128×96 영역으로 줄였다. 목적지끼리 겹치지 않는다.
- 자동 이동은 남은 거리보다 크게 step하지 않도록 clamp했고, 별도 우회 검사가 아니라 production route를 실제 player 크기와 substep으로 주행한다.

| 목적지 | arrived | frame | waypoint | 최대 정지 frame |
|---|---:|---:|---:|---:|
| Lab | true | 202 | 7 | 0 |
| Animal | true | 352 | 10 | 0 |
| Urban | true | 258 | 8 | 0 |
| Music | true | 366 | 10 | 0 |
| Human | true | 419 | 11 | 0 |
| Nature | true | 251 | 7 | 0 |
| Sound Library | true | 12 | 2 | 0 |
| Home | true | 318 | 9 | 0 |

- 사용자 재검토에 따라 충돌 마스크를 지형 색상 기반에서 8개 건물의 의미론적 본체 영역 기반으로 교체했다. 플레이어 발 크기(가로 14px, 세로 8px)를 반영해 건물만 막고, 길과 나머지 야외 지형은 이동 가능하다.
- 변경 전 walkable 111,304 cells(16.10%) / blocked 579,896 cells(83.90%)에서, 변경 후 walkable 634,419 cells(91.79%) / blocked 56,781 cells(8.21%)가 되었다.
- walkable 634,419 cells는 모두 spawn과 연결된다(disconnected 0, 1~2 cell pinch 0).
- 충돌 sampled move 104,656건과 8개 목적지 모두 max stalled frame 0.
- 이전에 실제로 막혔던 중앙 정원 아치(87,72)를 포함한 물가·숲·정원 표본도 모두 walkable로 검증했다.
- 실브라우저에서도 8개 전부 `arrived=true`, 정확한 `near destination`, failed asset 0을 확인했다.

## 4. 에셋·로딩·메모리

- 29개 production 이미지를 논리 표시 크기로 축소한 quality 92 WebP로 변환했다.
- 480×360 terrain preview를 먼저 표시하고, 초기 카메라의 terrain/object만 critical preload한다.
- terrain과 object는 카메라 기반 culling을 사용한다. 동일 URL preload는 module-level promise cache로 중복 요청/decode를 막는다.
- 이미지 실패는 해당 이미지만 숨기고 readiness를 해제하므로 한 장의 실패가 전체 맵을 영구 대기시키지 않는다.
- 런타임에서 참조하지 않던 생성 중간 PNG 30개와 stale root manifest를 제거했다. 필요하면 `scripts/build-world-map-v4-assets.py`로 원본 PNG를 재생성한 후 runtime builder를 다시 실행할 수 있다.

| 지표 | 변경 전 | 변경 후 | 변화 |
|---|---:|---:|---:|
| 전체 runtime manifest 전송 | 110.38 MiB | 7.04 MiB | -93.6% |
| public v4 디렉터리 | 약 122 MiB(관찰값; runtime variant 추가 직전) | 7,434,488 bytes(7.09 MiB) | 약 -94.2% |
| 초기 전송 예산(viewport별 정적 산출) | 63.72 MiB | 2.46–2.97 MiB | -95% 이상 |
| 초기 decoded RGBA | 212.33 MiB | 390×844 실측 추정 56,440,928 bytes(53.83 MiB) | -74.6% |
| 전체 decoded RGBA | 375.33 MiB | 122.87 MiB | -67.3% |
| asset count | 30 | 29 + preview | 미사용 underlay 제거 |

- 390×844 final browser: ready true, 12 resource, failed 0, decoded estimate 53.83 MiB, 117.7 FPS 표본, slow frame 0.
- optimized capture vs prior normalized browser baseline SSIM: **0.991368** (최소 0.95 이상).
- 기존 reference 기준 baseline SSIM: 0.961036.
- 캡처: `04-assets/runtime-clean-1448x1086.png`, `04-assets/mobile-390x844.png`
- 검증 JSON: `04-assets/runtime-asset-build.json`, `04-assets/visual-metrics.json`, `04-assets/asset-manifest-validation.json`

## 5. 목표·HUD·접근성

- 장기 목표와 근접 행동을 분리했다. 잠금 참여자의 장기 목표는 `음악 마을 1구역 전사하기`로 고정되어 spawn 근처 도서관 안내가 덮어쓰지 않는다.
- 음악 마을 방향과 타일 거리를 보여 주는 절제된 compass badge를 추가했다.
- `Overall Progress`를 `전체 진행률`로 바꾸고 사용자 노출 문구의 불필요한 영문 혼용을 제거했다.
- HUD action에 접근 가능한 이름을, zone 상태에 진행률 설명을 추가했다.
- 방향/확인 입력은 실제 `<button>`이며 label, focus-visible, disabled 상태를 가진다.
- D-pad는 `(hover: hover) and (pointer: fine)` 환경에서 숨기고 coarse/touch 환경에만 남는다.
- `prefers-reduced-motion`에서 반복 pulse/bobbing/transition을 끈다.
- 기존 quest/attendance/zone/duo 이벤트 이름과 주요 payload 계약을 유지했다.
- 잠금 모바일 캡처: `07-final/locked-mobile-final.png`

## 6. 렌더 구조와 depth

- `components/WorldMap.js`: 약 2,700줄 → **251줄**.
- production에서 사용하지 않던 절차형 v1/v2 renderer, 타일 장식 상수와 중복 JSX를 제거했다.
- 책임 분리:
  - controller/movement/QA metrics: `components/WorldMap.js`
  - responsive camera: `lib/worldMapCamera.mjs`
  - scene/culling/depth: `components/world-map/WorldMapScene.js`
  - character/portal overlay: `components/world-map/WorldMapActors.js`
  - HUD/objective/prompt/panels/input: `components/world-map/WorldMapUI.js`
  - navigation: `lib/worldMapNavigation.mjs`
- scene은 terrain ground, environment low decoration, Y-sort gameplay object + character, foreground canopy/roof/arch 순서를 유지한다.
- collision은 이미지 색을 런타임 추론하지 않고 `worldWalkableMaskData.mjs`의 논리 데이터만 사용한다.

## 7. 최종 회귀 결과

### 자동 검증

- `npm run lint` — PASS
- `npm run build` — PASS
- `npm run test:world-production` — PASS
- `npm run test:world-v4-assets` — PASS
- `npm run test:world-v4-collision` — PASS
- `npm run test:world-camera` — PASS
- `npm run test:world-authored-routes` — PASS
- `npm run test:input-lifecycle` — PASS (2/2)
- `npm run test:stage-6-lifecycle` — PASS (8/8)
- `npm run test:nature` — PASS (6/6)
- `npm run test:music-production` — PASS
- `npm run test:urban-production` — PASS
- `npm run test:human-production` — PASS
- `node --test lib/animalVillageSunflower.test.mjs` — PASS (8/8)

### 실제 루트 앱 브라우저 검증

- `/` 시작 화면 정상 렌더.
- 잠금 QA에서 Music-first 목표, compass, 한국어 HUD, failed asset 0 확인.
- Lab/Animal/Urban/Music/Human/Nature: production auto route 도착 후 실제 `Enter`로 각각 진입 성공.
- Animal/Urban/Music/Human/Nature는 월드맵 버튼으로 복귀. Lab은 복귀 확인 dialog의 `네, 나갈게요`까지 완료.
- Sound Library: 실제 `Enter` 진입, `Escape` 복귀.
- Home: 실제 `Enter` 진입, dry-run 빈 방 정상 렌더, `Escape` 복귀.
- 퀘스트·출석: 실제 버튼으로 각각 열기/닫기 성공.
- 8개 destination 모두 mapReady true, asset failure 0.
- touch confirm은 coarse pointer에서 노출되는 enabled `<button>`과 동일한 `activateNearbyDestination('touch')` 계약을 사용한다. 자동 lifecycle/production 검사는 통과했으나 이번 데스크톱 in-app browser는 fine pointer여서 물리 touch hardware 이벤트 자체는 에뮬레이션하지 않았다.

## 남은 위험과 의도적으로 하지 않은 작업

1. Next 16.2.7 기본 Turbopack production build가 이 로컬 환경에서 무출력 정지한다. 문서화된 Webpack builder로 `npm run build`를 안정화했다. Next/Turbopack 업그레이드 시 원인을 다시 확인할 수 있다.
2. build 중 Node `module.register()` deprecation warning은 dependency/toolchain 경고이며 앱 compile이나 route 생성에는 영향을 주지 않았다.
3. cold-cache 실제 transferSize는 브라우저 캐시와 로컬 dev protocol의 영향을 받아 정적 파일 합계(2.46–2.97 MiB)를 기준으로 기록했다. 배포 CDN에서의 압축 header 포함 wire size는 별도 측정 대상이다.
4. Supabase production write, 배포, commit, push, PR은 수행하지 않았다.
5. 제거한 대용량 PNG는 생성 중간 산출물이며 Python generator로 복구 가능하다. 런타임 WebP와 collision PNG/JSON은 유지했다.

## 주요 캡처·근거

- 기준선: `00-baseline/`
- 반응형 카메라: `02-camera/screenshots/`
- 개방 경로·건물 전용 충돌: `03-navigation-open-paths/`
- 에셋 최적화: `04-assets/`
- UI/접근성: `05-ui/`
- 리팩터링 후: `06-refactor/`
- 최종 잠금 모바일·도서관: `07-final/`
