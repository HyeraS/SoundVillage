# SoundVillage Nature v2 최종 재개 프롬프트

너는 토큰 만료로 두 번째 중단된 SoundVillage Nature v2 작업을 **현재 워킹 트리 그대로** 이어받는 Codex다. 아래 내용을 전부 읽고, 상태 보고만 한 뒤 멈추지 말고 실제 코드 확인, 브라우저 렌더링, 시안 비교, 기능 회귀 검증, 문서 갱신까지 완료해줘.

과거 대화나 중간 보고보다 현재 디스크의 파일, 이미지, 실행 결과와 `git diff`를 단일 진실로 사용한다. 작업을 처음부터 다시 시작하지 말고, 첫 번째로 검증되지 않은 변경부터 이어간다.

## 1. 프로젝트와 기준 파일

프로젝트 루트:

`/Users/hyera/Documents/SoundVillage-house-decor-2d`

최종 시안:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/02-brookside-bloom-v2.png`

정규화된 시안:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/reference-map-normalized-1536x1152.png`

이전 재개 프롬프트와 요구사항:

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/CODEX_RESUME_AFTER_TOKEN_EXPIRY_PROMPT.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/CODEX_ART_FIDELITY_CORRECTION_PROMPT.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/ASSET_MANIFEST.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/IMPLEMENTATION.md`

핵심 코드:

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureVillage.js`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/components/NatureZoneMap.js`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmLayout.mjs`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmLayout.test.mjs`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmArtGuide.mjs`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/app/nature-test/page.js`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/scripts/validate_nature_v2_assets.mjs`

작업 시작 시 루트와 하위 경로의 적용 가능한 `AGENTS.md`를 확인한다. 이 저장소의 Next.js는 학습 데이터의 일반적인 Next.js와 다를 수 있으므로 Next.js 또는 클라이언트 컴포넌트 코드를 수정하기 전 설치된 `node_modules/next/dist/docs/`에서 관련 가이드를 확인한다.

## 2. 이미 완료된 작업 — 반복 금지

다음 작업은 토큰 만료 전에 완료됐다. 현재 파일에서 실제 존재 여부를 빠르게 확인하되, 결과가 같으면 다시 수행하지 않는다.

- 9개 ImageGen 생성 작업 완료.
- Nature v2 런타임 PNG 14개 제작 완료.
- 물레방앗간, 북동 주택, 온실, 남서 오두막 연결 완료.
- 잔디, 길, 개울과 강둑, 두 다리, 일반 나무, 숲 나무, 사과나무, 밭, 울타리, 작물, 꽃, 벤치와 생활 소품의 v2 렌더러 연결 완료.
- 삭제된 `assets.nature`, `assets.bench`와 구형 환경 아틀라스 참조 제거 완료.
- 다리 난간 foreground 연결 완료.
- 길 마스크와 `path-v2.png` 셀의 방향을 픽셀 단위로 대조해 mask→tile/rotation 매핑 교정 완료. 이 매핑을 과거 상태로 되돌리지 않는다.
- 전체 1536×1152 조감과 주요 위치별 실제 화면 캡처 완료.
- 마지막으로 확인된 정적 검증 결과는 `npm run validate:nature-assets` 통과, `npm run test:nature` 6/6, Nature 대상 ESLint 통과였다.

현재 런타임 에셋 폴더:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/`

현재 생성 원본과 파생 기록:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/`

