# SoundVillage 월드맵 순차 안정화·개선 구현 프롬프트

아래 내용을 SoundVillage 저장소를 연 새 Codex 작업에 그대로 전달한다.

---

당신은 게임 디자인, 2D 월드 제작, 플레이어 이동·충돌, 반응형 웹 렌더링과 Next.js 성능 최적화에 숙련된 시니어 게임 개발자다.

현재 SoundVillage의 production 월드맵을 직접 실행하고 플레이하면서 아래 문제를 순서대로 해결하라. 계획이나 분석만 제출하지 말고, 허용된 범위 안에서 구현·테스트·브라우저 플레이 검증까지 완료하라. 각 단계의 완료 조건을 통과한 뒤에만 다음 단계로 진행한다. 중간 단계가 실패하면 원인을 찾아 수정하고 같은 검증을 다시 수행한다.

## 최종 목표

기존 `Sound Archive Garden / 소리 기록 정원`의 구도와 미술 정체성, 여섯 마을·도서관·우리 집의 위치와 제품 흐름을 보존하면서 다음을 달성한다.

1. 루트 앱이 정상적으로 빌드되고 월드맵에 진입할 수 있다.
2. 화면 비율이 달라도 플레이어와 목적지가 잘리지 않는 반응형 카메라를 제공한다.
3. 보이는 길, 충돌 마스크, 실제 이동 경로와 자동 QA 경로가 일치한다.
4. 초기 다운로드와 이미지 디코딩 메모리를 크게 낮춰 모바일에서도 안정적으로 실행한다.
5. 첫 목표, 길찾기, HUD, 입력과 접근성을 개선한다.
6. 월드맵 렌더링 구조와 레거시 코드를 정리하고 실제 depth 표현을 개선한다.
7. 실제 브라우저에서 월드맵 진입·이동·목적지 진입·복귀를 검증한다.

## 작업 원칙

- 먼저 루트와 작업 대상 디렉터리의 `AGENTS.md`를 읽고 따른다.
- 이 프로젝트는 Next.js 16.2.7을 사용한다. 코드를 쓰기 전에 이번 변경과 관련된 문서를 `node_modules/next/dist/docs/`에서 직접 읽는다. 기존 Next.js 지식을 추측으로 적용하지 않는다.
- 작업 트리는 이미 매우 dirty할 수 있다. 기존 수정·신규 파일은 사용자 소유다. 관련 없는 변경을 되돌리거나 정리하지 않는다.
- `git reset --hard`, `git checkout --`, 광범위한 삭제, 대규모 자동 포맷을 사용하지 않는다.
- 기존 `_review/` 결과를 덮어쓰지 않는다. 이번 결과는 `_review/world-map-sequential-fix-2026-09-21/` 아래에 저장한다.
- Supabase production 데이터에 쓰지 않는다. 제품 경로 검증은 개발 전용 QA 모드와 dry-run 경로를 사용한다.
- 배포, push, PR, commit은 요청하지 않았으므로 수행하지 않는다.
- annotation, vote, participant/session, group A/B, block 진행, Music-first 해금, 재화, 출석, 퀘스트, 집꾸미기, duo 기능의 의미를 바꾸지 않는다.
- `WorldMap`의 외부 props와 `app/page.js`의 화면 전환 계약을 임의로 깨지 않는다.
- 시각적 문제를 고치기 위해 승인된 전체 배경을 새로 생성하지 않는다. 새 이미지 생성은 기존 에셋의 구조적 재사용·압축으로 해결할 수 없고 실제 품질 결함이 확인된 경우에만 고려한다.
- 한 단계에서 변경한 범위에 맞는 테스트만 먼저 실행한다. 그 테스트가 통과하면 다음 단계로 이동하고, 마지막에 전체 회귀 검증을 한 번 수행한다.
- 사용자의 선택이 없어도 안전하고 되돌릴 수 있는 구현은 합리적으로 판단하여 계속 진행한다. 외부 서비스 권한이나 복구 불가능한 선택이 필요한 경우에만 멈추고 구체적인 증거와 함께 보고한다.

