# Moonlit Concert Garden v3 — styleframe-faithful production map

Date: 2026-09-18  
Runtime asset root: `public/assets/music-village-moonlit-v3/`  
Status: production use enabled

## Visual authority

The attached `01-moonlit-concert-garden-v2-music.png` is now the direct visual authority. The production master preserves its map composition, architecture, central garden and equalizer fountain, side ponds, path inlays, vegetation density, benches, lamps, lived-in yards, color palette and lighting. The five example sound-orb graphics were removed so that only real SoundVillage runtime markers appear.

The earlier simplified Moonlit v2 reconstruction is not used by runtime. It remains as a rollback artifact.

## Runtime packaging

The clean source master remains under `design/2d-map-redesign/sources/music-moonlit-v3/` and is never referenced by participant runtime. The reproducible builder resizes it to the authoritative 1536×1152 canvas using nearest-neighbor sampling, splits it into four 768×576 ground chunks, and extracts a transparent foreground-occlusion layer for roofs and tree canopies.

```sh
node design/2d-map-redesign/tools/build_music_moonlit_v3.mjs
node design/2d-map-redesign/tools/generate_music_moonlit_v3_qa.mjs
```

Runtime draw order is ground chunks → player → foreground occlusion → real sound markers → HUD.

## Geometry and collision

The 48×36 grid, 32px tiles, 24×18 FOV, Stage, Gate, four building contracts, spawn, exit trigger and player box are preserved. Prop placement and collision metadata were realigned to the visible styleframe. The collider set now covers 67 visible solid placements, including the central fountain/garden mass, tree trunks, benches, flowerbeds, planters, lamp bases, fences and lived-in yard objects. Tree crowns and roof overhangs are visual occlusion rather than full-footprint collision.

Marker placement avoids every solid collider by at least one tile plus all entrance/spawn/Gate clearances. A/B retain 83 deterministic placements each and the researcher diagnostic retains 166 unique safe placements.

## Functional scope

Sound metadata, IDs, groups, block rules, annotation flow, Museum flow, Supabase/SQL/RPC, rewards, house decor, other villages and World Map were not changed.