현재 비교 캡처:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/verification-v2/`

## 3. 절대 금지 사항

- ImageGen을 다시 호출하지 마라. 14개 런타임 에셋을 그대로 사용한다.
- 생성 원본, clean 파생본, 승인된 런타임 PNG를 다시 만들거나 덮어쓰지 마라.
- Nature 구현을 처음부터 다시 작성하지 마라.
- 이미 교정된 길 타일 매핑과 완료된 renderer integration을 되돌리지 마라.
- 전체 시안 PNG를 게임 배경으로 붙이지 마라.
- 과거 환경 아틀라스, 임시 단색 도형 또는 placeholder로 되돌아가지 마라.
- `git reset`, `git checkout`, `git restore`, `git stash`, `git clean`을 실행하지 마라.
- 관련 없는 미커밋 파일이나 미추적 파일을 삭제하거나 정리하지 마라.
- Music, Urban, Animal, Lab 등 다른 마을 파일을 수정하지 마라.
- 기존 Nature의 사운드 선택, AnnotationPanel, 블록 잠금, 캐릭터, HUD, D-pad와 제품 진입 흐름을 시각 조정을 이유로 교체하지 마라.
- 테스트가 통과했다는 이유만으로 실제 브라우저 검수를 생략하지 마라.
- 작업 중간 보고 후 사용자에게 넘기지 말고, 아래 완료 조건이 충족될 때까지 계속 진행한다.

현재 워킹 트리에는 Nature 외의 대규모 미커밋 작업이 공존한다. 변경 전 `git status --short`와 Nature 대상 `git diff`를 읽고, 이번 작업에서는 Nature 관련 파일만 최소 범위로 수정한다.

## 4. 정확한 현재 중단 지점

두 번째 토큰 만료 직전, `lib/natureVillage.js`의 v2 렌더러 통합과 첫 시각 검수는 끝났다. 중단된 지점은 **모바일 세로 화면의 카메라/FOV 대응을 `components/NatureZoneMap.js`에서 수정한 직후**다.

기존 24×18 타일 고정 FOV를 화면 폭 기준으로 축소하던 세로 화면에서, stage의 긴 높이를 사용하지 못해 아래쪽에 큰 빈 영역이 보였다. 이를 해결하기 위해 현재 `NatureZoneMap.js`에는 다음과 유사한 부분 구현이 이미 들어 있을 수 있다.

- `viewW`, `viewH`를 지역 변수로 계산.
- 세로 플레이 화면에서 높이에 맞춰 `zoom`을 구하고, 그 zoom으로 보이는 world width를 다시 계산.
- 모바일 가로 화면에서 폭에 맞춰 `zoom`을 구하고, 보이는 world height를 다시 계산.
- 새 `viewW`, `viewH`로 camera clamp와 canvas transform을 계산.

이 변경은 작성됐지만, 토큰 만료 때문에 변경 이후의 정적 검사, 실제 390×844 렌더링, 회전 후 재계산, 캐릭터와 foreground 정렬, 전체 기능 회귀가 완료됐다고 볼 수 없다.

따라서 첫 행동은 카메라 코드를 다시 작성하는 것이 아니라 다음 순서다.

1. `components/NatureZoneMap.js`의 현재 전체 내용과 diff를 읽는다.
2. 기존 `verification-v2/mobile-portrait-390x844.png`의 생성 시점과 현재 코드가 일치하는지 맹신하지 않는다.
3. 현재 번들로 `/nature-test`를 390×844에서 새로 렌더해 빈 영역이 재현되는지 확인한다.
4. 현재 부분 구현이 이미 문제를 해결했다면 불필요하게 다시 바꾸지 않고 나머지 검증으로 이동한다.
5. 문제나 정렬 오류가 남아 있을 때만 최소 수정한다.

## 5. 반응형 카메라의 합격 기준

카메라 수정이 필요하면 다음 계약을 모두 만족해야 한다.

### 공통 좌표 계약

- base canvas, water/orb/fog 동적 canvas drawing, foreground canvas와 DOM `PixelChar`가 **동일한** `viewW`, `viewH`, `camX`, `camY`, `zoom`, `offsetX`, `offsetY`를 사용한다.
- `PixelChar`의 screen left/top과 scale이 canvas transform과 한 프레임에서도 어긋나지 않아야 한다.
- 나무 수관과 다리 난간 foreground가 캐릭터 움직임 중에도 같은 world 좌표에 고정돼야 한다.
- `viewW`와 `viewH`는 각각 world width와 world height를 초과하지 않게 제한한다.
- camera 최대값은 `Math.max(0, worldSize - viewSize)` 형태로 안전하게 계산해 음수 clamp가 생기지 않게 한다.
- 화면 가장자리에서 맵 바깥색이나 빈 투명 영역이 보이지 않아야 한다.
- `ResizeObserver`와 다음 animation frame에서 새 stage 크기가 일관되게 반영돼야 한다.

### 모바일 세로 390×844

- HUD 아래의 실제 stage 높이를 채운다.
- 과거처럼 화면 아래쪽에 큰 단색 빈 영역을 남기지 않는다.
- 세로로 약 18타일을 유지하면서 폭 방향 world view를 화면 비율에 맞춰 줄이는 현재 접근을 우선 검증한다.
- 캐릭터가 지나치게 커져 HUD나 D-pad와 겹치지 않는다.
- D-pad는 보이면서 눌러 이동할 수 있고, 카메라가 캐릭터를 따라간다.
- 맵 위·아래·좌·우 가장자리 부근에서도 잘못된 camera clamp나 흔들림이 없다.

### 모바일 가로 844×390

- 기존 24타일 폭을 우선 유지하고 stage 높이에 맞는 world height가 표시되는 현재 접근을 우선 검증한다.
- 상하 빈 영역, 맵 밖 노출, 캐릭터/foreground 분리가 없어야 한다.
- D-pad와 HUD가 플레이 영역을 비정상적으로 덮지 않는다.

### 데스크톱 1440×900

- 다른 마을과 맞춘 기존 24×18 타일 FOV 체감을 유지한다.
- 모바일 수정으로 데스크톱 캐릭터 크기, 카메라 속도와 주요 랜드마크 비율이 바뀌지 않는다.
- stage aspect ratio 때문에 남는 공간이 있더라도 맵 배경과 자연스럽게 이어지며, 과거 모바일의 큰 빈 영역처럼 보이지 않아야 한다.

### 디버그 캡처 모드

- `debugOverview`와 `/nature-test?capture=1`은 모바일 플레이 분기를 타지 않고 48×36 전체 world를 정확히 렌더한다.
- `debugStaticArt`에서는 HUD, 캐릭터, orb, fog와 동적 효과가 숨겨진 현재 계약을 유지한다.
- 전체 조감은 정확히 1536×1152 비율이며 자르거나 늘리지 않는다.

화면 너비의 임의 breakpoint를 늘리는 방식보다 stage의 실제 width/height와 aspect ratio로 해결할 수 있으면 그 방식을 우선한다. 다만 현재 부분 구현이 위 기준을 충족하면 구조 개선을 이유로 다시 작성하지 않는다.

## 6. 렌더러 재감사 범위

카메라 검증과 함께 `lib/natureVillage.js`에서 이전 완료 작업이 현재도 유지되는지만 빠르게 감사한다. 전체 렌더러를 다시 구현하지 않는다.

- 존재하지 않는 asset key가 없는지 확인한다.
- `assets.nature`, `assets.bench`, 구형 Nature 환경 atlas 경로가 없는지 확인한다.
- 나무와 사과를 임시 `fillRect`로 덧그리는 코드가 없는지 확인한다.
- `drawStaticLayers`의 base/foreground 호출 계약이 맞는지 확인한다.
- 두 bridge deck은 base, rail은 foreground에 있는지 확인한다.
- 나무 수관, 지붕과 다리 난간의 foreground가 캐릭터 앞뒤 관계를 정상적으로 만든다.
- 길의 교정된 mask→tile/rotation 매핑을 유지한다.
- 14개 v2 런타임 파일 외의 금지된 과거 환경 경로가 다시 생기지 않았는지 검사한다.

브라우저에서 시각 문제가 발견되면 생성 에셋을 바꾸지 말고 source rect, destination rect, 위치, 레이어, 카메라 transform을 먼저 고친다.

## 7. 실제 브라우저 검수 절차

인앱 브라우저 제어 기능을 사용해 실제 페이지를 확인한다. 기존 `localhost:3016/nature-test`가 현재 코드의 서버로 살아 있으면 재사용한다. 서버가 없거나 오래된 번들이면 현재 프로젝트에서 개발 서버를 안전하게 실행하고 실제 포트를 기록한다.

최소 검수 순서:

1. `/nature-test?capture=1` 1536×1152 전체 조감.
2. `/nature-test` 1440×900 데스크톱 플레이.
3. `/nature-test` 390×844 모바일 세로.
4. 같은 브라우저에서 844×390 모바일 가로로 resize 또는 orientation 변경.
5. 다시 390×844로 돌아와 camera와 canvas가 재계산되는지 확인.
6. 물레방앗간, 위쪽 다리, 북동 주택·온실, 서쪽 세 밭, 동쪽 과수원, 아래쪽 다리와 남쪽 입구를 실제 카메라로 확인.

각 화면에서 다음을 확인한다.

- console error와 warning 중 이번 변경과 관련된 오류.
- v2 asset 404.
- canvas `drawImage` source rect 오류.
- 흰 seam, 검은 seam, 투명 halo, 빈 타일.
- 길 끝·곡선·교차점의 방향.
- 캐릭터와 전경 레이어 정렬.
- 세로 화면의 남는 빈 영역.
- D-pad pointer/touch 이동.
- 키보드 이동.
- 카메라가 world edge에서 튀거나 떨리는 문제.

시각 비교는 최종 시안과 현재 전체 조감을 동일한 1536×1152 크기로 놓고 수행한다. 기존 비교 파일을 참고하되, 카메라 또는 렌더러 변경이 실제 조감에 영향을 주었다면 다음 파일을 최신 결과로 갱신한다.

- `nature-v2-overview-1536x1152.png`
- `reference-vs-new.png`
- `reference-new-overlay-50.png`
- `before-reference-after-3col.png`
- `desktop-play-1440x900.png`
- `mobile-portrait-390x844.png`
- `mobile-landscape-844x390.png`

파일을 갱신할 때 현재 결과가 실제 새 캡처임을 확인하고, 과거 이미지를 복사해 통과한 것처럼 만들지 않는다.

## 8. 기능 회귀 검증

시각 검수와 별개로 다음 제품 기능을 실제로 확인한다.

- 정확히 두 개의 다리가 보이고 양방향으로 통과 가능하다.
- 물, 건물, 농지, 나무와 다리 난간 collision을 뚫지 못한다.
- 큰 frame delta에서도 collision 터널링이 재발하지 않는다.
- 서쪽 세 밭, 동쪽 사과 과수원과 네 건물 배치가 유지된다.
- A/B 그룹 각각 82개, 전체 164개 사운드의 중복 없는 결정적 배치가 유지된다.
- 접근 가능한 sound orb를 발견하고 선택할 수 있다.
- 블록 잠금과 수집 완료 표시가 유지된다.
- `월드맵 → Nature → 사운드 선택 → AnnotationPanel → Nature 복귀 → 월드맵 복귀`가 동작한다.
- QA 중 실제 외부 전사 데이터를 제출하지 않는다.
- Escape, 확인 모달, 출구 반경과 남쪽 입구 동작이 유지된다.

필요하면 `/nature-test`의 debug target과 `natureQa` 개발 전용 진입을 활용하되, QA 편의를 제품 프로덕션 UI에 노출하지 않는다.

## 9. 정적 검증과 빌드

코드 변경 후 다음을 실행하고 실패 원인을 해결한다.

1. `node --check lib/natureVillage.js`
2. `node --check components/NatureZoneMap.js`가 ESM/JSX 때문에 직접 적용되지 않으면 억지로 쓰지 말고 ESLint와 Next build로 검사한다.
3. `npm run validate:nature-assets`
4. `npm run test:nature`
5. 수정한 Nature 파일을 대상으로 한 ESLint.
6. `npx next build --webpack`

기본 Turbopack 빌드는 이전에 최적화 단계에서 장시간 무응답이었던 기록이 있다. 현재 다시 시도할 합리적 이유가 있으면 제한 시간을 두고 실행하되, 같은 정지를 반복해서 기다리지 않는다. Webpack production build가 성공하면 그 결과와 Turbopack의 관찰을 구분해 기록한다.

전체 저장소 lint에는 Nature와 무관한 기존 오류가 있을 수 있다. 전체 lint가 실패하면 이번 Nature 대상 파일에 신규 오류가 없는지 분리해 확인하고, 관련 없는 파일을 고치지 않는다.

## 10. 문서 정리

모든 검증이 끝난 뒤에만 다음 문서를 실제 최종 상태로 갱신한다.

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/IMPLEMENTATION.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/ASSET_MANIFEST.md`