## 현재 알려진 관찰값

아래 항목은 출발점이며 현재 작업 트리에서 반드시 다시 확인한다. 사실로 가정한 채 바로 수정하지 않는다.

- `components/WorldMap.js`는 약 2,700줄이며 현재 v4 렌더러 외에 이전 절차형 월드맵 코드가 상당량 남아 있다.
- 월드 논리 크기는 120×90타일, 기본 카메라는 30×22타일이다.
- 일반 플레이 SVG가 고정된 30×22 viewBox와 `preserveAspectRatio="xMidYMid slice"`를 사용하여 16:9에서 세로 FOV가 약 15타일까지 줄고, 세로형 모바일에서는 가로 FOV가 약 11타일까지 줄 가능성이 있다.
- `public/assets/world/sound-archive-garden-v4/` 전체 크기는 약 122MB다.
- manifest의 30개 런타임 이미지가 약 115.7MB이며, 시작 시 preload되는 20개 이미지가 약 66.8MB다.
- 원본 이미지 해상도를 기준으로 시작 에셋의 예상 RGBA 디코딩 메모리는 약 212MB, 전체는 약 375MB다.
- Nature QA 자동 이동이 중앙 광장 서쪽 부근에서 `terrain:reference-mask` 충돌로 멈춘 사례가 있었다. 당시 플레이어 foot 좌표는 대략 `1316,1430`이었다.
- 충돌 테스트는 목적지로 갈 수 있는 별도의 BFS 경로를 찾지만, 실제 `WORLD_MAP_V4_PATHS` waypoint를 끝까지 주행하는지는 검증하지 않는다.
- 이전 관찰 시 `lib/animalVillageSunflowerConfig.mjs`가 없어 `lib/animalVillage.js` import에서 전체 앱 빌드가 중단됐다. 현재도 누락됐는지 먼저 확인한다.
- 아래 월드맵 전용 테스트는 이전 관찰에서 PASS했지만 전체 앱 빌드 성공을 보장하지는 않았다.
  - `npm run test:world-production`
  - `npm run test:world-v4-assets`
  - `npm run test:world-v4-collision`

## 먼저 읽을 파일

- `AGENTS.md`
- `package.json`
- `app/page.js`
- `app/globals.css`
- `components/WorldMap.js`
- `components/world-map/WorldMapScene.js`
- `components/GameEngine.js`
- `components/AssetRegistry.js`
- `lib/worldMapGeometry.mjs`
- `lib/worldMapV4Manifest.mjs`
- `lib/worldMapV4Assets.mjs`
- `lib/worldWalkableMaskData.mjs`
- `scripts/test-world-map-production-integration.mjs`
- `scripts/test-world-map-v4-assets.mjs`
- `scripts/test-world-map-hd-collision.mjs`
- `design/concepts/world-map-reskin-2026-09-18/CODEX_IMPLEMENTATION_PROMPT.md`
- `design/2d-map-redesign/BASELINE_AUDIT.md`

## 0단계 — 작업 트리 보호와 기준선 확보

### 수행

1. `git status --short`로 현재 변경 상태를 기록한다.
2. 관련 파일과 월드맵 에셋의 존재 여부, 크기, import 관계를 확인한다.
3. 실행 가능한 상태라면 로컬 개발 서버를 열고 실제 루트 앱에서 QA 월드맵에 진입한다.
4. 다음 viewport의 기준 화면과 DOM·console 상태를 저장한다.
   - 1280×720
   - 1440×900
   - 390×844
   - 844×390
5. 전체 조감도, 일반 스폰 화면, Nature 방향 이동, 잠금 상태를 캡처한다.
6. 초기 전송 바이트, 이미지 수, `mapReadyMs`, FPS, slow frame, 디코딩 예상 메모리를 측정한다.

