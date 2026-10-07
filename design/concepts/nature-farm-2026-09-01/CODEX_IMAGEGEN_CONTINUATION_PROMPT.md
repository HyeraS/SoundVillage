너는 이전 Nature 시각 품질 복구 작업을 이어받은 Codex다. 현재 작업을 처음부터 다시 시작하지 말고, 워킹 트리에 남아 있는 진행 상태를 정확히 읽은 뒤 **중단된 ImageGen 에셋 제작부터 재개하여 최종 시안과 같은 ‘꽃피는 개울 농장’으로 완성**해줘.

이전 작업은 ImageGen 사용 한도 때문에 물레방앗간 1개만 새로 제작한 상태에서 멈췄다. 좌표·충돌·테스트 일부가 개선되었다고 해서 완료된 것이 아니다. 사용자가 요청한 핵심은 건물, 울타리, 나무, 밭, 길, 다리, 강가와 꽃을 최종 시안에서 파생된 하나의 새 에셋군으로 교체하는 것이다.

계획이나 현황 설명만 하고 끝내지 말고, ImageGen 사용이 가능하면 남은 생성·검수·런타임 연결·기존 참조 제거·시각 비교까지 계속 진행해줘.

## 1. 작업 위치와 현재 상태

프로젝트:
`/Users/hyera/Documents/SoundVillage-house-decor-2d`

최종 시각 기준:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/02-brookside-bloom-v2.png`

이전 시각 복구 요청서:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/CODEX_ART_FIDELITY_CORRECTION_PROMPT.md`

현재 구현 기록:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/IMPLEMENTATION.md`

현재 에셋 상태:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/ASSET_MANIFEST.md`

준비된 ImageGen 프롬프트:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/ASSET_PROMPTS.md`

시안 정규화 비교 이미지:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/design/concepts/nature-farm-2026-09-01/generated-source-v2/reference-map-normalized-1536x1152.png`

랜드마크·팔레트 기준:
`/Users/hyera/Documents/SoundVillage-house-decor-2d/lib/natureFarmArtGuide.mjs`

현재 확인된 상태:

- v2 물레방앗간만 생성·알파 정리·런타임 연결됨.
- 다음 9개 ImageGen 생성 작업이 아직 남아 있음:
  1. 북동쪽 주택.
  2. 온실.
  3. 남서쪽 오두막.
  4. 잔디·유기적인 길 패밀리.
  5. 개울·강둑 패밀리.
  6. 다리 deck·rail 패밀리.
  7. 일반 나무·숲 나무·사과나무 패밀리.
  8. 밭 흙·울타리·작물 패밀리.
  9. 꽃·갈대·돌·낮은 농장 소품 패밀리.
- 위 생성 결과에서 파생될 런타임 파일 13개가 아직 없음.
- `lib/natureVillage.js`에는 금지된 기존 환경 에셋 경로 7개가 아직 남아 있음.
- `npm run validate:nature-assets`는 이 상태에서 실패하는 것이 정상이며, 모든 교체가 끝난 뒤 반드시 통과해야 함.
- 좌표, 두 다리, 충돌, A/B·전체 사운드 배치와 제품 연결을 위한 기능 코드는 이미 작성되어 있으므로 보존해야 함.

먼저 `git status`, 관련 diff, 위 문서와 파일을 모두 확인해줘. 기존 미커밋 변경이나 생성물을 reset, checkout, stash, 삭제로 되돌리지 마라.

## 2. 이번 작업의 최우선 목표

이번 작업의 성공 기준은 테스트 통과만이 아니다. 아래 두 조건을 동시에 만족해야 한다.

1. 기존 Nature 제품 기능이 모두 유지된다.
2. 동적 요소를 숨긴 맵 배경이 최종 ImageGen 시안과 같은 장소로 명확히 인식된다.

현재 화면에 남아 있는 다음 표현은 최종 결과로 인정하지 않는다:

- 단색에 가까운 연두색 Canvas 잔디.
- 큰 사각 도장을 연결한 모래길.
- 직선 파란 띠와 얇은 갈색 선으로 만든 강과 둔치.
- 단색 사각형과 선으로 그린 다리.
- 기존 Nature atlas에서 가져온 작은 나무.
- 캐릭터에 가까운 크기의 기존 꽃 한 송이.
- 기존 farm atlas의 어두운 울타리·밭·작물.
- 기존 house_cream, house_cabin과 greenhouse 에셋.
- 물레방앗간만 새 에셋이고 나머지는 과거 에셋인 혼합 스타일.

