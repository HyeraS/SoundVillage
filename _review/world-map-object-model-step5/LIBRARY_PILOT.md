# Library WorldObject production pilot

## Result

PASS. `landmark-library` is the only native WorldObject authority. The other 17 objects, including Home, remain legacy.

Library render, destination, logical destination, guide path, minimap point, minimap presentation, aliases, collision, bounds, and spatial chunks now come from the selected authored WorldObject record through the deterministic generated projection. Production components do not import authored or legacy build inputs.

## Preserved runtime values

- object/canonical/manifest/external IDs: `landmark-library`, `sound-library`, `Library`, `Sound Library`
- aliases: `Library`, `Sound Library`
- asset: `landmark-library`
- render rect: `1146.9613259668508, 828.7292817679557, 1544.7513812154696 × 716.0220994475138`
- runtime sortY: `1339.2265193370165`; runtime reference `1010`
- semantic asset-build reference `1147` remains review-only and is rejected as runtime depth
- interaction/approach/minimap point: `(1918,1438)`
- guide path: `(1920,1504) → (1918,1438)`
- collider: `library-body`, `building-body`, `[1728,2112) × [1184,1398)`
- presentation: `Sound Museum`, `🏛`, `#C8A96E`
- culling chunks: 12, unchanged

The authored record intentionally continues to use the migration validation profile, `depth.legacySortY`, world-space collision, and legacy aliases.

## Production boundary

Next.js 16.2.7 documents that every static import below a `'use client'` boundary enters the client module graph. `WorldMapDiagram.js` therefore imports only the production facade. The facade exports a recursively frozen lean generated presentation projection; no authored candidate, legacy module, schema, compiler, adapter, Node builtin, or provenance enters the component graph.

## Additional test stabilization

The required minimap browser test opened the existing Home welcome overlay in a fresh Playwright context, which masked the objective direction's arrival wording. The test setup now marks that unrelated intro as already seen. Product behavior and Home data are unchanged; the minimap test is deterministic and passes.
