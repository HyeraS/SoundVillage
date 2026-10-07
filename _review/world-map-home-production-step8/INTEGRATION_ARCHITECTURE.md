# Integration Architecture

## Authority

- Native: `landmark-library`, `landmark-home`
- Legacy: the remaining 16 logical objects
- Total logical objects remain 18. No other landmark was migrated.

`landmark-home` is authored once in `data/world-map-v4/worldObjects.mjs`. The projection compiler emits its runtime compatibility object, sparse render-layer override, collision object, destination, minimap marker, presentation, guide path, and spatial-index input. Production modules consume only generated literals.

## Final Home data

- Transform: position `(1344,1344)`, rotation `0`, scale `(1,1)`, anchor `(0,0)`
- Ground contact: `(1648,1696)`; depth mode `ground-contact`
- Flat compatibility union: `(1344,1344)–(1856,1824)`, primary visual layer `body`, `sortY=1696`
- `site-ground`: local `(0,0)–(512,480)`, world `(1344,1344)–(1856,1824)`, ground band, `sortY=1695`
- `body`: local `(128,51)–(480,352)`, world `(1472,1395)–(1824,1696)`, world band, `sortY=1696`
- No foreground or overlay layer

The render planner sees the sparse Home override and completely suppresses the flat fallback. In the browser this produces exactly two SVG image nodes sharing `data-object-id="landmark-home"`; the nodes expose their layer IDs and render bands. The renderer architecture itself was not redesigned.

`WorldMapDiagram.js` now obtains Home label/icon/color from generated presentation metadata. Invite-ready, visitor, suffix, interactive marker, accessibility label, and diagnostic data attributes remain UI behavior rather than authored presentation data.

The logical culling entry remains one before and after. Home remains indexed in four chunks (`2,2`, `3,2`, `2,3`, `3,3`); only its one logical entry expands into two planned render nodes.