밝기 필터, hue-rotate, 전체 화면 색상 오버레이 또는 기존 에셋의 단순 확대·재색칠만으로 문제를 해결하지 마라. 최종 시안을 참조해 새로 생성한 Nature 전용 에셋이 실제 렌더에 사용되어야 한다.

## 3. ImageGen 재개 방법

imagegen 스킬을 다시 읽고 내장 ImageGen 도구를 사용해줘. 최종 시안 이미지를 모든 호출의 실제 이미지 참조로 전달한다.

준비된 `ASSET_PROMPTS.md`에는 9개 생성 작업의 독립 프롬프트가 이미 있다. 새로운 일반 농장 프롬프트로 교체하지 말고 해당 프롬프트를 기본으로 사용하되, 실제 결과를 본 뒤 한 번에 하나의 문제만 수정해 반복해줘.

진행 순서:

1. ImageGen 사용 가능 여부를 한 번 확인한다.
2. 사용 가능하면 북동 주택부터 9개 작업을 순서대로 진행한다.
3. 각 호출 직후 결과를 원본 해상도로 직접 열어 검수한다.
4. 시안과 다른 결과는 즉시 채택하지 않고 구체적인 한 가지 수정으로 재생성 또는 편집한다.
5. 승인된 생성 원본은 `generated-source-v2/`에 원형 그대로 보존한다.
6. 투명도·여백·픽셀 배율을 정리한 파생본은 별도 파일로 만든다.
7. 실제 게임용 파일만 `public/assets/world/nature-farm-v2/`에 저장한다.
8. 원본, 정리본, 런타임 파생본, 사용 프롬프트와 처리 과정을 `ASSET_MANIFEST.md`에 즉시 기록한다.

서로 다른 건물과 에셋 패밀리는 각각 별도 ImageGen 호출로 생성한다. 한 장의 거대한 전체 에셋 콜라주로 한 번에 대체하지 마라.

ImageGen 결과 검수 기준:

- 최종 시안과 동일한 밝은 봄 팔레트.
- 같은 굵기의 선명한 사각 픽셀 덩어리.
- 2D 탑다운 3/4 RPG 시점.
- 좌상단 광원과 짧은 우하단 접촉 그림자.
- 건물의 실제 투명 배경.
- 타일·소품 사이의 일관된 픽셀 밀도.
- 기존 캐릭터 대비 맞는 크기.
- 흰색 또는 체크무늬 배경이 픽셀에 구워져 있지 않음.
- 3D, 아이소메트릭, 회화적 흐림, 안티앨리어싱, 텍스트, HUD, 캐릭터와 소리 구슬 없음.

생성 원본에 체크무늬나 흰 배경이 구워진 경우 원본을 덮어쓰지 마라. 물레방앗간에서 사용한 것처럼 원본을 보존하고 경계 연결 픽셀만 투명 처리한 별도 정리본을 만들어 검수해줘. 피사체 내부의 크림 벽이나 유리 하이라이트까지 제거하지 않게 실제 알파 결과를 확인한다.

리사이즈는 nearest-neighbor와 정수 배율을 우선한다. 비정수 축소 때문에 픽셀이 흐려지면 생성 원본을 재구성하거나 크기를 다시 맞춰야 한다. bilinear·bicubic 결과를 pixelated CSS로 감춰 완료 처리하지 마라.

ImageGen이 여전히 사용 한도를 반환하면:

- 같은 호출을 반복해 시간과 한도를 소모하지 마라.
- CLI/API 또는 다른 유료 모델로 임의 전환하지 마라.
- 기존 에셋을 fallback으로 승인하지 마라.
- 현재 생성되지 않은 에셋을 생성된 것처럼 만들지 마라.
- 안전하게 할 수 있는 문서·좌표·파생 처리 준비까지만 수행하고, 정확히 어느 호출에서 막혔는지 보고한 뒤 미완료 상태를 유지한다.
- 한도가 해제된 다음 이어갈 수 있도록 manifest의 해당 항목과 다음 실행 프롬프트를 정확히 남긴다.

