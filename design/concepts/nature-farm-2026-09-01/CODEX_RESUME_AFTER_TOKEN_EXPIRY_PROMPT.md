너는 토큰 만료로 중단된 SoundVillage Nature v2 시각 복구 작업을 현재 워킹 트리에서 이어받는 Codex다. 과거 대화나 중간 보고를 그대로 믿지 말고 **현재 디스크의 파일·이미지·diff를 단일 진실로 사용**해 첫 번째 미완료 코드부터 계속해줘.

이 작업은 처음부터 다시 시작하는 에셋 생성 작업이 아니다. 토큰이 만료되기 전에 모든 ImageGen 생성과 14개 런타임 에셋 파생은 끝났고, 중단 지점은 `lib/natureVillage.js`의 새 에셋 렌더러 전환 도중이다. 이미 생성된 에셋을 다시 만들거나 기존 변경을 되돌리지 말고, 렌더러 통합·실제 화면 검수·시안 비교·회귀 검증을 완료해줘.

## 1. 프로젝트와 최종 시각 기준

프로젝트:
`/Users/hyera/Documents/SoundVillage-house-decor-2d`

최종 시안:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/02-brookside-bloom-v2.png`

정규화된 맵 비교 기준:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/reference-map-normalized-1536x1152.png`

시각 복구 요구사항:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/CODEX_ART_FIDELITY_CORRECTION_PROMPT.md`

에셋 제작 프롬프트:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/ASSET_PROMPTS.md`

에셋 승인 기록:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/ASSET_MANIFEST.md`

구현 기록:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/IMPLEMENTATION.md`

레이아웃·팔레트 가이드:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmArtGuide.mjs`

작업 전 적용되는 AGENTS.md와 현재 git 상태를 확인해줘. Next.js 코드를 변경하기 전 설치된 `node_modules/next/dist/docs/`의 관련 가이드를 확인하고, 기존 미커밋 변경·미추적 파일을 보존해줘.

## 2. 현재 디스크에서 확인된 완료 상태

현재 상태는 다음과 같다. 시작 시 명령으로 다시 확인하되, 결과가 같다면 완료 작업을 반복하지 마라.

ImageGen 생성 완료:

- 북동 주택.
- 온실.
- 남서 오두막.
- 잔디·길 패밀리.
- 개울·강둑 패밀리.
- 다리 deck·rail 패밀리.
- 일반 나무·숲 나무·사과나무 패밀리.
- 밭·울타리·작물 패밀리.
- 꽃·갈대·돌·소품 패밀리.
- 이전에 생성한 물레방앗간.

현재 14개 런타임 파일이 모두 존재한다:

- `watermill-v2.png`
- `north-cottage-v2.png`
- `greenhouse-v2.png`
- `south-cottage-v2.png`
- `grass-v2.png`
- `path-v2.png`
- `creek-bank-v2.png`
- `bridge-deck-v2.png`
- `bridge-rails-v2.png`
- `trees-v2.png`
- `forest-trees-v2.png`
- `apple-trees-v2.png`
- `farm-v2.png`
- `flowers-props-v2.png`

런타임 폴더:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/`

