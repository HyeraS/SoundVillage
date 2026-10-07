# WorldObject schema step test results

Run on 2026-09-26 (Asia/Seoul).

## Schema

- `node --test lib/worldMapObjectSchema.test.mjs` — PASS, 28/28 tests.
- `node --check lib/worldMapObjectSchema.mjs` — PASS.
- `node --check lib/worldMapObjectSchema.test.mjs` — PASS.
- `npx eslint lib/worldMapObjectSchema.mjs lib/worldMapObjectSchema.test.mjs` — PASS.
- No `test:world-object-schema` package script was added because `package.json` already contained unrelated user changes and the direct required command is sufficient.

Coverage includes the valid Library fixture, union/world bounds, world/local transforms, default and legacy sort, native-profile migration-field rejection, exact collider projection, object-local projection, concave polygon, decorative-nonblocking, approach/minimap derivation, aliases, duplicate IDs, empty/invalid shapes, finite coordinates, transform restrictions, depth/interaction requirements, visual enums, state serialization, provenance crop, collision authority conflict, boundary separation, and runtime provenance exclusion.

## Existing regression suite after implementation

| Command | Result |
|---|---|
| `npm run test:world-v4-collision` | PASS; 8/8 unit tests and full integration validation |
| `npm run test:world-authored-routes` | PASS; all 8 destinations arrived |
| `npm run test:world-minimap` | PASS; 7/7 |
| `npm run test:world-home-hub` | PASS; integration + 3/3 |
| `npm run test:world-production` | PASS |
| `npm run test:world-v4-assets` | PASS |
| `npm run test:world-camera` | PASS |
| `npm run lint` | PASS |

## Integrity checks

- Collision mask/artifact hashes before vs after: 0 changes.
- Packed mask module hash before vs after: 0 changes.
- All 31 runtime asset hashes before vs after: 0 changes.
- `worldMapV4Manifest.mjs`, `worldMapGeometry.mjs`, and `worldMapCollision.mjs`: identical hashes.
- Navigation, minimap, asset registry, scene, diagram, and package files: identical hashes.
- Library production render/collider/minimap/navigation/culling values: unchanged and asserted by tests.
- Component imports: unchanged; the only `worldMapObjectSchema` import is in its test file.
- Production client graph: no schema/provenance import.
- `git diff --check` for the new schema files: PASS.

## Result

PASS. The change remains isolated from production consumers and generated assets.
