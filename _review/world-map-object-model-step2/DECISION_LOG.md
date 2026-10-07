# WorldObject schema step decision log

1. Authored WorldObject source format is pure MJS.
2. Migration uses a compatibility adapter first and converges on WorldObject as the final authored authority. The adapter/compiler is deferred and not implemented here.
3. Library is the first future pilot, but this step contains only a test fixture and no production authored Library record.
4. Library runtime sort is preserved: reference `1010`, world `1339.2265193370165`. Asset-build semantic reference `1147` is recorded but not applied.
5. Canonical fixture destination ID `sound-library` preserves both legacy aliases: manifest interaction `Library` and external/minimap `Sound Library`.
6. Existing collision semantics and `validateCollisionObjects()` are reused. No point-in-polygon, rasterization, clearance dilation, max-pool, mask packing, or blocking-reason algorithm is reimplemented.
7. Interaction boundaries remain inclusive; collision rectangles remain half-open.
8. Provenance is build-only and must not enter a runtime/client projection.
9. Home work, foreground/depth renderer changes, adapter/compiler work, generated projections, and production Library migration are deferred.

