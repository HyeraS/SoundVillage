# WorldObject incremental migration plan

## 목표와 비목표

목표는 object별 authority를 legacy modules에서 authored WorldObject로 옮기고, 현재 runtime API와 visual/collision/interaction 결과를 adapter로 보존하는 것이다. 전체 월드를 한 번에 재구축하지 않는다.

이 계획은 구현 승인을 의미하지 않는다. 특히 Home art/site/좌표 변경, collision mask 재생성, runtime asset 교체는 별도 승인 후 단계에서만 수행한다.

## 제안 파일 경계

다음 이름은 구현 단계의 예상안이다.

| 역할 | 예상 파일 | 환경 |
|---|---|---|
| world 공통 상수 | `lib/worldMapConstants.mjs` | build + runtime, pure |
| schema/validator | `lib/worldMapObjectSchema.mjs` | build/test, pure |
| authored objects | `data/world-map-v4/worldObjects.mjs` | build-only |
| legacy import adapter | `scripts/world-map/legacy-world-object-adapter.mjs` | Node-only |
| projection compiler | `scripts/build-world-map-object-projections.mjs` | Node-only |
| lean render/destination/minimap projection | `lib/generated/worldMapV4RuntimeObjects.mjs` | client runtime |
| collision compatibility projection | `lib/generated/worldMapV4CollisionObjects.mjs` | collision engine/build; 현 단계에는 runtime reason lookup도 사용 |
| provenance/inventory projection | `public`이 아닌 review/build JSON | build-only |
| schema/adapter tests | `lib/worldMapObjectSchema.test.mjs`, `scripts/test-world-map-object-projections.mjs` | test |

`generated` 파일은 authored module을 import하지 않고 완결된 리터럴만 export해야 한다. 그래야 `'use client'` graph에 source crop/provenance/validator가 포함되지 않는다.

## import 규칙

1. `worldMapConstants`는 asset, collision, React를 import하지 않는다.
2. authored objects는 schema 상수 외에 runtime/generated 모듈을 import하지 않는다.
3. compiler만 authored + legacy + schema를 함께 읽는다.
4. `worldMapV4Manifest.mjs`는 lean generated render projection의 facade가 된다. collision을 re-export하지 않는다.
5. `worldMapCollision.mjs`의 geometry/raster 함수는 유지하고 generated collision projection을 import/re-export한다.
6. collision builder는 manifest가 아니라 pure world constants와 collision engine/projection을 import한다.
7. component는 generated projection 또는 facade만 import한다.
8. test가 client entry에서 build-only path로 이어지는 import를 탐지하면 실패한다.

이 방향은 정적 순환 import, Node builder의 browser module import, build-only 데이터의 client bundle 유입을 동시에 방지한다.

## 단계 0 — 기준선 고정과 승인

| 항목 | 내용 |
|---|---|
| 수정 대상 | production 없음. 이 검토 문서와 승인 기록만 사용 |
| adapter/validator | 없음 |
| 자동 테스트 | 현재 PASS 기록: v4 collision, authored routes, Home hub, production, minimap, assets. 구현 직전 같은 작업 트리에서 재실행 여부 결정 |
| 시각 회귀 | 1280×720, 1440×900, 390×844, 844×390 normal; Library close-up; objects/foreground/collision QA baseline |
| 완료 조건 | current hashes, screenshot baseline, asset/node/performance 수치 고정 |
| rollback | 해당 없음 |
| 승인 기준 | schema 좌표 규칙, candidate 3→1 경로, Library pilot, sortY/alias 열린 결정 승인 |

현재 조사 기준 성능 baseline:

- manifest: 30 assets, 7,439,806 encoded bytes, 129,521,776 decoded RGBA bytes 추정
- spawn normal scene: viewport에 따라 정적 SVG image 9–14개
- 1280×720/1440×900 spawn: 11 image nodes, preload 대상 10 runtime assets + preview, 약 3,020,860 encoded bytes / 52,609,156 decoded bytes

