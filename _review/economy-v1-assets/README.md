# SoundVillage Stage 3A asset review

This folder contains review-only files. Runtime walk sheets, store previews, and
currency icons live under `public/assets`; nothing in this folder is loaded by
the game.

## Visual approval checklist

- `currency-icons-light-dark.png`: approve the six motifs, palette, common
  token frame, and contrast on light/dark UI.
- `currency-icons-hud-sizes.png`: approve legibility at native 32 px and the
  24 px HUD reduction.
- `outfits-contact-sheet.png`: approve all 18 paid outfit front previews.
- `accessories-contact-sheet.png`: approve all eight accessory anchors after
  the representative hair layer.
- `front-layer-comparison.png`: confirm body → clothes → hair → accessory
  order. Eyes/makeup remain intentionally absent.
- `outfit-existing-vs-new-anchors.png`: compare the unchanged five existing
  sheets with the 13 new master crops.
- `nearest-neighbor-8x.png`: inspect hard pixel edges without interpolation.

## Source contract notes

- Walk sheets are 256×128: 32×32 cells, eight columns, four rows.
- Row order is Down, Up, Right, Left. The existing runtime mapping is unchanged.
- Preview pose is Down row 0, idle column 0.
- Catalog palette index 0 is the only canonical launch export; palette-wide
  purchase behavior is not decided here.
- `clown` has a source-pack-authored 20-pixel color difference between its
  merged master and `separate/walk` sheet. Their alpha anchors match. The
  catalog-referenced merged master is the canonical runtime source.