사용 가능한 상태라면 중간 보고 후 멈추지 말고 9개 생성 작업을 끝까지 진행해줘.

## 4. 생성 후 필요한 14개 런타임 파일

최종적으로 다음 파일이 모두 존재하고 실제 Nature 렌더러에서 사용되어야 한다:

`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/watermill-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/north-cottage-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/greenhouse-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/south-cottage-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/grass-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/path-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/creek-bank-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/bridge-deck-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/bridge-rails-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/trees-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/forest-trees-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/apple-trees-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/farm-v2.png`
`/Users/hyera/Documents/SoundVillage-house-decor-2d/public/assets/world/nature-farm-v2/flowers-props-v2.png`

한 ImageGen 원본에서 여러 런타임 파일을 파생할 수 있는 경우에도 원본과 각 파생 영역의 좌표·크기·처리 방식을 manifest에 기록한다.

빈 투명 PNG, 복사한 기존 에셋, 단색 placeholder 또는 파일 존재 검사만 통과시키기 위한 가짜 파일을 만들지 마라. `validate:nature-assets` 통과만을 목적으로 내용 없는 파일을 생성하는 것은 금지한다.

## 5. 기존 환경 참조 완전 제거와 렌더러 교체

모든 새 런타임 에셋이 승인된 뒤 `lib/natureVillage.js`에서 아래 7개 기존 경로를 제거해줘:

`/assets/world/nature_village_map/nature.png`
`/assets/world/terrain.png`
`/assets/world/farm_items.png`
`/assets/world/nature_village/house_cream.png`
`/assets/world/nature_village/house_cabin.png`
`/assets/world/greenhouse.png`
`/assets/world/nature_village/bench.png`

다른 마을이 사용하는 원본 파일은 삭제하거나 덮어쓰지 않는다. Nature v2 렌더러의 `ASSET_PATHS`와 draw 함수만 새 파일로 전환한다.

교체 대상:

- `drawGround`: grass-v2, path-v2와 creek-bank-v2의 타일·경계 표현 사용.
- 현재 단색 fillRect 잔디와 길은 최종 지형에서 제거.
- 현재 얇은 사각 강둑은 creek-bank-v2의 돌, 잔디 프린지와 얕은 물 경계로 교체.
- `drawPlot`: farm-v2의 흙두둑, 밝은 울타리와 작물 사용.
- `drawBridge`: bridge-deck-v2와 bridge-rails-v2로 분리.
- `drawTree`, `drawTreeForeground`: trees-v2, forest-trees-v2 사용.
- `drawOrchard`: apple-trees-v2를 사용하고 빨간 사각형을 나무 위에 덧그리는 현재 방식 제거.
- `drawFlowers`: flowers-props-v2의 작은 군락 사용.
- 건물 로딩: watermill, north-cottage, greenhouse, south-cottage 모두 v2 전용 파일 사용.
- 벤치, 표지판, 통, 상자, 갈대와 강돌도 flowers-props-v2 또는 해당 v2 파생본 사용.

길, 강과 들판을 새 이미지 한 장으로 통째로 배경에 붙이지 마라. 48×36 타일 좌표, 충돌과 카메라를 유지할 수 있는 타일·오브젝트 렌더링이어야 한다.

새 스프라이트의 실제 크기에 맞춰 draw 좌표, source rect, destination rect와 foreground 분할을 조정한다. 스프라이트를 기존 source rect에 억지로 끼워 넣지 마라.

지붕과 수관은 캐릭터 발의 baseY를 기준으로 자연스럽게 앞뒤 가림이 적용되어야 한다. 캐릭터가 건물 앞에 있는데 지붕 전체에 덮이거나, 수관 뒤에서 소리 구슬이 완전히 사라지면 안 된다.

## 6. 공간 구성과 시안 일치

현재 `natureFarmArtGuide.mjs`와 조정된 `natureFarmLayout.mjs`를 활용하되, 새 에셋을 연결한 뒤 최종 시안과 실제 조감 화면을 다시 비교해 좌표와 크기를 미세 조정해줘.

유지할 핵심:

