# Urban ImageGen 재구축 핸드오프

최종 상태: **완료**  
검수일: 2026-09-05  
제품 렌더러: `data-urban-asset-renderer="imagegen-v2"`

## 결과 요약

Urban은 더 이상 기존 Canvas 사각형·폴리곤 visible map art를 제품 경로에서 사용하지 않는다. 실제 `/`의 Urban 분기와 `/urban-test`는 분리된 ImageGen 래스터 에셋을 ground → static buildings/metro → y-sort props/vehicles/landmarks → player/markers → fixed foreground 순서로 합성한다. `/urban-art-preview`는 같은 draw 함수로 48×36 전체 월드를 HUD, 플레이어, 마커, 잠금 안개, D-pad 없이 4:3으로 표시한다.

확정 시안과 최종 art-only 비교 결과, 북측 고가 메트로와 5량 열차, 중앙 역 계단과 남북 보행축, 서측 미디어 오피스/orb, 동측 유리 푸드코트, 중앙 빛기둥 분수, 남서 문화 오피스, 남동 곡면 극장과 전기버스 베이, 도로 곡선·횡단보도·수목·가로시설이 같은 장소와 같은 `Midnight Metro Media Core` 방향으로 즉시 읽힌다. 체크 잔상, 흰 halo, 소스 crop 잘림, 비정상 stretch, seam은 최종 합성에서 발견되지 않았다. 추가 ImageGen 재생성은 필요하지 않았다.

## 최종 구조와 변경 파일

- `lib/urbanAssetArt.js`: 런타임 URL, source crop/destination rect, static/y-sort/foreground sprite 목록, 제품과 preview가 공유하는 draw 함수.
- `components/UrbanZoneMap.js`: ImageGen 제품 렌더 경로, 충돌·카메라·키보드/D-pad·수집·퇴장 흐름. 짧은 키/D-pad 탭도 한 번의 안전한 충돌 이동을 수행한다.
- `components/UrbanArtPreview.js`: HUD 없는 1536×1152 전체 맵 전용 렌더러.
- `app/urban-art-preview/page.js`: art-only 페이지.
- `app/urban-test/page.js`: A/B, block, entrance/midcity/metro 검수 화면.
- `lib/urbanVillage.js`: 잠금 안개, 출구 cue, 사운드 마커 상태별 시각 위계.
- `lib/urbanVillageConfig.mjs`: 48×36 월드, 건물·rail·차량·가로시설 충돌, 블록과 안전 슬롯.
- `scripts/test_urban_production.mjs`: A/B 데이터·결정론·BFS·충돌뿐 아니라 manifest/PNG IHDR/crop/destination/제품 렌더 경로를 검증.
- `public/assets/urban-city-v2/manifest.json`: 실제 loader key와 파일, 크기, alpha 역할, source/prompt/변환 및 실패 이력.

`app/page.js`의 실제 `activeZone === 'Urban'` 분기는 `UrbanZoneMap`을 사용한다. 구형 `drawUrbanStatic`/`drawUrbanForeground` 정의는 공유/역사 코드와의 충돌을 피하려고 삭제하지 않았지만, 제품 `UrbanZoneMap`에서는 호출하지 않으며 전용 테스트가 이를 검증한다.

## ImageGen 에셋과 생성 이력

모든 원본 미술은 OpenAI built-in ImageGen 모드로 생성되었고, 확정 시안 `02-midnight-metro-media-core.png`를 포지티브 구성·스타일 레퍼런스로 사용했다. 프롬프트, 생성 source, 런타임 파일은 프로젝트 안에 함께 보존한다.

| 패밀리 | 프롬프트 | 생성 source | 런타임 |
|---|---|---|---|
| 지면·도로·보도 | `prompts/ground.md` | `ground/ground-map-v1-source.png` | `ground/ground-map-v1.png` |
| 북측 스카이라인 | `prompts/north-buildings.md` | `buildings/north-skyline-v1-source.png` | `buildings/north-skyline-v1.png` |
| 4개 구역 건물 | `prompts/district-buildings.md` | `buildings/district-buildings-v1-source.png` | `buildings/district-buildings-v1.png` |
| 고가 메트로 | `prompts/metro.md` | `transit/metro-layer-v1-source.png` | `transit/metro-layer-v1.png` |
| 차량·셔틀·버스 | `prompts/vehicles.md` | `transit/vehicles-v1-source.png` | `transit/vehicles-v1.png` |
| 나무·가로등·플랜터·모빌리티 | `prompts/streetscape.md` | `props/streetscape-v1-source.png` | `props/streetscape-v1.png` |
| orb·분수·안테나 | `prompts/landmarks.md` | `props/landmarks-v1-source.png` | `props/landmark-orb-v1.png`, `props/landmark-fountain-v1.png`, `props/antenna-family-v1.png` |
| 그림자·발광·전경 | `prompts/overlays.md` | `overlays/shadow-emissive-foreground-v1-source.png` | `overlays/shadow-emissive-foreground-v1.png` |

