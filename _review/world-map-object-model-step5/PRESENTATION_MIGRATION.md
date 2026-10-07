# Library presentation migration

The former `WorldMapDiagram.js` Library literal was:

```js
{ label: 'Sound Museum', icon: '🏛', color: '#C8A96E' }
```

It is no longer present in the Client Component. The selected authority now produces:

```text
WorldObject.minimap
  -> projection compiler
  -> WORLD_MAP_V4_GENERATED_DESTINATION_PRESENTATIONS
  -> WORLD_MAP_V4_DESTINATION_PRESENTATIONS facade
  -> WorldMapDiagram.js
```

Home remains in `LEGACY_LANDMARK_META` in the component and was not migrated.

The legacy build-only Library presentation remains explicit solely for one-line rollback. Native and legacy compiler variants produce byte-identical runtime and collision source. Static tests reject JSX parsing, component imports from the compiler, build-only imports from the component graph, and provenance in generated modules.

The optimized root chunks contain one `Sound Museum` presentation object. A second text occurrence is unrelated objective prose (`Sound Museum과 우리 집도 둘러보세요`), not a second presentation authority.
