# WorldObject schema implementation

## Scope

This step adds a pure MJS schema/validator module and its tests only. It does not add authored production WorldObjects, an adapter, a compiler, generated projections, a Library production record, Home changes, renderer changes, or asset/collision regeneration.

## API

`lib/worldMapObjectSchema.mjs` exports:

- schema enums and version constants;
- `validateWorldObject()` and `validateWorldObjectSet()`;
- local-layer union and world visual-bounds derivation;
- world/object-local point projection;
- ground-contact sort derivation with migration-only `legacySortY` precedence;
- WorldObject collider projection into the existing collision object shape;
- interaction → approach and approach → minimap derivation;
- a runtime-projection assertion that rejects build-only `provenance`.

## Validation contracts

- Object IDs are unique across a set; layer IDs are unique inside an object; collider IDs are unique across a set.
- Every authored number must be finite.
- Rectangles and bounds are half-open and require positive extent.
- Polygons require at least three finite `[x,y]` points; concavity is allowed.
- Collision objects require rotation `0` and scale `(1,1)` in schema v1.
- Collision roles and shape semantics are handed to the existing `validateCollisionObjects()` implementation after projection. Rasterization, clearance, pooling, packing, and reason lookup are not duplicated.
- `decorative-nonblocking` remains valid.
- Collision generation from visual alpha is rejected, and authored/generated collision authority cannot coexist.
- Visual bounds must use `generated-layer-union`; an optional materialized rect must exactly equal the layer union.
- Interaction activation is explicitly inclusive axis-distance. Collision remains independently half-open.
- Navigation guide paths are explicitly `authored-guide`; actual routes remain `generated-from-walkable-clearance-mask`.
- State and the entire authored record accept only finite, declarative, plain JSON/MJS values. Functions, symbols, bigint values, circular structures, class instances, and React-style symbol-bearing values are rejected.
- Provenance supports source paths/crops, generator, registration, content hash, and source note. It is build-only and is rejected by the runtime-projection contract.

## Migration-only fields

`depth.legacySortY` and world-space colliders are accepted by the default `migration` validation profile. Both are identified in `WORLD_OBJECT_MIGRATION_ONLY_FIELDS` and rejected when `validateWorldObject(..., { profile: 'native' })` is used. This prevents native objects from silently retaining compatibility escape hatches.

## Library fixture

The test fixture reads the current production manifest, geometry, collision, navigation, minimap, runtime asset module, and asset manifest. It locks:

- `landmark-library` / `Library` / `Sound Library` identity mapping;
- current float render rectangle and asset display size;
- current `sortY`, while separately asserting the semantic builder sort drift;
- `library-body` and its exact shape;
- `(1918,1438)` interaction, approach, minimap, and route endpoint;
- the current two-point generated route and 12 culling chunks.

The fixture is test-only and is not imported by a production consumer.