### 알파 복구와 미사용 파일

- metro 생성은 두 번 모두 RGB 체크 배경을 반환했다. 새 그림을 덧그리지 않고 체크 배경 key-to-alpha, 연결 실루엣 분리, 투명 여백 정리, nearest-neighbor resize만 적용했다.
- `transit/metro-layer-v1-checker-failed.png`는 `runtime:false`인 실패 보관본이며 로더가 사용하지 않는다.
- landmark 전체 패밀리도 체크 배경 오염이 남아 독립 silhouette를 기계적으로 분리했다.
- `props/landmarks-v1.png`는 `runtime:false`인 보관본이며, 런타임은 orb/fountain/antenna 3개 독립 PNG만 사용한다.
- 이 이력과 각 source 1448×1086, runtime 크기/alpha 역할은 manifest에 기록되어 있고 테스트가 실제 PNG 헤더와 대조한다.

## 합성, anchor, 충돌 규칙

- ground는 불투명 1536×1152 한 장이다. 이는 완성 배경이 아니라 지면 전용 레이어다.
- 북측 4개 건물, 4개 구역 건물, metro 본체는 static pass에서 개별 source crop으로 배치한다.
- 나무, 가로등, 플랜터, 모빌리티 도크, 셔틀, 버스, 주차 차량, orb, 분수, 안테나는 발밑 `anchorY`로 플레이어와 y-sort한다.
- metro front lip은 플레이어 위 foreground pass에 별도 재합성되어 계단/플랫폼 통과 시 앞뒤 관계를 만든다.
- 남측 rail/tree edge는 고정 foreground로 입구 프레임을 만든다.
- 충돌은 이미지 자체가 아니라 동일한 건물 foundation, rail, 차량, 수목/가로시설 footprint를 사용한다. 테스트는 모든 destination rect와 source crop이 각 월드/이미지 경계 안인지 확인한다.

## 사운드 마커 위계

데이터와 28×28 상호작용 판정은 그대로 두고 visible marker만 상태별로 낮췄다.

- `active`: 반투명 0.5, 반지름 4 — 건축과 랜드마크보다 먼저 보이지 않는다.
- `nearby`/`interacting`: 불투명 1, 반지름 8, halo와 더 강한 stroke — Enter 안내와 함께 즉시 식별된다.
- `completed`: 불투명 0.3과 체크 표시 — 약해지지만 상태는 구별된다.
- `unavailable`: 회청색, 불투명 0.1, 반지름 3, 최소 파형 — 데이터에서 삭제하지 않고 잠금 안개 아래 비활성 표식으로 남는다.

block 1의 열린 15개와 block 6의 83개 모두 실제로 존재하며, 축소된 marker 크기는 수집 판정이나 BFS 접근성에 영향을 주지 않는다.

## 데이터·충돌·접근성 검증

- Group A: 83개.
- Group B: 83개.
- 블록 분포: `15/15/15/15/15/8`, 총 6블록.
- 그룹별 결정론, 고유 좌표, 최소 간격, 안전 슬롯 수용량, 각 해금 단계 BFS 접근성 통과.
- spawn/exit 비중첩, 잠금 경계 차단과 해금 후 횡단보도 통과 확인.
- 실제 이동으로 문화 오피스 foundation, 셔틀/차량, 나무, 북측 rail 충돌과 중앙 계단 통과를 확인.
- 나무 수관, metro front lip, 남측 전경의 player y-sort를 entrance/midcity/metro 카메라에서 확인.
- 1440×844, 1920×1080, 390×844에서 카메라 clamp, DPR/backing canvas, pixelated 렌더, HUD/D-pad를 확인.

## 브라우저 Gate

### Gate 2 — art-only

`/urban-art-preview`에서 48×36 전체 맵 4:3 렌더, 주요 장소 전체, HUD/플레이어/마커/잠금 안개/D-pad 부재, asset error 및 console error/warn 0을 확인했다.

건물 contact sheet와 transit/prop contact sheet는 중립 네이비 배경 위에서 파일명·역할·투명 경계를 다시 확인했다. 확정 시안과 art-only 프리뷰를 같은 표시 크기로 재합성한 비교 이미지에서도 북측 metro/5량 열차, 중앙 계단·남북축, 4개 구역 건물과 orb·분수·차량·가로시설의 구성 및 차가운 팔레트가 유지됐다. 체크 잔상, 흰 halo, crop 잘림, stretch, seam이 없어 기존 에셋은 재생성하지 않았다.

### Gate 3 — `/urban-test`

