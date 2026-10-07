# Step 4 test results

All required commands passed on 2026-09-26 (Asia/Seoul).

| Command | Result |
| --- | --- |
| `npm run build:world-object-projections` | PASS |
| `npm run test:world-object-projections` | PASS, 15/15 |
| `node --test lib/worldMapObjectSchema.test.mjs` | PASS, 28/28 |
| `npm run test:world-v4-collision` | PASS, 8/8 plus integration |
| `npm run test:world-authored-routes` | PASS, 8/8 routes |
| `npm run test:world-minimap` | PASS, 7/7 |
| `npm run test:world-minimap-browser` | PASS |
| `npm run test:world-home-hub` | PASS, script plus 3/3 tests |
| `npm run test:world-production` | PASS, 9,916 reachable player-foot tiles |
| `npm run test:world-v4-assets` | PASS, 30 manifest assets / 12 panels / 18 semantic objects |
| `npm run test:world-camera` | PASS, 4/4 viewports |
| `npm run lint` | PASS |
| `npm run build` | PASS, Next.js 16.2.7 webpack production build |

Additional checks passed:

- deterministic `--check` output;
- compiler import-graph isolation;
- rebuild without existing generated files in a temporary tree;
- production facade generated imports;
- deep parity and nested immutability;
- optimized client chunk marker/duplication audit;
- browser DOM, asset, culling, label, and console checks.

The prohibited collision builder and runtime asset builder were not run.
