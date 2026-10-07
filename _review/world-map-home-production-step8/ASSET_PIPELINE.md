# Asset Pipeline

## Promoted sources

| Asset ID | Source size | Approved/source SHA-256 |
|---|---:|---|
| `landmark-home-player-building` | 352×301 RGBA | `197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8` |
| `landmark-home-player-site-ground` | 512×480 RGBA | `4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b` |

Production source paths are under `design/world-map-v4/source-assets/`. `data/world-map-v4/sourceAssets.mjs` is the build-only source of truth for file path, pixel dimensions, alpha, category, and approved hash. `worldObjects.mjs` derives layer dimensions from that registry rather than duplicating them, while the client imports only generated runtime literals. This keeps authored/build code out of the Client Component graph and avoids a compiler/runtime circular dependency.

The runtime builder validates approved hashes, dimensions, RGBA format, and writes direct-size WebP files without resizing or recropping:

| Runtime asset | Size | Bytes | Decoded RGBA | SHA-256 |
|---|---:|---:|---:|---|
| building WebP | 352×301 | 25,226 | 423,808 | `5185988e7ae8f0e0ca9d1ddf3988cc022c3e1effc31d6c6f367c7d19e77d7f91` |
| ground WebP | 512×480 | 63,768 | 983,040 | `308f71eb6191ea2d88aed364c0cd83dc53bf8da373a78c6e0f3a0fc341f3547b` |

The additive path reused all existing files and encoded only these two additions. Runtime file count changed from 31 to 33; all 31 retained runtime files are byte-identical and `existingRuntimeAssetsReencoded=0`. The registry changed from 30 to 32 entries because the preview file is a runtime file but not a normal registry entry.

`landmark-home-hub` remains in both source/runtime compatibility data for rollback. Candidate B was not copied or registered.