생성 원본·정리본 폴더:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/`

현재 다음 명령은 통과한다:

- `npm run validate:nature-assets`: 14개 파일 존재, 금지된 과거 경로 0개.
- `npm run test:nature`: 6/6.

위 통과 결과는 에셋 파일과 순수 기능 모델이 준비됐다는 뜻일 뿐, 브라우저 렌더러가 완성됐다는 뜻은 아니다.

## 3. 금지 사항 — 완료된 작업 반복 방지

- 9개의 ImageGen 생성 호출을 다시 실행하지 마라.
- 승인된 생성 원본·clean 파생본·런타임 PNG를 다시 덮어쓰지 마라.
- 새 이미지가 실제 시각 검수에서 명백히 깨졌다는 증거가 생기기 전에는 ImageGen을 다시 호출하지 마라.
- 사용 한도 확인을 위해 불필요한 ImageGen 호출을 하지 마라.
- 이전 에셋 경로로 되돌아가지 마라.
- Nature 구현을 처음부터 새로 작성하지 마라.
- `natureFarmLayout.mjs`, 충돌·사운드 배치·제품 연결을 통째로 revert하지 마라.
- reset, checkout, stash, 관련 없는 파일 삭제를 하지 마라.
- validation 파일 존재 검사를 통과시키기 위한 placeholder를 만들지 마라.
- 시안 전체 PNG를 런타임 배경으로 붙이지 마라.

ImageGen 재호출은 새 에셋을 실제 브라우저에서 확인한 뒤 특정 스프라이트가 손상됐거나 시안과 현저히 다르다는 구체적인 증거가 있을 때만, 그 에셋 하나에 한해 검토한다.

## 4. 실제 중단 지점 — 렌더러 정상화

현재 `lib/natureVillage.js`는 새 `ASSET_PATHS` 등록과 지면·밭·다리 함수 일부가 작성됐지만 전환 도중 멈췄다. 파일 전체를 읽고 아래 불일치를 먼저 해결해줘.

현재 확인된 문제:

1. `drawTree`와 `drawTreeForeground`가 삭제된 `assets.nature`를 참조한다.
2. `drawFlowers`도 삭제된 `assets.nature`를 참조한다.
3. `drawStaticLayers`가 `drawGround(base.ctx, model)`처럼 새 함수에 필요한 `assets`를 넘기지 않는다.
4. `drawFieldGround(base.ctx)`도 `assets`가 빠져 있다.
5. `drawPlot(base.ctx, assets, ...)`여야 하는데 현재 호출과 함수 계약을 다시 확인해야 한다.
6. `drawBridge`는 `assets, bridge, index`를 요구하지만 현재 호출부가 이전 형태일 수 있다.
7. 새 `drawBridgeRail`이 실제 foreground 또는 올바른 y-sort 레이어에 호출되어야 한다.
8. `drawOrchard`는 새 `appleTrees`를 사용해야 하지만 이전 일반 나무와 빨간 fillRect 사과를 남겨두었다.
9. `BENCHES`는 삭제된 `assets.bench`가 아니라 `assets.props`의 새 벤치 source rect를 사용해야 한다.
10. `TREE_CENTERS`는 밝은 `assets.trees`와 가장자리용 `assets.forestTrees`를 위치에 맞게 선택해야 한다.
11. 꽃·갈대·돌·생활 소품은 `assets.props`의 실제 source rect로 렌더링해야 한다.
12. `drawStaticLayers`의 base/foreground 순서가 새 deck·rail, 건물·지붕, 나무 몸통·수관과 일치해야 한다.

위 목록만 부분 수정하고 끝내지 말고 `lib/natureVillage.js` 전체에서 다음을 검색해줘:

- 존재하지 않는 asset key.
- 옛 source rect.
- 옛 atlas 가정.
- 새 함수와 맞지 않는 인자.
- 정의됐지만 호출되지 않는 draw 함수.
- 호출되지만 정의와 계약이 다른 함수.
- 생성된 에셋을 전혀 사용하지 않는 코드.
- 임시 fillRect가 새 에셋을 대신하고 있는 코드.

특히 `assets.nature`, `assets.bench`, 기존 일반 나무 source rect와 사과용 빨간 `fillRect`는 최종 렌더에 남아서는 안 된다.

## 5. 새 아틀라스별 연결 기준

### 잔디와 길

- `grass-v2.png`는 32×32 셀, 8열×2행의 16개 변형이다.
- `path-v2.png`는 32×32 셀, 8열×3행의 17개 유효 변형과 빈 여백 셀이 있을 수 있다.
- 새 잔디·길을 실제 48×36 지형에 렌더한다.
- 길 마스크와 tile mapping을 브라우저에서 확인하고 잘못된 곡선·끝·빈 셀이 나오면 mask→index 매핑만 수정한다.
- path의 중앙을 임의의 16×16 crop으로 확대하는 방식이 결과를 깨뜨리면 올바른 생성 셀을 사용한다.
- 검은 seam, 흰 잔여 픽셀, 빈 타일과 반복되는 경계 오류가 없어야 한다.

### 개울과 강둑

- `creek-bank-v2.png`는 생성 원본 크기를 유지한 source sheet다.
- 현재 코드에 적힌 stream, rock, reed source rect를 실제 PNG와 대조한다.
- source rect가 빈 공간이나 다른 오브젝트를 자르면 실제 connected component와 육안 검수로 수정한다.
- 수면, 얕은 물, 돌 둔치, 잔디 프린지와 갈대가 하나의 강가로 읽혀야 한다.
- 파란 단색 타일과 얇은 갈색 선으로 돌아가지 않는다.
- 강둑 장식과 model.water 충돌 경계가 시각적으로 어긋나지 않게 한다.

### 다리

- `bridge-deck-v2.png`: 288×128 deck 두 개가 세로로 배열된 것으로 기록되어 있다.
- `bridge-rails-v2.png`: 288×54 rail 두 개가 세로로 배열된 것으로 기록되어 있다.
- 두 bridge 모두 9×4 visible box와 9×2 walk lane을 유지한다.
- deck은 정적 base에, 캐릭터 앞에 와야 하는 rail은 foreground/y-sort 레이어에 놓는다.
- rail이 다리 전체를 막거나 캐릭터 머리 위에 부자연스럽게 고정되지 않게 플레이 화면에서 확인한다.

### 나무

- `trees-v2.png`: 112×128 셀의 밝은 나무 6개.
- `forest-trees-v2.png`: 112×128 셀의 어두운 숲 나무 2개.
- `apple-trees-v2.png`: 112×128 셀의 사과나무 3개.
- 기존 32×32 atlas source rect를 사용하지 않는다.
- destination size를 매번 임의로 2.5배 확대하지 말고 112×128 world px 계열을 기준으로 시안·캐릭터 비례를 맞춘다.
- 나무 몸통 충돌과 수관 foreground 분할의 baseY를 일치시킨다.
- 사과는 생성된 sprite 안의 픽셀을 사용하고 빨간 사각형을 덧그리지 않는다.
- 지도 가장자리에는 forestTrees, 내부와 생활 구역에는 trees, 과수원에는 appleTrees를 사용한다.

### 밭·울타리·작물

- `farm-v2.png`의 실제 sheet를 열고 흙, 울타리 가로·세로·모서리·문, 밀·당근·양배추·옥수수의 source rect를 확인한다.
- 현재 임시 source rect를 그대로 신뢰하지 말고 이미지에서 실제 잘린 영역을 확인한다.
- 작물을 32px 셀마다 과밀하게 확대하지 말고 시안의 줄 간격과 크기를 맞춘다.
- 밝은 울타리와 열린 gate가 레이아웃 collision의 gate와 일치해야 한다.
- 기존 어두운 farm atlas나 단색 흙 fillRect를 사용하지 않는다.

### 꽃과 소품

- `flowers-props-v2.png`의 실제 sheet에서 흰·분홍·노랑·보라 꽃 군락, 갈대, 돌, 벤치, 표지판, 통, 상자와 낮은 소품의 source rect를 기록한다.
- 각 꽃은 6–24 world px의 작은 군락으로 표시한다.
- 이전 30×30 단일 꽃 크기를 사용하지 않는다.
- `createNatureFlowerDecor`의 좌표·variant를 새 꽃 rect에 매핑한다.
- BENCHES와 물가 장식도 이 sheet에서 가져온다.
- 길, 다리 landing, 문 앞, 소리 reservation을 가리지 않는다.

### 건물

- 새 watermill, north-cottage, greenhouse, south-cottage를 그대로 사용한다.
- 각 sprite의 실제 알파·trim 영역과 `BUILDINGS`의 target box를 맞춘다.
- 건물 전체를 base와 foreground에 중복으로 그려 겹쳐 보이지 않게 한다.
- foreground에는 지붕·처마 중 캐릭터보다 앞에 와야 하는 영역만 사용한다.
- 문 앞 doorPad와 보이는 문 위치를 일치시킨다.

## 6. 파생 스크립트와 manifest 정리

`scripts/derive_nature_v2_sheets.mjs`는 토큰 만료 전에 만들어진 파생 스크립트다. 먼저 읽고 현재 런타임 PNG를 재현할 수 있는지 확인해줘.

- 원본·clean 파일을 덮어쓰지 않는다.
- 필요하면 파생 스크립트에 누락된 creek, bridge, farm, props 처리 또는 source rect manifest 생성을 추가한다.
- 반복 실행해도 같은 런타임 결과가 나오는지 확인한다.
- 임시 preview나 OS temp 파일을 제품 에셋으로 참조하지 않는다.
- source rect와 runtime cell 규격을 코드와 `ASSET_MANIFEST.md`에 기록한다.
- manifest 상단의 “generation in progress”와 IMPLEMENTATION의 물레방앗간만 완료됐다는 오래된 설명을 실제 현재 상태에 맞게 갱신한다.
- rejected 원본과 정리 전 원본은 감사 기록으로 보존한다.

현재 모든 14개 파일이 존재하므로 파일을 다시 생성하기 전에 checksum·크기·알파를 확인하고, 명백히 잘못된 파생본만 해당 스크립트로 재생성한다.

## 7. 첫 번째 실행 검증

렌더러 호출 계약을 수정한 즉시 다음을 실행해줘:

1. `node --check lib/natureVillage.js`
2. `npm run validate:nature-assets`
3. `npm run test:nature`
4. Nature 대상 ESLint
5. 브라우저에서 `/nature-test?capture=1` 로드
6. 콘솔의 asset 404, drawImage source rect, undefined image와 canvas 예외 확인

현재 validation과 node:test가 이미 통과하더라도 브라우저는 아직 확인되지 않았다. 반드시 실제 canvas가 렌더되는지 확인해줘.

기존 `localhost:3016/nature-test`가 살아 있으면 재사용해도 된다. 프로세스가 없거나 오래된 번들을 보여주면 현재 프로젝트에서 개발 서버를 안전하게 다시 실행하고 실제 URL을 기록한다.

첫 브라우저 화면에서 큰 깨짐이 보이면 전체를 재작성하지 말고 다음 순서로 분리 진단해줘:

1. loadAssets의 모든 이미지 naturalWidth/naturalHeight.
2. drawStaticLayers 호출 인자.
3. atlas cell 크기와 source rect.
4. destination rect와 y축 위치.
5. base/foreground 중복 또는 누락.
6. alpha halo와 잘못된 배경.
7. camera transform과 capture 모드.

## 8. 시각 품질 반복

첫 렌더 성공은 완료가 아니다. 다음 이미지를 동일 비율로 비교해줘:

- 최종 시안:
  `02-brookside-bloom-v2.png`
- 과거 실패 구현:
  `verification/desktop-overview.png`
- 새 동적 요소 없는 렌더:
  `/nature-test?capture=1`에서 캡처.

시안의 HUD 47px을 제외한 맵 영역과 새 1536×1152 world map을 같은 크기로 정규화한다.

다음 산출물을 새로운 verification-v2 또는 명확한 후속 폴더에 저장해줘:

- 새 전체 조감.
- reference vs new 좌우 비교.
- reference/new 50% overlay 또는 차이 비교.
- before/current/after 3열 비교.
- 물레방앗간.
- 위쪽 다리.
- 북동 주택·온실.
- 서쪽 세 밭.
- 동쪽 과수원.
- 아래쪽 다리와 남쪽 입구.
- 데스크톱 실제 플레이.
- 모바일 세로·가로 실제 플레이.

비교 항목:

- 밝은 잔디 변주와 반복 seam.
- 유기적인 모래길 곡선·폭·교차점.
- S자 청록 개울, 돌 둔치, 얕은 물과 갈대.
- 정확히 두 다리의 비율·판자·난간.
- 네 건물의 실루엣·위치·크기.
- 세 밭의 흙·작물·밝은 울타리.
- 둥근 나무와 숲 가장자리 밀도.
- 생성된 사과나무와 벤치.
- 작은 다색 꽃 군락.
- 빈 잔디와 장식 면적의 균형.
- 기존 캐릭터와 환경의 픽셀 굵기.

큰 차이가 있으면 코드의 source rect, 크기, 좌표와 배치부터 수정한다. 생성 에셋 자체가 실제로 잘못된 경우에만 해당 에셋 하나를 재편집하거나 ImageGen 재호출한다.

색상 필터, 기존 atlas fallback, 전체 시안 PNG 배경 붙이기, 단색 Canvas 도형으로 차이를 숨기지 마라.

## 9. 기능·제품 회귀 검증

시각 조정 뒤 다음 기능을 다시 확인해줘:

- 정확히 두 다리와 양방향 통행.
- 스폰 → 두 다리 양쪽 landing → 출구 연결.
- 고립된 walkable 영역 없음.
- 새 건물·나무·밭·울타리·물·난간의 발 기준 충돌.
- 보이는 경계와 collision 차이 약 0.5타일 이내.
- 그룹 A·B 각각 82개, 전체 접근 164개 아이템.
- 고유 ID·좌표, 동일 목록의 결정적 재배치.
- 각 블록 단계의 활성 아이템 도달성.
- 꽃·소품과 아이템 겹침 없음.
- WorldMap → Nature → 소리 선택 → AnnotationPanel → 취소/안전한 완료 → WorldMap 복귀.
- 키보드와 모바일 D-pad.
- 잠금 안개, 완료·퇴장 모달.
- 데스크톱 1440×900.
- 모바일 390×844.
- 모바일 가로 844×390.
- 콘솔 오류, 에셋 404, 카메라 떨림, 흐림과 foreground 가림.

외부 전사 데이터를 제출하거나 운영 DB를 변경하지 마라.

관련 ESLint, `npm run test:nature`, `npm run validate:nature-assets`와 production build를 실행한다. Turbopack이 다시 최적화 단계에서 장시간 무응답이면 이전 기록과 구분해 적절히 중단하고 `npx next build --webpack`으로 검증하되 원래 문제를 숨기지 마라.

## 10. 완료 조건과 보고

다음이 모두 충족돼야 완료다:

- 14개 v2 에셋이 실제 Nature 렌더에서 사용됨.
- 삭제된 asset key와 금지된 기존 경로 0개.
- `lib/natureVillage.js`의 새 함수 계약 불일치 0개.
- 새 나무·사과나무·꽃·벤치·다리 rail이 실제로 보임.
- 단색 임시 길·강둑·다리가 최종 화면에 남지 않음.
- 브라우저 배경 전용 맵이 정상 렌더됨.
- 시안·과거 구현·새 구현의 동일 비율 비교가 존재함.
- 실제 플레이와 모바일 화면이 검수됨.
- asset validation, Nature 테스트, ESLint와 지원되는 production build가 통과함.
- 제품의 소리 탐험·전사 흐름이 유지됨.
- manifest와 IMPLEMENTATION이 실제 완료 상태를 반영함.

최종 보고에는 다음을 포함해줘:

1. 토큰 만료 시점에 완료돼 있던 내용과 이어서 완료한 내용.
2. 실제 수정한 렌더러 함수와 source rect.
3. 사용된 14개 runtime 에셋 목록.
4. asset validation, Nature 테스트, ESLint와 build 결과.
5. 시안·before·after 비교 이미지.
6. 주요 위치와 모바일 캡처.
7. 제품 흐름·충돌·블록별 아이템 검증.
8. 시안과 아직 남은 차이.
9. 로컬 확인 URL.
10. 미검증 항목과 알려진 제한.

현재 워킹 트리에는 관련 없는 다른 작업이 많다. 해당 파일을 정리·삭제하거나 reset, checkout, stash하지 마라. 로컬 코드·에셋 수정과 비파괴 검증은 진행해도 되지만 push, 배포, 운영 DB 변경, 데이터 삭제와 유료 구매는 별도 승인 없이 하지 마라.

이 작업의 첫 행동은 ImageGen 재호출이 아니라, 현재 `lib/natureVillage.js`의 중단된 v2 렌더러 통합을 완성해 실제 브라우저 화면을 띄우는 것이다.