- 48×36타일, 1536×1152 world px.
- 북쪽 중앙에서 남동쪽으로 흐르는 S자 청록 개울.
- 정확히 두 개의 목교.
- 위쪽 다리 9×4 외형, 9×2 실제 통행 구역.
- 아래쪽 다리 9×4 외형, 9×2 실제 통행 구역.
- 북서 물레방앗간.
- 북동 주택과 온실.
- 남서 오두막.
- 서쪽의 밀·채소·옥수수 밭.
- 동쪽의 6그루 사과 과수원과 벤치.
- 밝은 숲 테두리와 남쪽의 열린 입구.
- 밝은 잔디, 따뜻한 모래길과 작은 다색 꽃 군락.

현재 좌표가 기능 테스트를 통과해도 시안과 시각적으로 다르면 조정한다. 다만 충돌, 스폰, 출구, doorPad, 다리 landing과 사운드 후보를 함께 갱신해야 한다.

시안과 비교할 때:

- 물레방앗간·주택·온실·오두막의 중심 위치는 정규화 기준에서 약 1타일 이내.
- 보이는 건물 크기는 시안 기준 약 10–15% 이내.
- 밭과 과수원의 면적·세로가로 비율을 시안과 맞춤.
- 길 폭은 2–3타일로 보이며 교차점이 거대한 직사각형 광장처럼 퍼지지 않음.
- 개울은 일정 폭의 파란 계단식 띠가 아니라 굽이·돌·갈대·잔디 프린지가 있는 자연스러운 강가로 보임.
- 꽃은 한 송이 큰 오브젝트가 아니라 작은 군락으로 보임.
- 숲은 동일한 작은 나무를 일정 간격으로 놓은 경계가 아니라 크기·명암·간격 변주가 있는 풍성한 가장자리로 보임.
- 새 에셋끼리 픽셀 굵기와 광원 방향이 통일됨.

## 7. 기능 보존

다음 이미 검증된 기능은 유지해줘:

- WorldMap → Nature 제품 진입.
- Nature 테스트 경로와 배경 전용 `?capture=1` 모드.
- 기존 PixelChar, HUD, D-pad와 카메라.
- `sounds`, `onCollectSound`, `onExit`, `collectedIds`, `isAnnotating`, `blockNum`, `blockTotal` 계약.
- 그룹 A·B 각각 82개, 전체 접근 164개의 누락·중복 없는 결정적 배치.
- sound_id, group, block과 단계별 잠금 의미.
- 소리 선택 → AnnotationPanel → 취소·완료 → WorldMap 복귀.
- 스폰·출구 분리.
- 두 다리와 모든 통행 영역의 연결.
- 물·건물·밭·나무줄기·울타리·다리 난간 충돌.
- 큰 dt 이동의 터널링 방지와 막힌 축 sliding.

에셋 크기와 좌표가 바뀌면 보이는 경계에 맞춰 충돌·doorPad·decor reservation·item reservation을 갱신한다. 테스트를 통과시키려고 옛 충돌 위치를 남기지 마라.

꽃·낮은 풀·작은 돌 장식은 비충돌로 둘 수 있지만 주요 통행과 소리 접근 여백을 가리면 안 된다. 작물 영역, 울타리, 나무 몸통, 물과 다리 난간은 발 기준으로 막혀야 한다.

전체 개방 조감에 82개 구슬이 보이는 것은 기능상 정상일 수 있지만 배경 시각 검수에는 적합하지 않다. 최종 배경 비교는 `/nature-test?capture=1`처럼 HUD, 캐릭터, 구슬, 잠금 안개와 검토 UI가 숨겨진 화면으로 수행한다. 제품 화면에서는 실제 소리 개수를 줄이거나 하드코딩하지 마라.

## 8. 완료 전 검증

다음 순서로 검증해줘:

1. 모든 새 원본과 런타임 에셋을 열어 투명도, 픽셀 선명도, 크기, 시안 일치 검수.
2. `npm run validate:nature-assets` 실행.
3. 14개 파일 존재와 금지된 기존 경로 0개 확인.
4. `npm run test:nature` 실행.
5. 그룹 A/B·전체 접근 아이템 수, 고유성, 재현성과 단계별 도달성 확인.
6. Nature 관련 ESLint 실행.
7. production build 실행.
8. 브라우저에서 배경 전용 전체 조감 캡처.
9. 최종 시안, 기존 구현, 새 구현의 동일 비율 비교 생성.
10. 최종 시안과 새 구현의 50% 오버레이 또는 차이 비교 생성.
11. 물레방앗간, 위쪽 다리, 북동 집·온실, 서쪽 밭, 동쪽 과수원, 아래쪽 다리·남쪽 입구의 플레이 줌 캡처.
12. 실제 제품 경로에서 Nature 진입, 이동, 다리 통과, 소리 선택, AnnotationPanel과 복귀 확인.
13. 데스크톱 1440×900, 모바일 세로 390×844, 모바일 가로 844×390 확인.