Group A/B, block 1/4/6, entrance/midcity/metro를 확인했다. 모든 조합에서 `imagegen-v2`, 83개 items가 유지됐다. Group A에서 나무 약 `(714.3, 905.6)`, 문화 오피스 foundation 약 `(394.9, 958.3)`, 셔틀 약 `(956.4, 911.5)`, 북측 rail 약 `(819, 214.2)`에서 실제 이동이 멈췄고, 열린 중앙 계단은 `(784, 375)`에서 `(784, 214.2)`까지 통과했다. block 1 서측 잠금 경계는 약 `(617.7, 955.6)`에서 막혔으며 block 2 해금 뒤 `(395.4, 955.6)`까지 통과했다. 근접 marker 확대와 Enter cue, 테스트 수집 후 completed 표시, 나무 수관·metro front lip·남측 전경 y-sort, 카메라 clamp와 픽셀 선명도를 확인했다. 390×844에서는 D-pad 한 번으로 `(784, 1046)`에서 `(789.9, 1046)`으로 이동했고 좁은 HUD도 겹치지 않았다. 최종 이미지는 QA 컨트롤을 숨긴 현재 렌더러 화면이며 PNG 치수도 entrance/midcity/metro 1440×844, desktop 1920×1080, mobile 390×844로 다시 확인했다. 최종 브라우저 console error/warn는 0이다.

### Gate 4 — 실제 `/` 제품 흐름

- `ALLAUDIO_A`: 로그인 → WorldMap → Urban 포털 직접 이동 → ImageGen Urban 6/6, 0/83 → `Motorcycle · URB_77669` 접근 → AnnotationPanel 열림 → 제출/건너뛰기 없이 닫기 → 0/83 유지 및 즉시 재호출 없음 → ESC WorldMap 복귀.
- `ALLAUDIO_B`: 같은 실제 동선 → ImageGen Urban 6/6, 0/83 → 그룹 A와 다른 `Engine · Urban_384119` 접근 → AnnotationPanel 열림 → 제출/건너뛰기 없이 닫기 → 0/83 유지 및 즉시 재호출 없음 → ESC WorldMap 복귀.

Supabase 연구 데이터를 오염시키지 않기 위해 제출과 건너뛰기는 실행하지 않았다. 로그인/진행 데이터 조회와 패널 열기·취소까지만 수행했다.

## 자동 검증 결과

- `npm run test:urban-production`: 통과. A/B 83, 6블록, 결정론·간격·BFS·잠금·충돌·spawn/exit 및 manifest/PNG/crop/destination/loader/제품 renderer 검사 통과.
- Urban 변경 파일 targeted ESLint: 통과.
- `npm run build`: 통과. 샌드박스 실행은 최적화 단계에서 무출력 정지해 중단했고, 승인된 환경에서 같은 명령을 재실행해 Next.js 16.2.7 컴파일·TypeScript·26개 정적 경로 생성을 완료했다.
- `npm run lint`: 저장소 전체 기준 50 errors / 13 warnings로 실패. Urban 전용 파일은 오류가 없고, 실패는 `.next-nature-qa`, 디자인 reference `support.js`, 기존 `app/page.js`, `SoundMuseum`, `LibraryRoom`, `ZoneMap` 등 Urban 범위 밖 기존/병렬 WIP에 있다. 지시대로 수정하거나 되돌리지 않았다.
- `test:urban-production`의 Node 실행에는 `urbanAssetArt.js` ESM 자동 재해석 성능 경고가 한 번 출력된다. 검증 실패나 브라우저 오류는 아니며, 전역 `package.json` module type 변경은 다른 WIP에 영향을 줄 수 있어 적용하지 않았다.

## 최종 리뷰 이미지

- `_review/urban-advanced-city/imagegen-rebuild/art-preview-full-map.png`
- `_review/urban-advanced-city/imagegen-rebuild/gate2-art-only-1440x844.png`
- `_review/urban-advanced-city/imagegen-rebuild/asset-contact-sheet-buildings.png`
- `_review/urban-advanced-city/imagegen-rebuild/asset-contact-sheet-transit-props.png`
- `_review/urban-advanced-city/imagegen-rebuild/reference-vs-art-preview.png`
- `_review/urban-advanced-city/imagegen-rebuild/entrance-block1-1440x844.png`
- `_review/urban-advanced-city/imagegen-rebuild/midcity-block4-1440x844.png`
- `_review/urban-advanced-city/imagegen-rebuild/metro-block6-1440x844.png`
- `_review/urban-advanced-city/imagegen-rebuild/desktop-1920x1080.png`
- `_review/urban-advanced-city/imagegen-rebuild/mobile-390x844-block1.png`
- `_review/urban-advanced-city/imagegen-rebuild/root-worldmap-to-urban.png`
- `_review/urban-advanced-city/imagegen-rebuild/root-annotation-panel.png`

과거 `gate2-*` 리뷰 이미지는 이력으로 보존했다. 새 최종 PNG들은 현재 marker 위계와 프로덕션 빌드를 기준으로 다시 캡처했다.

## 체크포인트 / 남은 제한

Urban ImageGen 재구축의 필수 완료 조건에는 blocker가 없다. 전체 저장소 lint의 Urban 외 기존 오류와 Node의 ESM 성능 경고만 남아 있으며, 둘 다 Urban 제품 렌더·빌드·브라우저 실행을 막지 않는다. 커밋과 push는 수행하지 않았다.
