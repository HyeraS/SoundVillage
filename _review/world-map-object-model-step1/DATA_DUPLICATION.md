# World map v4 data duplication

## 판정 기준

- **authority**: 사람이 값을 바꿀 때 실제 동작을 바꾸는 현재 원천
- **duplicate**: 같은 의미의 값을 둘 이상의 authored 위치에 기록
- **derived**: 다른 authority에서 계산되므로 중복 원천이 아님
- **generated**: 빌드 산출물이며 손으로 수정하면 안 됨
- 모든 좌표는 별도 표시가 없으면 world top-left 원점의 pixel이다.

## 공통 중복

| 의미 | 위치 A | 위치 B | 판정 |
|---|---|---|---|
| world 3840×2880, tile 32 | `lib/worldMapV4Manifest.mjs:9-20` | `lib/worldMapGeometry.mjs:7-11` | authored duplicate |
| 8 destination tile boxes/approach | `lib/worldMapV4Manifest.mjs:26-35` | `lib/worldMapGeometry.mjs:20-33` | authored duplicate; 현재 값은 일치 |
| landmark source crop boxes | `scripts/build-world-map-v4-assets.py:37-46` | `lib/worldMapV4Manifest.mjs:109-121` | authored duplicate |
| semantic crop metadata | `scripts/build-world-map-v4-assets.py` | generated `asset-manifest.json` | 정상 generated copy |
| runtime asset dimensions | generated `lib/worldMapV4Assets.mjs` | 파일 자체와 generated `asset-manifest.json` | 정상 generated copy, 두 manifest의 목적은 다름 |
| collision 소유권 | `lib/worldMapCollision.mjs` | manifest의 모든 object에 `collision: []` | 실제 authority와 오해를 부르는 빈 duplicate shell |
| marker point | geometry destination | `WORLD_MINIMAP_DESTINATIONS` | 정상 runtime derived |
| marker presentation | `components/GameEngine.js:11-18` | `components/world-map/WorldMapDiagram.js:14-17` | zone vs landmark로 분리된 authored data |
| authored guide road | `WORLD_MAP_V4_PATHS` | navigation result의 `authoredPoints` | 정상 참조; 실제 route authority는 아님 |

## 같은 좌표가 갖는 서로 다른 의미

목적지 `tx/ty/w/h`는 interaction fallback box처럼 보이지만 현재 세 사례에서는 collision rect와 거의 같은 footprint를 중복 표현한다. 그럼에도 정확히 일치하지 않는다.

| 사례 | destination tile box를 px로 변환 | collision rect | 차이 | approach |
|---|---|---|---|---|
| Home | `[1536,1472)–[1792,1760)` | `[1536,1472)–[1792,1752)` | collision bottom이 8px 짧음 | `(1664,1792)` |
| Library | `[1728,1184)–[2112,1440)` | `[1728,1184)–[2112,1398)` | collision bottom이 42px 짧음 | `(1918,1438)` |
| Music | `[3040,2080)–[3392,2432)` | `[3040,2080)–[3392,2430)` | collision bottom이 2px 짧음 | `(3166,2470)` |

현재 collision rect는 완료된 물리 authority다. destination tile box에서 재계산하거나 두 값을 자동으로 같게 만들면 안 된다. 새 스키마에서는 legacy destination box를 interaction compatibility 출력으로만 취급하고, collision은 명시적인 collider 선언에서만 투영해야 한다.

## 사례 1 — Home

### 현재 데이터 위치

