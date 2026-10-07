# Import graph verification

## Required direction

The automated projection suite verifies this direction:

```text
build-only authored data -> adapter/compiler -> generated modules -> production facade -> runtime/components
```

It rejects:

- adapter/compiler imports of production facades;
- adapter/compiler imports of generated output;
- authored build-only modules imported by production components;
- facade imports of adapter/compiler modules;
- generated imports of authored, Node-only, React, browser, adapter, compiler, or schema modules.

## Isolated rebuild

`scripts/test-world-map-object-projections.mjs` creates a temporary directory, copies only the compiler input graph, omits existing generated files, writes both projections to temporary output paths, compares their exact contents/hashes, and removes only that temporary directory. Workspace generated files are never deleted.

## Client graph audit

The optimized root-route chunks contain zero occurrences of build-only/compiler/schema markers and Node built-ins:

| Marker | Occurrences |
| --- | ---: |
| `legacyWorldMapV4` | 0 |
| `legacyCollisionObjects` | 0 |
| `WORLD_MAP_V4_OBJECT_AUTHORITY` | 0 |
| `worldMapObjectSchema` | 0 |
| `legacy-world-object-adapter` | 0 |
| `build-world-map-object-projections` | 0 |
| `node:fs` | 0 |
| `node:path` | 0 |

The representative asset path `terrain-panel-0-0.webp` occurs once in the root client chunks, confirming that the generated runtime did not add a second asset registry.
