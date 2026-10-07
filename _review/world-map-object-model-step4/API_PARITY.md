# API and data parity

## Public facade

The existing public exports remain available:

- `WORLD_MAP_V4`
- `WORLD_MAP_V4_DESTINATIONS`
- `WORLD_MAP_V4_PATHS`
- `WORLD_MAP_V4_TERRAIN_PANELS`
- `WORLD_MAP_V4_OBJECTS`
- `WORLD_MAP_V4_FOREGROUND`
- `WORLD_MAP_V4_ASSET_MANIFEST`
- `objectBounds()`
- `createWorldMapSpatialIndex()`
- `WORLD_MAP_V4_SPATIAL_INDEX`
- `queryWorldMapTerrainPanels()`
- `queryWorldMapObjects()`

Collision exports and blocking-reason behavior are also preserved.

## Exact parity

| Projection | Result |
| --- | --- |
| Render objects | 17/17 deep-equal |
| Foreground | 1/1 deep-equal |
| Destinations | 8/8 deep-equal |
| Logical destinations | 8/8 deep-equal |
| Guide paths | 8/8 deep-equal |
| Minimap points | 8/8 deep-equal |
| Collision objects | 8/8 deep-equal |
| Spatial index | 48 entries, equal order/content |
| Boundary-touch behavior | equal (`0,0`, `1,0` fixture) |

The build-only legacy snapshot is byte-stable across the source move: 45,398 serialized bytes, SHA-256 `84b755152fa58029530f8f606f706e43910e3f5330ac4a6bd2c59e306553805f`.

## Identity and immutability

The facade recursively freezes generated world, destination, path, panel, object, foreground, logical destination, minimap, alias, and collision values. Tests cover top-level arrays/objects and nested object, point, path, and shape values. Existing object identity relationships used by geometry/minimap consumers are preserved.

## Explicit non-migrations

- 18/18 authorities are `legacy`.
- `WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-library'] === 'legacy'`.
- Manifest interaction ID remains `Library`.
- External destination ID remains `Sound Library`.
- Library JSX/presentation, current sortY, collider, approach point, minimap point, and guide path are unchanged.
- Home values are unchanged.
- `WorldMapScene.js` and `WorldMapDiagram.js` are unchanged.