## 단계 1 — schema와 validator

| 항목 | 내용 |
|---|---|
| 수정/생성 파일 | `lib/worldMapObjectSchema.mjs`, `lib/worldMapObjectSchema.test.mjs`, optional `lib/worldMapConstants.mjs` |
| adapter/validator | `validateWorldObject`, `validateWorldObjectSet`, layer-union bounds, transform projection, collider validation |
| 자동 테스트 | duplicate id/layer/collider, invalid rect/polygon, role enum, transform 제한, groundContact/depth, interaction/minimap derivation, forbidden runtime provenance |
| 시각 회귀 | 없음; production consumer에 연결하지 않음 |
| 완료 조건 | representative Library fixture와 invalid fixtures가 기대대로 PASS/FAIL; production import graph 변화 0 |
| rollback | 새 파일만 제거 가능; 기존 source 무수정 |
| 승인 기준 | schema가 모든 요구 필드를 표현하고 collision half-open/concave/decorative 계약을 그대로 인용하는지 review |

주의: validator가 collision 알고리즘을 복제하면 안 된다. shape validation은 기존 `validateCollisionObjects()`에 projection을 넘겨 재사용하거나, 공통 validation primitive를 이동하되 동작 parity test를 둔다.

## 단계 2 — compatibility adapter와 projection compiler

| 항목 | 내용 |
|---|---|
| 수정/생성 파일 | `scripts/world-map/legacy-world-object-adapter.mjs`, `scripts/build-world-map-object-projections.mjs`, generated runtime/collision modules, `scripts/test-world-map-object-projections.mjs`, `package.json` scripts |
| adapter/validator | legacy manifest + geometry + collision을 read-only import해 WorldObject snapshot 생성; native object는 반대 방향으로 현 API projection 생성 |
| 자동 테스트 | 전체 legacy→projection deep equality, object order, destination aliases, render floats, culling bounds, collision arrays, minimap points, guide paths; generated source stable hash |
| 시각 회귀 | generated output을 아직 consumer에 연결하지 않으므로 없음 |
| 완료 조건 | 현재 8 destination과 17 render objects를 손실 없이 round-trip; authority registry에서 id 중복 0 |
| rollback | generated files와 scripts 제거; 기존 modules untouched |
| 승인 기준 | generated 파일에 provenance/source crop/validator 코드가 없고 client-facing gzip/raw size가 baseline projection보다 유의하게 크지 않음 |

Authority registry 예:

```js
{
  'landmark-library': 'native',
  'landmark-home': 'legacy',
  // 한 id는 정확히 한 source만 선택한다.
}
```

adapter가 양쪽 값을 “merge해서 맞는 것을 선택”하면 drift가 숨는다. 선택한 authority의 projection을 내고, 비선택 source와 parity를 assertion해야 한다.

## 단계 3 — Library 첫 pilot

| 항목 | 내용 |
|---|---|
| 수정/생성 파일 | authored `landmark-library`, authority registry, generated projections; facade 연결을 위해 `worldMapV4Manifest.mjs`, `worldMapGeometry.mjs`, `worldMapCollision.mjs`의 선언 import 부분만 최소 변경 |
| adapter/validator | Library → render object, destination/museum constants, collision object, minimap marker, guide path projection |
| 자동 테스트 | 기존 Library object/destination/collider deep-equal; mask bytes/hash 동일; route points/arrival 동일; 12 culling chunk keys 동일; asset id/dimensions 동일 |
| 시각 회귀 | Library close-up + spawn, 네 viewport, normal/objects/collision. pixel diff는 완전 동일을 목표로 함 |
| 완료 조건 | runtime render 좌표·sortY·interaction·collision·minimap·culling 결과가 현재와 동일; SVG image node 수 변화 0 |
| rollback | registry를 `legacy`로 되돌리고 이전 facade import로 복귀; authored Library 파일은 비활성 상태로 남겨도 runtime 영향 없음 |
| 승인 기준 | Library/Sound Library alias 처리와 compatibility groundContact/legacySortY가 명시적으로 승인됨 |

