# Urban City V2 — ImageGen asset rebuild plan

Master requirement: `design/concepts/urban-advanced-city-2026-09-01/CODEX_IMAGEGEN_ASSET_REBUILD_PROMPT.md`

Positive visual reference only: `design/concepts/urban-advanced-city-2026-09-01/02-midnight-metro-media-core.png`.
The existing `/urban-test` screenshots are negative references and are not passed to ImageGen.

## Runtime coordinate system

- Logical world: 48×36 tiles
- Runtime tile: 32 px
- World plate: 1536×1152 px
- View: orthographic top-down 2D pixel art
- Compositing order: ground → shadow → static bases/y-sorted objects → player/items → foreground → emissive/weather
- Images are loaded from `/assets/urban-city-v2/`; Canvas smoothing stays disabled.

## Generation strategy

The final concept is never used as a flat runtime background. ImageGen is called once per cohesive visual family. Each generated family is a 4:3 world-aligned plate so the renderer can crop object regions by manifest rectangle and draw them individually for collision/y-sort. Only the ground plate is opaque; all other families require genuine transparency.

1. `ground/ground-map-v1.png` — ground only: wet asphalt, sidewalks, plazas, curbs, drains, lanes, arrows, crosswalks, bus bay, restrained reflections.
2. `transit/metro-layer-v1.png` — north elevated rail, platform, station canopy, stairs, stopped train, pillars, safety strip and rail detail.
3. `buildings/north-skyline-v1.png` — northwest tower, north hotel/skyline, media tower, northeast curved glass tower.
4. `buildings/district-buildings-v1.png` — west media office, southwest culture/office, east glass food court, southeast curved cinema/media hall.
5. `transit/vehicles-v1.png` — electric buses, autonomous shuttle, parked cars, traffic controllers, EV charger, scooter/bike dock.
6. `props/streetscape-v1.png` — three tree variants, planters, smart lamps, benches, bollards, kiosks, bins, bus shelter, banner poles, low shrubs.
7. `props/landmarks-v1.png` — cyan light fountain, holographic globe, abstract media screens, station entrance detail, satellite dish, antennas, rooftop HVAC/solar modules.
8. `overlays/shadow-emissive-foreground-v1.png` — pixel shadows, restrained cyan/white/violet emissive shapes, tree crowns, canopies, platform rails and façade lips used in foreground/occlusion passes.

The source plates are mechanically resized/cropped only if the built-in output is not exactly 1536×1152. No programmatic substitute art is permitted.

## Visual acceptance Gate 1

Every generated file must be inspected at original resolution for:

- orthographic top-down camera; no isometric/perspective
- coarse, crisp pixel clusters and hard alpha edges
- cool navy/indigo/blue-gray/cyan palette with restrained violet and sparse warm windows
- no UI, text, characters, sound icons, logos, signatures or watermarks
- no cropping of required silhouettes
- correct opaque/transparent background role
- no large flat rectangles that reproduce the current negative renderer

Failed families are regenerated with one targeted correction and the history recorded in `manifest.json`.

## Layout preservation

- North: elevated metro, stopped train, center station and wide stair.
- Outer north/west/east: dense glass office skyline.
- Center: north-south pedestrian spine, east-west road, cyan light fountain.
- West-middle: media office, satellite dish, holographic globe plaza.
- East-middle: transparent food court/office and transfer plaza.
- Southwest: culture/office and mobility dock.
- Southeast: curved cinema/media hall, electric bus stop and outdoor seating.
- South-center: unobstructed world entrance and spawn.

## Collision and occlusion

Collision remains invisible geometry and is fitted to building foundations, rail structures, vehicle bodies, tree/lamppost bases and furniture footprints. Image rectangles are never treated as a single collider. Manifest objects declare collision and foreground regions. Buildings and hard props are rendered from their family plate crop; y-sorted objects use the manifest sort anchor. Tree crowns, entrance canopies, platform rails and façade lips are re-drawn from the foreground plate after the player.

## Review outputs

Gate contact sheets and all game screenshots are written under `_review/urban-advanced-city/imagegen-rebuild/`. The permanent art-only route is `/urban-art-preview`.