### 산출물

- `_review/world-map-sequential-fix-2026-09-21/00-baseline/`
- `baseline-report.md`
- viewport별 스크린샷
- 콘솔 오류와 네트워크·메모리 기준값

### 완료 조건

- 기존 변경을 건드리지 않고 재현 가능한 기준선이 확보됐다.
- 실행 불가 상태라면 정확한 첫 빌드 오류와 import 체인이 기록됐다.

## 1단계 — 전체 앱 빌드와 실행 안정화

### 수행

1. `lib/animalVillageSunflowerConfig.mjs`가 누락됐는지 확인한다.
2. 누락됐다면 먼저 git 이력, 인접 worktree, 프로젝트 문서와 테스트에서 권위 있는 원본을 찾는다.
3. 의미를 추측해 임의의 더미 config를 만들지 않는다. 복구 가능한 원본이 없다면 `animalVillage.js`의 실제 계약과 테스트를 분석해 최소한의 정식 구현을 재구성하고, 그 근거를 보고서에 남긴다.
4. 최초 빌드 오류를 해결한 후 새로 드러난 오류를 순서대로 처리한다.
5. QA query 없이 루트 앱이 시작 화면까지 렌더되는지, QA query로 월드맵이 렌더되는지 확인한다.

### 필수 검증

- `npm run build`
- `npm run lint`
- 관련 Animal 테스트 또는 production 검사
- `npm run test:world-production`
- 브라우저 console error 0

### 완료 조건

- 깨끗한 프로세스에서 전체 앱 빌드가 성공한다.
- 개발 서버를 새로 시작해 루트 앱과 QA 월드맵에 진입할 수 있다.
- 기존 사용자 변경을 되돌린 파일이 없다.

## 2단계 — 반응형 카메라와 입력 안전 영역

### 목표

고정 viewBox를 `slice`로 잘라내지 않고 실제 화면 비율에 맞는 논리 카메라를 계산한다. 모든 화면에서 플레이어가 안전 영역 안에 있고, 건물·진입 프롬프트·HUD가 의도치 않게 잘리지 않아야 한다.

### 구현 요구

1. viewport 크기와 HUD 높이를 반영해 카메라의 논리 `viewW`와 `viewH`를 계산한다.
2. 한 축의 FOV를 보존하고 다른 축을 확장하는 방식으로 종횡비를 맞춘다.
3. 필요한 경우 데스크톱과 모바일에 합리적인 최소·최대 타일 FOV를 둔다.
4. 카메라 clamp는 최종 동적 viewBox 크기를 사용한다.
5. 맵 가장자리에서도 플레이어가 화면 밖으로 밀리지 않아야 한다.
6. overview·clean·reference·collision QA 모드를 보존한다.
7. 캐릭터와 배경 이미지를 비균등 stretch하지 않는다.

### 자동 테스트

- 순수 카메라 계산 함수를 별도 모듈로 추출하고 다음을 검증한다.
  - 1280×720
  - 1440×900
  - 390×844
  - 844×390
  - 맵 중앙·네 모서리·8개 목적지
- 모든 샘플에서 플레이어 중심이 viewport 안전 영역 안에 있어야 한다.
- 실제 보이는 타일 수와 계산한 카메라 크기가 일치해야 한다.

### 브라우저 검증

- 네 viewport에서 스폰, Home, Lab, Human, Music 위치를 확인한다.
- HUD, 목표 카드, 진입 프롬프트와 캐릭터가 겹치거나 잘리지 않는지 확인한다.

### 완료 조건

- 4개 기준 viewport에서 잘림 없이 플레이 가능하다.
- 종횡비가 바뀌어도 플레이어 크기와 맵 비율이 왜곡되지 않는다.
- 변경 전후 스크린샷과 FOV 수치가 보고서에 기록됐다.

## 3단계 — 길·충돌·목적지 경로 통합

### 목표

