# Step 10 Release File List

Exactly **45** paths are present in the isolated release candidate. Every path was selected by the Step 9 manifest; no review-only or unrelated path is included.

## 1. Authored object model — 8

- `data/world-map-v4/legacyCollisionObjects.mjs`
- `data/world-map-v4/legacyWorldMapV4.mjs`
- `data/world-map-v4/sourceAssets.mjs`
- `data/world-map-v4/worldObjects.mjs`
- `lib/worldMapCollisionContract.mjs`
- `lib/worldMapObjectSchema.mjs`
- `scripts/build-world-map-object-projections.mjs`
- `scripts/world-map/legacy-world-object-adapter.mjs`

## 2. Render-layer infrastructure — 4

- `components/world-map/WorldMapScene.js`
- `lib/worldMapRenderLayers.mjs`
- `lib/worldMapRenderLayers.test.mjs`
- `scripts/test-world-map-render-layers.mjs`

## 3. Collision infrastructure — 6

- `lib/worldMapCollision.mjs`
- `lib/worldMapCollision.test.mjs`
- `lib/worldMapGeometry.mjs`
- `scripts/build-world-map-hd-assets.py`
- `scripts/build-world-map-v4-collision.mjs`
- `scripts/build-world-map-v4-collision.py`

## 4. Asset pipeline — 3

- `lib/worldMapV4Assets.mjs`
- `scripts/build-world-map-v4-runtime-assets.mjs`
- `scripts/test-world-map-v4-assets.mjs`

## 5. Approved Home assets — 4

- `design/world-map-v4/source-assets/landmark-home-player-building.png`
- `design/world-map-v4/source-assets/landmark-home-player-site-ground.png`
- `public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-building.webp`
- `public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-site-ground.webp`

## 6. Generated projections and masks — 7

- `lib/generated/worldMapV4CollisionObjects.mjs`
- `lib/generated/worldMapV4RuntimeObjects.mjs`
- `lib/worldWalkableMaskData.mjs`
- `public/assets/world/sound-archive-garden-v4/collision-build.json`
- `public/assets/world/sound-archive-garden-v4/collision-debug.png`
- `public/assets/world/sound-archive-garden-v4/obstacle-mask.png`
- `public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png`

## 7. Production consumers and scripts — 4

- `components/world-map/WorldMapDiagram.js`
- `lib/worldMapMinimap.mjs`
- `lib/worldMapV4Manifest.mjs`
- `package.json`

## 8. Tests — 9

- `lib/worldMapObjectSchema.test.mjs`
- `scripts/test-world-map-hd-collision.mjs`
- `scripts/test-world-map-home-circulation.mjs`
- `scripts/test-world-map-home-hub.mjs`
- `scripts/test-world-map-home-object-pilot.mjs`
- `scripts/test-world-map-library-object-pilot.mjs`
- `scripts/test-world-map-minimap-browser.mjs`
- `scripts/test-world-map-object-projections.mjs`
- `scripts/test-world-map-production-integration.mjs`

Total: **8 + 4 + 6 + 3 + 4 + 7 + 4 + 9 = 45**.
