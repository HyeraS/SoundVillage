# Library render-layer canary

`landmark-library` remains the only native authority and is the only production layer override.

| Field | Value |
| --- | --- |
| layer count | 1 |
| layer ID / role | `body` / `body` |
| render band | `world` |
| asset | `landmark-library` |
| rect | `1146.9613259668508, 828.7292817679557, 1544.7513812154696 × 716.0220994475138` |
| sortY | `1339.2265193370165` |
| DOM | one `<image>`, `data-object-id="landmark-library"`, `data-asset-id="landmark-library"`, `data-layer="gameplay"`, `data-layer-id="body"` |

The compatibility flat record is still exported but is suppressed when the override key exists. Across all applicable visual captures the Library node count is exactly one. Interaction, destination, aliases, guide path, minimap, presentation, collision, culling chunks, and asset registration remain equal.

The one-line authority rollback produces the same flat compatibility and collision projections, while correctly omitting the native-only sparse override. Removing the renderer's override import/use immediately restores flat rendering without changing authority, assets, masks, or Home.
