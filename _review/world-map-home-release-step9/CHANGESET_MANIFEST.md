# Changeset Manifest

Status: **PASS**

The exact Home release candidate is **45 files**. It was overlaid on pristine `HEAD` without `.git`, `_review`, `tmp`, `.codex`, attachments, or local environment files and passed the release suite. The machine-readable manifest records every current modified/untracked file individually.

## Counts

- Home release required/authored/code: 35
- Regenerable generated (still required in the commit candidate): 10
- Review-only: 108
- Unrelated pre-existing dirty: 1341
- Unknown: 0

## Exact candidate

| Path | Git state | Source kind | Include |
|---|---|---|---|
| `components/world-map/WorldMapDiagram.js` | tracked-modified | authored/code | yes |
| `components/world-map/WorldMapScene.js` | tracked-modified | authored/code | yes |
| `data/world-map-v4/legacyCollisionObjects.mjs` | untracked | authored/code | yes |
| `data/world-map-v4/legacyWorldMapV4.mjs` | untracked | authored/code | yes |
| `data/world-map-v4/sourceAssets.mjs` | untracked | authored/code | yes |
| `data/world-map-v4/worldObjects.mjs` | untracked | authored/code | yes |
| `design/world-map-v4/source-assets/landmark-home-player-building.png` | untracked | source | yes |
| `design/world-map-v4/source-assets/landmark-home-player-site-ground.png` | untracked | source | yes |
| `lib/generated/worldMapV4CollisionObjects.mjs` | untracked | generated | yes |
| `lib/generated/worldMapV4RuntimeObjects.mjs` | untracked | generated | yes |
| `lib/worldMapCollision.mjs` | untracked | authored/code | yes |
| `lib/worldMapCollision.test.mjs` | untracked | authored/code | yes |
| `lib/worldMapCollisionContract.mjs` | untracked | authored/code | yes |
| `lib/worldMapGeometry.mjs` | tracked-modified | authored/code | yes |
| `lib/worldMapMinimap.mjs` | tracked-modified | authored/code | yes |
| `lib/worldMapObjectSchema.mjs` | untracked | authored/code | yes |
| `lib/worldMapObjectSchema.test.mjs` | untracked | authored/code | yes |
| `lib/worldMapRenderLayers.mjs` | untracked | authored/code | yes |
| `lib/worldMapRenderLayers.test.mjs` | untracked | authored/code | yes |
| `lib/worldMapV4Assets.mjs` | tracked-modified | generated | yes |
| `lib/worldMapV4Manifest.mjs` | tracked-modified | authored/code | yes |
| `lib/worldWalkableMaskData.mjs` | tracked-modified | generated | yes |
| `package.json` | tracked-modified | authored/code | yes |
| `public/assets/world/sound-archive-garden-v4/collision-build.json` | tracked-modified | generated | yes |
| `public/assets/world/sound-archive-garden-v4/collision-debug.png` | tracked-modified | generated | yes |
| `public/assets/world/sound-archive-garden-v4/obstacle-mask.png` | tracked-modified | generated | yes |
| `public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-building.webp` | untracked | generated | yes |
| `public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-site-ground.webp` | untracked | generated | yes |
| `public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png` | tracked-modified | generated | yes |
| `scripts/build-world-map-hd-assets.py` | tracked-modified | authored/code | yes |
| `scripts/build-world-map-object-projections.mjs` | untracked | authored/code | yes |
| `scripts/build-world-map-v4-collision.mjs` | tracked-modified | authored/code | yes |
| `scripts/build-world-map-v4-collision.py` | tracked-modified | authored/code | yes |
| `scripts/build-world-map-v4-runtime-assets.mjs` | tracked-modified | authored/code | yes |
| `scripts/test-world-map-hd-collision.mjs` | tracked-modified | authored/code | yes |
| `scripts/test-world-map-home-circulation.mjs` | untracked | authored/code | yes |
| `scripts/test-world-map-home-hub.mjs` | tracked-modified | authored/code | yes |
| `scripts/test-world-map-home-object-pilot.mjs` | untracked | authored/code | yes |
| `scripts/test-world-map-library-object-pilot.mjs` | untracked | authored/code | yes |
| `scripts/test-world-map-minimap-browser.mjs` | tracked-modified | authored/code | yes |
| `scripts/test-world-map-object-projections.mjs` | untracked | authored/code | yes |
| `scripts/test-world-map-production-integration.mjs` | tracked-modified | authored/code | yes |
| `scripts/test-world-map-render-layers.mjs` | untracked | authored/code | yes |
| `scripts/test-world-map-v4-assets.mjs` | tracked-modified | authored/code | yes |
| `scripts/world-map/legacy-world-object-adapter.mjs` | untracked | authored/code | yes |

## Exclusions

Review evidence and all unrelated dirty files are excluded. See `changeset-manifest.json` for the exact per-file classification, dependency reason, and missing-file consequence. No files were staged or committed.