Library는 Home보다 pilot에 적합하다. art/site 변경 대기 상태가 없고, spawn→approach route가 두 점이며, collider/interaction이 명확하다. builder semantic sort 1147과 runtime sort 1010의 차이는 자동 정정하지 않고 current runtime 1010을 보존한다.

## 단계 4 — 렌더·충돌·상호작용 회귀 게이트

| 항목 | 내용 |
|---|---|
| 수정 대상 | 주로 tests/review artifacts; 기능 변경 금지 |
| adapter/validator | projection diff reporter: field path, legacy value, native value |
| 자동 테스트 | `test:world-v4-collision`, `test:world-authored-routes`, `test:world-minimap`, `test:world-home-hub`, `test:world-production`, camera/assets tests; mask 691,200 cell parity |
| 시각 회귀 | baseline/current pixel diff, foreground order, player 앞/뒤, marker label/state, mobile clipping |
| 완료 조건 | 기능 assertion 전부 PASS, collision mask changed cells 0, unexpected changed pixels 0, console/asset errors 0 |
| rollback | Library authority만 legacy로 전환 가능해야 함 |
| 승인 기준 | encoded/decoded memory, bundle, image node, initial readiness가 허용 오차 안 |

권장 성능 허용 오차:

- pilot client JS raw/gzip 증가: schema/provenance가 들어오지 않았음을 증명; generated projection 자체는 기존 literal 대체 수준
- initial asset bytes/decoded bytes: 0 변화
- normal SVG image nodes: 0 변화
- map-ready median: baseline 대비 ±5% 안 또는 통계적 잡음 설명
- heap: 장시간 이동 후 지속 증가 없음

## 단계 5 — 기존 landmark 순차 이전

권장 순서: Lab → Animal → Nature → Urban → Human → Music. 각 object는 독립 PR/승인 단위로 취급한다. Music은 큰 edge crop, 긴 route, 과거 depth 이슈가 있어 마지막에 둔다.

| 항목 | 내용 |
|---|---|
| 수정 대상 | object별 authored record와 authority registry; generated outputs |
| adapter/validator | 동일 adapter 재사용; 새 per-object custom branch 금지 |
| 자동 테스트 | object별 render/destination/collider/minimap/route/culling parity + 전체 8 destination regression |
| 시각 회귀 | 해당 landmark close-up, 접근 경로, player 앞/뒤, 네 viewport; Music은 vegetation/transparent foreground 장면 포함 |
| 완료 조건 | 한 번에 한 id만 native로 전환, deep equality와 visual baseline PASS |
| rollback | 해당 id만 legacy로 전환; 다른 migrated id에 영향 없음 |
| 승인 기준 | drift가 발견되면 current runtime 유지인지 의도 수정인지 별도 결정. migration에 묻어 수정 금지 |

## 단계 6 — depth/foreground 구조 통합

이 단계 전까지 모든 pilot object는 한 visual layer로 현 `<image>` 결과를 그대로 낸다.

| 항목 | 내용 |
|---|---|
| 수정 대상 | `components/world-map/WorldMapScene.js`, generated runtime projection, 필요한 asset build records; object별 visual layer data |
| adapter/validator | logical object → render items flattening, object union cull → layer cull, explicit render bands |
| 자동 테스트 | stable sort(`sortY`, object id, layer id), layer bounds union, current single-layer node parity, foreground visibility modes, culling boundary tests |
| 시각 회귀 | roof/canopy/gate에서 player 앞·뒤 캡처, normal/objects/foreground/clean modes, transparent seam 검사 |
| 완료 조건 | sentinel `sortY=999999` 없이 동일 foreground 결과; 분리된 object만 정당한 추가 node 사용 |
| rollback | multi-layer record를 legacy single-layer asset로 되돌릴 수 있음; scene renderer는 single-layer도 지원 |
| 승인 기준 | object별 layer 분리 이유, 추가 draw node/texture bytes, seam 없는 캡처 승인 |

