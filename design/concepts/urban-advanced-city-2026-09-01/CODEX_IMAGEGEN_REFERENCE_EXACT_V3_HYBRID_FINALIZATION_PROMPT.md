# Codex 마스터 프롬프트 — Urban 확정 시안 1:1 하이브리드 런타임 완성

현재 워킹 트리에서 중단된 SoundMimic Village Urban reference-exact v3 작업을 이어서 실제 제품까지 완성하세요.

이 문서를 이번 실행의 마스터 프롬프트로 사용합니다. 먼저 처음부터 끝까지 읽고, 아래 체크포인트 문서와 현재 파일을 직접 재검증한 다음 작업하세요.

- 기존 마스터 프롬프트: `design/concepts/urban-advanced-city-2026-09-01/CODEX_IMAGEGEN_REFERENCE_EXACT_REBUILD_PROMPT.md`
- 현재 체크포인트: `design/concepts/urban-advanced-city-2026-09-01/IMAGEGEN_REFERENCE_EXACT_V3_HANDOFF.md`
- 확정 시안: `design/concepts/urban-advanced-city-2026-09-01/02-midnight-metro-media-core.png`
- v3 작업 디렉터리: `public/assets/urban-city-v3/`
- 현재 검수 자료: `_review/urban-advanced-city/imagegen-reference-exact-v3/`

이전 채팅의 완료 보고나 수치만 믿지 말고 현재 파일, 실제 렌더, 브라우저 동작, 테스트 결과로 다시 확인하세요. 커밋과 push는 하지 않습니다.

---

## 1. 최종 목표

확정 시안에서 게임 UI, 플레이어, D-pad, 입구 버튼, 여섯 개의 개념 사운드 오브를 제거하고 복원한 `canonical-map-art`를 실제 Urban 게임 월드 미술로 사용하세요.

완성 결과는 다음을 동시에 만족해야 합니다.

1. Urban art-only 화면이 확정 시안의 월드 미술과 사실상 픽셀 단위로 일치합니다.
2. 실제 플레이 중 플레이어가 보도, 광장, 횡단보도, 중앙 계단, 남쪽 입구를 정상적으로 이동합니다.
3. 플레이어가 나무 수관, 캐노피, 전철 승강장 전면부, 남측 rail, 접근 가능한 가로시설의 앞뒤를 지날 때 깊이 관계가 자연스럽습니다.
4. A/B 각각 83개, 6블록, marker, AnnotationPanel, 잠금, 충돌, 카메라, 모바일 D-pad, 복귀 흐름이 유지됩니다.
5. 시안에 보이는 176개 placement가 inventory에서 사라지지 않고 모두 asset binding을 가집니다.
6. 제품은 Gate 1–4가 모두 통과한 뒤에만 v3로 전환합니다.

이번 실행의 우선순위는 다음과 같습니다.

1. 확정 시안과의 시각적 동일성
2. 실제 게임 플레이와 올바른 오클루전
3. 좌표·크기·밀도 보존
4. 에셋 관리 가능성과 검증 가능성
5. 불필요한 재생성 최소화

---

## 2. 이번 실행에서 채택할 핵심 구조

기존 프롬프트의 “확정 시안 전체를 단일 제품 배경으로 사용 금지” 규칙은 이번 문서가 아래와 같이 좁게 대체합니다.

### 허용하며 권장하는 구조

HUD·플레이어·D-pad·입구 cue·개념 사운드 오브가 제거된 다음 파일을 **정적 월드 베이스 플레이트**로 사용합니다.

- `public/assets/urban-city-v3/reference/canonical-map-art-runtime.png`

이 파일은 원본 시안 전체를 편법으로 붙이는 파일이 아닙니다. Phase B에서 비월드 오버레이를 제거하고 가려진 월드 미술을 복원한 1448×1086 월드 전용 canonical art입니다. 이를 정적 베이스로 쓰는 것이 이번 작업의 시각 정확도 기준입니다.

정적 베이스 위에 플레이어와 marker를 그리고, 플레이어보다 앞에 와야 하는 물체의 **정확한 오클루전 cutout**만 다시 그립니다.

권장 렌더 순서:

