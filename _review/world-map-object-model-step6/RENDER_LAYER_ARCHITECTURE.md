# Render layer architecture

## Result

PASS. Native `WorldObject.visual.layers[]` now compiles to lean runtime render-layer records while the established flat `WORLD_MAP_V4_OBJECTS` API remains available for culling, interaction, portals, and rollback.

## Data flow

```text
build-only WorldObject
  -> projection compiler
  -> generated sparse layer overrides
  -> production facade
  -> pure render planner
  -> flat SVG <image> nodes
```

The client graph imports only `lib/generated/worldMapV4RuntimeObjects.mjs`, the facade, and the pure planner. Authored candidates, schema validation, provenance, compiler code, adapters, and Node built-ins remain outside the Client Component graph.

## Runtime layer record

Each projected layer contains `objectId`, `layerId`, `role`, `renderBand`, `assetId`, world `x/y/width/height`, `sortY`, `sortOffsetY`, declarative `visibleWhen`, and the compatibility `layer` value used by existing DOM diagnostics.

- Layer rects are authored object-locally and projected to half-open world rects.
- Positive scale is supported and tested; zero and negative scale fail validation.
- Schema-v1 production image layers reject non-zero rotation in the compiler.
- Asset IDs and the explicit `compatibility.primaryVisualLayerId` must resolve or compilation fails.
- Overlay layers require an explicit state condition. Supported visibility keys are `qaModes` and `state`; functions and unknown predicates fail.

## Sparse override boundary

`WORLD_MAP_V4_GENERATED_LAYER_OVERRIDES` contains one key only: `landmark-library`. The other 17 authority entries have no copied layer metadata and continue through the legacy flat fallback. When an override key exists, the planner never emits the compatibility flat image.

The compatibility object's rectangle is the union of all visual layer rects. Its `assetId` is taken from the explicit primary layer, but its bounds are never confused with that primary layer's rect. The spatial index therefore remains object-level and future multi-layer objects cannot be culled from body bounds alone.

## DOM shape

Logical hierarchy does not create per-object wrappers. Render items remain flat SVG `<image>` nodes. Band `<g>` elements are emitted only when a band has content; current production has no ground, object-foreground, or overlay groups.

## Home boundary

No Home candidate, art, asset, coordinate, collision, interaction, route, minimap, presentation, or site-ground data was added. `landmark-home` remains legacy and has no layer override.