렌더러는 `visual.layers.length`만큼 무조건 node를 만들면 안 된다. object bounds로 먼저 cull하고 visible/state-enabled layer만 flatten한다.

## 단계 7 — 새 Home Site 적용

Home은 schema pilot가 아니라 별도 콘텐츠 변경 단계다. Step 0/1의 art/site 결정과 후속 collision 시스템의 반개방 결과를 다시 조정해야 한다.

| 항목 | 내용 |
|---|---|
| 수정 대상 예상 | authored Home object, Home source art/site layers, asset build inputs, generated projections, collision projection/mask, visual regression assets |
| adapter/validator | ground/body/optional foreground multi-layer, state/minimap projection, protected corridor validation |
| 자동 테스트 | approved coordinates, 29×17 clearance, 4px max-pool, x=1792 road cell, 7 circulation routes, Home interaction/minimap/state, collision reason parity |
| 시각 회귀 | 네 viewport, spawn/Home approach, two-character waiting area, protected road, layer/depth/state variants |
| 완료 조건 | 별도 승인된 Home art·site·groundContact·collision·approach를 모두 만족; 기존 값을 암묵 사용하지 않음 |
| rollback | 기존 `landmark-home-hub` single-layer object와 현 collision/approach/mask artifact로 복귀 가능한 asset/version switch |
| 승인 기준 | Home 352×301 여부, site bounds, passage, final groundContact/sortY, collision right, art quality를 사용자가 별도 승인 |

현재 문서가 Home 변경을 승인하지 않는다. Step 1의 `right=1774` magic correction은 사용하지 않고, 완료된 half-open builder 기준으로 final collider를 검증한다.

## 단계 8 — 중요한 환경 오브젝트만 선택적 모듈화

| 항목 | 내용 |
|---|---|
| 수정 대상 | authored cluster와 선택된 prop/tree/wall objects, 필요한 layer assets/colliders |
| adapter/validator | cluster ownership, no duplicate pixels/asset responsibility, optional collider projection |
| 자동 테스트 | collision/interaction/state가 있는 대상만 독립 object인지 검사; protected passages; draw/asset budgets |
| 시각 회귀 | 제거 전/후 cluster seam, depth, collision debug, mobile/desktop |
| 완료 조건 | 독립 gameplay 책임이 증명된 항목만 분리; 꽃/잔디/작은 돌 object 0 |
| rollback | prop layer를 cluster asset/version으로 되돌릴 수 있는 지역 단위 rollback |
| 승인 기준 | 각 분리의 gameplay 또는 계측 근거와 비용 승인 |

우선 후보는 Home site의 가로등/벤치/벽, 실제 collider가 필요한 나무 몸통·울타리다. 장식 밀도를 이유로만 분리하지 않는다.

## 단계 9 — legacy authority 제거

| 항목 | 내용 |
|---|---|
| 수정 대상 | `worldMapV4Manifest.mjs`, `worldMapGeometry.mjs`, `worldMapCollision.mjs`의 legacy arrays; adapter의 legacy read path; obsolete asset/collision metadata |
| adapter/validator | native-only compiler; legacy API exports는 필요 시 generated facade로 유지 |
| 자동 테스트 | legacy literal 탐지, generated freshness, import graph, 전체 production suite, clean rebuild 재현성 |
| 시각 회귀 | 전체 맵 overview + 8 destination + foreground + minimap + Home 상태 |
| 완료 조건 | authored 숫자는 WorldObjects에 한 번만 존재; clean checkout에서 projections/assets/mask를 결정적으로 생성 |
| rollback | 제거 직전 tag/commit으로 전체 legacy source 복원. 이 단계 전까지 object-level rollback 유지 |
| 승인 기준 | 모든 id native, 두 release/QA cycle 안정, bundle/performance budget 충족 후 제거 승인 |

## 회귀 비교 상세

### 데이터 parity