현재 문서 상단에 남아 있을 수 있는 “generation in progress”, “물레방앗간만 완료”, “나머지 에셋 생성 대기” 같은 오래된 설명을 제거하고 다음을 정확히 기록한다.

- 9개 생성 묶음과 14개 런타임 에셋 완료.
- v2 renderer integration 완료.
- 길 타일 매핑 교정 완료.
- 반응형 모바일 카메라의 최종 동작과 화면별 검수 결과.
- 최신 verification-v2 파일 목록.
- 기능 테스트, asset validation, 대상 ESLint와 production build 결과.
- 남아 있는 실제 제한 사항이 있다면 숨기지 않고 구체적으로 기록.

완료되지 않은 항목을 완료로 쓰지 않는다.

## 11. 완료 조건과 최종 보고 형식

다음 조건을 모두 만족해야 완료다.

- 현재 부분 구현된 반응형 카메라를 실제 현재 번들에서 검증했다.
- 390×844에서 HUD 아래 stage에 큰 빈 영역이 없다.
- 844×390과 1440×900에서 새로운 레이아웃 회귀가 없다.
- base canvas, foreground canvas와 `PixelChar`가 이동 중 정렬된다.
- 전체 조감이 최종 시안의 배치와 v2 시각 언어를 유지한다.
- collision, 두 다리, 사운드 선택, AnnotationPanel과 복귀 흐름이 동작한다.
- Nature asset validation과 6개 테스트가 통과한다.
- Nature 대상 ESLint가 통과한다.
- Webpack production build가 성공한다.
- IMPLEMENTATION과 ASSET_MANIFEST가 실제 완료 상태와 일치한다.

최종 답변은 다음 순서로 간결하지만 검증 가능하게 작성한다.

1. 카메라와 렌더러에서 실제로 변경한 내용.
2. 데스크톱, 모바일 세로·가로 브라우저 검수 결과.
3. 기능 회귀 검증 결과.
4. 실행한 명령과 통과 여부.
5. 최신 캡처와 핵심 파일의 절대 경로 링크.
6. 남은 실제 위험이나 제한 사항.

검증이 실패하면 “완료”라고 보고하지 않는다. 동일한 장애가 아닌 이상 사용자 확인을 기다리며 멈추지 말고, 현재 워킹 트리에서 원인을 추적해 수정하고 다시 검증한다.

이제 현재 `git status`, Nature 대상 diff, `components/NatureZoneMap.js`의 부분 구현을 읽고, 새 390×844 브라우저 렌더링으로 첫 번째 미검증 지점부터 작업을 재개해줘.