1. canonical static base plate
2. 런타임 marker 중 베이스/플레이어 뒤에 있어야 하는 요소
3. player
4. `anchorY > playerFeetY`인 접근 가능 물체의 y-sort occluder
5. 고정 foreground: metro front lip, canopy, south rail 등
6. marker의 전경/상호작용 강조가 필요하면 해당 pass
7. HUD와 모바일 조작 UI

베이스에 이미 그려진 물체를 같은 좌표에 다시 그리는 것은 허용합니다. 플레이어가 물체 앞에 있을 때는 베이스의 물체 위에 플레이어가 보이고, 플레이어가 물체 뒤에 있을 때는 동일 픽셀의 occluder가 플레이어 위에 다시 그려지는 방식입니다.

### 모든 물체에 대한 에셋 계약

176개 placement 모두 `inventory.json`에서 유지하고 다음 중 하나의 binding을 가져야 합니다.

- `baked-static`: canonical base plate에 픽셀과 좌표가 보존되어 있으며 독립 런타임 이동이 필요하지 않은 물체
- `dynamic-occluder`: canonical base에 포함되면서, 플레이어와 깊이 상호작용할 때 사용할 투명 PNG cutout도 가진 물체
- `fixed-foreground`: 항상 player 위에 그려지는 투명 PNG cutout
- `ground-region`: canonical/static base의 지면 또는 이동 영역을 기술하는 placement
- `catalog-only`: 기존 source crop과 provisional extraction을 감사·비교 자료로 보존하지만 제품 draw call에는 사용하지 않는 물체

각 placement에는 최소한 다음 필드가 있어야 합니다.

- id, category
- reference/world bounds
- coverage mode
- base plate file
- source crop
- runtime occluder 또는 `null`
- anchor/footprint/collision
- foreground role
- review status와 근거

“모든 물체에 에셋이 있다”는 조건은 모든 건물과 소품을 억지로 독립 이동 가능한 sprite로 재해석한다는 뜻이 아닙니다. 모든 물체가 추적 가능한 개별 inventory/binding을 가지며, 실제 런타임 분리가 필요한 물체만 깨끗한 alpha cutout을 갖는다는 뜻입니다.

---

## 3. 이 구조를 사용해야 하는 이유

현재 Phase D의 165개 provisional PNG는 평면 시안과 복원 ground의 차이를 겹치는 bounds 사이에 분배해 만든 것입니다. 따라서 전체 재합성은 SSIM 0.999149까지 도달하지만 일부 tree/building/prop PNG가 전철, 도로, 포장, 이웃 물체 픽셀을 포함합니다.

평면 합성 이미지 하나에는 서로 가린 물체의 숨은 픽셀이 존재하지 않습니다. 모든 물체를 완전한 독립 sprite로 만들면서 visible canonical 픽셀까지 1:1 보존하는 것은 일반적으로 유일한 해가 없는 역합성 문제입니다. `building-west-media-office` ImageGen 분리 시험처럼 모델에 전체 실루엣을 다시 그리게 하면 좌표·비율·디테일이 재해석됩니다.

따라서 다음 원칙을 지킵니다.

- 시안에서 이미 보이는 픽셀은 생성 모델로 다시 그리지 않습니다.
- 픽셀 동일성이 필요한 영역은 canonical 원본에서 기계적으로 합성합니다.
- 건물, 북측 스카이라인, 전철, 도로 주변처럼 player가 실제로 겹칠 수 없는 정적 미술은 base plate에 굽습니다.
- alpha 검수는 제품에서 실제로 투명 draw call에 사용되는 occluder만 필수 대상으로 합니다.
- 기존 165개 provisional 파일은 삭제하지 않고 감사 자료로 보존하되 제품 runtime asset으로 자동 간주하지 않습니다.

---

## 4. 절대 보존 조건

- `public/assets/urban-city-v2/`를 삭제·덮어쓰기·재생성하지 않습니다.
- v2는 v3 전환 실패 시 즉시 돌아갈 수 있는 rollback 경로로 유지합니다.
- `public/assets/urban-city-v3/`의 Phase A–C 결과와 후보·거부 이력을 삭제하지 않습니다.
- Music, Nature, Lab, Animal, Human 및 Urban과 무관한 변경을 수정하거나 되돌리지 않습니다.
- 기존 dirty worktree를 정리하지 않습니다.
- Supabase에 실제 제출/skip 데이터를 만들지 않습니다.
- 커밋과 push를 하지 않습니다.
- Canvas 사각형, SVG, CSS, 폴리곤을 보이는 임시 미술로 사용하지 않습니다.
- 폴리곤/rect는 투명한 collision, walkability, mask metadata에만 사용할 수 있습니다.
- 비균일 스케일을 사용하지 않습니다.
- reference/canonical의 1448×1086 좌표계를 유지합니다.
- 시안에 그려진 여섯 개 사운드 오브를 runtime 83개 marker 대신 베이스에 굽지 않습니다.

