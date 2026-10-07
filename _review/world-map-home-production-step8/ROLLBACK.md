# Home Rollback

Rollback remains a one-authority test operation: set only `landmark-home` to `legacy` for compilation, without deleting the native candidate or any asset.

The isolated rollback compile restores:

- Render asset: `landmark-home-hub`
- Render bounds: `(1440,1368)–(1888,1752)`
- Legacy `sortY`: 1752
- Collision: `(1536,1472)–(1792,1752)`
- Approach/minimap: `(1664,1792)`
- Legacy destination and guide path
- Legacy presentation behavior

The rollback compile passed in memory/test-only mode. Final production authority remains native. The legacy source data and `landmark-home-hub` runtime asset were not removed or re-encoded.