보이는 길, 실제 충돌, 수동 이동과 QA 자동 경로가 같은 공간 계약을 사용하도록 만든다.

### 구현 요구

1. `WORLD_MAP_V4_PATHS`의 각 선분을 production의 `moveWorldPlayer()`로 실제 주행하는 회귀 테스트를 먼저 추가해 기존 실패를 재현한다.
2. 단순히 waypoint를 조금 옮겨 테스트만 통과시키지 말고 다음 중 유지보수 가능한 방식을 선택한다.
   - 충돌 마스크 위 A* 경로 탐색
   - 검증된 nav polyline과 자동 보정
   - 길 중심선에서 충돌·자동 경로를 함께 파생
3. 선택 근거와 데이터의 단일 원천을 문서화한다.
4. 6개 마을, 도서관, Home까지 실제 플레이어 크기와 substep으로 이동 가능해야 한다.
5. 보이는 길과 실제 collision 경계 차이를 가능한 한 0.5타일 이내로 유지한다.
6. 목적지 interaction point가 문·게이트의 시각 위치와 일치하는지 확인한다.
7. 기존 240×192 진입 hitbox가 너무 이른 프롬프트를 만든다면 발 중심 거리 또는 문 앞 capsule/rect 방식으로 조정한다. 목적지끼리 interaction 영역이 겹치면 안 된다.

### 필수 검증

- `npm run test:world-production`
- `npm run test:world-v4-collision`
- 새 exact authored-route 테스트
- 8개 목적지 각각 `arrived === true`
- 각 목적지에서 Enter, Space, 모바일 확인 버튼 중 해당 입력이 정상 동작
- 충돌 중 30프레임 이상 정지하는 구간 0

### 완료 조건

- Nature를 포함한 모든 경로가 실제 브라우저에서 완주된다.
- 테스트가 별도 우회 BFS의 존재만 확인하지 않고 production 이동 경로를 직접 검증한다.
- 보이지 않는 벽이나 길 밖 통과가 재현되지 않는다.

## 4단계 — 월드맵 에셋·로딩·메모리 최적화

### 목표 예산

- 초기 월드맵 전송량: 가능하면 15MB 이하
- 전체 월드맵 에셋: 기존 대비 최소 50% 감소
- 초기 이미지 디코딩 예상 메모리: 100MB 이하
- 기준 이미지 시각 유사도: 기존 SSIM 0.961에서 유의미하게 악화되지 않으며 최소 0.95 유지

목표를 달성하지 못하면 수치를 숨기거나 품질을 임의로 낮추지 말고 병목과 다음 선택지를 보고한다.

### 구현 요구

1. 현재 manifest 에셋별 압축 바이트, 픽셀 수, decoded RGBA 예상치를 보고한다.
2. 카메라 시작 위치에 필요한 terrain·environment·landmark만 critical로 분류한다.
3. 현재 청크와 이동 방향 인접 청크를 우선 로드하고 나머지는 지연 로드한다.
4. 불투명 이미지와 투명 이미지에 적절한 WebP/AVIF 또는 최적화 PNG를 사용한다.
5. 실제 표시 크기보다 과도하게 큰 원본은 승인된 품질 범위에서 축소하거나 해상도 variant를 만든다.
6. 저해상도 프리뷰 또는 부드러운 placeholder 후 고해상도 교체를 적용해 빈 초록 화면을 피한다.
7. `mapReady`는 전체 환경 에셋이 아니라 첫 화면 플레이에 필요한 에셋 준비 상태를 나타내야 한다.
8. 실패한 이미지 한 장 때문에 월드맵 전체가 영구적으로 준비되지 않는 상태가 되지 않도록 fallback을 제공한다.
9. 카메라 이동 중 동일 이미지를 반복 decode하거나 요청하지 않는다.

### 필수 검증

- `npm run test:world-v4-assets`
- visual reconstruction 또는 screenshot diff
- 기존 기준과 새 SSIM 비교
- 로컬 캐시 비움 상태의 초기 전송량 측정
- 390×844 환경의 로딩·이동·메모리 확인
- 화면 이동 중 404와 decode error 0

