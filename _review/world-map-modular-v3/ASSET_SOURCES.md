# Sound Archive Garden v3 — asset sources

Generated 2026-09-20 with OpenAI built-in ImageGen. The only visual reference was
`design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png`.
It was used for composition, palette, camera, lighting, and landmark identity; no
v3 object is a crop or upscale of the flattened v2 world image.

## Shared exact prompt contract

Every building call used this complete contract followed by the subject line
listed below:

> Create one production-ready isolated transparent PNG sprite for the referenced
> cozy SoundVillage map. Match the soft high-resolution hand-painted storybook
> 2D game art, warm daylight from the upper left, rich greens and cream stone,
> rounded friendly silhouette, and consistent three-quarter top-down camera.
> Center one complete object with generous transparent padding. Preserve clean,
> undistorted doors, windows, roof and entrance. No characters, no text, no logo,
> no UI, no watermark, no colored or white rectangular backdrop, no cut-off
> shadow, and no white or black halo. The front entrance must remain clearly
> readable and unobstructed. Supply at least four source pixels per intended
> world pixel.

Subject lines, one independent ImageGen call each:

1. `Sound Library: elegant cream-stone civic library with deep blue roof, central double door, symmetrical flower beds and a subtle sound-wave pediment.`
2. `Home: small cozy cream cottage with moss-green roof, warm wooden door, flower boxes and a compact private-garden identity.`
3. `Animal village: friendly red-roof farm lodge with paw-like round window motifs, hay and small garden accents, but no lettering.`
4. `Nature village: living botanical conservatory gateway with pale stone, lush vines, leaves and an open centered doorway.`
5. `Human village: welcoming community hall with warm terracotta roof, cream walls, broad central door and friendly civic details.`
6. `Urban village: compact elegant blue-roof city station/civic building with stone façade, clean windows and open centered entrance.`
7. `Music village: whimsical music pavilion with teal-blue roof, brass ornamental shapes and a clear central entrance; no musical text.`
8. `Lab village: magical observatory laboratory with dark blue domed roof, brass scientific details, glowing teal accents and clear centered door.`
9. `Foreground arch: tall garden arch with pale stone posts, blue fabric detail and leafy canopy, transparent open passage through its center.`

## Nature atlas prompt

> Create a production-ready transparent PNG sprite atlas matching the reference.
> Strict 4 columns × 2 rows, exactly one centered isolated object per cell, large
> transparent margins, no overlap or grid lines. Row 1: three distinct rounded
> broadleaf trees, then one pine. Row 2: a second pine, one flowering tree, one
> flowering shrub, one mossy rock with flowers. Use the same three-quarter
> top-down camera and upper-left warm light. No text, backdrop, outline, clipped
> shadow, characters, buildings, or watermark. Each cell must support at least
> 4× runtime density.

## Props atlas prompt

> Create a production-ready transparent PNG sprite atlas matching the reference.
> Strict 4 columns × 2 rows, exactly one centered isolated object per cell, large
> transparent margins, no overlap or grid lines. Row 1: wooden bench, garden
> lamp, blank wooden sign, cream picket-fence straight segment. Row 2: matching
> fence corner, matching open gate, wooden footbridge, cattail/reed cluster.
> Consistent three-quarter top-down camera and warm upper-left light. No text,
> backdrop, outline, clipped shadow, characters, buildings, or watermark.

The bridge cell did not meet density after extraction, so it was regenerated in
one independent call with the same contract as a single 1536px transparent
wooden footbridge sprite. That independent master is `bridge-wood-source.png`.

## Supplemental atlas exact prompt

> Create a production-ready transparent PNG sprite atlas for the referenced cozy
> SoundVillage map, matching its soft high-resolution hand-painted storybook 2D
> game art, warm daylight from upper left, and consistent three-quarter top-down
> perspective. Canvas is a strict 4 columns × 2 rows grid with generous
> transparent padding; exactly one isolated object centered in each cell, no
> overlap and no cell borders. Row 1 left to right: (1) small colorful flower
> cluster, (2) friendly red-and-cream mushroom cluster, (3) cream ceramic flower
> pot with leafy plant, (4) fabric village banner on a short wooden pole with no
> text. Row 2 left to right: (5) small market crate display with fruit and jars,
> (6) whimsical compact research apparatus with glass flask and brass stand but
> no lettering, (7) water-lily cluster with green pads and two pale flowers
> viewed from above, (8) mossy low cliff-edge rock segment suitable as a modular
> blocking prop. Transparent background everywhere outside the objects. No
> shadows cut off, no white outline, no colored rectangular backdrop, no text,
> no logo, no characters, no buildings. Clean silhouettes and undistorted
> geometry. Each sprite should remain legible at approximately 60–100 world
> pixels while having at least 4× source density.

## Terrain

`terrain-water-source.png` was generated as a seamless, soft-painted turquoise
water texture with subtle diagonal highlights, no bank, objects, text, or hard
border. `terrain-grass`, `terrain-path`, and `terrain-plaza` preserve the earlier
ImageGen masters from `sound-archive-garden-v1`; they are genuine generated
repeatable textures, not pieces of the v2 full map.

## Post-processing and master/runtime relation

- Masters: `design/world-map-v3/source-assets/*.png`.
- Runtime: `public/assets/world/sound-archive-garden-v3/*.webp`.
- Processing is limited to atlas cell extraction, alpha-bounds trim with 12px
  padding, and quality-92 WebP encoding. There is no enlargement, AI upscale,
  sharpening, convolution filter, or extraction from the old full map.
- Alpha corners, dimensions, source density, decode success, manifest use, and
  total bytes are checked by `scripts/test-world-map-v3-assets.mjs`.
- The only manual edits are deterministic crop/trim, IDs, anchor/collider data,
  and runtime placement. Generated art is used under the terms applicable to
  OpenAI ImageGen output for this project; no third-party stock asset is added.
