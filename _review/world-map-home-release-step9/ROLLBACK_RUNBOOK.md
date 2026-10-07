# Rollback Runbook

Status: **REHEARSED / PASS**

1. Change only `WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-home']` from `native` to `legacy`.
2. Run `npm run build:world-object-projections`.
3. Run `npm run build:world-v4-collision` (or first use `--check` when inspecting an already-generated rollback set).
4. Run the Home, projection, render-layer, collision, minimap, production, asset, lint, and build suite.
5. Verify the restored values in `rollback-results.json`.

The rehearsal used an in-memory authority override and did not alter production files. It restored `landmark-home-hub`, bounds `(1440,1368)–(1888,1752)`, sortY `1752`, collision `(1536,1472)–(1792,1752)`, and approach/minimap `(1664,1792)`. The legacy source/runtime assets remain present.
