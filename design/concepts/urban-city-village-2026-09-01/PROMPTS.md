# ImageGen Prompt Set

생성 방식: Codex 내장 ImageGen. 첨부 도시맵 3장은 구도·도시 요소 참고, 기존 Nature/Lab 콘셉트는 픽셀 굵기·HUD·소리 아이템·아트 패밀리 참고로 사용했다.

## Shared prompt

```text
Use case: stylized-concept
Asset type: production-minded game map design mockup for SoundMimic Village Urban Zone
Input images: Images 1–3 are layout and urban pixel-map references only; Image 4 is the strongest reference for the existing game's pixel thickness, warm cream HUD, player scale, collectible design, and overall art family; Image 5 supports the lush cozy village density and path readability. Generate a new original map, do not edit or reproduce any source image.
Primary request: one complete outdoor urban village map for a 2D sound-transcription exploration game. The player walks freely around town, cannot pass through buildings, trees, parked vehicles, fences, lamps, planters, or water, and must route around them.
Style/medium: polished orthographic top-down 2D pixel art, absolutely not isometric, not 3D, not perspective concept art. Cozy gentle life-sim village feeling, but an original design. Chunky square pixels, broad flat color clusters, restrained texture, crisp nearest-neighbor edges; visual equivalent of native 384×288 or 512×384 game art enlarged cleanly. Match Image 4's pixel density and character/object scale. Outdoor town, never an interior room or cutaway.
Composition/framing: landscape 4:3 gameplay screenshot showing the complete map. A clear south entrance at bottom center with the player just inside. Connected sidewalks and pedestrian paths make a continuous loop through every area; minimum path width is two player sprites. Buildings form believable collision masses while doors face accessible walkable space. Preserve plenty of open navigation room.
Gameplay: exactly SIX floating golden sound collectibles, each a small circular glow containing a simple white waveform, with a tiny dark oval ground shadow. Every collectible is on dry, reachable pedestrian pavement or plaza space, at least one player-width away from all obstacles; none on roads, water, rooftops, behind fences, or inside props. Show no collection badges or dark square backgrounds.
UI: one slim warm-cream pixel HUD bar at top, matching Image 4. Korean text only: “← 월드맵” at left, “🏙 도시 마을” beside it, “소리 수집” centered, “구역 6 / 6” at right. A small cream pixel D-pad at lower-left. A tiny cream label “↓ 입구” at bottom center. No other readable text, no logos, no watermark.
Constraints: map must feel like an inhabited city village, not a room, highway interchange, empty parking lot, formal garden, or rural farm. Keep drivable asphalt visually distinct from walkable sidewalks, but collectibles and player stay on safe walkable areas. Furniture and scenery must read as obstacles with clear silhouettes. Avoid excessive tiny detail, thin anti-aliased lines, photorealism, 3D rendering, isometric perspective, diagonal camera, blurred pixels, fake screenshot borders, multiple panels, minimap, quest windows, dialogue boxes.
```

## Concept 1 — Brick & Bloom Civic Square

```text
Scene/backdrop: warm clear daytime neighborhood of terracotta-roof brick townhouses, a bakery façade, tiny corner café, post office, flower shop, and low apartment blocks around a leafy civic plaza. A compact clock pavilion and small fountain anchor the central plaza. A single narrow two-lane street makes a rounded rectangular loop around the plaza, with four zebra crossings and broad pale-stone sidewalks. Pocket flower beds, street trees in square planters, benches, bicycle racks, one bus shelter, a delivery van and two parked compact cars create city life without blocking paths.
Layout: three main connected pedestrian loops—central civic plaza, west shop row, east residential pocket—with short alleys connecting them. South entrance feeds directly onto the central promenade. Make six visually distinct sound-search pockets without drawing hard district borders.
Lighting/mood: sunny late morning, cheerful and cozy.
Color palette: warm brick red, cream façades, muted navy asphalt, sage and emerald trees, butter-yellow awnings, small coral accents.
```

## Concept 2 — Canal Station Promenade

```text
Scene/backdrop: cozy compact city district built around a narrow blue canal running vertically along the right third, crossed by exactly two broad stone pedestrian bridges. A small brick railway station with clock and glass canopy sits at the north center; a short decorative tram is stopped beside it and never blocks a walkable route. West side has bookshop, bakery, café terraces, brick rowhouses, and a tiny produce kiosk. East side has a riverside promenade, pocket park, town library façade, benches, lamps, planters, and bicycle parking. No giant buildings.
Layout: south entrance opens onto a generous station boulevard. A walkable loop runs west through shop alleys, north to the station plaza, east over the upper bridge, down the canal promenade, and back over the lower bridge. Both sides remain reachable; canal banks and rail edge are clear collision boundaries. Exactly six collectibles on dry paving spread across both sides.
Lighting/mood: soft golden afternoon with calm blue water, cozy but clearly urban.
Color palette: honey brick, dusty teal, warm cream stone, desaturated blue water, forest green foliage, burgundy awnings.
```

## Concept 3 — Pocket Park & Night Market Boulevard

```text
Scene/backdrop: lively but cozy early-evening neighborhood centered on a large irregular pocket park with mature trees, curved brick walking paths, a small bandstand, flower planters, and a dry paved community square. Around it are compact mixed-use buildings: noodle café, record shop, laundromat, corner market, warm apartments with lit windows, and a modest cinema marquee shape with no readable text. A T-shaped asphalt boulevard and one side street frame the district; one stationary city bus at a curb, scooters and parked cars add urban identity. String lights appear only over the market square and do not obscure movement.
Layout: a curved park loop connects to a straight shop arcade and a south-to-north boulevard promenade; frequent sidewalk gaps and two zebra crossings join all areas. South entrance is unmistakable. Six sound collectibles are evenly distributed across open sidewalks, plaza, and park paths, all reachable and unobstructed.
Lighting/mood: cozy blue-hour dusk, warm amber windows and streetlamps, readable ground and obstacles; not dark or neon cyberpunk.
Color palette: deep teal and muted indigo shadows, terracotta brick, warm amber light, dusty rose awnings, rich green trees, cream UI.
```

## Concept 3 localized correction

```text
Use case: precise-object-edit
Primary request: Add one sixth floating golden sound collectible on the clear dry central stone sidewalk at approximately 50% image width and 77% image height, above the player and below the existing center collectible. Match the other collectibles exactly and keep everything else unchanged. After the edit there must be exactly six collectibles.
```