| 정보 | 현재 값 | 파일/생성 경로 | 판정 |
|---|---|---|---|
| logical/render id | `landmark-home` | `worldMapV4Manifest.mjs:134-149` | render id |
| asset id | `landmark-home-hub` | 같은 위치 | authored link |
| visual position | `(1440,1368)` | 같은 위치; asset builder에도 `worldBox`가 중복 | authored duplicate |
| width/height | `448×384` | manifest, generated asset module, asset manifest | runtime manifest authored; asset metadata generated |
| visual bounds | `[1440,1368)–[1888,1752)` | position+size에서 파생 | derived |
| 실제 alpha>8 bounds | `[1523,1394)–[1846,1695)` | Step 0 findings | 분석값, runtime 미사용 |
| anchor | local `(0,0)` | manifest `anchorX/Y` | authored이나 renderer는 x/y top-left로 직접 사용 |
| groundContact | 없음 | — | 결손; Step 0/1 제안값은 미래안 |
| depth/sortY | `1752` | manifest, asset builder `sortWorldY` | authored duplicate, 현재 일치 |
| collision | `[1536,1472)–[1792,1752)` | `worldMapCollision.mjs:32` | 물리 authority |
| interaction kind/id | `{type:'home', id:'Home'}` | manifest | authored |
| interaction/approach point | `(1664,1792)` | manifest destinations와 geometry `WORLD_HOME` | authored duplicate |
| interaction range | x ±64, y ±48, inclusive | geometry globals/functions | shared runtime rule |
| authored navigation guide | hub→`(1856,1568)`→`(1792,1696)`→approach | manifest `spoke-home` | authored minimap/guide path |
| actual navigation route | spawn→`(1810,1650)`→`(1810,1762)`→approach | mask BFS runtime result | derived, mask 변화 시 변함 |
| minimap point | `(1664,1792)` | geometry에서 `worldMapMinimap.mjs`가 파생 | derived |
| minimap presentation | label/icon/color + Home state CSS | `WorldMapDiagram.js`, CSS | separate authored/runtime state |
| culling bounds | visual bounds; chunks `2,2`, `3,2`, `2,3`, `3,3` | manifest spatial index | derived |
| state | `default/decorating/invite-ready/visitor` | `homeHub.mjs`, `WorldMap.js` | render object 밖의 runtime state |
| source asset | `design/world-map-v4/source-assets/landmark-home-player-hub-v1.png` | asset builder, asset manifest | build-only provenance |
| generation | source `getbbox()` crop → public intermediate PNG → display-size WebP | two asset builders | build-only |

### Home의 중요한 충돌

- 현재 sortY 1752, 실제 의미 있는 그림 bottom 1695, Step 0/1 미래 groundContact 1696은 서로 다른 개념/세대의 값이다.
- Step 1의 temporary collider right 1774는 완료된 half-open collision 개선이 대체했다. 현재 production Home은 right 1792이고 미래 fixture는 right 1776을 보정 없이 허용한다.
- Home은 art/site 변경 예정이므로 schema 첫 pilot로 사용하면 현재값 보존과 미래값 승인을 동시에 처리해야 한다. 첫 pilot에서 제외한다.

## 사례 2 — Library

### 현재 데이터 위치

| 정보 | 현재 값 | 파일/생성 경로 | 판정 |
|---|---|---|---|
| logical/render id | `landmark-library` | `worldMapV4Manifest.mjs:113` | authored |
| destination naming | render interaction id `Library`, portal/minimap id `Sound Library` | manifest, geometry | semantic alias drift |
| source crop | reference `[865,625)–[2030,1165)` + polygon | asset builder와 manifest | authored duplicate |
| visual position | `(1146.9613,828.7293)` | reference crop × 3840/2896 | manifest runtime 계산 |
| width/height | `1544.7514×716.0221`; WebP `1545×717` | manifest float vs generated asset integer | 의도된 display rounding 차이 |
| visual bounds | `[1146.9613,828.7293)–[2691.7127,1544.7514)` | position+size | derived |
| anchor | local `(0,0)` | manifest | authored, top-left placement |
| groundContact | 없음 | — | 결손 |
| depth/sortY | `1339.2265` = ref y 1010 × scale | runtime manifest | current gameplay authority |
| builder semantic sort | ref y 1147 | asset builder/asset manifest | build metadata drift; runtime에 쓰지 않음 |
| collision | `[1728,1184)–[2112,1398)` | collision module | 물리 authority |
| interaction point | `(1918,1438)` | manifest destinations + geometry museum | authored duplicate |
| authored navigation guide | hub→approach | `spoke-library` | authored |
| actual navigation route | spawn `(1920,1504)`→approach | mask BFS | derived |
| minimap | point derived; `Sound Museum`, `🏛`, `#C8A96E` 별도 authored | minimap + diagram | split |
| culling bounds | visual bounds; 12 spatial chunks | manifest index | derived; 큰 transparent crop 때문에 보수적 |
| source asset | HD master crop `(1730,1250)–(4060,2330)` | asset manifest | build-only provenance |
| generation | masked HD crop → runtime resize/WebP | asset builders | build-only |