---

## 5. 시작 전 재검증

작업을 시작하기 전에 다음을 수행하고 결과를 기록하세요.

1. `git status --short`로 전체 dirty worktree를 확인합니다.
2. 위 두 프롬프트/핸드오프 문서를 끝까지 읽습니다.
3. `manifest.json`, `inventory.json`, `layout.json`, `asset-plan.md`를 확인합니다.
4. canonical, ground-only, art-only, overlay, blink, heatmap, 네 contact sheet를 원본 해상도로 직접 봅니다.
5. 165개 상태가 실제로 `extracted-needs-alpha-review`인지 확인합니다.
6. `productionSwitched=false`와 제품 loader가 v2를 가리키는지 확인합니다.
7. `tree-01`, 오염된 건물, 대표 planter/light/kiosk, metro foreground를 원본 해상도로 확인합니다.
8. 관련 Next.js 코드를 수정하기 전 `node_modules/next/dist/docs/`에서 현재 설치 버전에 해당하는 가이드를 읽습니다.

이전 수치나 보고와 현재 파일이 다르면 현재 파일을 기준으로 문서화합니다.

---

## 6. Phase H1 — 런타임 오클루전 필요성 분류

176개 placement를 전수 분류해 `runtime-role-audit.json`과 사람이 읽을 수 있는 `runtime-role-audit.md`를 만드세요.

각 placement마다 다음 질문에 답합니다.

1. player의 walkable 영역이 이 물체의 visible bounds와 실제로 겹칠 수 있는가?
2. collision 때문에 player가 물체 앞/뒤 중 한쪽에만 있을 수 있는가?
3. player가 이 물체 뒤로 들어갈 수 있어 물체 픽셀이 player를 가려야 하는가?
4. 고정 foreground인가, y-sort occluder인가, baked-static인가?
5. 기존 provisional alpha가 오염되어 있는가?
6. 오염이 실제 player 교차 영역에 영향을 주는가?

분류 시 bounds 겹침만 보지 말고 `walkable mask ∩ player swept area ∩ object visible area`를 기준으로 판단합니다.

우선 검토 대상:

- 보도와 광장에 있는 나무 및 수관
- 중앙 광장 fountain/orb 등 랜드마크
- 접근 가능한 planter, kiosk, 가로등, 벤치, outdoor table
- metro front lip, 계단 주변 구조, canopy
- 남측 rail과 남측 나무
- 플레이어가 앞뒤로 지나갈 수 있는 차량

대부분의 외곽 건물, 북측 스카이라인, 전철 차량, collision 내부 소품은 `baked-static`일 가능성이 높습니다. 실제 이동 경로를 확인하지 않고 전부 y-sort로 지정하지 마세요.

산출물에는 카테고리별 총 placement 수와 role별 수를 포함하고 합계가 176인지 자동 검증합니다.

---

## 7. Phase H2 — canonical base와 occluder 제작

### 7.1 static base

`canonical-map-art-runtime.png`를 원본 크기 그대로 v3 runtime static base로 사용합니다.

- crop 금지
- stretch 금지
- 색보정 금지
- 재인코딩으로 인한 RGB 변화 금지
- 렌더 destination은 1448×1086 identity transform

필요하면 이름이 역할을 분명히 드러내는 runtime 사본을 만들 수 있지만 원본과 SHA-256 및 decoded RGB가 동일해야 합니다. 불필요한 사본은 만들지 마세요.

### 7.2 runtime occluder

`dynamic-occluder`와 `fixed-foreground`로 분류된 placement만 투명 runtime PNG를 승인합니다.

각 occluder는 다음 규칙을 만족해야 합니다.

