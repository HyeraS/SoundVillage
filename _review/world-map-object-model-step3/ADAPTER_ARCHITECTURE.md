# Step 3 legacy adapter architecture

## Scope

This step adds an inactive compatibility pipeline. It does not change a production import or select native authority for any object.

```text
legacy production modules ──> Node-only legacy adapter ──┐
                                                         ├─> Node-only projection compiler
Library authored candidate ──────────────────────────────┘              │
                                                                        ├─> runtime literal
                                                                        └─> collision literal
```

The generated modules are not imported by `worldMapV4Manifest.mjs`, `worldMapGeometry.mjs`, `worldMapCollision.mjs`, `worldMapNavigation.mjs`, `worldMapMinimap.mjs`, `WorldMapScene.js`, or `WorldMapDiagram.js`.

## Adapter boundary

`scripts/world-map/legacy-world-object-adapter.mjs` imports the current production modules read-only and clones their data into a Node-only snapshot. It never patches, freezes, or writes back to a production export.

The snapshot keeps these responsibilities separate:

- 17 render objects, including 8 static environment clusters, 8 interactive landmarks, and the non-interactive guesthouse;
- 1 foreground object;
- 8 logical destinations and their separate manifest destination keys;
- 8 collision objects;
- 8 authored guide paths;
- 8 minimap destinations;
- 12 terrain panels classified as baked environment;
- asset registration, declared visual bounds, and current spatial-index chunk membership.

The per-object compatibility record carries render, destination, logical destination, collision, guide path, minimap, bounds, culling chunks, asset, and alias data without assuming that every render object owns every responsibility. Environment clusters and the guesthouse therefore remain valid non-interactive records. Small baked flowers, grass, and stones are not split into objects.

## Authority selection

`data/world-map-v4/worldObjects.mjs` contains one registry entry for each of the 18 semantic render/foreground objects. Every entry, including `landmark-library`, is `legacy` in this step.

The compiler validates the complete registry before projection:

- only `legacy` and `native` are accepted;
- every legacy object and every native candidate must have an entry;
- a legacy selection must have a legacy record;
- a native selection must have a candidate;
- duplicate candidates and duplicate output IDs fail;
- every non-selected native candidate must still pass exact legacy parity.

The selected record is emitted as a unit. No field-level fallback or merge exists.

## Library candidate

The Library candidate uses the migration validation profile. It intentionally retains `depth.legacySortY` and a world-space collider. The authored canonical destination is `sound-library`; compatibility metadata preserves `Library` and `Sound Library` as distinct legacy identities.

The candidate records runtime sort reference `1010` and semantic asset-build reference `1147` separately. Only the runtime value projects to `sortY=1339.2265193370165`; the semantic value is review-only provenance.

## Client boundary

The installed Next.js 16.2.7 guide states that all imports beneath a `'use client'` boundary enter the client module graph. Accordingly, authored objects, validator logic, adapter logic, Node built-ins, and provenance stop at the compiler. Only complete literal generated modules could be connected in a later approved step.
