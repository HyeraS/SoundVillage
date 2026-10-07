# Collision and Navigation

## Collision authority

Home has one native building-body collider and the site ground has none:

`(1520,1472)–(1776,1696)` using half-open rectangle semantics.

The 28×16 player-foot clearance is applied once by the production rasterizer. The regenerated 960×720 packed mask and collision reason API agree in all **691,200** cells. The protected `x=1792` east-road cell is walkable.

Mask delta from the Step 8 baseline:

- Newly blocked: 240 cells
- Newly walkable: 1,248 cells
- Total changed: 1,488 cells
- Cell bounds: `(376,366)–(452,440)`
- World bounds: `(1504,1464)–(1808,1760)`
- Changed cells around every other building: 0
- Walkable/reachable: 636,624 / 636,624
- Disconnected walkable cells: 0
- 1–2 cell pinches: 0
- Collision reason mismatches: 0

## Interaction and routing

- Door, interaction, approach: `(1648,1760)`
- Road connection: `(1824,1760)`
- Ground contact: `(1648,1696)`
- Destination tile box: `{tx:47, ty:46, w:9, h:7}`. Its world rectangle `(1504,1472)–(1792,1696)` is the integer-tile outward alignment of the collision footprint.
- Guide path: `(1920,1504) → (1856,1568) → (1824,1760) → (1648,1760)`

Seven required cases were tested as nine directed routes: spawn→Home, east→approach, west→approach, approach→east, approach→west, north↔south, and west↔east. Every replay through `moveWorldPlayer` had zero stalled frames. The authored Home route also arrived in 71 browser-equivalent frames using four waypoints.

The actual browser production auto-walk finished at foot `(1648.7,1759.8)`, reported `near=Home`, `blocked X=no`, `blocked Y=no`, and collision reason `none`.

