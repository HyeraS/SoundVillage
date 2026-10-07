# ImageGen prompt set

Built-in ImageGen을 사용했다. 세 번 모두 기존 `02-sound-archive-garden-hd-master.png`를 immutable layout reference로 입력했다.

## 공통 잠금 조건

```text
Use case: stylized-concept
Asset type: production concept sheet for a 2D top-down game world map reskin
Input image: Image 1 is the immutable layout and composition reference.

View and style: fixed top-down three-quarter orthographic view; crisp high-resolution pixel art with one consistent medium-coarse pixel scale; readable, original cozy life-sim 2D game art; never a 3D render.

Immutable geometry: retain the exact same 4:3 canvas, camera, crop, and scale; same central circular library footprint and door; same six outer village landmark positions and footprints; same player-home position; same bottom entrance; same ring road, radial roads, bridges, river banks, gates, plazas, stairs, doorway centers, road widths, open lawns, walkable gaps, and edge exits. Every path centerline and entrance stays aligned to Image 1. Do not add, remove, bend, resize, or shift roads, buildings, bridges, gates, or water crossings.

Production modularity: terrain reads as one clean base layer. Buildings, trees, flowers, lamps, signs, fences, benches, rocks, bridges, and props have clean separable silhouettes and explicit ground contact for later transparent-PNG extraction. Reuse a coherent common object set across districts.

Gameplay readability and collision: paths stay clearly distinct from grass; solid objects use compact readable footprints and short contained shadows; no foliage, roots, awnings, tables, glow effects, or decorations cover path edges or entrances. Leave at least one character-width route around every freestanding prop. Doorways remain obvious.

Constraints: no characters, no UI, no labels, no text, no logos, no watermark, no extra structures, no photorealism, no isometric 3D, no painterly blur. Preserve composition more strongly than style changes.
```

## 01 Spring Sound Archive Garden

```text
Primary request: bright late-spring morning; sage and apple greens, cream stone, honey wood, teal roofs, pale blue water; lush but controlled wildflowers. Give the six districts clear identities through materials and props only: animal paddock, nature creek, human market, urban audio-tech plaza, music conservatory, mysterious observatory. The center library remains the dominant landmark and the lower approach remains visually open.
```

## 02 Autumn Lantern Village

```text
Primary request: golden late-afternoon in early autumn; olive and moss greens, amber foliage, rust-orange accents, warm cream cobble, chestnut wood, muted blue-green roofs, clear turquoise water. Cozy lanterns and small harvest flower beds add warmth without turning the map into a festival. The six districts read distinctly through restrained materials and props only: animal paddock, nature creek, human cafe market, urban audio-tech plaza, music garden hall, mysterious hill observatory. The central library remains dominant; the lower approach stays open and legible.
```

## 03 Blue-Hour Firefly Commons

```text
Primary request: clear blue hour just after sunset, cozy rather than dark; dusty indigo light, deep spruce and blue-green foliage, lavender and soft peach flowers, pale moonlit stone, warm amber windows and lantern pools, readable cyan water. Use subtle fireflies only on grass, never across roads. Six districts stay distinct through materials and restrained props: animal paddock, nature creek, human evening cafe, urban audio-tech plaza, music conservatory with warm glow, mysterious observatory. The central library is the strongest warm focal point and the lower approach remains visually open. No heavy darkness or fog.
```

## 01 Final — Home + Nature correction

Built-in ImageGen의 `precise-object-edit` 모드로 `01-spring-sound-archive-garden.png`를 수정했다. 승인된 `landmark-home-player-building.png`를 보조 이미지로 사용했다.

```text
Change only two local areas in the Spring Sound Archive Garden edit target.

1. Place the approved compact one-story player cottage in the empty grass plot immediately southwest of the central library, inside the ring road and left of the straight southern radial path. Match the orange tiled roof, mint trim, cream walls, centered south-facing wooden door and short steps. Keep its footprint inside the inner-lawn plot and preserve clear routes around its east and south sides.

2. Add one compact botanical field-station greenhouse on the western stream bank immediately above and left of the existing wooden bridge, with its visible entrance facing southeast toward the bridge approach. Use a cream stone base, teal-green roof, modest glass conservatory section, vines and restrained white flowers. Preserve the stream, waterfall, bridge, river banks and approach path.

Keep all other map regions, roads, landmarks, entrances, water edges, camera, crop, scale and movement corridors unchanged. No labels, characters, UI, new roads or additional buildings.
```

## 01 Final v2 — Nature greenhouse removal

Built-in ImageGen의 `precise-object-edit` 모드로 이전 Final의 서쪽 온실만 제거했다. 수정 전 Spring 시안을 해당 구역의 복원 참조로 사용했다.

```text
Remove only the small teal-roof botanical greenhouse on the western stream bank above the wooden bridge. Restore that local area to the original natural stream-bank treatment: trees, shrubs, grass, wildflowers, rocks and clear water-edge vegetation.

Keep the orange-roof, mint-trim player home southwest of the central library exactly unchanged. Preserve the waterfall, stream, wooden bridge, river banks, central library, roads, gates, every other landmark and the full 4:3 camera/crop. The western bank must remain an open Nature Village landscape gateway with no replacement building, gazebo, arch, sign, tent or landmark.
```
