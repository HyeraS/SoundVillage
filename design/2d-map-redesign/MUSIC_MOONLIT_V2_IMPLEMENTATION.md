# Moonlit Concert Garden v2 — production implementation

> Superseded on 2026-09-18 by `MUSIC_MOONLIT_V3_IMPLEMENTATION.md`. The v2 package is retained only as a rollback artifact and is not loaded by runtime.

Date: 2026-09-18  
Runtime asset root: `public/assets/music-village-moonlit-v2/`  
Status: production use enabled

## Geometry authority

The existing 1536×1152 canvas, 48×36 tile grid, 32px tile size, 24×18 camera FOV, 20×14 player box, Stage, Gate, four building footprints, spawn, exit trigger and entrance clearances remain authoritative. The selected 1448×1086 styleframe is an art-direction reference only.

No building or landmark coordinates changed. The central sculpture is a foot-level solid prop, so the garden shortcut splits around it and rejoins the north-south axis. Both Gate lanes, both directions of the outer and inner loops, every entrance and the Stage approach remain connected to spawn.

## Art direction and asset generation

The selected styleframe contributed the indigo night palette, teal/violet roofs, restrained amber lighting, coral/cyan/pink accents, low double-wave canopy, building-specific music motifs, central equalizer fountain and lived-in props. Characters, example sound orbs, UI, labels and guides were excluded from static runtime images.

ImageGen produced `sources/music-moonlit-v2/imagegen-material-prop-reference.png` as a material/prop reference sheet. It is not loaded by participant runtime. Runtime PNGs are deterministically assembled by:

```sh
node design/2d-map-redesign/tools/build_music_moonlit_v2.mjs
node design/2d-map-redesign/tools/generate_music_moonlit_v2_qa.mjs
```

The asset manifest records geometry, placements, foot-level collision insets, draw order, source references, byte sizes and SHA-256 hashes for every runtime PNG.

## Collision and sound markers

`PROP_SPECS` is the single source for every prop's visual footprint and foot-level collision inset. The runtime collider list now includes Stage rear, Gate posts, all buildings, map boundaries and 43 placed props including benches, planters, lamps, trees, flowerbeds, the equalizer fountain, fences and lived-in yard objects. Foliage crowns and overhang pixels do not become full visual-footprint collision.

Marker safety checks the complete collider set with a one-tile visual margin, plus entrance, spawn and Gate clearances. A/B retain 83 deterministic unique placements each with blocks `15/15/15/15/15/8`; the 166-item researcher diagnostic placement remains unique and safe.

## Functional scope

Only the Music visual renderer, its geometry/collision authority, isolated test harness and Music production validation are changed. Sound metadata, IDs, group/block rules, annotation and Museum flow, Supabase/SQL/RPC, rewards, house decor, other villages and World Map remain unchanged.
