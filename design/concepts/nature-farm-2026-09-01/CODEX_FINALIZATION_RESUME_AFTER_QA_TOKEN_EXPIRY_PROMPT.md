# SoundVillage Nature v2 최종 마감 재개 프롬프트

너는 토큰 만료로 세 번째 중단된 SoundVillage Nature v2 작업을 현재 워킹 트리에서 이어받는 Codex다. 이 작업은 구현이나 에셋 생성을 다시 시작하는 작업이 아니다. 렌더러, 반응형 카메라, 브라우저 제품 경로 QA와 최신 캡처 생성까지 이미 완료된 상태이며, 마지막 증거 확인, 문서 최신화, 최종 정적 검사와 production build를 마쳐야 한다.

아래 내용을 전부 읽고 따라줘. 중간 상태만 보고하고 멈추지 말고, 명시된 완료 조건을 충족할 때까지 작업을 계속한다. 과거 대화의 표현보다 현재 디스크의 파일, 이미지, `git diff`와 실제 명령 결과를 단일 진실로 사용한다.

## 1. 프로젝트와 기준 자료

프로젝트 루트:

`/Users/hyera/Documents/SoundVillage-house-decor-2d`

최종 ImageGen 시안:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/02-brookside-bloom-v2.png`

정규화된 시안 비교본:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/reference-map-normalized-1536x1152.png`

이전 상세 재개 프롬프트:

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/CODEX_RESUME_AFTER_TOKEN_EXPIRY_PROMPT.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/CODEX_FINAL_RESUME_AFTER_CAMERA_TOKEN_EXPIRY_PROMPT.md`

최종 갱신 대상 문서:

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/IMPLEMENTATION.md`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/ASSET_MANIFEST.md`

핵심 Nature 파일:

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureVillage.js`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/components/NatureZoneMap.js`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmLayout.mjs`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmLayout.test.mjs`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmArtGuide.mjs`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/app/nature-test/page.js`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/scripts/validate_nature_v2_assets.mjs`

제품 QA를 위해 수정된 공유 파일:

- `/Users/hyera/Documents/SoundVillage-house-decor-2d/app/page.js`
- `/Users/hyera/Documents/SoundVillage-house-decor-2d/components/AnnotationPanel.js`

작업을 시작할 때 적용 가능한 `AGENTS.md`를 확인한다. Next.js 또는 React 코드를 추가 수정해야 한다면 설치된 `node_modules/next/dist/docs/`의 관련 문서를 먼저 확인한다. 이미 코드 수정이 필요 없고 문서와 검증만 남았다면 불필요한 재작성은 하지 않는다.

## 2. 현재 디스크에서 확인된 완료 상태

다음은 2026-09-04 마지막 세션에서 완료된 상태다. 시작 시 파일과 이미지가 실제로 존재하는지만 빠르게 확인한다. 결과가 일치하면 완료 작업을 반복하지 않는다.

### 에셋과 렌더러

- 9개 ImageGen 생성 묶음이 완료됐다.
- Nature 전용 런타임 PNG 14개가 `public/assets/world/nature-farm-v2/`에 존재한다.
- 잔디, 길, S자 개울과 강둑, 정확히 두 다리, 일반 나무, 숲 나무, 사과나무, 세 밭, 울타리, 작물, 꽃, 갈대, 돌, 벤치와 생활 소품이 v2 에셋으로 연결됐다.
- 물레방앗간, 북동 주택, 온실과 남서 오두막이 v2 에셋으로 연결됐다.
- `assets.nature`, `assets.bench`와 금지된 구형 Nature 환경 경로 검색 결과는 0건이었다.
- 길 mask→tile/rotation 매핑은 실제 `path-v2.png` 셀과 대조해 교정됐다.
- base canvas, foreground canvas, 다리 난간, 나무 수관과 `PixelChar` 레이어 통합이 완료됐다.

### 반응형 카메라와 브라우저 검수

- 1440×900 데스크톱 플레이를 검수했다.
- 390×844 모바일 세로에서 HUD 아래 stage를 채우고 과거의 큰 빈 영역이 사라진 상태를 검수했다.
- 844×390 모바일 가로를 검수했다.
- 모바일 실제 제품 화면에서 HUD, D-pad, 카메라와 사운드 상호작용 UI를 확인했다.
- `/nature-test?capture=1` 전체 조감과 주요 랜드마크 화면을 최신 코드로 다시 캡처했다.
- `월드맵 → Nature → 사운드 선택 → AnnotationPanel` 제품 경로를 실제 외부 데이터 저장 없이 검수하기 위한 개발 전용 `?natureQa=1` 흐름과 `dryRun`이 추가됐다.
- 전사 패널이 열린 제품 경로 캡처도 생성됐다.