- RGB는 visible canonical 픽셀을 그대로 사용합니다.
- alpha만 reviewed matte로 결정합니다.
- 이웃 물체, 도로, 포장, 전철, checker, halo가 없어야 합니다.
- 타이트한 crop을 사용하되 world placement와 anchor가 정확히 보존되어야 합니다.
- 자연스러운 anti-alias edge는 허용하지만 반투명 도로/배경 halo는 금지합니다.
- occluder가 player와 절대 겹치지 않는 픽셀은 alpha에서 제외해도 됩니다.
- 그림자가 player를 실제로 가려야 하는 디자인이 아니라면 shadow를 occluder에 포함하지 않습니다.

### 7.3 reviewed mask override

`scripts/extract_urban_assets_v3.py`가 검수된 matte를 다시 덮어쓰지 않도록 override 구조를 추가하세요.

권장 구조:

- `public/assets/urban-city-v3/masks-reviewed/<id>-occluder-mask.png`
- `public/assets/urban-city-v3/accepted/occluders/<id>.png`
- `public/assets/urban-city-v3/rejected/` 또는 기존 candidate history

reviewed mask가 있으면 extractor/assembler가 이를 최우선으로 사용하고, 없으면 provisional mask를 제품에 자동 승인하지 않아야 합니다.

### 7.4 마스크 제작 방법

먼저 결정론적·기계적 방법을 사용하세요.

1. canonical source crop과 기존 provisional mask를 확인합니다.
2. 연결 성분, 색/경계 연속성, inventory bounds, 충돌 footprint, player swept area로 불필요한 성분을 제거합니다.
3. 필요하면 사람이 검수할 수 있는 binary/grayscale matte를 정확한 좌표에 작성합니다.
4. source RGB + reviewed alpha로 PNG를 합성합니다.
5. canonical base 위 동일 좌표에 다시 합성했을 때 보이는 월드 픽셀이 변하지 않는지 확인합니다.
6. 인공 player probe를 앞/뒤 위치에 놓아 occluder가 의도한 부분만 가리는지 확인합니다.

mask 데이터와 collision geometry는 visible placeholder art가 아니므로 기계적 편집이 허용됩니다.

---

## 8. ImageGen 사용 규칙

이번 작업에서도 `$imagegen` 스킬을 반드시 읽고 built-in ImageGen 모드만 사용합니다.

단, 현재 실패 원인이 ImageGen 부족이 아니라 alpha 분해 계약이므로 다음 원칙을 지킵니다.

- 이미 보이는 canonical RGB를 alpha 정리 목적으로 다시 생성하지 않습니다.
- background 제거는 우선 reviewed alpha matte로 해결합니다.
- 실제로 가려져 있어 원본에 존재하지 않는 픽셀이 게임 플레이 중 노출되어야 할 때만 ImageGen edit를 사용합니다.
- 한 호출은 한 asset 또는 한 국소 hidden patch만 처리합니다.
- 입력으로 canonical full reference와 정확한 target crop/mask를 제공하고 역할을 명시합니다.
- “change only hidden/missing region”과 보존할 geometry, layout, lighting, visible pixels를 명시합니다.
- 생성 결과 전체를 그대로 채택하지 말고 승인된 mask 내부만 원본에 합성합니다.
- mask 밖의 decoded pixels는 원본과 동일해야 합니다.
- 생성이 실루엣, 좌표, 비율, 창문/패널, 색 배치를 재해석하면 거부하고 이유와 경로를 기록합니다.
- 서로 다른 asset은 서로 다른 호출을 사용합니다.
- 투명 출력이 필요하면 PNG와 genuine transparent background를 요청하고 alpha를 직접 검사합니다.
- 외부 API, CLI, 로컬 대체 모델로 우회하지 않습니다.

ImageGen을 사용할 수 없고 정말 필요한 hidden patch가 남으면 임시 미술로 대체하거나 완료라고 보고하지 말고 정확한 asset id, 마지막 통과 gate, 필요한 입력, 재개 명령을 blocker로 남깁니다.

---

## 9. manifest와 기존 provisional 자산

기존 165개 provisional 자산과 50개 foreground split은 삭제하지 않습니다. 상태를 사실대로 분리하세요.

권장 manifest 계약:

