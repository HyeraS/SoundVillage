# Authority Audit

Status: **PASS**

- Visual/layer/interaction/navigation/minimap/collision authority: `data/world-map-v4/worldObjects.mjs`.
- Build-only source metadata authority: `data/world-map-v4/sourceAssets.mjs`.
- Production consumers: generated literal projections through `lib/worldMapV4Manifest.mjs`.
- Collision runtime authority: `scripts/build-world-map-v4-collision.mjs` plus `lib/worldWalkableMaskData.mjs`; the Python builders explicitly identify themselves as legacy reference tools.
- `WorldMapDiagram.js` has no Home presentation literal. Legacy Home is used only by the adapter/rollback path, and the renderer requests no legacy Home image.
- Contract tests derive from authored/generated outputs and independently test boundaries. The culling test now enforces atomic union-bound culling for native multi-layer objects.
