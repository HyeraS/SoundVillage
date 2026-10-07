# 미지의 소리 마을 — 이미지 생성 프롬프트

제작: 내장 이미지 생성 도구(image_gen). CLI/API 경로 미사용.

각 시안은 공통 생성 프롬프트와 개별 프롬프트를 연결해 별도로 생성했다. 이후 초안의 세밀한 질감을 기존 게임에 더 가까운 굵은 픽셀 표현으로 보정했다. 생성 이미지는 디자인 목업이며 정확한 타일맵이나 작동하는 충돌 데이터가 아니다.

## 공통 생성 프롬프트

```text
Use case: ui-mockup.
Asset type: one polished 2D pixel-art outdoor village map design proposal for the Korean browser game SoundMimic Village, not a playable build.
Primary request: design the "미지의 소리 마을" (unknown-sound village) as a cozy Halloween village, capturing the welcoming village-life feeling of Animal Crossing but rendered entirely as classic flat 2D pixel art. User wants a WALKABLE GAME MAP, not a decorative illustration.
Reference roles: user's attached first illustration is a reference for friendly jack-o-lanterns, warm windows and autumn mood ONLY; do NOT adopt its ground-level perspective. User's second and third attached game maps are references for orthographic top-down 3/4 village layout, cozy Halloween props and crisp sprite silhouettes. The existing Nature and Animal screenshots inspected in this conversation are references for the actual game's restrained pixel density, earthy paths, character/house proportions and thin cream HUD. Create ORIGINAL assets, no copied logos or watermark.
Shared art direction for all three proposals: high-quality consistent 16/32px-family pixel art, discrete square pixels, deliberate 1–2 logical pixel edges, flat 3–5-tone sprite shading, sparse clustered ground detail, small contact shadows cast southeast. World planned as 48x36 logical tiles, 32px each, landscape 4:3 full-map overview approximately 1536x1152. Full village visible, no horizon/sky, no floating island edge, no isometric diamonds, no 3D modeling/rendering, no painted brushstrokes, no blur, no soft illustration, no glossy vector shapes. Match a commercial top-down 2D sprite game. Roofs show front walls below them and verticals stay vertical. Buildings modest relative to the map; at least five separate outdoor cottage/building volumes and interconnected garden spaces. Calm readable ground occupies at least 45% of map. Trees and decorations form clusters at edges, NOT carpet-like clutter.
Gameplay readability: continuous wide walking circuits from the south entrance to every district; main paths approximately 3–4 tiles wide, branch paths 2–3 tiles, generous turning spaces. Houses, trunks, pumpkin carts, ponds and fences read clearly as solid obstacles; open gates and passable gaps are obvious. No collection item inside a fenced-off bed, on a roof, underwater, or hidden by tree foliage. Exactly six SAMPLE floating sound collectibles, ivory-mint abstract small luminous lozenges with a simple neutral waveform-like inner stripe, all same design, hovering above tiny separate ground shadows and discrete pixel sparkles; leave empty ground around each. These are conceptual examples, not all runtime sounds. No musical-note or source-revealing symbols. Exactly one small chibi human player on a path near bottom center, approximately 2 tiles tall at this overview, subtle warm outfit, not a giant foreground character. Ambient pumpkin lanterns are warm amber, dimmer than the six collectibles. No enemies, gore, jump scares, weapons or threatening horror.
UI mockup: one slim warm ivory toolbar across top, highly legible dark brown Korean text. Left small "← 월드맵", then title "미지의 소리 마을"; right small "소리 수집" and a short neutral progress bar without invented counts. Bottom center small ivory "↓ 입구" plaque positioned on the entrance. No other captions, labels, callouts, watermarks, side panels, legend, palette chips or title outside the game viewport. The artwork itself is a complete immersive map.

```

## 호박등 광장 — 개별 생성 프롬프트

