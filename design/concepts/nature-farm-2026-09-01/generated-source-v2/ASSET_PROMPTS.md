# Brookside Bloom v2 — queued ImageGen prompts

Every call uses `../02-brookside-bloom-v2.png` as **Image 1, primary visual
reference**. Each numbered section is a separate built-in ImageGen call. The
common contract is repeated rather than relying on implicit context.

## 1. North-east cottage

```text
Use case: stylized-concept. Asset type: project-bound standalone 2D pixel RPG
building sprite. Image 1 is the PRIMARY visual reference for palette, pixel
density, silhouette proportions, materials and lighting. Recreate only the
north-east cottage: low broad warm ivory walls, steep blue-gray slate gable
roof, warm brown double front door, small side annex, compact stone chimney,
flower boxes and two entrance planters. Target about 288×256 world px on a 32px
logical grid. Crisp coarse square pixel clusters, limited 3–5 tone ramps,
upper-left light and short lower-right contact shadow. Genuine transparent
background and generous padding. No old house design, terracotta roof,
greenhouse, trees, path, fence, HUD, character, orb, text, watermark,
antialiasing, painterly smoothing, 3D or isometric view.
```

## 2. Greenhouse

```text
Use case: stylized-concept. Asset type: project-bound standalone 2D pixel RPG
building sprite. Image 1 is the PRIMARY visual reference for palette, pixel
density, silhouette proportions, materials and lighting. Recreate only the
far-north-east greenhouse: low wide glasshouse, pale mint-gray frame,
transparent turquoise glass panels, broad trapezoidal roof, warm wooden central
door, visible yellow-green plants inside and tiny pink flowers at the base.
Target about 256×192 world px on a 32px logical grid. Crisp coarse square pixel
clusters, limited 3–5 tone ramps, upper-left light and short lower-right contact
shadow. Genuine transparent background. No cottage, trees, path, fence, HUD,
character, orb, text, watermark, antialiasing, painterly smoothing, 3D or
isometric view.
```

## 3. South-west cottage

```text
Use case: stylized-concept. Asset type: project-bound standalone 2D pixel RPG
building sprite. Image 1 is the PRIMARY visual reference for palette, pixel
density, silhouette proportions, materials and lighting. Recreate only the
south-west small cottage: compact warm ivory facade, steep blue-gray slate
gable roof, one warm wooden door, two small windows, compact chimney and low
flower boxes. Target about 192×224 world px on a 32px logical grid; match the
reference's character-relative scale. Crisp coarse square pixel clusters,
limited 3–5 tone ramps, upper-left light and short lower-right contact shadow.
Genuine transparent background. No second building, trees, path, sign, fence,
HUD, character, orb, text, watermark, antialiasing, painterly smoothing, 3D or
isometric view.
```

## 4. Grass and organic path tile family

```text
Use case: stylized-concept. Asset type: coherent project-bound pixel RPG terrain
tile sheet. Image 1 is the PRIMARY visual reference for palette, pixel density,
materials and lighting. Create a clean, evenly spaced tile sheet for a 32px
logical grid containing: quiet luminous yellow-green grass, light/mid/shadow
grass variants, sparse tiny blade/dot variants; warm buttery-apricot path center,
horizontal/vertical edges, four outer curves, four inner curves, end caps and a
compact intersection. Organic grass fringe must intrude 2–6 px into path edges
without breaking seamless joins. Use coarse square pixel clusters and 3–5 tone
ramps. Orthographic flat tile sheet on genuine transparency outside each tile;
no labels or guide text. No water, bridge, buildings, trees, crops, props, HUD,
character, orb, checkerboard, watermark, antialiasing, 3D or isometric diamonds.
```

## 5. Creek and shoreline tile family

