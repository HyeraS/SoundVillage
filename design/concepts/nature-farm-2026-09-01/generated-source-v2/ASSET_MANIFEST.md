# Brookside Bloom v2 — asset manifest

Status: **complete and integrated**. This manifest distinguishes accepted
assets, rejected generations, untouched sources, and runtime derivatives. The
production renderer consumes the accepted runtime files under
`public/assets/world/nature-farm-v2/`.

## Visual authority

- Primary reference: `../02-brookside-bloom-v2.png` (1448×1086).
- Map-only normalization: `reference-map-normalized-1536x1152.png`.
- Normalization removes the 47 px concept HUD, then resizes the remaining
  1448×1039 map to the 1536×1152 runtime canvas using nearest-neighbour. It is
  comparison material only and must never be loaded as the runtime background.
- Landmark measurements/config: `../../../../lib/natureFarmArtGuide.mjs` and
  `../LANDMARK_GUIDE.md`.

## Extracted palette

The 24-color quantization was sampled from the map-only portion of the approved
reference. Runtime material ramps are recorded in `natureFarmArtGuide.mjs`.

| Material | Main reference colors |
| --- | --- |
| Grass | `#B4CC26`, `#C7D429`, `#A9C920`, `#97AF27` |
| Path | `#FCD46F`, `#EECF54`, `#D8A357` |
| Water | `#1EC5D3`, `#21AEB7`, `#35788C`, pale cyan glints |
| Foliage | `#71AA2A`, `#50912B`, `#256730`, `#3F5545` |
| Wood | `#D8A357`, `#9C6929`, `#5F5C26` |
| Plaster/roof | `#DDD3AD`, slate `#3F5545`, terracotta `#AD6F41` |

## Generated sources

| Asset | Source | Runtime derivative | Status | Notes |
| --- | --- | --- | --- | --- |
| Complete Brookside Bloom world | `brookside-bloom-runtime-source-v3.png` | `../../../../public/assets/world/nature-farm-v2/brookside-bloom-map-v3.png` | **accepted; primary runtime layer** | Precise ImageGen edit of the approved village removed only the baked player, seven sound markers, Enter prompt and D-pad. The environment remains a single coherent ImageGen scene. Runtime is point-resized to the exact 1536×1152 / 48×36 world. |
| Watermill | `watermill-source-v2.png` | `../../../../public/assets/world/nature-farm-v2/watermill-v2.png` | **accepted after cleanup; wired** | First output had a baked near-white checkerboard. The unchanged source is preserved; `watermill-clean-v2.png` is a non-destructive flood-filled alpha cleanup. Runtime is nearest-neighbour fit to 384×256 on a transparent canvas and is loaded by `lib/natureVillage.js`. |
| North-east cottage | `north-cottage-source-v2.png` | `north-cottage-v2.png` | **accepted** | Genuine alpha. Trimmed derivative `north-cottage-clean-v2.png`; point-filter fit to 288×256, south aligned. |
| Greenhouse | `greenhouse-source-v2.png` | `greenhouse-v2.png` | **accepted** | Genuine alpha. Trimmed derivative `greenhouse-clean-v2.png`; point-filter fit to 256×192. |
| South-west cottage | `south-cottage-source-v2.png` | `south-cottage-v2.png` | **accepted** | Genuine alpha. Trimmed derivative `south-cottage-clean-v2.png`; point-filter fit to 192×224. |
| Grass/path terrain family | `grass-path-source-v2.png` | `grass-v2.png`, `path-v2.png` | **accepted after cleanup** | RGB checkerboard removed in `grass-path-clean-v2.png`. 33 connected cells detected in row order; first 16 → 8×2 grass atlas, remaining 17 → 8×3 path atlas. Each cell shaves 2 source px, removes near-white edge residue, point-resizes to 32×32 and composites over reference grass `#B4CC26`. |
| Creek/bank terrain family | `creek-bank-source-v2.png` | `creek-bank-v2.png` | **accepted after cleanup** | RGB checkerboard removed in `creek-bank-clean-v2.png`; limited near-white halo removal in `creek-bank-runtime-clean-v2.png`. Runtime preserves the 1536×1024 source sheet for explicit source-rect rendering. |
| Bridge deck/rail family | `bridge-source-v2.png` | `bridge-deck-v2.png`, `bridge-rails-v2.png` | **accepted after one edit** | First result (`bridge-source-v2-rejected-bg.png`, historical filename) had real alpha but was too deep, not rejected for background. Targeted edit changed only complete-bridge proportion to ≈2.28:1. Baked gray checker in the edited result was flood-filled at 8% into `bridge-clean-v2.png`. Deck crops `(54,248,660,289)` and `(820,249,662,289)` → two 288×128 rows. Rail crops `(54,629,660,123)` and `(823,629,658,123)` → two 288×54 rows. |
| Trees/apple trees | `trees-source-v2.png` | `trees-v2.png`, `forest-trees-v2.png`, `apple-trees-v2.png` | **accepted after cleanup** | RGB checkerboard removed in `trees-clean-v2.png`. Connected full-tree components split 6/2/3; each runtime cell is 112×128. Forest crown/trunk pairs were recomposed at baseY to remove generated transparent gaps. Apples are generated pixels, never overlay rectangles. |
| Fields/crops/fences | `farm-source-v2.png` | `farm-v2.png` | **accepted after cleanup** | White background flood-filled in `farm-clean-v2.png`; runtime retains the 1536×1024 sheet for explicit soil/fence/crop source rects. |
| Flowers/reeds/rocks/props | `flowers-props-source-v2.png` | `flowers-props-v2.png` | **accepted after cleanup** | White background flood-filled in `flowers-props-clean-v2.png`; runtime retains the 1536×1024 sheet for explicit low-cluster and prop source rects. |

