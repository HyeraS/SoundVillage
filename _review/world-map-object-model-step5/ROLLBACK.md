# Library rollback

Rollback is a one-line authority change:

```diff
- 'landmark-library': 'native',
+ 'landmark-library': 'legacy',
```

Then run only the WorldObject projection compiler. The legacy presentation comes from the build-only `LEGACY_WORLD_MAP_V4_DESTINATION_PRESENTATIONS` record. No asset, mask, Home, renderer, scene, depth, foreground, collision algorithm, or component literal change is required.

Automated rollback verification compiles both authority states in memory and asserts:

- full runtime projection deep equality;
- full collision projection deep equality;
- byte-identical generated runtime source;
- byte-identical generated collision source;
- one and only one selected Library authority in either state;
- Home and asset registry equality.

Production is left in the required native state.
