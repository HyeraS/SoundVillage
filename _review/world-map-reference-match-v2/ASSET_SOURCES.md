# Sound Archive Garden v2 asset sources

## Source of truth

The environment artwork comes from the user-supplied reference:

`design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png` (1448×1086)

No v1 landmark, ground-pattern, border-forest, or decoration asset is visible in the v2 runtime. Those files remain preserved as a fallback under `public/assets/world/sound-archive-garden-v1/`.

## Clean master preparation

OpenAI ImageGen built-in edit mode was used once with the reference as the precise edit target. The request was to remove only the central player and restore the occluded concentric stone paving while preserving the exact 4:3 canvas, crop, camera, object positions, scale, palette, materials, shadows, and all other pixels.

To prevent any model drift outside the intended edit, `scripts/prepare-world-map-reference-v2.py` composites only a feathered polygon around the player (changed bounding box: x=703..751, y=514..579) from the ImageGen result into the untouched original. It then creates the exact 2× production master:

`public/assets/world/sound-archive-garden-v2/world-base-clean.png` (2896×2172)

The clean normalized source used for QA is:

`_review/world-map-reference-match-v2/01-reference-clean.png` (1448×1086)

The reference-to-clean mean RGB absolute error is 0.000186 normalized, confined to the player-removal neighborhood.
