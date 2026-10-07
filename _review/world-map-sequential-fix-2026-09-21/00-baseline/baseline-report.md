# World map sequential fix — baseline

Captured on 2026-09-21 (Asia/Seoul) from the existing dirty worktree. No pre-existing tracked or untracked change was reverted.

## Repository and startup

- Next.js: `16.2.7`; relevant local Client Component and Image guides were read before implementation.
- `lib/animalVillageSunflowerConfig.mjs` exists and the Animal contract tests pass (8/8).
- `npm run lint`: PASS.
- `npm run test:world-production`: PASS, but the test only proved alternate BFS reachability; Animal, Music, and Human had zero whole-tile approach samples.
- `npm run test:world-v4-assets`: PASS; browser SSIM `0.961036`.
- `npm run test:world-v4-collision`: PASS.
- `npm run build`: the first Turbopack build remained at `Creating an optimized production build ...` for more than three minutes and was stopped for diagnosis. There was no compiler diagnostic before the stop.
- A pre-existing dev server was available at `http://localhost:3100`. Development QA queries bypass participant restoration and analytics/database writes.

## Asset baseline

| Set | Images | Compressed bytes | MiB | Estimated decoded RGBA | MiB |
|---|---:|---:|---:|---:|---:|
| Startup preload (12 terrain + 8 environment) | 20 | 66,819,562 | 63.72 | 222,648,064 | 212.33 |
| Manifest total | 30 | 115,739,525 | 110.38 | 393,558,656 | 375.33 |

The runtime `decodedBodySize` field is compressed response-body size, not decoded bitmap memory; decoded memory above is calculated as `width × height × 4`.

## Camera and browser baseline

All ordinary play viewports used the fixed `960 × 704` viewBox with `xMidYMid slice`.

| Viewport | Effective player CSS size | mapReady | mapReadyMs (warm local cache) | Runtime image resources |
|---|---:|---:|---:|---:|
| 1280×720 | 96×117.3 | true | 159.1 | 20 |
| 1440×900 | 108×132 | true | 159.1 | 20 |
| 390×844 | 80.6×98.5 | true | 159.1 | 20 |
| 844×390 | 63.3×77.4 | true | 159.1 | 20 |

The portrait viewport crops the horizontal field to roughly 10.2 tiles and visibly overlaps the D-pad, entry prompt, objective card, and QA control. The desktop 16:9 viewport crops the vertical field to roughly 15.6 tiles.

## Authored route reproduction

`?natureQa=1&worldLockQa=1&worldAutoWalk=Nature&worldCollisionDebug=1` was allowed to run for 14 seconds.

- `data-auto-walk-arrived`: `false`
- player top-left: `(1281, 1350)`
- foot: `(1317.3, 1430.0)`
- blocked axes: X and Y
- reason: `terrain:reference-mask`
- console error/warn: 0

## Screenshots

- `screenshots/spawn-1280x720.png`
- `screenshots/spawn-1440x900.png`
- `screenshots/spawn-390x844.png`
- `screenshots/spawn-844x390.png`
- `screenshots/overview-1280x720.png`
- `screenshots/nature-autowalk-1280x720.png`

