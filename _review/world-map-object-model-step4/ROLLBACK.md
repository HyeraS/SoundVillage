# Rollback boundary

The reversible boundary is the production facade import seam.

To roll back this connection, restore the previous direct legacy declarations/inputs in:

- `lib/worldMapV4Manifest.mjs`;
- `lib/worldMapGeometry.mjs`;
- `lib/worldMapCollision.mjs`;
- `lib/worldMapMinimap.mjs`.

The compiler, authored candidates, build-only legacy modules, generated files, and projection tests can remain in place. A rollback does not require changing the authority registry, deleting candidates, reverting Home, rebuilding collision masks, or rebuilding runtime images.

The most important seam is:

```text
generated runtime/collision -> production facade
```

No permanent runtime feature flag was added. The rollback therefore affects only imports and compatibility-facade declarations, not persisted data or assets.
