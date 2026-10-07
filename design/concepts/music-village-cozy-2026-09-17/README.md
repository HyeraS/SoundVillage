# Cozy Music Village — ImageGen concept set

Generated on 2026-09-17 with the built-in ImageGen workflow.

These images are visual direction styleframes, not collision-authoritative runtime maps. They deliberately preserve the existing Music Village macro structure so the selected direction can be translated into the current 48×36, 32 px tile production pipeline.

## Concepts

### 01 — Moonlit Concert Garden

- Deep indigo, teal and violet nighttime palette with warm amber homes.
- Strongest match to the supplied neon-night references while still reading as a residential village.
- Central flower-and-water garden creates a calm gathering place and a clear visual anchor.
- Recommended as the primary direction for a distinctive Music Village identity.

### 02 — Sunset Record Lane

- Warm terracotta paving with lavender roofs, mint accents and sunset lighting.
- Strongest lived-in neighborhood feeling: record archive, listening café terrace, rehearsal building and workshop all read clearly.
- Brightest ground and clearest route hierarchy of the three concepts.

### 03 — Starlit Sound Canal

- Cool midnight navy and turquoise with coral/magenta sound accents.
- Strongest exploration rhythm: luminous paving dots connect the south gate to the north stage.
- Water remains in non-walkable garden plots while the main loop stays open and collision-readable.

## Shared production prompt

Use case: stylized-concept. Asset type: implementation-ready 2D game environment concept and full Music Village map styleframe. Create an original, lived-in outdoor Music Village for Sound Village, where a small character walks freely, discovers hovering sound objects and transcribes them. Use a landscape 4:3 full-map composition, orthographic 3/4 top-down view and 48×36 tile logic at 32 px per tile. Preserve the existing production macro layout: an open concert stage at the north, Record Archive in the northwest, Listening Café in the northeast, Community Studio in the southwest, Sound Workshop in the southeast, an open two-tile-wide gate centered at the south, a broad outer loop, an inner rounded loop and a central north–south path. Keep at least three clear walkable tiles before every entrance and stage approach. Give every obstacle a readable silhouette and keep lived-in props outside primary routes. Show exactly five small floating sound collectibles over separate unobstructed path tiles. Render polished original 2D pixel art with crisp intentional clusters, coherent tile-game scale and cozy life-sim charm. No characters, HUD, buttons, arrows, map legend, labels, text, logos, watermark, isometric camera, 3D, photorealism, interior walls or path-blocking clutter.

## Direction prompts

- **Moonlit Concert Garden:** deep indigo blue-hour lighting, teal and violet roofs, amber windows and lantern pools, restrained coral/cyan neon accents, a low double-wave teal stage canopy and curved sound-wave flowerbeds.
- **Sunset Record Lane:** late-evening warmth, terracotta stone, dusty rose and lavender roofs, butter-yellow windows, mint/coral accents, record-culture props and vinyl-groove paving rhythm.
- **Starlit Sound Canal:** midnight navy and turquoise, magenta/coral accents, warm interiors, reflective water gardens restricted to non-walkable plots and subtle luminous paving dots from gate to stage.

## Runtime translation constraints

- Rebuild the selected art at the canonical 1536×1152 runtime canvas; the ImageGen outputs are 1448×1086 4:3 styleframes.
- Keep `lib/musicVillageConfig.mjs` as collision and placement authority.
- Bake only ground and static environment into production assets. Render sound collectibles, the player and interaction state at runtime.
- Preserve the current layer order: ground → contact shadows → structures → low props → foreground → emissive → player → sound marker → HUD.
- Validate every building footprint, gate post, stage rear and prop against the existing collision overlay before replacing production assets.

## Music-identity revisions

The selected Moonlit and Starlit directions were revised with the built-in ImageGen edit workflow after review.

- `01-moonlit-concert-garden-v2-music.png`: adds a vinyl-window archive, gramophone/headphone café details, piano-window studio, tuning-fork instrument workshop, waveform stage canopy and central equalizer fountain. The original map geometry, five sound collectibles and routes are preserved.
- `03-starlit-sound-canal-v2-music.png`: adds the same readable building roles, stage instruments, paired equalizer fountains and a restrained treble-clef sculpture. Musical-staff paving remains subtle; excessive glowing note glyphs from the first edit pass were removed so the scene still feels residential.

Shared revision prompt intent: strengthen the unmistakable Music Village identity through functional architecture, integrated paving motifs and one central sound landmark while preserving the cozy residential atmosphere, exact composition, broad walkable loops, entrances, collision readability, palette, pixel density and exactly five runtime-style sound collectibles. Avoid text, UI, new buildings, blocked routes, oversized music symbols and theme-park clutter.
