# World map flat-v2 release-candidate QA

## Verdict

PASS. The single ImageGen candidate passed the geometry, clarity, pixel-density, runtime, collision, responsive layout, destination, lint, and production-build gates.

## Runtime asset

- PNG master/runtime: 1448×1086 RGB, 3,303,072 bytes, SHA-256 `662323f4478bf3a9b6419e2c29d92b30a3df8ec61472455523ea658a14ff4601`
- Near-lossless WebP runtime: 1448×1086, 726,704 bytes, SHA-256 `d170a62ebfa5726355fe5331b3d51148bd1fa0af461c6d5870c14467559815ae`
- PNG/WebP PSNR: 32.4468 dB; ImageMagick normalized SSIM distortion: 0.0208497
- Runtime uses WebP first and retains PNG as the decode/error fallback.

## Responsive browser matrix

| Viewport | DPR | map CSS scale | character target/actual | map-ready | transfer | decoded | average FPS | slow frames |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1280×720 | 1 | 0.230556 | 52/52 px | 72.3 ms | 727,004 B | 6,290,112 B | 117.3 | 0 |
| 1440×900 | 1 | 0.293056 | 52/52 px | 64.3 ms | 727,004 B | 6,290,112 B | 117.9 | 0 |
| 1440×900 | 2 | 0.293056 | 52/52 px | 70.8 ms | 727,004 B | 6,290,112 B | 118.8 | 0 |
| 1920×1080 | 1 | 0.355556 | 52/52 px | 69.8 ms | 727,004 B | 6,290,112 B | 118.2 | 0 |
| 390×844 | 1 | 0.101563 | 40/40 px | 69.4 ms | 727,004 B | 6,290,112 B | 118.6 | 0 |
| 844×390 | 1 | 0.115972 | 40/40 px | 69.0 ms | 727,004 B | 6,290,112 B | 119.2 | 0 |

All six cases kept the 3840×2880 viewBox, `xMidYMid meet`, a fixed background rectangle during movement, no crop/distortion, zero failed assets, no horizontal overflow, and no minimap/full-map UI. The measured FPS is from headless Chromium on a high-refresh local runner and is comparative, not a promise for end-user hardware.

## Destination and collision QA

- Browser auto-walk + Enter + interior render + return passed for Lab, Animal, Urban, Music, Human, Nature, Home, and Sound Library.
- Six village returns restored the portal entry point (rounding variance at most 1 px).
- Home and Sound Library retained the existing central-spawn return contract.
- Flat-v2 Home: approach `(1288,1744)`, visual bounds `(1098,1369)–(1467,1719)`, collision `(1155,1470)–(1405,1705)`.
- Flat mask: 960×720 cells at 4 px, 636,464 walkable / 54,736 blocked, with 14×8 px player-foot clearance and 3 px movement substeps.
- Modular-v4 rollback mask remains unchanged and separately passes 636,624/636,624 reachable cells with zero reason mismatches.

## Commands

- `npm run lint` — PASS
- `NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA=true npm run build` — PASS (39/39 static pages)
- `npm run test:world-camera` — PASS
- `npm run test:world-flat-v2` — PASS
- `npm run test:world-production` — PASS (8/8 routes)
- `npm run test:world-authored-routes` — PASS
- `npm run test:world-v4-collision` — PASS
- `npm run test:character-render-size` — PASS
- `WORLD_MINIMAP_BROWSER_BASE_URL=http://localhost:3107 npm run test:world-minimap-browser` — PASS
- `WORLD_FLAT_V2_BROWSER_BASE_URL=http://localhost:3107 npm run test:world-flat-v2-browser` — PASS (6 cases)
- `WORLD_FLAT_V2_BROWSER_BASE_URL=http://localhost:3107 npm run test:world-flat-v2-destinations` — PASS (8 destinations)
- `git diff --check` — PASS

## Review artifacts

- `browser/`: six full-page screenshots
- `browser-metrics.json`: exact DOM geometry and performance readings
- `image-qa/approved-vs-flat-v2-game-size.png`: approved vs candidate at 1440×900 game display size
- `image-qa/approved-vs-flat-v2-100-percent-crop.png`: native 100% crop comparison
- `image-qa/browser-contact-sheet.png`: viewport overview (individual screenshots are authoritative for aspect ratio)