- render: object/layer id, asset id, world rect, sort order, visibility mode
- collision: deep-equal collider projection + generated mask hash + changed cell count
- interaction: destination ids/aliases, point, inclusive activation boundary
- navigation: reachable cells, arrival, stalled frames, generated route endpoint
- minimap: 8 marker ids/points/lock/current/near state, guide polyline
- culling: representative camera별 queried object ids/chunks, rendered layer ids
- provenance: asset source/crop/generator가 inventory에는 있고 runtime projection에는 없음

### 시각 baseline

- 전체 overview clean/normal
- 각 destination approach
- player가 body/foreground 뒤와 앞에 있는 depth pair
- collision debug
- compact minimap과 full-map overlay
- 1280×720, 1440×900, 390×844, 844×390

Migration-only 단계 1–5는 의도된 visual change가 0이므로 pixel diff 0을 목표로 한다. WebP를 재인코딩하지 않기 때문에 lossy artifact 허용치를 둘 이유가 없다. 단계 6 이후 의도된 layer split은 변경 mask 밖 pixel diff 0을 요구한다.

## draw call, DOM/SVG, culling, memory, bundle 영향

### Draw call과 SVG node

- WorldObject wrapper를 DOM `<g>`로 반드시 만들 필요는 없다. renderer가 visible layer를 flat render item으로 바꾸면 logical hierarchy와 DOM 수를 분리할 수 있다.
- Library pilot는 1 layer이므로 `<image>` 1개 그대로다.
- foreground 분리는 대상 하나당 보통 `<image>` 1개 증가한다. 승인표에 object별 증가량을 기록한다.
- minimap은 모든 object를 그리지 않고 현재와 같이 8 marker + guide paths만 유지한다.

### Culling

- 1차: generated `visual.bounds` union으로 object cull
- 2차: object 통과 후 layer bounds/state로 layer cull
- rect는 half-open intersection으로 표준화하되, migration parity 단계에서는 current boundary-touch 결과 snapshot을 먼저 고정한다.
- large environment crop 분할은 object model의 필수 작업이 아니라 계측 기반 최적화다.

### 메모리

- schema 자체보다 decoded texture가 지배적이다. 전체 current 추정 129.5 MB다.
- 하나의 큰 transparent asset을 여러 layer로 분할하면 보이는 픽셀은 같아도 각 texture padding과 decode surface 합이 늘 수 있다. 분할 전후 `Σ(width×height×4)`를 비교한다.
- 반대로 큰 빈 crop을 tight layer들로 줄이면 decode memory와 overdraw가 감소할 수 있다. visual 정확도와 함께 측정해야 한다.
- collision object 수는 runtime movement memory에 영향을 거의 주지 않는다. packed mask 크기는 고정이다. full shapes를 production reason lookup에 유지할지는 별도 bundle 결정이다.

### Bundle

- authored provenance와 validator를 Client Component가 import하면 Next client graph에 포함된다. 반드시 generated lean module만 client가 읽는다.
- `worldMapV4Manifest.mjs`의 collision re-export 결합을 끊어 render consumer가 collision compiler/helper를 끌어오지 않게 한다.
- `worldMapGeometry.mjs`는 현재 blocked reason 때문에 collision helper를 runtime import한다. 초기 migration에서는 유지하고, 이후 dev-only 또는 compact reason projection을 별도 승인한다.
- generated module size, route data, provenance 누출을 build test로 계측한다. BFS route는 현재처럼 runtime cache할 수 있으며 모든 destination full path를 bundle에 미리 넣지 않는다.

## 중단 조건

다음 중 하나가 발생하면 다음 object로 넘어가지 않는다.

- collision mask changed cell > 0인 migration-only 단계
- current interaction boundary/route arrival 변화
- baseline 밖 visual pixel 변화
- client projection에 provenance/source path/Node import가 포함됨
- initial asset bytes 또는 image nodes가 이유 없이 증가
- object id가 legacy/native 양쪽 authority에 존재
- rollback이 object 하나 단위로 불가능
