# SoundVillage world-map HD and collision QA

Date: 2026-09-20

## Outcome

The low-resolution cause was the 2896×2172 source being enlarged to the 3840×2880 world and then enlarged again by the 30×22 camera. The runtime sharpen convolution and `crisp-edges` only emphasized halos and stair stepping. The replacement is a registered 5792×4344 master/runtime image, naturally downsampled with `imageRendering: auto`; the old runtime filter is removed and the HD asset is preloaded without displaying an enlarged low-resolution fallback.

Invisible walls came from an analytic ellipse/segment/rectangle approximation plus two foot-edge samples. Runtime and tests now import one packed 960×720 clearance mask (4 world-px/cell), use one foot-center lookup after the complete 28×16 foot area is baked into the mask, and use a shared 3px sub-step X/Y sliding movement function.

## Registration and visual QA

- world/camera preserved: 120×90 tiles, 32px/tile, 30×22 default camera;
- master/runtime: 5792×4344, exact 4:3, exact 2× source registration;
- road-center and landmark-silhouette offset: 0px by construction;
- runtime compression: 5,021,332 bytes versus 4,253,049 bytes for the former PNG;
- local server transfer (3 runs): old 4.394–10.053ms; new 4.620–6.069ms;
- estimated decoded RGBA memory: old 25,158,912 bytes; new 100,635,648 bytes;
- no runtime sharpen filter, `crisp-edges`, white tile seam, or low-res flash;
- captured at 1280×720, 1440×900, 1920×1080, 390×844, and 844×390;
- direct browser DPR was 1. DPR 2 was not exposed by the in-app viewport API; the 2× intrinsic master and `03-resolution-200-percent-crop.png` provide the raster-density inspection, but this is not a separate native DPR 2 browser capture.

## Collision coverage

- mask: 960×720, 4 world-px/cell;
- clearance cells: 111,304;
- 4-connected reachable cells: 111,304;
- disconnected cells: 0;
- 1–2-cell pinch candidates: 3 (edge endpoints, no route stall);
- production movement samples: 18,368 across cardinal/diagonal inputs and 1×/3× delta;
- maximum 60fps stall on tested routes: 0 frames;
- obstacle samples blocked: Nature water, library body, north forest, southwest garden, Music building.

## Removed mismatch locations

The before/after pairs mark positions that were visually on the path, failed the previous two-sample analytic collision, and are inside the new clearance mask:

| Location | Tile coordinate | Result |
|---|---:|---|
| east plaza curve / ring join | 82.94, 43.94 | walkable |
| west plaza curve / ring join | 39.56, 38.31 | walkable |
| Animal branch | 86.69, 22.69 | walkable |
| Nature bridge/gate | 9.31, 39.81 | walkable |
| Music flowerbed lane | 86.19, 62.06 | walkable |
| Home branch | 42.19, 27.31 | walkable |
| Human market/bench lane | 29.56, 57.94 | walkable |
| Urban gate | 102.69, 39.31 | walkable |

## Destination and input results

The shared production movement function reached Lab, Animal, Urban, Music, Human, Nature, Sound Library, and Home with the current speed, foot size, X/Y slide, and sub-steps. All paths report zero 500ms stalls. Enter/Space/mobile confirmation still share `activateNearbyDestination`; Music-first lock wiring, analytics, duo synchronization, and Supabase flows were not changed.

Fresh browser input from the default spawn was completed for Nature (touch movement, proximity cue, Enter, Nature component, return) and the spawn-adjacent Sound Library (cue, Enter, museum component, Escape return). A 3px collision-to-interaction gap found during this run was fixed by expanding the shared destination hitbox by 8px and using the same helper in runtime/tests. See `browser-entry-results.json` for the explicit limitation: the other six destinations and Home passed the current shared movement/transition contract, but were not all physically replayed from spawn in the browser during this pass.

## Artifacts

- before/after/resolution: `01-before-resolution.png`, `02-after-resolution.png`, `03-resolution-200-percent-crop.png`;
- full mask views: `04-full-map-collision-overlay.png`, `05-road-coverage-only.png`, `06-obstacle-coverage-only.png`, `07-runtime-collision-debug.png`;
- responsive captures: `08-desktop-1440x900.png` through `11-mobile-landscape-844x390.png`;
- browser entry captures: `12-nature-entered-by-walking.png`, `14-library-entered-by-walking.png`;
- eight blockage before/after pairs: `block-01-*` through `block-08-*`;
- metrics: `resolution-performance-comparison.json`, `collision-coverage-validation.json`, `collision-portal-validation.json`, `browser-entry-results.json`.

## Final command results

- `npm run lint`: PASS;
- `node scripts/verify-world-map-reskin.mjs`: PASS;
- `npm run test:world-production`: PASS;
- `npm run test:world-hd-collision`: PASS;
- `npm run test:input-lifecycle`: 2/2 PASS;
- `npm run test:stage-6-lifecycle`: 8/8 PASS;
- `npm run build -- --webpack`: PASS, 28/28 static pages generated.
