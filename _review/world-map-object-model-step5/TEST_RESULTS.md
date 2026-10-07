# Test results

All required commands passed on 2026-09-26 (Asia/Seoul).

| Command | Result |
| --- | --- |
| `npm run build:world-object-projections` | PASS |
| `node scripts/build-world-map-object-projections.mjs --check` | PASS |
| `npm run test:world-object-projections` | PASS, 15/15 |
| `node --test lib/worldMapObjectSchema.test.mjs` | PASS, 28/28 |
| `node scripts/test-world-map-library-object-pilot.mjs` | PASS, 7/7 |
| `npm run test:world-library-object` | PASS, 7/7 |
| `npm run test:world-v4-collision` | PASS, 8/8 plus integration |
| `npm run test:world-authored-routes` | PASS, 8/8 arrivals |
| `npm run test:world-minimap` | PASS, 7/7 |
| `npm run test:world-minimap-browser` | PASS |
| `npm run test:world-home-hub` | PASS, script plus 3/3 |
| `npm run test:world-production` | PASS, 9,916 reachable foot tiles |
| `npm run test:world-v4-assets` | PASS |
| `npm run test:world-camera` | PASS, 4/4 viewports |
| `npm run lint` | PASS |
| `npm run build` | PASS, Next.js 16.2.7 webpack |

The prohibited collision-mask builder and runtime-asset builder were not run. There was one expected Node deprecation warning from the installed build toolchain (`module.register()`); compilation, type checking, 37 static pages, and build traces completed successfully.
