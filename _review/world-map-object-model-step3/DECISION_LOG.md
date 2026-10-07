# Step 3 decision log

1. The authority registry covers the 17 render objects plus 1 foreground object. All 18 remain `legacy`; `landmark-library` is not activated.
2. Authority selection is whole-record selection. Legacy and native fields are never merged or chosen field-by-field.
3. Every authored candidate is parity-checked even when not selected. Candidate drift is a hard compile failure.
4. The Library candidate uses the migration profile and preserves both approved escape hatches: `depth.legacySortY` and a world-space collider.
5. Library identities remain explicit: canonical `sound-library`, manifest interaction `Library`, external/minimap `Sound Library`.
6. Runtime sort reference `1010` remains authoritative for migration output. Asset-build semantic reference `1147` is retained only in build-only compatibility/provenance data.
7. Environment clusters, the guesthouse, foreground, logical destinations, and collision objects stay separate in the adapter. Baked small decoration is not objectized.
8. The runtime projection contains enough data to reconstruct bounds and the current spatial index but omits redundant materialized copies.
9. Minimap presentation metadata remains in JSX because the compiler may not import or parse components. Moving it to pure runtime data is deferred to the approved consumer-connection step.
10. `package.json` received only `build:world-object-projections` and `test:world-object-projections`; its prior ordering and unrelated changes were preserved.
11. Production facade imports, Library authority activation, Home, renderer/depth, collision masks, and runtime asset generation are explicitly deferred.
12. The next step requires user approval; this implementation does not continue into Library production connection.