```text

Specific proposal 01 — PUMPKIN LANTERN SQUARE / 호박등 광장:
This is the brightest and most grounded cozy Halloween choice, a welcoming golden autumn village at late afternoon. Muted olive/sage grass (#89965A), creamy ochre paths (#E7C78A), terracotta and cinnamon roofs, dusty plum tree crowns in moderation, pumpkin orange accents (#DA873B), warm pale plaster and chestnut wood. Avoid oversaturated yellow ground.
Layout: a broad rounded-square stone-and-dirt ring surrounds a modest central harvest square. At the center a single round autumn tree growing out of a low circular planter, a few jack-o-lanterns nestled at its base, with wide space all around. A clear south entrance joins the ring and two cross-lanes offer alternate routes. Cottage clusters northwest and northeast; a small cream village hall along the north edge, two little purple/terracotta roof cottages southwest/southeast; west open-gate pumpkin garden; east small awning stall with pumpkin cart set off the path. Short fences enclose gardens, never surround the whole playable zone like room walls. Vary paths organically with small stone stepping details but preserve generous walkability. Autumn leaves, tiny friendly ghost cloth decorations and bat garlands on eaves, very limited spiderwebs. Do not use a graveyard as the main theme. Distribute six sample sound items in separate quiet path-side discovery pockets, never in the central planter. Full top-down map fills the entire viewport below the thin toolbar. Make the overall composition feel intimate and thoughtfully authored, with large clear navigation paths and charming distinct buildings.

```

## 달안개 수로 — 개별 생성 프롬프트

```text

Specific proposal 02 — MOONMIST WATERWAYS / 달안개 수로:
A luminous blue-hour Halloween waterside village, mysterious yet safe and warm. Ground is LIGHT muted dusty sage-teal (#789C91), water medium desaturated teal (#467A80), paths pale oatmeal (#D7CDB2), roofs muted slate-plum (#6F637D), tiny pumpkin/apricot lights (#E6A358), ivory collectibles. Never cover the image in dark purple, black night shadows or thick fog; the ground and routes must stay readable. This proposal should differ clearly from the sunny autumn square, while keeping exactly the same pixel-art scale and building language.
Layout: a narrow meandering S-shaped canal runs from upper-left to lower-right, dividing the map into two soft organic banks; THREE clearly wide wooden bridges at north, center and south connect both banks and create two alternate walking loops. Do not make a symmetric circular island map. At north-center a small star-roofed town clock cottage facing an open landing, not a laboratory; northwest and northeast two small cozy homes, southwest lantern workshop and southeast riverside cottage; additional tiny covered waterside stall. Small pumpkin lamps flank bridges outside the traversable deck; willow-like round teal trees and occasional lilac trees frame homes. One compact waterfront plaza with benches and a short timber landing is a visual focal point. The water is explicitly non-walkable with continuous readable banks; all bridge decks connect flush to paths. Low haze allowed only at distant outer map edges and over decorative water, never over items or routes. Friendly ghost cloth hung under an eave, modest paper star garland, orange pumpkins and warm windows for Halloween. Six identical sample floating sound lozenges on accessible quiet ground across both banks, none in water and none on the narrow bridge decks. The south entrance splits naturally into both loop options. Full top-down map visible with same thin Korean toolbar.

```

## 보랏빛 마녀 골목 — 개별 생성 프롬프트

```text

Specific proposal 03 — VIOLET WITCH LANES / 보랏빛 마녀 골목:
A cozy storybook Halloween woodland village in soft lavender late-afternoon light, slightly whimsical, not spooky horror. Muted moss/olive ground (#8B966A), pale dusty peach/cream dirt lanes (#DDC4A0), plum and lavender foliage (#94718D), aubergine and terracotta cottage roofs, cream plaster and dark wood, soft apricot pumpkins. Brightness intermediate between proposals 01 and 02. Warm and earthy, never monochrome purple or neon magic.
Layout: an asymmetrical figure-eight pedestrian lane curls through three separate small neighborhood courtyards, connected by two short cross-lanes for exploration and obstacle detours. The entire map is an outdoor village, NOT one building's interior. A modest tall crooked-roof witch's cottage sits at upper-center offset from the paths as landmark; separate small potion shop and harvest bakery around the left courtyard, two separate compact homes on the right, and a tiny open-front canopy market off the lower loop. All five-plus houses have visible doors with empty approach space. Center is an OPEN public courtyard with a low stone wishing well and a bench off its side; leave generous paths passing both sides. Gentle clusters of plum trees, a few leafless ornamental trees, pumpkin carts tucked beside houses, small mushrooms and modest hanging cloth ghosts. Low garden walls and short fence segments create corners to walk around but have wide visible gates. An intimate upper-right quiet memory garden uses ONLY three small rounded weathered stones among flowers; no skulls or threatening cemetery. Main lanes stay wide, not a maze. Six identical floating abstract sound lozenges occupy path-side pockets among the three courtyards, clearly separated from props and reachable from south entrance. Show the single player discovering a collectible near a clear turning point on the lower loop. Same restrained sharp 2D sprite detail and same Korean toolbar as other proposals.

```

