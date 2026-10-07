# World map flat-v2 ImageGen provenance

- Generated with: OpenAI built-in ImageGen (`image_gen`)
- Generation count: 1 (the first candidate passed; no second generation)
- Edit source: `../01-spring-sound-archive-garden-final-v2.png`
- Style references: Lab witch, Music moonlit, Human master, and Urban canonical production village maps
- Output: `world-map-flat-v2-master.png`, 1448×1086 RGB PNG, 3,303,072 bytes
- SHA-256: `662323f4478bf3a9b6419e2c29d92b30a3df8ec61472455523ea658a14ff4601`

## Core edit prompt

> Precisely enhance the approved full world-map artwork while preserving its complete 4:3 composition and every landmark, road, river, bridge, waterfall, entrance and building position. The approved map is the immutable geometry and content reference. Improve only the clarity of existing forms: cleaner medium-coarse pixel edges, clearer material separation, reduced muddy color bleeding and more readable paths. Match the visual pixel density and edge thickness of the supplied production village-map references. The result must be noticeably clearer than the approved concept, but it must still look like cohesive game pixel art viewed at the same scale as the other villages. Do not introduce tiny high-frequency details, vector-like edges, realistic textures, new props, new buildings, text, labels, lighting changes or composition changes. Preserve the southwest player home and the open western nature area exactly. No crop, no camera change, no perspective change and no object relocation.

The edit was submitted as a precise-object-edit with explicit instructions to treat the first image as immutable geometry/content authority, use the remaining images only for pixel density and edge-thickness guidance, preserve 1448×1086/4:3, and return a single full-frame map without UI or labels.

## Measured comparison

- Global phase-correlation shift: 0 px horizontal, 0 px vertical
- Laplacian variance: 1056.12 → 1832.23 (+73.5%)
- Mean gradient: 11.5675 → 14.0603 (+21.5%)
- 95th-percentile gradient: 42.0 → 54.333 (+29.4%)
- The generated output has the same native dimensions as the approved source and is not a nearest-neighbour enlargement.

