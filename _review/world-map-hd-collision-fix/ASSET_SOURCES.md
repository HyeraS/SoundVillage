# World map HD asset sources

## Source of truth

- User-supplied concept: `design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png` (1448×1086).
- Existing registered clean production source: `public/assets/world/sound-archive-garden-v2/world-base-clean.png` (2896×2172).
- Provenance and the player-removal edit are documented in `_review/world-map-reference-match-v2/ASSET_SOURCES.md`.
- No third-party image or new externally licensed asset was added in this pass. The source remains a user-supplied repository asset.

## Shipped HD preparation

`scripts/build-world-map-hd-assets.py` produces the final registered master and runtime asset. The pass is deterministic: exact 2× Lanczos reconstruction followed by a bounded (±9 luma) source-derived multi-scale detail restoration at 0.42 gain. It never changes the canvas, crop, perspective, landmark positions, road geometry, palette, or scene inventory. The runtime has no sharpen filter and uses natural downsampling.

- Master: `design/concepts/world-map-reskin-2026-09-18/02-sound-archive-garden-hd-master.png` (5792×4344).
- Runtime: `public/assets/world/sound-archive-garden-v2/world-base-hd.webp` (5792×4344, quality 96).
- Registration: origin `(0,0)`, exact scale `2`, road/landmark positional offset `0px`.

## Navigation mask preparation

The same build script samples the registered clean source at 960×720 (4 world-px/cell), selects the visible warm stone/dirt network, keeps only the spawn-connected component, and applies narrow hand-traced corrections for the Urban asphalt threshold, Music garden approach, and Human brick lane. Building bodies are explicitly subtracted. An 8 world-px visual-boundary tolerance is applied before the complete 28×16 foot clearance is baked in.

- Runtime/QA mask: `public/assets/world/sound-archive-garden-v2/world-walkable-mask.png`.
- Packed runtime source: `lib/worldWalkableMaskData.mjs`.
- Debug overlay: `public/assets/world/sound-archive-garden-v2/world-collision-debug.png`.

## Rejected ImageGen attempt

The built-in ImageGen edit mode was tried once as a possible restoration route with the existing clean map as the sole edit target. The prompt required exact composition, road centerlines, landmark silhouettes, palette, lighting, and all object positions; it prohibited new, removed, or moved elements, text, seams, and sharpen halos. The result changed small scene details and framing, so it failed the 2px registration requirement and was not copied into the repository or used by the runtime. The shipped asset is entirely the deterministic restoration described above.
