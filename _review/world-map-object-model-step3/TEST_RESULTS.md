# Step 3 test results

Run on 2026-09-26 (Asia/Seoul).

## New pipeline

| Command | Result |
|---|---|
| `node --test lib/worldMapObjectSchema.test.mjs` | PASS, 28/28 |
| `node scripts/test-world-map-object-projections.mjs` | PASS, 13/13 |
| `npm run test:world-object-projections` | PASS, 13/13 |
| `npm run build:world-object-projections` twice | PASS; both generated hashes identical |
| `node scripts/build-world-map-object-projections.mjs --check` | PASS |
| stale generated file + `--check` | expected FAIL, exit 1 |
| regenerated file + `--check` | PASS, exit 0 |
| targeted ESLint for new files | PASS |

## Existing regression suite

| Command | Result |
|---|---|
| `npm run test:world-v4-collision` | PASS; 8/8 unit tests, 691,200-cell integration, 0 reason mismatches, 0 disconnected cells |
| `npm run test:world-authored-routes` | PASS; all 8 destinations arrived |
| `npm run test:world-minimap` | PASS, 7/7 |
| `npm run test:world-home-hub` | PASS; integration and 3/3 unit tests |
| `npm run test:world-production` | PASS; 9,916 reachable player-foot tiles |
| `npm run test:world-v4-assets` | PASS; 30 registrations, 12 panels, 18 semantic objects |
| `npm run test:world-camera` | PASS; 4 viewports |
| `npm run lint` | PASS |
| `git diff --check` | PASS |

## Integrity

- Collision artifact and packed-mask hash changes: 0/5.
- Runtime WebP hash changes: 0/31.
- Production/consumer hash changes excluding `package.json`: 0/10.
- Component import graph changes: 0; scene and diagram hashes are unchanged.
- Generated projection references outside build/test code: 0.
- Generated provenance/source metadata, Node import, React/browser import, validator code, timestamp, and absolute local path: 0 findings.

No collision builder, asset builder, deployment, commit, or push command was run.