시각 검수에서 다음을 하나씩 기록한다:

- 잔디와 길의 팔레트·경계.
- 강 굽이, 강둑 돌과 갈대.
- 다리의 판자·난간·그림자.
- 네 건물의 형태·위치·크기.
- 세 밭의 밝기·작물·울타리.
- 나무 수관의 풍성함과 숲 밀도.
- 사과나무와 과수원 구성.
- 꽃 군락의 크기·색상·밀도.
- 빈 잔디와 장식 영역의 균형.
- 기존 캐릭터와 새 환경 에셋의 픽셀 굵기·비례.

`validate:nature-assets`, 기능 테스트와 build가 성공하더라도 배경 비교에서 기존 시안과 크게 다르면 완료가 아니다. 위치·크기·팔레트·에셋 중 차이가 큰 항목을 찾아 해당 부분만 다시 생성·편집하고 재검수해줘.

## 9. 완료 보고 기준

아래 상태에서는 완료라고 보고하지 마라:

- ImageGen 한도로 일부 에셋만 만들어진 상태.
- 기존 환경 경로 7개 중 하나라도 Nature 렌더러에 남은 상태.
- 14개 필수 런타임 파일 중 하나라도 없거나 placeholder인 상태.
- 물레방앗간만 새 에셋이고 나머지는 기존 atlas인 상태.
- 단색 Canvas 길·강둑·다리가 최종 화면에 남은 상태.
- 테스트는 통과하지만 시안 비교에서 다른 맵처럼 보이는 상태.
- 동일 비율 비교와 실제 플레이 줌 캡처가 없는 상태.
- 원본·파생본·프롬프트 기록이 누락된 상태.

완료 보고에는 다음을 포함해줘:

1. 이어받았을 때의 상태와 실제로 완료한 작업.
2. 9개 ImageGen 호출과 결과별 승인·수정 이력.
3. 14개 런타임 에셋 경로.
4. 제거한 기존 환경 경로 7개.
5. 변경한 렌더링·좌표·충돌 파일.
6. 시안·기존 구현·새 구현의 비교 이미지.
7. 실제 플레이 줌과 모바일 캡처.
8. `validate:nature-assets`, `test:nature`, ESLint와 build 결과.
9. 제품 흐름과 단계별 사운드 접근 결과.
10. 시안과 아직 남은 차이 및 이유.
11. 로컬 확인 URL.

기능이나 좌표의 일부가 이미 완료되어 있어도 이번 작업의 핵심은 남은 전체 환경 에셋 교체다. 사용자가 같은 ‘꽃피는 개울 농장’으로 인식할 수 있는 시각 결과와 기존 SoundVillage 기능이 동시에 충족될 때만 완료로 보고해줘.

## 10. 작업 안전 범위

현재 워킹 트리에는 다른 마을과 기능의 미커밋 변경이 있다. 관련 없는 파일을 수정·삭제하거나 reset, checkout, stash로 되돌리지 마라.

기존 Nature 기능 구현을 통째로 폐기하지 말고, 현재 `natureFarmLayout.mjs`, `NatureZoneMap.js`와 테스트를 기반으로 시각 에셋과 필요한 좌표·충돌만 개선해줘.

로컬 이미지 생성·편집, 런타임 파생본 제작, 코드 수정과 비파괴 검증은 진행해도 된다. push, 배포, 운영 DB 변경, 외부 전사 제출, 데이터 삭제, 유료 에셋 구매는 별도 승인 없이 하지 마라.

목표는 중간 단계에서 멈춘 작업을 실제로 이어서, 최종 ImageGen 시안에서 보이는 건물·울타리·나무·밭·길·다리·강가·꽃을 모두 새 Nature 전용 에셋으로 교체하고 제품 안에서 정상 작동하는 동일한 분위기의 맵을 완성하는 것이다.