### 완료 조건

- 성능 수치가 before/after 표로 기록됐다.
- 첫 화면이 전체 20개 환경 이미지 선로딩에 묶이지 않는다.
- 시각적 정체성과 목적지 위치가 유지된다.

## 5단계 — 목표·길찾기·HUD·접근성 개선

### 목표

신규 플레이어가 첫 필수 행동을 이해하고, 목표 마을을 찾으며, 키보드·터치·보조기술로 동일한 기능을 사용할 수 있어야 한다.

### 구현 요구

1. 장기 진행 목표와 현재 근접 행동 안내를 분리한다.
2. Music-first 참여자의 첫 월드맵 목표는 음악 마을 구역 1 완료를 명시한다.
3. 스폰 지점이 도서관 interaction 범위 안이더라도 첫 진행 목표가 도서관 안내로 덮이지 않게 한다.
4. 필수 또는 선택된 목적지의 방향을 절제된 edge arrow, compass 또는 중앙 표지판으로 안내한다.
5. 잠긴 마을은 멀리서도 잠김 상태를 이해할 수 있게 하되 활성 포털과 같은 pulse를 쓰지 않는다.
6. 데스크톱의 상시 D-pad를 제거하고 `pointer: coarse` 또는 터치 환경에서만 표시한다. 키보드 도움말은 최초 또는 요청 시에만 보여준다.
7. 상단 HUD의 핵심 정보 위계를 정리한다. 진행률·수집 수·재화·퀘스트·출석을 유지하되 한 화면에서 경쟁하지 않게 한다.
8. 사용자에게 보이는 `Overall Progress`, `Zone` 등 불필요한 영문 혼용을 자연스러운 한국어로 통일한다.
9. 방향 버튼과 확인 버튼을 실제 `<button>`으로 만들고 label, focus, disabled 상태를 제공한다.
10. 의미 있는 텍스트를 `title`과 emoji에만 의존하지 않는다.
11. 핵심 텍스트는 모바일에서 읽을 수 있는 크기와 대비를 유지한다.
12. `prefers-reduced-motion`에서 pulse·bobbing 등 반복 애니메이션을 끈다.
13. 기존 분석 이벤트 이름과 payload 계약을 보존한다. UI 구조 변경으로 이벤트가 중복 발화하지 않게 한다.

### 플레이 검증 시나리오

1. 잠긴 일반 참여자 상태로 월드맵 진입
2. 첫 목표와 음악 마을 방향 확인
3. 잠긴 다른 마을 접근 및 차단 설명 확인
4. 음악 마을 진입
5. 월드맵 복귀 후 목표 상태 확인
6. 키보드, 터치, focus 탐색 확인
7. reduced-motion 환경 확인

### 완료 조건

- 신규 사용자가 외부 설명 없이 첫 필수 목적지를 찾을 수 있다.
- 데스크톱과 모바일 UI가 서로 필요한 입력만 표시한다.
- keyboard-only와 touch-only로 목적지 진입이 가능하다.

## 6단계 — 렌더 레이어와 유지보수 구조 정리

### 목표

시각 결과를 보존하면서 현재 월드맵의 이중 구현과 제한적인 depth 처리를 정리한다.

### 구현 요구

1. `WorldMap.js` 안에서 실제 v4 production 경로에 사용되지 않는 상수·함수·레거시 렌더러를 참조 검색과 테스트로 증명한 뒤 제거하거나 별도 archive/reference 모듈로 격리한다.
2. 다음 책임을 분리한다.
   - 월드 상태·이동 컨트롤러
   - 반응형 카메라
   - 월드 scene renderer
   - 플레이어·duo 캐릭터
   - HUD·목표·진입 프롬프트
   - QA overlay와 성능 계측
