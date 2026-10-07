# Visual regression

## Result

PASS: 24 viewport/mode comparisons completed with zero unexpected pixels, DOM image-node mismatches, visible-object order mismatches, asset-request mismatches, decoded-asset-byte mismatches, console errors, warnings, or missing assets.

The matrix covers desktop and mobile viewports across the production QA modes. All 12 static comparisons are pixel-exact. The remaining comparisons contain only the already-allowed animated character frames; their structural, asset, and ordering metrics are exact.

## Reference method

`fixtures/WorldMapScene.step5.js` is an exact copy of the accepted Step 5 renderer (`sha256 3670664d7327f9c236a60950b3b85459ea8847361de691b7549367903239e5df`). It was served from a temporary checkout and captured with the same Chromium executable and capture script as the Step 6 renderer. This removes browser/color-profile differences from the comparison.

The archived Step 5 PNGs embed an sRGB profile while the current Playwright screenshots do not. A direct raw-pixel comparison between those two capture paths therefore reports whole-frame color differences even though DOM geometry, asset bytes, node order, and same-environment pixels agree. The same-browser Step 5 fixture capture is the authoritative pixel reference.

## Production invariants

- The Library is one flat SVG `<image>` with the same asset, world rect, and ordering position.
- The south-gate foreground is still one node at the exact Step 5 world rect.
- Current production emits no object `ground`, object `foreground`, or object `overlay` group because those bands are empty.
- Object/image counts match Step 5 for every viewport and mode.
- The 31 runtime image assets have unchanged SHA-256 hashes and decoded bytes.

Machine-readable output is in `visual/current-render-layers/summary.json`; reference and current capture artifacts are under `visual/rollback-flat-reference/` and `visual/current-render-layers/`.