```json
{
  "renderMode": "canonical-base-plus-occlusion-overlays",
  "productionSwitched": false,
  "staticBase": {
    "file": "reference/canonical-map-art-runtime.png",
    "width": 1448,
    "height": 1086,
    "reviewStatus": "accepted"
  },
  "objectBindings": [],
  "runtimeOccluders": [],
  "legacyProvisionalAssets": []
}
```

실제 스키마는 현재 loader/test와 일관되게 설계하되 다음은 자동 검증합니다.

- objectBindings 합계 176
- inventory의 모든 id가 정확히 한 번 연결됨
- runtime occluder 파일 존재와 decoded dimensions 일치
- source crop/bounds/anchor/role 유효
- runtime에 사용하는 transparent PNG만 alpha gate 대상
- legacy provisional은 runtime draw list에 포함되지 않음
- 모든 URL이 실제 Next public 경로로 로드됨
- 비균일 scale 0
- productionSwitched는 Gate 1–4 전까지 false

`extracted-needs-alpha-review`인 165개를 일괄 `accepted`로 바꾸지 마세요. 각 파일은 다음 중 사실에 맞는 상태를 가집니다.

- `accepted-runtime-occluder`
- `accepted-catalog-baked-static`
- `provisional-not-runtime`
- `rejected`

---

## 10. renderer 전환

현재 제품은 v2 loader를 사용합니다. v3 전환은 새 구조를 별도 경로에서 완성하고 Gate 1과 Gate 2가 통과한 뒤 수행합니다.

필요 작업:

1. v3 manifest loader를 추가합니다.
2. static offscreen canvas에 canonical base를 identity transform으로 한 번 그립니다.
3. 기존 gameplay canvas 구조와 카메라/DPR을 유지합니다.
4. player 앞/뒤 판정은 player feet Y와 object anchor Y를 사용합니다.
5. y-sort 대상이 player 앞일 때만 exact occluder를 player 위에 다시 그립니다.
6. fixed foreground는 지정 pass에서 항상 다시 그립니다.
7. collision과 walkability는 이미지 alpha가 아니라 `layout.json`/검증된 geometry를 사용합니다.
8. runtime marker와 28×28 interaction 판정은 분리 상태를 유지합니다.
9. asset load 실패 시 조용히 v2/빈 화면으로 숨기지 말고 명시적 오류를 남깁니다.
10. 개발용 art preview와 실제 제품 renderer가 동일한 v3 loader/manifest를 사용하게 합니다.

시각 art를 맞추기 위해 gameplay 좌표나 A/B item 계약을 임의로 바꾸지 마세요. 정말 좌표 변환이 필요하면 identity 1448×1086 기준에서 근거와 테스트를 남깁니다.

---

## 11. Gate 1 — runtime asset와 alpha

Gate 1의 대상은 “모든 provisional crop”이 아니라 실제 제품 draw call에 사용될 static base와 runtime occluder입니다.

필수 검증:

- static base decoded RGB가 승인 canonical과 동일
- 각 runtime occluder의 alpha 존재
- 승인 mask 밖 alpha pixel 0
- checker/halo/이웃 물체/도로/포장 오염 0
- crop damage 0
- world placement 오차 0 px
- native/runtime 비균일 scale 0
- manifest URL, dimensions, bounds, anchor 일치
- 카테고리별 runtime occluder contact sheet 육안 통과
- provisional-not-runtime 파일이 renderer draw list에 없음

정량 자동검사와 원본 해상도 육안검사를 모두 수행합니다.

추가로 최소 다음 player probe 이미지를 만드세요.

- 나무 앞 / 나무 뒤
- planter 또는 kiosk 앞 / 뒤
- 중앙 landmark 앞 / 뒤
- metro front lip 아래/위 관계
- 남측 rail과 입구
- 대표 차량 앞 / 뒤 또는 collision으로 뒤 접근 불가 증명

오염이 하나라도 player를 잘못 가리면 Gate 1 실패입니다.

---

## 12. Gate 2 — 전체 맵 art-only

`/urban-art-preview`가 동일한 v3 loader를 사용하도록 합니다.

조건:

- HUD, player, marker, fog, D-pad, entrance cue 없음
- 전체 1448×1086 월드가 한 화면에 표시됨
- canonical과 동일 crop/표시 크기
- v2 asset 요청 0
- console error/warn, hydration error, missing asset 0

산출물:

