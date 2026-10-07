# SoundVillage approved village currency icons

## Decision

The existing six 32×32 octagonal currency icons remain the approved runtime
assets without a redesign. Each village's in-world sound-data marker now draws
the matching approved currency icon, so collecting data and spending the
resulting currency use one established symbol.

| Village | In-world marker now uses |
| --- | --- | --- |
| Animal | `animal.png` octagonal paw token |
| Human | `human.png` octagonal person token |
| Nature | `nature.png` octagonal seedling token |
| Urban | `urban.png` octagonal car token |
| Music | `music.png` octagonal note token |
| Lab | `lab.png` octagonal controller token |

The runtime files remain
`/assets/economy/village-currencies/{animal|human|nature|urban|music|lab}.png`
for compatibility with wallet, shop, attendance, and purchase UI. Database
columns, reward amounts, prices, and ledger contracts are unchanged.

## Rendering contract

- exactly six 32×32 RGBA PNG files;
- binary transparency and at least a one-pixel safe margin;
- hard pixel edges with nearest-neighbor review scaling;
- the established shared octagonal footprint and a distinct motif/palette for every village;
- legible at the 16px world HUD size as well as 24px and native 32px.

The live village renderers retain their animation, glow, proximity, lock, and
completion treatments around the approved icon. Their previous provisional
circles, crystals, or faceted marker cores remain only as load-error fallbacks.

## Review files

- `all-candidates.png` — source-led and HUD-refined octagonal candidates.
- `recommended-six.png` — selected set at 16, 24, and 32px.
- `generated-a-vs-asset-pack-b.png` — generated draft A versus approved asset-pack B.
- `hud-24px-light.png` and `hud-24px-dark.png` — HUD contrast checks.
- `hud-32px.png` — native runtime size.
- `nearest-neighbor-8x.png` — pixel-grid inspection.
- `silhouette-test.png` — marker silhouettes without color cues.

The earlier generated Stage 3A set is preserved unchanged under
`../currency-icons-generated-draft-a/` for historical comparison.