```text
Use case: stylized-concept. Asset type: coherent project-bound pixel RPG creek
terrain tile sheet. Image 1 is the PRIMARY visual reference for palette, pixel
density, materials and lighting. Create compatible 32px-grid creek pieces:
bright turquoise water base and restrained ripple variants; straight banks;
four inside bends; four outside bends; narrowing and widening transitions;
source and downstream continuation. Shoreline combines pale shallow-water edge,
irregular warm-gray stones and bright grass fringe. Separate a few low reed and
small rock cutouts in clearly isolated cells. Coarse square pixels, 3–5 tone
ramps, upper-left light. Genuine transparency outside pieces; no labels. No
bridge, buildings, trees, path, HUD, character, orb, text, checkerboard,
watermark, antialiasing, painterly smoothing, 3D or isometric view.
```

## 6. Wooden bridge family

```text
Use case: stylized-concept. Asset type: coherent project-bound 2D pixel RPG
bridge sprites. Image 1 is the PRIMARY visual reference for palette, pixel
density, silhouette, materials and lighting. Create two matching nine-tile-wide
wooden bridge variants viewed top-down 3/4: bright honey planks, dense narrow
board rhythm, darker water-contact shadow, short posts and low rails. Provide
each bridge as a separated deck/base sprite and separated foreground rail
sprite, aligned to a 32px logical grid. Upper and lower variants share material
but have subtle plank variation. Genuine transparent background. No water or
bank baked behind the bridge, no labels, HUD, character, orb, text, checkerboard,
watermark, antialiasing, painterly smoothing, 3D or isometric view.
```

## 7. Tree and apple-tree family

```text
Use case: stylized-concept. Asset type: coherent project-bound 2D pixel RPG
vegetation sprite sheet. Image 1 is the PRIMARY visual reference for palette,
pixel density, silhouettes, materials and lighting. Create six rounded lush
deciduous tree variants with luminous yellow-green crowns, two darker forest
edge variants of the same proportions and pixel weight, and three apple-tree
variants with only a few integrated readable red apples. Each tree is about
80–112 world px wide and 96–128 px tall on a 32px grid. Arrange isolated sprites
with genuine transparent gaps; trunks and crowns must be separable by a clear
horizontal baseY split for layering. Coarse clustered pixels, 3–5 tone ramps,
upper-left light and short shadow. No giant red squares, flowers, path, buildings,
HUD, character, orb, labels, text, checkerboard, watermark, antialiasing, 3D or
isometric view.
```

## 8. Fields, fences and crops

```text
Use case: stylized-concept. Asset type: coherent project-bound 2D pixel RPG farm
sprite/tile sheet. Image 1 is the PRIMARY visual reference for palette, pixel
density, materials and lighting. Create warm light-brown soil centers, dark soft
soil edges and orderly ridge variants; bright honey-wood fence horizontal,
vertical, corners, end posts and open one/two-tile gates; compact crop rows for
golden wheat, orange carrots, glossy pale cabbage/leaf greens and green corn.
Crops must read instantly but remain below character scale, fitting 32px logical
cells. Clearly separated sheet cells, genuine transparency around fence/crops,
coarse square pixels and 3–5 tone ramps. No buildings, trees, flowers, HUD,
character, orb, labels, text, checkerboard, watermark, antialiasing, 3D or
isometric view.
```

## 9. Flowers and low farm props

```text
Use case: stylized-concept. Asset type: coherent project-bound 2D pixel RPG low
decoration sprite sheet. Image 1 is the PRIMARY visual reference for palette,
pixel density, materials and lighting. Create at least three compact variants
each of 2–6-flower clusters: white daisies, peach-pink blossoms, butter-yellow
wildflowers and occasional lavender-purple flowers, each 6–24 world px. Also
create isolated low reeds, small warm-gray river stones, grass tufts, orchard
bench, signpost, barrel, small crate, watering can and compact farm cart. Keep
reference density and one coherent pixel weight. Genuine transparent gaps,
coarse square pixels, 3–5 tone ramps, upper-left light and short shadows. No
building, tree, path, HUD, character, orb, labels, text, checkerboard, watermark,
antialiasing, painterly smoothing, 3D or isometric view.
```

