# Sound Archive Garden v4 asset sources

## Coordinate authority

- coordinate/visual reference: `public/assets/world/sound-archive-garden-v2/world-base-clean.png` (2896×2172)
- runtime raster source: `design/concepts/world-map-reskin-2026-09-18/02-sound-archive-garden-hd-master.png` (5792×4344)
- world: 3840×2880
- transform: `worldX = referenceX × (3840 / 2896)`, `worldY = referenceY × (2880 / 2172)`

The runtime does not synthesize roads, plazas, water, or vegetation from v3
polylines and repeated placements. The object-free ImageGen terrain underlay is
split into twelve logical 724×724 panels. Each file contains 1448×1448 source
pixels and is displayed at 960×960 world pixels, avoiding the previous
2896→3840 raster upscaling. Exact HD environment and landmark layers are
composited above those panels. The HD reconstruction is pixel-exact against the
5792×4344 master; its registered downsample differs from the 2896×2172 reference
by 1.471516 RGB levels out of 255 on average.

## Semantic layers

Eight exact reference crops represent Home, Lab, Animal, Nature, Library,
Urban, Human, and Music. Eight exact environment clusters preserve the authored
forest, stream, gardens, fences, flower beds, benches, lamps, signs, and local
density. The south gate is a separate foreground layer. These layers provide
depth/culling hooks while the panel reconstruction preserves every source pixel.

## ImageGen underlay

OpenAI built-in ImageGen edit mode was used once to create
`design/world-map-v4/source-assets/terrain-underlay-imagegen.png`. The prompt
removed above-ground buildings, trees, props, and gates while preserving the
road/plaza/water geometry and overall style. This output is retained as the
terrain-hidden-below-objects source and is not used as the visual authority;
exact reference crops cover the authored final composition.

Final edit prompt:

> Remove all above-ground buildings, trees, vegetation, fences, lamps, props,
> animals, gates, and arches; reconstruct terrain beneath them while preserving
> the exact 4:3 crop, road/plaza/water positions, palette, lighting, texture
> scale, and camera. Add no new geometry, text, UI, character, or watermark.
