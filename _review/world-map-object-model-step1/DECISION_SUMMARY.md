# WorldObject decision summary

## 결정

| 질문 | 권장 결정 |
|---|---|
| 권장 WorldObject authority | 지금은 **후보 3: compatibility adapter를 통한 점진 이전**, 최종 상태는 **후보 1: WorldObject가 visual/collision/interaction/navigation/minimap/state 의미의 authored authority** |
| 기존 collision 모듈 연결 | `WorldObject.collision.colliders`를 adapter/compiler가 기존 `WORLD_MAP_V4_COLLISION_OBJECTS` 형식으로 투영한다. `buildCollisionMasks`, rect/concave polygon, half-open bounds, 29×17 clearance, 4px max-pool, packed mask lookup은 그대로 유지한다. |
| authored/generated 경계 | 사람이 쓰는 값은 object id/kind/transform/layers/groundContact/collider/interaction/guide/minimap presentation/state/provenance. 생성 값은 visual bounds, sortY 기본값, approach/minimap point, legacy manifest/geometry/collision projections, asset metadata, culling index, collision mask, BFS route다. |
| 첫 pilot | **Library (`landmark-library`)**. Home은 art/site 좌표 변경 승인을 기다리므로 제외한다. |
| 작은 장식 정책 | 꽃·잔디·작은 돌·낮은 비상호작용 장식은 baked ground/static cluster에 남긴다. gameplay 책임이 생긴 벽·울타리·문·벤치·가로등·나무 몸통만 선택적으로 object화한다. |

## 왜 Library인가

- 독립 collider와 interaction point가 이미 있다.
- spawn에서 가까우며 generated route가 두 점이라 회귀 원인 추적이 쉽다.
- current visual은 한 layer이므로 pilot에서 SVG node/draw 결과를 정확히 보존할 수 있다.
- Home과 달리 승인 대기 중인 art/site 변경이 없다.

단, 두 legacy 차이는 adapter가 명시적으로 보존해야 한다.

- interaction id `Library`와 external/minimap id `Sound Library`
- asset-build semantic `sortReferenceY=1147`과 current runtime manifest `sortReferenceY=1010`; migration에서는 1010을 유지

## 프로덕션 구현 전 승인할 결정

1. 후보 3을 migration 방식으로, 후보 1을 최종 authority로 채택
2. Library를 첫 pilot으로 채택
3. canonical destination id를 정규화하고 legacy aliases를 adapter에서 유지할지
4. Library/Music current sortY를 compatibility groundContact로 사용할지, 별도 art 측정 후 native groundContact를 승인할지
5. authored source 형식을 pure MJS로 할지 JSON으로 할지
6. production blocked reason을 위해 full shapes를 client에 유지할지, dev-only/compact projection으로 바꿀지
7. foreground/occluder를 object-local layer로 world sort queue에 합치는 규칙
8. 단계 7에서 Home의 art, site, groundContact, approach, collision을 별도 승인한다는 경계

## 다음 단계에서 수정할 예상 파일

새 파일 예상:

- `lib/worldMapConstants.mjs`
- `lib/worldMapObjectSchema.mjs`
- `lib/worldMapObjectSchema.test.mjs`
- `data/world-map-v4/worldObjects.mjs`
- `scripts/world-map/legacy-world-object-adapter.mjs`
- `scripts/build-world-map-object-projections.mjs`
- `scripts/test-world-map-object-projections.mjs`
- `lib/generated/worldMapV4RuntimeObjects.mjs`
- `lib/generated/worldMapV4CollisionObjects.mjs`

pilot 연결 시 최소 수정 예상:

- `lib/worldMapV4Manifest.mjs`
- `lib/worldMapGeometry.mjs`
- `lib/worldMapCollision.mjs` — collider 선언의 import/projection 연결만; raster engine 재구현 금지
- `scripts/build-world-map-v4-collision.mjs` — world constants import 정리 가능, raster pipeline 불변
- `package.json` — build/test scripts

depth/foreground 단계 이후에만 수정 예상:

- `components/world-map/WorldMapScene.js`
- `components/WorldMap.js`
- `components/world-map/WorldMapDiagram.js`
- `lib/worldMapNavigation.mjs`
- `lib/worldMapMinimap.mjs`

## 주요 위험

1. **dual authority 고착**: adapter가 migration 종료 후에도 legacy와 native 값을 merge하면 drift를 숨긴다. id별 authority를 하나만 허용한다.
2. **collision 회귀**: destination box에서 collider를 재생성하거나 Step 1의 right=1774 보정을 되살릴 위험. 기존 projected shapes와 mask hash를 고정한다.
3. **depth drift**: asset builder semantic sort와 runtime sort가 이미 다르다. migration에서 자동 정정하지 않는다.
4. **client bundle 오염**: `'use client'` component가 authored provenance/validator/compiler를 import하면 모두 client graph로 들어갈 수 있다. lean generated projection만 import한다.
5. **빌드 순환/시간적 self-dependency**: runtime asset builder가 기존 generated asset module을 입력 목록으로 쓰는 패턴을 새 authored pipeline에 복제하지 않는다.
6. **draw node 폭증**: logical object를 DOM wrapper나 decoration 개체로 1:1 전개하지 않는다. Library pilot node 수는 0 변화가 기준이다.
7. **texture memory 증가**: multi-layer 분할 시 `Σ width×height×4`가 늘 수 있다. layer별 asset split은 depth/state 이득과 함께 승인한다.
8. **culling overdraw**: union bounds가 큰 object는 layer-level 2차 culling이 필요하다. half-open chunk boundary도 표준화 대상이다.
9. **interaction 경계 변경**: current activation은 inclusive `<=`, collision은 half-open이다. 두 규칙을 하나로 합치며 행동을 바꾸면 안 된다.
10. **Home 세대 혼합**: current production Home, Step 0, Step 1, 후속 collision fixture의 좌표를 한 object에 섞지 않는다.

## 승인 후 첫 구현의 완료 기준

- Library의 render/destination/collider/minimap/route/culling projection이 current와 deep-equal
- collision mask changed cells 0, mask hash 동일
- 네 viewport와 Library close-up의 pixel diff 0
- normal SVG image node, initial asset bytes, decoded bytes 변화 0
- authored provenance가 client generated module에 없음
- Library authority flag 하나로 즉시 legacy rollback 가능

이 문서 세트는 설계 단계에서 종료한다. 프로덕션 구현은 사용자 승인 후 시작한다.