3. 배경을 최소한 다음 레이어로 나눈다.
   - ground
   - low decoration
   - Y-sort 가능한 gameplay object
   - character
   - canopy/roof/arch foreground
4. 캐릭터가 나무·지붕·게이트 앞뒤를 이동할 때 자연스럽게 가려지는지 확인한다.
5. collision을 이미지 색상에서 런타임 추론하지 않고 논리 데이터로 유지한다.
6. 대규모 리팩터링 중에도 외부 prop, test id, 화면 전환 callback을 보존한다.
7. 리팩터링만을 위한 무의미한 snapshot 테스트를 대량 추가하지 않는다. 이동·레이어·상호작용 계약을 검증하는 테스트를 둔다.

### 완료 조건

- `WorldMap.js`의 책임과 크기가 실질적으로 줄었다.
- production 렌더 경로가 하나로 명확해졌다.
- 플레이어와 주요 전경 오브젝트의 depth가 실제 브라우저에서 자연스럽다.
- visual regression과 제품 흐름이 통과한다.

## 7단계 — 최종 제품 회귀 검증

### 자동 검증

최소한 다음을 실행하고 결과를 기록한다.

```bash
npm run lint
npm run build
npm run test:world-production
npm run test:world-v4-assets
npm run test:world-v4-collision
npm run test:input-lifecycle
npm run test:stage-6-lifecycle
```

변경 영향에 따라 관련 Animal·Music·Nature·Human·Urban·Lab production 검사도 실행한다.

### 브라우저 검증

실제 루트 앱에서 다음을 확인한다.

- 시작 화면 → 월드맵
- 잠금 상태와 Music-first 안내
- 6개 마을 각각 접근·진입
- 각 마을 → 월드맵 복귀
- 도서관 접근·진입·복귀
- Home 접근·진입·복귀 또는 로컬 backend가 없을 경우 안전한 fallback
- 퀘스트·출석 패널 열기와 닫기
- 키보드·Space·Enter·터치 확인
- 4개 기준 viewport
- console error/warn, 404, hydration 오류, 무한 입력, 캐릭터 화면 이탈 여부

실제 DB 저장이나 연구 데이터 변경은 하지 않는다.

### 최종 산출물

`_review/world-map-sequential-fix-2026-09-21/FINAL_REPORT.md`에 다음을 기록한다.

1. 단계별 문제와 원인
2. 변경한 파일과 변경 이유
3. 카메라 FOV before/after
4. 8개 목적지 경로 결과
5. 초기·전체 전송량과 decoded memory before/after
6. SSIM 또는 screenshot diff 결과
7. 데스크톱·모바일 캡처
8. 실행한 테스트와 결과
9. 남은 위험과 의도적으로 하지 않은 작업

## 최종 완료 정의

다음 조건을 모두 만족해야 완료로 보고한다.

- 전체 앱 build와 lint가 성공한다.
- 실제 루트 앱에서 월드맵이 열린다.
- 4개 viewport에서 플레이어가 잘리지 않는다.
- 6개 마을·도서관·Home이 도달 가능하다.
- 실제 authored/production 경로 테스트가 통과한다.
- 보이는 길과 충돌이 일치한다.
- 초기 월드맵 로딩이 전체 환경 이미지 preload에 종속되지 않는다.
- 기존보다 전송량과 디코딩 메모리가 명확히 감소한다.
- Music-first 목표와 목적지 방향이 이해된다.
- 데스크톱·터치·키보드 접근이 각각 정상이다.
- 주요 제품 기능과 데이터 계약에 회귀가 없다.
- 기존 사용자 변경을 되돌리거나 덮어쓰지 않았다.

최종 답변은 먼저 완료 여부를 명확히 밝히고, 단계별 결과, 핵심 수치, 테스트 결과, 남은 위험, 리뷰 파일 경로를 간결하게 보고하라. 단순히 “개선했다”라고 표현하지 말고 검증된 수치와 실제 플레이 결과를 제시하라.