## 공통 보정 프롬프트

```text
Use case: style-transfer.
EDIT input image 1, the completed map design. Input image 2 is ONLY a pixel-art STYLE reference (user's Halloween top-down map). Input image 3 is ONLY a pixel-density and earthy rendering STYLE reference from the existing SoundMimic game. Do not reproduce reference logos or screenshot artifacts.
Critical requested correction: redraw the WHOLE scene as genuinely COARSE crisp 2D pixel art compatible with input 3 and the discrete hand-placed clusters of input 2. The current input 1 is too high-resolution painterly and far more finely textured than the existing game. Preserve its map layout, cottage positions, path network, cozy mood, the Korean toolbar and composition, but SIMPLIFY THE ART substantially. Imagine the scene was drawn natively on a 480x360 pixel canvas and enlarged exactly 3x using nearest-neighbor: large visible uniform square 3x3 pixels throughout world art, unmistakably stepped contours on roofs, trees and paths, 1 logical pixel dark outline, 3–4 FLAT solid color values per material. A tree crown uses broad interlocking colored pixel clusters, NOT hundreds of little leaves or fuzzy highlights. Ground tiles are mostly quiet flat color with a few 2–3-pixel marks; remove at least 70% of ground speckles and tiny flowers. Cottage roof shingles should be larger repeatable modular blocks, walls flat, shadows simple 1–2-tone solid contact shadows. Preserve clear separation of grass and sandy paths. Use a restrained roughly 32–48 color palette for world art. No blur, no gradients, no painterly shading, no smooth curves, no 3D lighting, no miniature diorama look. This must look like actual clean, charming SNES-style tilemap game art, not a fine-detailed illustration with a pixelation filter.
Keep the existing generous walking routes around obstacles. Render six identical neutral floating sound items as small ivory/mint lozenges with a simple stripe, discrete pixel halo and a detached tiny ground shadow. Keep them separate from background decor. Exactly one player, preserve bottom entrance. No additional UI or labels, keep Korean title "미지의 소리 마을", "← 월드맵", "소리 수집", "↓ 입구" as crisp legible UI.

```

## 호박등 광장 — 개별 보정 지시

```text
Specific identity: preserve warm muted olive grass, orange pumpkin accents and the central tree plaza. The figure inside the pumpkin field should clearly be an inanimate straw scarecrow, not a second player. Reduce oversaturated orange lighting and keep roofs terracotta with plum accents.
```

## 달안개 수로 — 개별 보정 지시

```text
Specific identity: preserve the canal, both wooden bridges and waterside homes, and the LIGHT sage-teal ground. Keep all six sound items on accessible LAND. Simplify the water to 3 flat teal pixel bands with sparse discrete ripples, NO glistening painterly surface.
```

## 보랏빛 마녀 골목 — 개별 보정 지시

```text
Specific correction for this map: the current lower-left floating sound item is inaccessible in the pond. REMOVE it from the water and place that SAME sixth item on the wide open land path immediately east of the pond, leaving clear walking access and enough space from fences. Preserve the other five sample item positions. Preserve earthy olive grass and plum foliage but lighten dark shadow masses.
```

## 보정 입력

1. 각 시안의 첫 생성 이미지(편집 대상).
2. 사용자 두 번째 할로윈 마을 이미지(스타일 참조).
3. `_review/nature-zone-tree-declutter/01_full_zone.png`(기존 게임의 픽셀 밀도·지면·캐릭터 비례 참조).

