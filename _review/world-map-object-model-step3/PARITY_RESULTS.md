# Step 3 parity results

## Result

PASS. The compatibility projection is production-equivalent while remaining inactive.

| Measure | Current | Generated | Result |
|---|---:|---:|---|
| Render objects | 17 | 17 | deep-equal, same order |
| Foreground objects | 1 | 1 | deep-equal, same order |
| Destination keys | 8 | 8 | deep-equal |
| Logical/minimap destinations | 8 | 8 | deep-equal |
| Authored guide paths | 8 | 8 | deep-equal point and path order |
| Collision objects | 8 | 8 | deep-equal collider and shape order |
| Authority entries | 18 legacy | 18 legacy | Library remains legacy |
| Runtime assets | 31 files | unchanged | 0 hash changes |

Bounds reconstructed from generated render rectangles equal all current `objectBounds()` results. Rebuilding the 512px spatial index from the generated render list produces the exact current 48-entry map, including existing conservative boundary behavior.

## Library candidate

All candidate checks pass:

- render object, asset ID/registration, float x/y/width/height, anchor, layer, category, and current `sortY`;
- manifest interaction `Library`, external/minimap ID `Sound Library`, and canonical authored ID `sound-library`;
- destination tile box and `(1918,1438)` approach point;
- `library-body` world rect `[1728,2112) × [1184,1398)` in the existing structured shape;
- minimap point and two-point guide path;
- visual bounds and the current 12 chunk keys.

The candidate keeps runtime reference `1010` and runtime world sort `1339.2265193370165`. A negative test substitutes semantic asset-build reference `1147`; candidate parity then fails. The semantic value is never emitted as runtime depth.

## Collision and integrity

- Generated collision array vs current collision array: deep-equal.
- Existing 691,200-cell collision/reason validation: PASS with 0 reason mismatches.
- Collision/mask/packed-mask files changed from Step 2: 0 of 5.
- Production/consumer files changed from Step 2, excluding the intentionally edited package scripts: 0 of 10.
- Generated modules imported by production consumers: false.
- Home, renderer, runtime assets, and presentation components changed by this step: false.

Machine-readable details are in `projection-parity.json` and `generated-file-hashes.json`.
