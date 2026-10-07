# Test Results

Final status: **PASS**

| Validation | Result |
|---|---|
| `node --test lib/worldMapObjectSchema.test.mjs` | PASS, 28/28 |
| `npm run test:world-object-projections` | PASS, 15/15 |
| `npm run test:world-library-object` | PASS, 7/7 |
| `npm run test:world-home-object` | PASS, 7/7 |
| `npm run test:world-render-layers` | PASS, 7/7 + integration checks |
| `npm run test:world-v4-collision` | PASS, 8/8 + 691,200-cell integration |
| `npm run test:world-authored-routes` | PASS, all 8 destinations |
| `npm run test:world-home-circulation` | PASS, 7 cases / 9 directed routes |
| `npm run test:world-minimap` | PASS, 7/7 |
| `npm run test:world-minimap-browser` | PASS |
| `npm run test:world-home-hub` | PASS, script + 3/3 |
| `npm run test:world-production` | PASS |
| `npm run test:world-v4-assets` | PASS |
| `npm run test:world-camera` | PASS, four viewports |
| runtime asset `--check` | PASS, 33 files / 32 registry entries / 0 re-encoded |
| projection `--check` | PASS |
| `npm run lint -- --quiet` | PASS |
| `npm run build` | PASS, Next.js 16.2.7 production build |
| `git diff --check` | PASS |

The minimap browser command first stopped because `WORLD_MINIMAP_BROWSER_BASE_URL` was not supplied. After supplying `http://localhost:3100`, its first Chromium launch was blocked by the macOS sandbox (`MachPortRendezvousServer: Permission denied`). The same required script was then rerun with the permitted browser-launch environment and passed all canonical markers, dialog/focus, movement blocking, synchronization, arrival, responsive layout, console, and asset-loading checks. No product code change was used to hide either environment failure.

Production build emitted only Node's `module.register()` deprecation warning; compilation, TypeScript, 37 static pages, and build traces completed successfully. This build-time Node warning is not a browser console warning and is unrelated to the Step 8 runtime.

Open issues: none.

