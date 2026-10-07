# Codex 프롬프트 — Step 11 전체 월드맵 화질 감사

이 프롬프트는 Home release local commit이 완료된 뒤, 그 commit에서 시작하는 별도 깨끗한 worktree에서 실행하는 것이 원칙이다. production 변경은 하지 않는 read-only 조사 단계다.

```text
SoundVillage 월드맵 v4의 전체 래스터 화질 문제를 계측하고 원인별로 분리해줘.

이번 작업은 Step 11: “전체 월드맵 품질 기준선 및 열화 원인 감사”다. 해결책 구현, production asset 교체, 이미지 생성, collision 변경은 아직 하지 않는다.

## 시작 전 필수 확인

1. 현재 worktree, branch, HEAD, Git status를 기록한다.
2. Home native layered object release commit을 포함한 깨끗한 별도 worktree인지 확인한다.
3. dirty이면 어떤 파일도 변경하지 말고 중단한다.
4. 저장소 루트의 `AGENTS.md`를 읽는다.
5. 브라우저/Next.js 실행 방식을 확인해야 할 때는 설치된 Next.js 16.2.7 문서를 `node_modules/next/dist/docs/`에서 먼저 읽는다.
6. 다음 인수인계와 기존 결과를 읽는다.
   - `_review/world-map-chat-handoff-2026-09-27/HANDOFF.md`
   - `_review/world-map-home-release-step9/FINAL_HANDOFF.md`
   - `_review/world-map-home-release-step10/FINAL_CODE_REVIEW.md`
   - `_review/world-map-object-model-step6/RENDER_LAYER_ARCHITECTURE.md`

## 목표

현재 사용자가 보는 흐림·선명도 불균일·세부 손실이 아래 어느 단계에서 얼마나 발생하는지 증거로 분리한다.

1. HD source 자체의 품질/미술 밀도
2. source crop 또는 panel/cluster 구성
3. runtime resize와 WebP encode
4. 1× asset density 부족
5. SVG camera의 비정수 scale 재샘플링
6. DPR 1/2 차이
7. 서로 다른 세대의 asset style 혼합
8. 큰 environment cluster에 장식이 baked된 구조

## 조사 대상

- terrain panel 12개
- environment cluster 8개
- native Home와 Library
- 대표 legacy landmarks: Music, Human, Urban, Guesthouse
- 중앙 정원과 외곽 영역을 각각 대표하는 viewport
- 현재 runtime asset manifest, source asset registry, projection, renderer, camera 계산

## 필수 계측

### A. asset inventory

각 source/runtime asset에 대해 가능한 범위에서 다음을 수집한다.

- logical world bounds와 pixel dimensions
- pixel density(px/world px)
- 포맷, 파일 크기, alpha 여부
- source → runtime resize 비율
- WebP encode 설정
- source/runtime SHA-256
- decoded RGBA memory 추정치
- 어떤 object/layer/viewport가 사용하는지

### B. image quality metrics

동일 crop 기준으로 source와 runtime을 비교하고, 최소한 다음을 계산한다.

- mean edge magnitude
- strong-edge ratio
- luminance/contrast 분포
- source를 runtime 크기로 기준 downsample한 이미지와 runtime의 차이
- 가능하면 SSIM/PSNR 또는 동등한 구조 보존 지표

지표는 화풍의 좋고 나쁨을 단독 판정하는 점수가 아니라 열화 위치를 찾는 증거로 사용한다.

### C. browser/camera matrix

실제 production 렌더에서 최소 다음 scale을 포함하도록 viewport를 구성한다.

- 약 0.58
- 약 0.609
- 약 0.943
- 약 1.198

각각 DPR 1과 DPR 2를 가능한 범위에서 검증한다. 각 조합에서:

- 실제 카메라 scale
- 선택·요청된 asset URL
- request transfer bytes
- rendered/decoded image 수와 decoded memory 추정
- DOM image node 수
- console error/warning과 asset failure
- 대표 crop screenshot
- 같은 월드 지점의 화면상 edge/blur 변화

애니메이션은 고정하거나 제외 영역을 명시한다.

### D. 구조적 분해 가능성

중앙 정원에서 baked content를 다음 세 범주로 분류한다.

- 계속 background/ground에 남길 것
- 의미 있는 독립 object로 분리할 것
- character occlusion을 위해 foreground로 분리할 것

꽃, 잔디, 작은 돌을 무조건 개별 object로 만들지 않는다. 이동·교체·collision·depth·부분 재제작의 가치가 있는 항목만 후보로 잡는다.

## 비교 시나리오

production에 연결하지 않는 분석용 결과로 중앙 정원 대표 crop에 대해 다음을 비교한다.

1. 현재 1× runtime
2. encode quality만 높인 1×
3. 실제 HD source 기반 1.5×
4. 구조적으로 필요한 레이어만 선택적 1.5×

인공 업스케일은 개선 후보로 판정하지 않는다. `image-rendering: pixelated`도 적용하지 않는다.

## 성능 예산 분석

- 현재 대표 viewport의 transfer/decode baseline을 계산한다.
- 전체 1.5× 적용 시 pixel area 약 2.25배, 2× 적용 시 약 4배라는 이론치와 실제 inventory를 비교한다.
- 모바일/데스크톱별 네트워크·decoded memory 증가를 추정한다.
- Step 12에서 결정할 수 있도록 “항상 1× / 선택적 1.5× / 1.5× 금지” 후보 클래스를 제시한다.

이번 단계에서는 최종 정책을 확정하거나 runtime 선택 로직을 구현하지 않는다.

## production 불변 조건

- production code 변경 0
- source/runtime asset 변경 0
- generated projection/collision/mask 변경 0
- Home/Library authority 및 모든 좌표 변경 0
- package.json 변경 0
- commit, push, deploy 0

분석 스크립트와 결과는 `_review/world-map-quality-step11/` 아래에만 생성한다. 기존 `_review` 산출물을 덮어쓰지 않는다.

## 필수 산출물

- `QUALITY_BASELINE.md`
- `DEGRADATION_CAUSES.md`
- `ASSET_DENSITY_INVENTORY.json`
- `BROWSER_SCALE_MATRIX.json`
- `PERFORMANCE_BUDGET_BASELINE.md`
- `CENTRAL_GARDEN_DECOMPOSITION.md`
- `STEP12_DECISION_INPUTS.md`
- `quality-audit-results.json`
- 재현 가능한 분석 스크립트
- 대표 source/runtime/browser 비교 이미지와 연락표
- 시작/종료 Git status 및 production hash 비교

## PASS 기준

- 대상 asset class와 scale/DPR matrix가 누락 없이 계측됨
- 흐림의 원인이 source/runtime/encode/camera/style/structure 단계별로 구분됨
- 수치와 대표 이미지가 서로 연결됨
- 성능 비용과 품질 이득을 함께 제시함
- Step 12가 추가 추측 없이 정책 결정을 할 수 있는 선택지와 trade-off가 있음
- production 변경과 hash drift가 0임

결과가 PASS여도 해결책 구현으로 넘어가지 말고 사용자 승인 대기 상태로 멈춰라.
```
