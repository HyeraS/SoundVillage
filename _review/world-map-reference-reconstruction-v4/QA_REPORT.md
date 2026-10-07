# SoundVillage world-map reference reconstruction v4 QA

Date: 2026-09-21

## Result

PASS. The normal world scene now imports `worldMapV4Manifest.mjs`; it no longer
imports the rejected v3 manifest or paints its synthetic polylines, ellipses,
or procedural tree/prop loops.

## Visual registration

- visual registration reference: 2896×2172
- runtime raster source: 5792×4344 HD master (2× reference density)
- runtime world: 3840×2880
- ImageGen terrain-underlay panels: 12 (4×3)
- semantic layers: 17 (8 landmarks, 8 environment clusters, 1 foreground)
- HD master reconstruction mean RGB absolute error: 0/255
- HD master reconstruction differing pixel bounds: none
- HD-to-reference downsample mean RGB absolute error: 1.471516/255
- browser-to-browser SSIM: 0.961036 (target ≥ 0.95)
- browser-to-browser mean RGB absolute error: 6.598553/255
- browser console warnings/errors during capture: 0

The browser score compares the v4 panel capture with the earlier v2 browser
capture of the same clean source at the same 4:3 normalization. A separate
Pillow-resample diagnostic is retained in `visual-metrics.json` and is not used
as the browser layout score because its raster filter differs from Chromium.

## Collision and reachability

- mask: 960×720 at 4 world pixels per cell
- source: reference-registered road/plaza extraction, not v3 paths
- walkable clearance cells: 111,304
- disconnected cells: 0
- 1–2 cell pinch count: 3
- normal and large-delta movement samples: 18,368
- all eight destinations have a continuous reachable approach
- all six village triggers are centered on measured walkable entrance points
- QA mode unlocks all six villages for direct verification
- blocked samples verified: Nature water, library body, north forest,
  southwest garden, Music building

## Player visibility and entry regression

The broad landmark duplicate crops are now inspection-only and are not placed
in the normal depth-sorted gameplay layer. Buildings remain visible in the HD
environment layer below the player, so lamps, walls, and large polygon crops
cannot cover the local character at an entrance.

Browser verification at the measured entrance point passed for Lab, Animal,
Urban, Music, Human, and Nature: map ready, player visible, no locked label,
zero landmark depth overlays, and successful Enter transition.

## Browser artifacts

- `09-browser-full-map.png`: clean v4 overview
- `10-browser-terrain-only.png`: twelve source panels
- `11-browser-objects-only.png`: semantic environment/landmark layers
- `12-browser-foreground-only.png`: south gate foreground
- `13-browser-collision.png`: registered collision overlay
- `10-approach-lab.png` through `10-approach-nature.png`: six live entrance checks
- `19-browser-vs-browser-reference.png`: equal-condition comparison
- `20-browser-render-diff-heatmap.png`: browser render difference

## Automated checks

- `npm run lint`: PASS
- `npm run test:world-v4-assets`: PASS
- `npm run test:world-v4-collision`: PASS
- `npm run test:world-production`: PASS
