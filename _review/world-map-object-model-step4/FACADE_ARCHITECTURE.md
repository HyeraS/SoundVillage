# Step 4 facade architecture

## Result

The production World Map v4 path now consumes deterministic generated projections while all 18 object authorities remain `legacy`.

```text
data/world-map-v4/legacyWorldMapV4.mjs ---------+
data/world-map-v4/legacyCollisionObjects.mjs ---+--> legacy adapter
data/world-map-v4/worldObjects.mjs -------------+       |
                                                        v
                                             projection compiler
                                                |             |
                                                v             v
                                      generated runtime   generated collision
                                                |             |
                                                +------v------+
                                               production facade
                                                        |
                                                        v
                                              existing runtime/components
```

## Responsibility split

- `legacyWorldMapV4.mjs` is the build-only authored authority for world registration, terrain panels, render objects, foreground, destination metadata, logical destinations, guide paths, minimap points, and the independent asset registry reference.
- `legacyCollisionObjects.mjs` is the build-only authored collider authority.
- `worldObjects.mjs` remains the authority registry and candidate source. Every registry entry, including `landmark-library`, is still `legacy`.
- `legacy-world-object-adapter.mjs` reads only build inputs. It no longer imports a production facade or generated output.
- `worldMapV4RuntimeObjects.mjs` exposes lean named exports and does not duplicate the asset registry.
- `worldMapV4Manifest.mjs` is a non-authoritative compatibility facade over generated runtime/collision data and the independent asset registry.
- `worldMapCollision.mjs` reads generated collider declarations while retaining the existing geometry, raster, clearance, pooling, and reason-lookup algorithms.
- `worldMapGeometry.mjs` and `worldMapMinimap.mjs` receive generated destination projections through the facade.

No component, Library presentation, Home value, renderer, collision mask, or runtime image was changed.

## Generated runtime exports

- `WORLD_MAP_V4_GENERATED_WORLD`
- `WORLD_MAP_V4_GENERATED_TERRAIN_PANELS`
- `WORLD_MAP_V4_GENERATED_OBJECTS`
- `WORLD_MAP_V4_GENERATED_FOREGROUND`
- `WORLD_MAP_V4_GENERATED_DESTINATIONS`
- `WORLD_MAP_V4_GENERATED_LOGICAL_DESTINATIONS`
- `WORLD_MAP_V4_GENERATED_PATHS`
- `WORLD_MAP_V4_GENERATED_MINIMAP_DESTINATIONS`
- `WORLD_MAP_V4_GENERATED_ALIASES`

The asset registry remains solely in `lib/worldMapV4Assets.mjs`.
