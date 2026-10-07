# WorldObject schema step baseline

Recorded on 2026-09-26 (Asia/Seoul). The snapshot was taken before schema code was added and was rechecked after implementation. No asset builder or collision builder was run.

## Worktree state

The worktree was already dirty. Existing modified files included `lib/worldMapGeometry.mjs`, `lib/worldMapV4Manifest.mjs`, `lib/worldWalkableMaskData.mjs`, `package.json`, collision artifacts, and collision/build test scripts. Existing untracked work included `lib/worldMapCollision.mjs`, `lib/worldMapCollision.test.mjs`, review directories, design files, and other user work.

This step did not reset, restore, clean, commit, push, deploy, regenerate collision masks, or regenerate runtime assets. The only files directly added by this step are the two schema files and this review directory.

## Pre-implementation test baseline

All requested commands passed before implementation:

| Command | Result |
|---|---|
| `npm run test:world-v4-collision` | PASS; 8 unit tests, 691,200-cell reason parity, 0 disconnected cells |
| `npm run test:world-authored-routes` | PASS; all 8 destinations arrived |
| `npm run test:world-minimap` | PASS; 7 tests |
| `npm run test:world-home-hub` | PASS; integration + 3 unit tests |
| `npm run test:world-production` | PASS; 9,916 reachable player-foot tiles |
| `npm run test:world-v4-assets` | PASS; 30 assets, 12 terrain panels, 18 semantic objects |
| `npm run test:world-camera` | PASS; 4 viewports |
| `npm run lint` | PASS |

## Library baseline

- Object ID: `landmark-library`
- Manifest interaction ID: `Library`
- External destination/minimap ID: `Sound Library`
- Canonical fixture destination ID: `sound-library`
- Runtime render rectangle: `(1146.9613259668508, 828.7292817679557)` with size `1544.7513812154696 × 716.0220994475138`
- Runtime visual bounds: `[1146.9613259668508, 828.7292817679557)–[2691.7127071823206, 1544.7513812154696)`
- Runtime sort reference: `1010`; world `sortY=1339.2265193370165`
- Asset-build semantic sort reference: `1147`; scaled world value `1520.8839779005525`
- Migration rule: keep the runtime value; do not auto-correct it to the asset-build value
- Asset: `landmark-library`, display file `1545 × 717`, 249,172 encoded bytes
- Destination tile box: `(tx=54, ty=37, w=12, h=8)`
- Interaction/minimap/route endpoint: `(1918, 1438)`
- Collider: `library-body`, `building-body`, rect `[1728,2112) × [1184,1398)` as structured precisely in `baseline.json`
- Generated navigation route: `(1920,1504) → (1918,1438)`
- Spatial-index chunks: 12 keys recorded in `baseline.json`

## Integrity baseline

The collision mask, packed mask, runtime asset, production module, component, and package hashes are recorded in `baseline.json`. The same hash set was measured after implementation with zero changes.
