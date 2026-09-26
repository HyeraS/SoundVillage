# Sunflower Commons production assets

The Animal village is a 48×32 world at 32 px per tile (1536×1024 px).

## Active production files

- `base-map.png` — lossless, byte-identical copy of `public/design-previews/animal-village-concepts/01-sunflower-commons-v4.png`. This is the only static visual source used by the production renderer.
- `walkable-mask.png` — invisible black/white collision reference generated from `lib/animalVillageSunflowerConfig.mjs`. It is loaded for validation and is never painted over the map.
- `foreground-map.png` — transparent 1536×1024 overlay containing only pixels copied from the reference image. The conservative first extraction contains the south entrance arch; ambiguous canopy and roof edges are intentionally omitted.

The earlier sprite sheets and generated accents remain in this folder only as inactive legacy files. They are not loaded or drawn by `lib/animalVillage.js`.

## Rebuild

Run `node scripts/build-animal-village-logical-assets.mjs` after changing collision geometry or the conservative foreground mask. This command never rewrites `base-map.png`.

Reference/base SHA-256 at integration time:

`d6b075ca5df5c54aefb3a96bef7e90f345aa7a09de3b0d1f3250bfb1872acd0c`