### 최신 검증 이미지

다음 파일은 모두 2026-09-04 22:01~22:09에 새로 생성됐다.

폴더:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/verification-v2/`

핵심 파일:

- `nature-v2-overview-1536x1152.png`
- `reference-vs-new.png`
- `reference-new-overlay-50.png`
- `before-reference-after-3col.png`
- `desktop-play-1440x900.png`
- `mobile-portrait-390x844.png`
- `mobile-landscape-844x390.png`
- `mobile-product-portrait-390x844.png`
- `mobile-product-landscape-844x390.png`
- `product-annotation-dry-run.png`
- `watermill-play.png`
- `upper-bridge-play.png`
- `northeast-house-greenhouse-play.png`
- `west-fields-play.png`
- `orchard-play.png`
- `lower-bridge-entrance-play.png`
- `desktop-location-contact-sheet.png`

마지막 실행 명령은 위 여섯 랜드마크 이미지를 조합해 `desktop-location-contact-sheet.png`를 만드는 ImageMagick montage였고 성공했다. 이 contact sheet가 마지막 토큰 만료 직전에 완성된 산출물이다.

## 3. 정확한 현재 중단 지점

중단 시점에는 코드 정적 검사와 브라우저 캡처 재생성이 끝났고, 다음 작업이 남아 있었다.

1. 최신 contact sheet와 비교 이미지가 열리고 깨지지 않았는지 마지막으로 확인.
2. 개발 전용 `?natureQa=1`과 `AnnotationPanel dryRun`이 외부 쓰기를 확실히 차단하고 프로덕션 동작을 바꾸지 않는지 코드 차원에서 최종 감사.
3. 오래된 `IMPLEMENTATION.md`를 실제 완료 상태로 갱신.
4. 오래된 `ASSET_MANIFEST.md`의 “generation in progress”, “validation intentionally failing”, “pending calls” 설명을 실제 완료 상태로 갱신.
5. 최종 Nature 대상 ESLint와 자동 테스트 재실행.
6. `npx next build --webpack` production build 실행 및 결과 기록.
7. 완료 보고.

현재 `IMPLEMENTATION.md`는 여전히 “Visual recovery is in progress”, “물레방앗간만 승인됨”, “나머지 에셋 대기”라고 적혀 있다. 현재 `ASSET_MANIFEST.md`도 상단에 “generation in progress”, 하단에 validation이 의도적으로 실패한다고 적혀 있다. 두 설명은 실제 디스크와 모순되므로 반드시 수정해야 한다.

## 4. 반복하거나 되돌리면 안 되는 작업

- ImageGen을 다시 호출하지 마라.
- 9개 생성 원본 또는 14개 런타임 에셋을 다시 생성하거나 덮어쓰지 마라.
- 최신 verification-v2 이미지를 처음부터 다시 캡처하지 마라. 파일이 손상됐거나 현재 코드와 불일치한다는 구체적인 증거가 있을 때만 해당 이미지 하나를 다시 만든다.
- montage를 다시 만들 필요가 없다. 현재 파일이 열리지 않거나 입력 파일과 불일치할 때만 다시 만든다.
- Nature renderer나 반응형 카메라를 다시 작성하지 마라.
- 길 타일 매핑을 이전 상태로 되돌리지 마라.
- 전체 시안 PNG를 런타임 배경으로 사용하지 마라.
- 구형 atlas, placeholder 또는 단색 Canvas 도형으로 되돌아가지 마라.
- `git reset`, `git checkout`, `git restore`, `git stash`, `git clean`을 실행하지 마라.
- 관련 없는 미커밋 변경이나 미추적 파일을 삭제하지 마라.
- Music, Urban, Animal, Lab 작업을 정리하거나 수정하지 마라.
- 전체 저장소 lint의 기존 오류를 이번 작업 범위로 끌어와 수정하지 마라.
- 이미 완료된 브라우저 QA를 형식적으로 전부 반복하며 토큰을 소모하지 마라.
- 문서만 수정한 뒤 build와 최종 검증을 생략하지 마라.

현재 워킹 트리에는 여러 마을의 대규모 미커밋 작업이 함께 존재한다. 특히 `app/page.js`와 `components/AnnotationPanel.js`에는 Nature QA 외의 변경도 섞여 있을 수 있다. 파일 전체를 과거 버전으로 덮어쓰지 말고 현재 diff를 보존한다.

## 5. 첫 번째 작업: 증거 파일과 현재 diff 확인

시작 즉시 다음을 수행한다.

1. `git status --short`를 확인한다.
2. Nature 관련 파일과 `app/page.js`, `components/AnnotationPanel.js`의 현재 diff를 읽는다.
3. verification-v2 파일 목록, 크기와 수정 시각을 확인한다.
4. 최소한 다음 이미지를 직접 열어 육안으로 확인한다.
   - `desktop-location-contact-sheet.png`
   - `nature-v2-overview-1536x1152.png`
   - `mobile-product-portrait-390x844.png`
   - `mobile-product-landscape-844x390.png`
   - `product-annotation-dry-run.png`
   - `reference-vs-new.png`
5. 이미지가 정상이고 최신 코드 결과라는 증거가 일치하면 캡처 단계는 완료로 간주한다.

확인할 시각 항목:

- contact sheet에 물레방앗간, 위 다리, 북동 주택·온실, 서쪽 세 밭, 과수원, 아래 다리·남쪽 입구가 모두 포함된다.
- 모바일 세로 stage 아래에 큰 단색 빈 영역이 없다.
- 모바일 가로에서 맵 밖 투명 영역이나 상하 빈 띠가 없다.
- 캐릭터, 나무 수관과 다리 난간의 위치가 어긋나지 않는다.
- 제품 캡처에 실제 Nature HUD, 사운드 상호작용과 AnnotationPanel이 나타난다.
- 전체 조감이 1536×1152이고 시안 비교 이미지가 열리며 깨지지 않았다.

문제가 없다면 브라우저 서버를 다시 띄우지 않고 다음 단계로 진행해도 된다. 불일치나 손상이 발견됐을 때만 현재 프로젝트의 개발 서버를 실행해 해당 장면을 재검증한다.

## 6. 개발 전용 Nature 제품 QA 경로 감사

제품 루트는 실제 참여자 ID 입력 시 출석, 진행도, 화폐, 장비와 전사 API를 호출할 수 있다. 그래서 기존 세션에서 개발 전용 `/?natureQa=1` 경로를 추가했다. 이 코드는 실제 사용자 데이터에 영향을 주지 않으면서 제품 흐름을 확인하기 위한 것이다.

현재 구현에서 다음을 확인한다.

- `natureQa`는 `process.env.NODE_ENV === 'development'`일 때만 활성화된다.
- QA 모드가 아니면 기존 시작 화면과 참여자 흐름은 변하지 않는다.
- QA 모드에서는 로컬 전용 participant ID와 A 그룹을 설정하고 월드맵을 연다.
- QA 모드의 zone 진입은 진행도 조회 API를 호출하지 않고 Nature 소리를 로컬 metadata에서 구성한다.
- 출석 체크인, count/progress 조회, 화폐와 장비 조회가 QA 모드에서 실행되지 않는다.
- AnnotationPanel의 `dryRun`은 다음 외부 쓰기를 모두 건너뛴다.
  - `saveAnnotation`
  - `awardAnnotationCurrency`
  - `recordAnnotationQuestProgress`
  - skip 시 `saveAnnotation`
- `dryRun`이어도 `onSubmit` 또는 닫기 callback은 호출되어 `AnnotationPanel → Nature 복귀` UI 흐름을 확인할 수 있다.
- 일반 프로덕션 사용자는 `dryRun=false` 기본값을 사용하므로 실제 저장 흐름이 유지된다.
- QA 버튼이나 자동 진입은 production build에서 활성화되지 않는다.
- QA 중 실제 Supabase/외부 전사 데이터가 제출되지 않았다는 기존 조건을 유지한다.

소스 감사에서 누락된 외부 호출이 보이면 QA 분기 안에서만 최소 수정한다. 프로덕션 API 경로를 삭제하거나 전역 mock으로 바꾸지 않는다. 코드가 이미 위 계약을 충족하면 리팩터링하지 않는다.

`components/AnnotationPanel.js`의 deterministic waveform와 segment state 관련 변경은 현재 공유 작업의 일부다. Nature 마감이라는 이유로 삭제하거나 과거 `Math.random()` 구현으로 되돌리지 않는다.

## 7. IMPLEMENTATION.md 갱신 기준

`IMPLEMENTATION.md`를 현재 구현의 최종 기록으로 수정한다. 기존의 유효한 레이아웃, collision과 provenance 정보는 유지하고 오래된 진행 상태만 정확히 교체한다.

최소 포함 내용:

### 상태

- Nature v2 시각 복구와 제품 연결이 완료됐다고 기록한다. 단, 이후 build가 실패하면 완료라고 쓰지 말고 먼저 해결한다.
- 9개 ImageGen 생성 묶음과 14개 런타임 에셋이 모두 완료됐음을 기록한다.
- 구형 환경 atlas 의존과 임시 Canvas 도형을 제거했음을 기록한다.

### 실제 구현

- 48×36, 32px logical tile world.
- S자 개울과 정확히 두 개의 9×4 visible bridge, 9×2 통행 lane.
- 서쪽 세 밭, 동쪽 사과 과수원, 물레방앗간·주택·온실·오두막.
- v2 tree/forest/apple, farm, flower/props, grass/path/creek/bridge atlas 사용.
- base/foreground 분리와 캐릭터 occlusion.
- 모바일 세로·가로 반응형 카메라와 데스크톱 FOV 보존.

### 게임 기능

- A/B 각각 82개, 전체 164개 중복 없는 결정적 sound placement.
- 충돌, swept movement, 다리 통행과 reachability.
- 기존 캐릭터, HUD, D-pad, block lock, sound selection과 AnnotationPanel 흐름 유지.
- 개발 전용 `?natureQa=1`과 `dryRun`의 목적, production 비활성 조건과 외부 저장 차단.

### 검증 자료

- verification-v2의 최신 전체 조감, 비교, 데스크톱, 모바일, 제품 경로, 랜드마크와 contact sheet를 기록한다.
- 마지막 실제 실행 결과를 기준으로 asset validation, 6개 Nature 테스트, 대상 ESLint와 Webpack build 결과를 기록한다.
- 과거 Turbopack 정지 기록은 Webpack 성공과 구분해 남긴다. 이번 세션에서 다시 실행하지 않았다면 다시 성공/실패했다고 쓰지 않는다.
- 전체 저장소 lint에 기존 문제가 있다면 Nature 대상 결과와 구분한다.

더 이상 “물레방앗간만 완료”, “나머지 에셋 대기”, “visual recovery in progress” 또는 현재와 모순되는 completion gate가 남지 않게 한다.

## 8. ASSET_MANIFEST.md 갱신 기준

`ASSET_MANIFEST.md`의 생성 provenance와 개별 에셋 표는 보존한다. 다음 오래된 상태 문구를 실제 완료 상태로 바꾼다.

- `Status: generation in progress` → 생성과 runtime integration 완료 상태.
- “Nothing in this folder is consumed until accepted”는 과거 acceptance 규칙이었다고 명확히 하거나, 현재 모든 표 항목이 accepted/wired 상태임을 반영한다.
- `pending call`과 `as generation resumes` 표현을 과거 생성 계약/기록으로 바꾼다.
- `npm run validate:nature-assets is intentionally failing`을 제거하고, 현재 gate가 14개 파일과 금지 경로를 검사하며 통과한다는 마지막 실제 결과로 교체한다.
- 모든 14개 런타임 파일 이름을 유지한다.
- 원본, cleanup, rejected bridge와 비파괴 파생 기록을 삭제하지 않는다.
- 전체 시안과 정규화된 비교 이미지는 runtime background가 아니라 시각 비교 전용이라는 설명을 유지한다.
- ImageGen 사용 한도 이후 생성이 재개돼 9개 호출이 완료됐다는 이력을 유지한다.

manifest에 새로운 생성이나 재생성을 했다고 쓰지 않는다. 이번 세션에서는 ImageGen을 호출하지 않는다.

## 9. 최종 자동 검증

문서 갱신 전 또는 직후 현재 코드 기준으로 다음을 실행한다. 이전 세션에서 통과했다는 로그는 참고 자료일 뿐, 최종 보고에는 이번 세션의 실제 결과를 사용한다.

1. `node --check lib/natureVillage.js`
2. `npm run validate:nature-assets`
3. `npm run test:nature`
4. 수정 범위 대상 ESLint:
   - `app/page.js`
   - `app/nature-test/page.js`
   - `components/NatureZoneMap.js`
   - `components/AnnotationPanel.js`
   - `lib/natureVillage.js`
   - `lib/natureFarmLayout.mjs`
   - `lib/natureFarmLayout.test.mjs`
   - `lib/natureFarmArtGuide.mjs`
   - `scripts/validate_nature_v2_assets.mjs`
5. `npx next build --webpack`

JSX 파일에 `node --check`를 억지로 적용하지 않는다. ESLint와 Next build로 검사한다.

검증 실패 시:

- 이번 Nature 변경에서 발생한 실패면 원인을 수정하고 다시 실행한다.
- 전체 저장소의 다른 마을 WIP 때문에 발생한 실패면 정확한 파일과 원인을 분리해 기록하고 관련 없는 코드를 되돌리지 않는다.
- build가 `.next` 또는 병렬 개발 서버와 충돌하면 실행 중인 프로세스와 build directory를 확인하고 안전하게 분리한다. 기존 작업 파일을 삭제하는 방식으로 해결하지 않는다.
- 기본 `npm run build`의 Turbopack이 과거 최적화 단계에서 장시간 정지한 기록이 있다. 같은 정지를 무기한 반복하지 않는다. 요구되는 최종 기준은 `npx next build --webpack` 성공이다.
- build 출력의 실제 route 개수와 경고를 기록한다. 과거의 25개 route 숫자를 현재 결과인 것처럼 복사하지 않는다.

## 10. 브라우저 재검증이 필요한 조건

최신 캡처와 코드가 정상이라면 전체 브라우저 QA를 반복하지 않는다. 다음 중 하나가 생겼을 때만 관련 장면을 다시 연다.

- final lint/build 수정을 위해 UI 코드가 변경됨.
- Nature 카메라, renderer, layout 또는 product QA 분기를 수정함.
- 캡처 파일이 열리지 않거나 깨짐.
- `?natureQa=1`의 외부 쓰기 차단에 누락이 발견됨.
- build 후 development-only 조건이 의심스러움.

재검증이 필요하면 기존 `localhost:3016` 서버가 현재 코드로 살아 있는지 먼저 확인한다. 죽어 있으면 현재 프로젝트에서 QA용 개발 서버를 다시 실행한다. 외부 전사 데이터를 제출하지 않는다.

## 11. 최종 완료 조건

다음을 모두 충족해야 Nature v2 마감 완료다.

- 최신 전체 조감, 비교 이미지, 모바일 제품 화면, AnnotationPanel dry-run과 랜드마크 contact sheet를 직접 확인했다.
- ImageGen 또는 에셋 재생성을 하지 않았다.
- 개발 전용 QA 경로가 외부 조회·저장·보상 호출을 건너뛰고 production에서는 활성화되지 않는다.
- `IMPLEMENTATION.md`가 실제 완료된 renderer, 카메라, 제품 연결과 검증 결과를 설명한다.
- `ASSET_MANIFEST.md`가 9개 생성 묶음과 14개 accepted runtime asset의 완료 상태를 설명한다.
- `npm run validate:nature-assets`가 통과한다.
- `npm run test:nature`가 6/6 통과한다.
- Nature 및 QA 공유 파일 대상 ESLint가 통과한다.
- `npx next build --webpack`가 성공한다.
- 관련 없는 워킹 트리 변경을 손대지 않았다.

## 12. 최종 답변 형식

최종 답변은 다음 내용을 짧고 검증 가능하게 작성한다.

1. 이번 재개 세션에서 실제 마무리한 항목.
2. 기존 완료 상태로 확인하고 반복하지 않은 항목.
3. asset validation, Nature test, 대상 ESLint와 Webpack production build의 실제 결과.
4. QA dry-run의 외부 데이터 보호와 production 비활성 확인 결과.
5. 갱신한 `IMPLEMENTATION.md`, `ASSET_MANIFEST.md`, 최신 overview와 contact sheet의 절대 경로 링크.
6. 남은 실제 제한 사항이 있을 경우에만 구체적으로 기록.

검증이 실패한 상태에서 완료라고 보고하지 않는다. 단순히 토큰을 아끼기 위해 문서나 build를 생략하지 않는다. 동일 장애가 아닌 이상 사용자 응답을 기다리며 멈추지 말고 원인을 수정한 뒤 검증을 마친다.

이제 현재 `git status`, 관련 diff와 최신 verification-v2 이미지부터 확인하고, **이미 끝난 캡처 작업은 반복하지 않은 채 개발 전용 QA 경로 감사 → 두 문서 갱신 → 최종 자동 검증 → Webpack production build → 완료 보고** 순서로 이어서 마무리해줘.
