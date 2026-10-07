# Test results

## Result

PASS. The final generated files are current, lint succeeds, the production build succeeds, and all focused and regression suites listed below pass.

| Area | Command / check | Result |
| --- | --- | --- |
| generated projection freshness | `node scripts/build-world-map-object-projections.mjs --check` | PASS |
| projection contract | `npm run test:world-object-projections` | PASS, 15 checks |
| schema contract | `node --test lib/worldMapObjectSchema.test.mjs` | PASS, 28 tests |
| Library pilot | `npm run test:world-library-object` | PASS, 7 checks |
| render layers | `npm run test:world-render-layers` | PASS, 7 unit tests + integration |
| collision | `npm run test:world-v4-collision` | PASS, 8 unit tests + 691,200-cell parity |
| authored routes | `npm run test:world-authored-routes` | PASS, 8/8 arrivals, 0 stalled |
| minimap | `npm run test:world-minimap` | PASS, 7 tests |
| minimap browser | `WORLD_MINIMAP_BROWSER_BASE_URL=http://localhost:3100 npm run test:world-minimap-browser` | PASS |
| Home hub | `npm run test:world-home-hub` | PASS |
| production integration | `npm run test:world-production` | PASS |
| v4 assets | `npm run test:world-v4-assets` | PASS |
| camera | `npm run test:world-camera` | PASS |
| lint | `npm run lint -- --quiet` | PASS |
| production build | `npm run build` | PASS, Next.js 16.2.7 webpack build |
| visual regression | 24 same-Chromium Step 5/Step 6 comparisons | PASS |

## Dedicated fixture assertions

The five-layer test object covers projection and union bounds, scale and offsets, explicit primary-layer selection, render-band order, stable character ties, object- and layer-level culling, declarative QA/state visibility, sparse-override duplicate suppression, invalid layer/asset/rotation/scale rejection, and collision independence.

The fixture is test-only. No fixture layer or asset appears in the generated production projections.
