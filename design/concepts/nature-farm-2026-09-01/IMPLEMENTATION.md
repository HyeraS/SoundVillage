# Brookside Bloom Farm — implementation record

## Status

**Complete and integrated.** The approved ImageGen village is now the actual
Nature gameplay world instead of an approximation assembled from independent
tiles. The runtime uses a world-only edit that preserves the village while
removing the baked player, seven sound markers, Enter prompt and D-pad.

## Runtime source of truth

- `public/assets/world/nature-farm-v2/brookside-bloom-map-v3.png` is the
  1536×1152 / 48×36 primary environment layer.
- `generated-source-v2/brookside-bloom-runtime-source-v3.png` preserves the
  untouched 1448×1086 ImageGen edit output.
- `lib/natureVillage.js` loads the complete map directly. The previous
  atlas-composed renderer remains only as a defensive fallback.
- `lib/natureFarmLayout.mjs` owns collision, bridge rails, reachability, sound
  placement and swept movement independently from the art layer.
- `components/NatureZoneMap.js` owns camera, player, sound orbs, fog, HUD,
  D-pad, AnnotationPanel entry and exit behavior.

## Gameplay alignment

- World size remains 48×36 tiles at 32 px per tile.
- Exactly two bridges retain traversable lanes and rail collisions.
- Water, building footprints, plots, orchard trees and the forest boundary
  remain collision-backed.
- Full building visual boxes and the orchard are reserved from sound spawning,
  so live sound orbs do not appear on roofs or inside dense scenery.
- Group A and group B placement remains deterministic, unique and reachable;
  the A+B research bypass also retains its complete unique placement set.
- The real product flow remains World Map → Nature → sound interaction →
  AnnotationPanel → completion/cancel → World Map. Local QA uses dry-run mode
  and never writes an annotation or currency record.

## Accepted asset family

The acceptance gate contains fifteen runtime files: the complete Brookside
Bloom world plus the fourteen generated terrain, building, bridge, tree, farm
and prop derivatives. No legacy Nature/farm path is referenced by the renderer.
Full provenance and cleanup notes are in
`generated-source-v2/ASSET_MANIFEST.md`.

## Verification

- `npm run validate:nature-assets`: passes for 15 runtime assets.
- `npm run test:nature`: 6/6 passing.
- Related ESLint targets pass.
- Browser product QA confirms the live ImageGen map, player, reachable sound
  prompt, responsive camera, AnnotationPanel entry and World Map return.
- Final visual artifacts are stored in `verification-v2/`, including
  `nature-v3-product-1440x900.png` and the earlier normalized comparisons.

## Visual note

The environment now preserves ImageGen's organic curved paths, S-shaped creek,
dense flowers, rocks, reeds, forest border, buildings, plots and orchard as one
coherent image. Live gameplay elements are intentionally separate: player,
sound orbs, collection fog, interaction prompt and mobile controls remain
dynamic and are not baked into the environment.
