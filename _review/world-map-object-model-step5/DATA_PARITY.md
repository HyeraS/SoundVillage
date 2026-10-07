# Data and collision parity

## Projection counts

| Projection | Result |
| --- | --- |
| Render objects | 17/17, same order and values |
| Foreground | 1/1, same order and values |
| Destinations | 8/8 |
| Logical destinations | 8/8 |
| Guide paths | 8/8 |
| Minimap points | 8/8 |
| Collision objects | 8/8 |
| Spatial index | 48 entries |
| Library culling chunks | 12, exact order |

## Contracts

- Native/legacy compiler runtime source: byte-identical.
- Native/legacy compiler collision source: byte-identical.
- Generated collision hash: unchanged (`ce657526…12ce7`).
- Nested immutability and established object identity assertions: PASS.
- Interaction boundary remains inclusive at 64×48.
- Collision remains half-open.
- Collision/reason parity: 691,200 cells, 0 mismatches.
- Eight destination routes arrive successfully; maximum stalled frames: 0.
- Library image, render geometry, collision geometry, route, interaction point, minimap point, IDs, and strings are unchanged.
- Collision masks and packed mask: 0 changed files.
- Runtime assets: 0/31 changed files.

No collision or runtime asset builder was executed.
