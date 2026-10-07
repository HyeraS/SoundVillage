# Rollback

## Renderer-only rollback

The fastest rollback is to restore `components/world-map/WorldMapScene.js` from `fixtures/WorldMapScene.step5.js`. The fixture is byte-for-byte the accepted Step 5 scene source (`sha256 3670664d7327f9c236a60950b3b85459ea8847361de691b7549367903239e5df`). The flat `WORLD_MAP_V4_OBJECTS` compatibility export remains intact, so this rollback requires no authority, asset, mask, route, minimap, interaction, or collision change.

An equivalent targeted rollback is to remove the scene's `WORLD_MAP_V4_LAYER_OVERRIDES`/render-planner use and render the existing flat object list through the former object loop.

## Authority rollback

If native Library authority must also be rolled back, remove the Library authority candidate or switch its adapter selection back to legacy, then rebuild projections. The generated sparse override disappears while the compatibility flat and collision projections remain equivalent. The other 17 objects already use the legacy fallback.

## Verification after rollback

Run projection freshness, Library, production, collision, minimap, Home hub, lint, build, and the 24-case visual script. The exact Step 5 fixture was already exercised against the Step 6 data/facade boundary and produced exact same-environment pixels and matching node/order/asset metrics.

No rollback step deletes generated art or edits the five collision/mask artifacts. Home remains outside this change.
