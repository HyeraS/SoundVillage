# Step 3 projection contract

## Runtime projection

`lib/generated/worldMapV4RuntimeObjects.mjs` exports one complete literal, `WORLD_MAP_V4_RUNTIME_PROJECTION`, containing:

- world registration and terrain panels;
- 17 ordered render objects and 1 ordered foreground object;
- the 8-key manifest destination object;
- 8 ordered logical destinations;
- 8 ordered authored guide paths;
- 8 ordered minimap world points;
- runtime asset registration;
- explicit alias metadata for `landmark-library`.

The existing `objectBounds()` and `createWorldMapSpatialIndex()` APIs can reconstruct exact current bounds and chunk results from the projected `x/y/width/height` and world `chunkSize`. Redundant materialized bounds and spatial-index copies are intentionally omitted to keep the runtime literal lean.

## Collision projection

`lib/generated/worldMapV4CollisionObjects.mjs` exports `WORLD_MAP_V4_COLLISION_OBJECTS` as an ordered literal array. Its `objectId`, `colliderId`, `collisionRole`, shape order, type, and coordinates are deep-equal to the current collision authority.

The generated file does not contain the rasterizer, clearance dilation, max-pool, packed mask, or blocking-reason implementation. The current collision engine and mask artifacts remain untouched and unconnected to this generated module.

## Generated-file restrictions

Both files are deterministic data modules. They contain no:

- authored-module, adapter, compiler, validator, React, or browser imports;
- Node built-ins;
- provenance, source crop, generator metadata, or absolute local path;
- generation timestamp;
- environment-dependent value.

The compiler calls `assertWorldObjectRuntimeProjection()` before serialization. Key and array order comes from explicit current production order, not authority-registry insertion order.

## Write and check modes

```sh
node scripts/build-world-map-object-projections.mjs
node scripts/build-world-map-object-projections.mjs --check
```

Write mode replaces only the two generated modules. Check mode builds the expected strings in memory and exits non-zero if either file differs. An integration check confirmed exit 1 for a deliberately stale collision file and exit 0 after regeneration.

## Deliberately deferred data

Library label/icon/color presentation remains in the current JSX component and is not duplicated into the runtime projection. Importing or parsing JSX in the compiler is forbidden. Presentation migration belongs to the later consumer-connection step; the current component hash and minimap regression tests remain the parity gate.