### Library가 pilot에 적합한 이유

- spawn과 가깝고 actual route가 2점뿐이라 interaction/navigation 회귀 원인이 작다.
- 독립 collider와 명확한 interaction point가 이미 있다.
- asset는 크지만 한 layer라 baseline draw 결과를 비교하기 쉽다.
- Home처럼 승인 대기 중인 art/site 좌표가 없다.
- 단, `sortReferenceY 1010` 대 builder metadata `1147` drift와 `Library`/`Sound Library` alias를 adapter가 현재 동작 그대로 고정해야 한다.

## 사례 3 — Music

Music은 Home 외의 기존 랜드마크 대표 사례로 선택했다. 큰 crop, 긴 route, zone metadata, map edge culling을 함께 검증할 수 있기 때문이다.

| 정보 | 현재 값 | 파일/생성 경로 | 판정 |
|---|---|---|---|
| logical/render/destination id | `landmark-music` / `Music` | manifest, geometry | id mapping authored |
| source crop | ref `[2160,1360)–[2896,2115)` + polygon | asset builder와 manifest | authored duplicate |
| visual position | `(2864.0884,1803.3149)` | manifest scale transform | authored source + derived world |
| width/height | `975.9116×1001.1050`; WebP `976×1002` | manifest vs generated asset | display rounding 차이 |
| visual bounds | `[2864.0884,1803.3149)–[3840,2804.4199)` | derived | 오른쪽 월드 경계 접촉 |
| anchor | local `(0,0)` | manifest | authored, top-left placement |
| groundContact | 없음 | — | 결손 |
| depth/sortY | `2532.5967` = ref y 1910 × scale | runtime manifest | current gameplay authority |
| builder semantic sort | ref y 2097 | asset builder/asset manifest | build metadata drift |
| collision | `[3040,2080)–[3392,2430)` | collision module | 물리 authority |
| interaction point | `(3166,2470)` | manifest destinations + geometry portal | authored duplicate |
| authored navigation guide | hub→`(2250,1690)`→`(2500,1920)`→`(2860,2140)`→approach | manifest | authored road/minimap |
| actual navigation route | 10 BFS/simplified points; x≈3022 corridor 경유 | navigation runtime | derived |
| minimap point | `(3166,2470)` | geometry에서 파생 | derived |
| minimap presentation | `ZONE_META.Music` label/color/icon | `GameEngine.js` | 별도 authored |
| culling bounds | visual bounds; chunks `5..7 × 3..5` | manifest spatial index | derived; edge-touch over-registration 가능 |
| source asset | HD master crop `(4320,2720)–(5792,4230)` | asset manifest | build-only provenance |
| generation | masked HD crop → runtime resize/WebP | asset builders | build-only |

## 중복 제거 규칙

1. `id`는 kebab-case logical id 하나를 canonical key로 삼고 `destinationId`, 기존 label/route name은 adapter alias로 낸다.
2. destination `tx/ty/w/h`를 collision에서 만들지 않는다. 필요하면 interaction compatibility box로만 생성한다.
3. `navigation.approachPoint`와 minimap marker point는 `interaction.point`에서 파생한다. 별도 숫자를 허용하지 않는다.
4. `visual.bounds`와 culling bounds는 layer union에서 생성한다. 수동 복사를 금지한다.
5. native object의 `depth.sortY`는 `groundContact.y + offsetY`에서 생성한다. legacy pilot 동안만 explicit override를 허용하고 warning을 낸다.
6. collision shapes는 WorldObject authored source에 한 번만 존재하고 current `WORLD_MAP_V4_COLLISION_OBJECTS`는 adapter projection이어야 한다.
7. source crop/polygon/generator/provenance는 authored build 입력에 남기되 runtime projection에서는 제거한다.
8. generated modules과 JSON에는 `generatedFrom`, schema version, content hash를 기록해 stale artifact를 검출한다.