- reference-clean.png
- art-only-runtime.png
- side-by-side
- 50% overlay
- blink GIF
- absolute diff heatmap
- metrics.json
- runtime occluder contact sheet
- role audit overlay

정적 art-only는 canonical base가 직접 사용되므로 evaluable 영역의 decoded pixel 비교가 원칙적으로 exact여야 합니다. 브라우저 캡처에는 리사이즈/색관리 차이가 있을 수 있으므로 source-level decoded exactness와 browser-level metric을 분리 기록합니다.

권장 기준:

- source base decoded RGB exact pixel fraction: 1.0
- world transform: identity
- non-uniform scale: 0
- browser art-only global luminance SSIM: 0.998 이상
- masked RMSE: 3.0 이하
- 육안 overlay/blink에서 위치·크기·밀도 흔들림 없음

수치가 기준을 넘더라도 잘못된 crop, interpolation blur, 좌표 이동이 보이면 실패입니다.

---

## 13. Gate 3 — `/urban-test` 실제 게임 검증

Gate 1과 Gate 2가 통과한 뒤에만 실행합니다.

반드시 브라우저의 실제 키 입력과 모바일 D-pad 입력으로 확인합니다.

- Group A와 Group B
- block 1, 4, 6
- entrance, midcity, metro
- 1440×844
- 1920×1080
- 390×844
- 중앙 계단과 모든 주요 횡단보도 통과
- 외곽 건물, metro support, 차량, 버스, 나무, planter, 가로등 충돌
- 잠긴 block 진입 차단과 해금 후 접근
- 모든 active item BFS 접근 가능
- 나무 수관, 캐노피, metro lip, south rail, 접근 가능한 소품의 앞뒤 occlusion
- 카메라 clamp와 DPR
- 짧은 key tap과 연속 이동
- 모바일 D-pad
- annotation 중 입력 잠금
- marker active, nearby, interacting, completed, unavailable 위계
- marker 시각 크기와 28×28 상호작용 판정 분리
- console error/warn, hydration error, asset 404 0

“art-only가 맞다”는 사실로 gameplay occlusion을 통과 처리하지 마세요.

---

## 14. Gate 4 — 실제 `/` A/B 흐름

Gate 3 이후 실제 `/`에서 ALLAUDIO_A와 ALLAUDIO_B를 각각 검증합니다.

1. 로그인
2. WorldMap 진입
3. Urban 포털 이동
4. v3 renderer 로드 확인
5. 83 items, 6 blocks 확인
6. 최소 세 종류 collision 확인
7. 서로 다른 active sound에 접근
8. Enter 또는 모바일 상호작용
9. 서로 다른 AnnotationPanel이 열리는지 확인
10. 제출하지 않고 닫기
11. 완료 수가 0/83에서 잘못 증가하지 않는지 확인
12. 같은 item이 즉시 재호출되지 않는지 확인
13. ESC 및 남쪽 출구 복귀 확인

연구 데이터 관례가 확실하지 않으면 Supabase submit/skip을 실행하지 않습니다.

---

## 15. 자동 검증과 테스트

기존 테스트를 유지하고 새 구조를 증명하는 검증을 추가하세요.

최소 증명 항목:

- inventory placement 176개 및 카테고리 합계
- 모든 placement가 object binding에 연결됨
- canonical base 파일 존재, dimensions 1448×1086, decoded RGB checksum
- runtime occluder 파일/alpha/dimensions/bounds/anchor
- 승인 mask 밖 alpha 오염 0
- runtime draw list에 provisional-not-runtime 0
- v3 제품 loader에 v2/concept raw PNG 의존 없음
- v3 renderer가 old polygon visible art를 호출하지 않음
- identity transform과 non-uniform scale 0
- y-sort/fixed foreground 누락 0
- A/B 각각 83개
- 블록별 15/15/15/15/15/8
- sound_id/group/block/AnnotationPanel 계약
- 결정론적 배치와 좌표 중복 없음
- 각 해금 단계의 BFS 접근성
- spawn/exit가 collision 또는 item과 겹치지 않음
- 짧은 key tap과 D-pad

최종 실행:

- `npm run test:urban-production`
- 새 v3 hybrid/reference-exact 검증 테스트
- Urban 변경 파일 targeted ESLint
- `npm run build`
- 필요하면 `npm run lint`