ImageGen originally returned a usage-limit response after the first call on
2026-09-01. Generation resumed later the same day and all nine queued calls
completed. Every original source and the rejected first bridge proportion is
preserved for audit. No existing Nature/farm atlas is an approved fallback.

### Watermill prompt

```text
Use case: stylized-concept. Asset type: project-bound 2D pixel RPG environment
sprite. Image 1 is the PRIMARY visual reference for palette, pixel density,
silhouette proportions, materials and lighting. Recreate the northwest
watermill as one standalone sprite: low wide warm cream plaster building,
honey-brown timber frame, burnt terracotta tiled gable roof, large readable
wooden water wheel on the left, short turquoise millrace, warm wooden door,
small flower boxes, one barrel and compact crates. 2D top-down 3/4 RPG pixel art
for a 32px logical grid, crisp coarse square clusters, 3–5 tone ramps,
upper-left light and short lower-right shadow. Genuine transparent background;
no antialiasing, painterly smoothing, 3D, isometric view, HUD, character, sound
orb, text, watermark, trees, long river, path, fence or extra building.
```

## Common prompt contract

The original nine asset-family calls used these constraints:

```text
Use case: stylized-concept.
Asset type: project-bound 2D pixel RPG environment sprite or coherent tile family.
Image 1 is the PRIMARY visual reference for palette, pixel density, silhouette,
materials and lighting. Match its luminous spring yellow-green meadow, turquoise
creek, warm honey wood, warm ivory plaster, blue-gray slate and terracotta.
2D top-down 3/4 RPG pixel art for a 32px logical grid. Crisp coarse square pixel
clusters, limited 3–5 tone ramps, upper-left light, short lower-right contact
shadow. Transparent objects require genuine alpha. No antialiasing, painterly
smoothing, 3D, isometric view, white/checkerboard baked background, HUD,
character, sound orb, text, label or watermark. Do not add unrelated scenery.
```

The final world-only edit additionally locked every environmental object and
removed only gameplay overlays so the approved ImageGen composition could be
used directly by the runtime.

## Runtime acceptance gate

`npm run validate:nature-assets` passes. It requires these 15 Nature-only
runtime files and also scans `lib/natureVillage.js` for every forbidden legacy
path:

```text
brookside-bloom-map-v3.png
watermill-v2.png
north-cottage-v2.png
greenhouse-v2.png
south-cottage-v2.png
grass-v2.png
path-v2.png
creek-bank-v2.png
bridge-deck-v2.png
bridge-rails-v2.png
trees-v2.png
forest-trees-v2.png
apple-trees-v2.png
farm-v2.png
flowers-props-v2.png
```

The complete world layer is the primary renderer input. The fourteen split
assets remain accepted, auditable fallbacks and reusable foreground/source
material. Validation currently reports `PASS (15 runtime assets, no forbidden
references)`.
