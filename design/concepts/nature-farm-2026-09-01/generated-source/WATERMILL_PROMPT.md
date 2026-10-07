# Brookside Bloom watermill source

- Tool: built-in ImageGen (imagegen skill default mode)
- Generated source: `watermill-source-v1.png`
- Runtime derivative: `public/assets/world/nature-farm/watermill-v1.png`
- Reference image: `../02-brookside-bloom-v2.png` (palette, pixel density, material, and silhouette reference)
- Processing: transparent bounds trimmed, then nearest-neighbor resized to 320px wide. The generated source remains unchanged.

```text
Use case: stylized-concept
Asset type: 2D pixel game environment object sprite, project-bound source asset
Primary request: create one isolated brookside watermill building sprite for the SoundVillage Nature map, matching the upper-left watermill in the provided approved farm-map reference.
Input image 1: composition, palette, pixel-density, material, and silhouette reference only; do not copy its HUD, player, sound markers, or background.
Subject: a compact warm cream-plaster cottage with honey-brown timber framing, burnt terracotta gabled roof, a large readable wooden water wheel attached on the LEFT side, a short turquoise millrace pouring under the wheel, small flower boxes near the door.
Style/medium: crisp hand-authored 2D pixel art, top-down 3/4 RPG building sprite, coarse square pixel clusters, 3–5 tone material ramps, 1–2 pixel dark outline at native game scale, upper-left light, short lower-right contact shadow.
Composition/framing: single front-facing building object, centered, fully visible, generous transparent padding, no ground tile baked in except a very small contact shadow and the water wheel's short millrace.
Color palette: bright spring daylight; warm ivory plaster, honey wood, terracotta roof, clear turquoise water; dark roof and wheel shadows retained for readability.
Runtime intent: displayed about 288 world px wide by 224 world px tall on a 32 px grid beside a creek; door visually about 44–52 world px wide.
Constraints: genuinely transparent background; no scenery, no trees, no path, no HUD, no character, no sound orb, no text, no labels, no watermark; exactly one building and exactly one water wheel; not isometric, not 3D, no anti-aliased painterly edges, no white glow, no windmill.
```