전체 lint가 Urban 외 기존 WIP 때문에 실패하면 해당 파일을 수정하지 말고 Urban targeted lint 결과와 분리 보고합니다.

---

## 16. 제품 전환과 rollback

Gate 1과 Gate 2가 통과하기 전에는 제품 loader를 v3로 바꾸지 않습니다.

Gate 1–4와 테스트/build가 모두 통과하면:

- v3 manifest의 `productionSwitched=true`
- 실제 Urban loader를 v3 hybrid manifest로 연결
- v2는 삭제하지 않고 rollback 경로로 유지
- preview와 제품이 같은 loader를 쓰는지 확인

전환 뒤 문제가 발견되면 v2를 삭제하거나 수정하지 말고 loader switch만 되돌릴 수 있어야 합니다.

---

## 17. 최종 검수 산출물

다음 디렉터리에 새 산출물을 정리하세요.

- `_review/urban-advanced-city/imagegen-reference-exact-v3-hybrid/`

최소 파일:

- full-map art-only
- reference vs runtime side-by-side
- 50% overlay
- blink GIF
- diff heatmap
- runtime occluder contact sheet
- runtime role audit overlay
- player occlusion probe sheet
- desktop 1440×844
- desktop 1920×1080
- mobile 390×844
- Group A 실제 AnnotationPanel
- Group B 실제 AnnotationPanel
- metrics.json
- browser-console summary

기존 `_review/.../imagegen-reference-exact-v3/` 산출물은 덮어쓰거나 삭제하지 않습니다.

---

## 18. 핸드오프 문서

기존 핸드오프를 지우지 말고 다음 새 문서를 작성하세요.

- `design/concepts/urban-advanced-city-2026-09-01/IMAGEGEN_REFERENCE_EXACT_V3_HYBRID_HANDOFF.md`

포함 내용:

- 왜 165개 완전 분리가 Gate 1에서 실패했는지
- 왜 canonical base + occluder 구조를 선택했는지
- 기존 프롬프트에서 대체한 규칙
- 176 placement의 role별/카테고리별 수
- 실제 runtime occluder id 전체 목록
- baked-static/catalog-only 목록 또는 기계 판독 가능한 파일 경로
- reviewed alpha 방식과 ImageGen 사용/거부 이력
- manifest/renderer/render order
- collision/walkability/y-sort/foreground 규칙
- Gate 1/2/3/4 결과와 증거 경로
- A/B 83개·6블록·실제 루트 결과
- 테스트, targeted lint, 전체 lint, build
- Supabase 제출 여부
- rollback 방법
- 남은 제한과 blocker

---

## 19. 중단 및 blocker 규칙

다음 중 하나라도 충족하지 못하면 완료라고 보고하지 않습니다.

- canonical base가 실제 제품 loader에서 사용되지 않음
- runtime occluder alpha 오염이 player를 잘못 가림
- Gate 2 시각 비교 실패
- A/B item/블록/AnnotationPanel 계약 파손
- 실제 `/` 흐름 미검증
- Urban 테스트 또는 build 실패
- 필수 ImageGen hidden patch가 생성되지 않음

중단 시 다음을 정확히 남깁니다.

- 마지막 통과 phase/gate
- 남은 asset id 또는 코드 경로
- 재현 절차
- 마지막 실행 명령과 결과
- 마지막 ImageGen prompt/source/candidate 경로
- productionSwitched 값
- 다음 실행이 시작할 정확한 파일과 작업

ImageGen이 막혔다고 visible 임시 미술로 대체하지 않습니다.

---

## 20. 최종 응답 형식

완료 시 다음만 간결하게 보고하세요.

1. canonical base + occluder 방식으로 확정 시안이 제품에 연결되었는지
2. 176 placement의 role별 수와 실제 runtime occluder 수
3. manifest와 production switch 상태
4. source/browser visual metric과 overlay/blink 육안 결과
5. player occlusion, collision, 접근성, camera, mobile 결과
6. A/B 각각 83개·6블록과 실제 `/` AnnotationPanel 흐름
7. 테스트·targeted lint·build, 전체 lint의 Urban 외 오류 분리
8. 최종 screenshot/review/handoff 경로
9. 남은 제한 또는 blocker

커밋과 push는 하지 마세요.
