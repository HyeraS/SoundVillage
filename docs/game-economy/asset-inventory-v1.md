# SoundVillage asset inventory v1

Status: source audit and economy catalog linkage contract. `InteriorDecorRoom` is the official system; `HouseDecorRoom` is retained as test-only and unofficial. No source asset, runtime catalog, database, purchase API, or UI was changed in this phase.

## Audit boundary

- Read-only source packs: `assets/Character v.2`, `assets/interior full`
- Existing connections checked: `components/AssetRegistry.js`, `lib/shopCatalog.js`, `lib/interiorCatalog.js`, `lib/houseCatalog.js`, `lib/currency.js`, `lib/interiorDecor.js`, `lib/houseDecor.js`, `app/api/participant-purchase/route.js`, `components/SoundMuseum.js`, `components/InteriorDecorRoom.js`, `components/HouseDecorRoom.js`
- Database history checked: `scripts/currency_schema.sql`, `scripts/interior_decor_schema.sql`, and security migrations `001` through `007`, especially the currently effective reward and purchase functions in `003` and `006`
- Runtime files were compared to the purchased originals by image dimensions and exact pixel matching. No source file was moved, edited, or copied.

## Character v2 inventory

The pack contains 1,041 filesystem entries: 1,036 PNG files, 3 text files, and 2 `.DS_Store` files. The high file count is mostly action-separated duplicates, not 1,036 different cosmetics.

| Group | Master files | Selectable variants represented | Notes |
| --- | ---: | ---: | --- |
| Body/skin | 8 individual sheets + 1 aggregate | 8 skin tones | `char_all.png` duplicates the 8 individual sheets in one file. |
| Clothing | 19 | 156 palette realizations | 14 styles have 10 palettes, clown and pumpkin have 2, spooky and witch have 1. `basic` is the default. |
| Hair | 15 | 210 palette realizations | 13 actual styles × 14 colors, plus 2 skirt-underlay compatibility sheets × 14 colors. |
| Eyes/makeup | 3 | 14 eye colors + 5 blush + 5 lipstick | Eye colors follow the ordering in `list.txt`. |
| Accessories | 15 | 46 palette realizations | Beard 14, glasses 10, sunglasses 10, and 12 fixed-color earring/hat/mask files. |
| Greyscale/modular | 122 | authoring inputs | Intended for recoloring and modular composition; not direct launch products. |
| Action-separated | 853 | 13 action groups | Axe, block, carry, die, fish, hoe, hurt, jump, pickaxe, pickup, sword, walk, and water. |
| Utility | 2 | — | `emoticons.png`, `shadow.png`. |

### Canonical color order

- Hair, 14: Black, Blonde, Brown, Brown Light, Copper, Emerald, Green, Grey, Lilac, Navy, Pink, Purple, Red, Turquoise.
- Clothing, 10: Black, Blue, Blue Light, Brown, Green, Green Light, Pink, Purple, Red, White/Grey.
- Eyes, 14: Black, Blue, Blue Light, Brown, Brown Dark, Brown Light, Green, Green Dark, Green Light, Grey, Grey Light, Pink, Pink Light, Red.
- Blush and lipstick each contain 5 light-to-dark values.

### Animation and layer contract

The source uses a 32×32 grid and a merged 256×1568 layout. The documented render order is body → eyes/blush/lipstick → clothes → hair → accessories. Walk is a 256×128 block with 8 frames × 4 directions at 100 ms per frame. Pixel inspection confirms row order Down, Up, Right, Left; the existing renderer mapping (`down: 0, up: 1, right: 2, left: 3`) is unchanged. The source also includes jump, pickup, carry, sword, block, hurt, die, axe, pickaxe, water, hoe, and fishing animations.

The launch catalog treats color as a variant of a style, not as a separately purchased item. That avoids selling identity attributes and avoids creating hundreds of duplicate entitlements.

### Existing game connection

| Asset area | Connected now | Not connected as a selectable product |
| --- | --- | --- |
| Player body | `char1` walk block is `/assets/world/player_body.png` | Skin tones 2–8 |
| Player clothing | `basic` walk block is `/assets/world/player_clothes.png` | Remaining basic color palettes |
| Player hair | First buzzcut palette is `/assets/world/player_hair.png` | 12 other hair styles, all additional hair colors, and the 2 underlay helpers |
| Outfit shop | Existing IDs preserved: `overalls`, `sailor`, `sporty`, `suit`, `witch` | 13 other clothing masters and their color variants |
| Eyes | No eye layer exists in `WORLD_CHARACTER.layers` | All 14 eye colors, blush, lipstick |
| Accessories | No accessory layer exists in `WORLD_CHARACTER.layers` | All 15 accessory masters |

The five paid outfit runtime sheets are exact matches for the first 256×128 walk block of their corresponding purchased master. The current default body is an exact match for `separate/walk/char1_walk.png`; the default clothing is the first `basic_walk` palette; the default hair is the first `buzzcut_walk` palette.

### Stage 3A runtime confirmation

- All 18 paid outfit IDs now resolve through `OUTFIT_SHEETS`. The 13 new runtime sheets are canonical palette-index-0 crops at `/assets/character-v2/outfits/*-walk.png`; the five existing `/assets/world/outfits/*.png` files are retained byte-for-byte.
- All eight launch accessories use their catalog `sourcePaletteIndex` and resolve through `ACCESSORY_SHEETS` at `/assets/character-v2/accessories/*-walk.png`. The optional renderer layer is appended after hair and is absent by default, preserving the previous body → clothes → hair result.
- Master and `separate/walk` pixels match exactly for 17 paid outfits and all eight accessories. `clown` contains a source-pack-authored 20-pixel color variance between the two source files while dimensions and alpha anchors match; the catalog-referenced master is authoritative and the validator pins that variance.
- Store previews are separate from gameplay sheets at `/assets/economy/previews/outfits/{id}.png` and `/assets/economy/previews/accessories/{id}.png`. Each uses Down row 0, idle column 0 with the current player body and representative hair.
- Six approved 32×32 transparent currency icons are at `/assets/economy/village-currencies/{animal|human|nature|urban|music|lab}.png`. Wallet, shop, attendance, purchase UI, and the matching village's in-world sound-data markers reuse these same files.
- Reproducible generation is in `scripts/build-character-v2-runtime-assets.py`; pixel, hash, catalog, registry, preview, and icon checks are in `scripts/validate-character-v2-runtime-assets.py` and `scripts/character-v2-assets.test.mjs`.

## Cozy Interior inventory

The pack contains 196 filesystem entries: 39 PNG files, 154 animated GIF files, 2 text files, and 1 `.DS_Store`. `global.png` is a composite atlas and several 16×16/shadow sheets duplicate artwork at different presentation sizes.

### Static sheets

| Area | Source files | Contents |
| --- | ---: | --- |
| Basics | 6 PNG | Curtains, doors atlas, fireplaces atlas, rugs/floor patterns, stairs, wallpapers |
| Furniture | 21 PNG | Bathroom, beds, boxes, chairs, couches, tables, decorations, kids room, kitchen, storage, wall shelves, and shadow companions |
| 16×16 alternatives | 8 PNG | Beds, bathroom, couches, couch tables and shadow companions |
| Pets | 3 PNG | Pet atlas plus cat and yorkie animation atlases |
| Aggregate | 1 PNG | `global.png`, 4320×3440 |

### Animated assets

| Family | GIF count | Variants |
| --- | ---: | --- |
| Doors | 70 | 5 designs × 7 material colors × standard/gold hardware. One filename contains the source typo `door4_redbrige_gold.gif`. |
| TV | 22 | 13 modern 32×32 programs and 9 retro 16×16 programs |
| Fireplaces/candles | 31 | Three fireplace families × 7 colors, plus 10 candle/candelabra variants |
| Pets | 30 | Yorkie 10, cat 5, aquariums 3, hamster cages 5, budgies 7 |
| Holiday tree | 1 | `furniture/holidaytree.gif` |

Documented animation timings include door open 300 ms, fireplace 100 ms, candles 150 ms, hamster 100 ms, cat/yorkie walk 150 ms, fish 400 ms, and program-specific TV timings.

## Existing runtime connections

There are two overlapping house-decoration systems today.

| Runtime surface | Current catalog size | Connection status |
| --- | ---: | --- |
| Outfit shop in `SoundMuseum` | 5 outfits | Curated and purchasable with the scalar wallet |
| `InteriorDecorRoom` | 40 items + 3 sets | **Official system.** Curated, permanent unique-item unlocks; an unlocked item may later be placed multiple times without increasing ownership/progress counts. Two starter surfaces are granted in UI state. |
| `HouseDecorRoom` | 8,469 items | **Test-only, unofficial system.** 12 featured items plus 8,457 generated entries; its current stackable model is not the v1 ownership contract. |
| `AssetRegistry` scene decor | 3 player layers, 13 Lab decor crops, 5 Library decor assets | Rendered scenery/player assets, not store products |

`lib/generatedHouseAssets.json` expands the Cozy Interior sheets into 8,457 product records:

| Category | Count | Category | Count |
| --- | ---: | --- | ---: |
| TV | 22 | 계단 | 49 |
| 러그 | 127 | 문 | 66 |
| 벽난로 | 25 | 벽선반 | 21 |
| 벽지 | 782 | 소파 | 428 |
| 소품 | 909 | 수납 | 301 |
| 욕실 | 268 | 의자 | 266 |
| 조명 | 6 | 주방 | 603 |
| 침실 | 792 | 커튼 | 3,296 |
| 키즈 | 70 | 테이블 | 180 |
| 펫 | 246 |  |  |

The generated catalog contains 150 animated products. All 8,457 generated product records are hidden from the official store. `public/house-assets` currently contains 8,954 files because it also contains featured files and auxiliary/trim outputs. These existing files were not regenerated, expanded, or deleted in this phase.

### Curated 40-item source mapping

Exact pixel matching confirmed that all current `/assets/interior/*` catalog images originate from the purchased pack. The launch contract records the original source sheet for every selected item. Representative exact matches are:

- Wallpapers → `basics/wallpapers.png`
- Rugs and the current floor swatches → `basics/rugs.png`
- Beds → `furniture/beds.png`
- Sofas/armchair → `furniture/couches.png`
- Dresser → `furniture/storage.png`
- Wardrobes → `furniture/kitchen_tiles.png`
- Tables/bench/stool → `furniture/tables.png`
- Plants, lamp, candle, cactus pot, Christmas tree → `furniture/decorations.png`
- Small books/pets/fruit bowl → `furniture/kidsroom.png`
- Curtains → `basics/curtains.png`
- Fireplace → `basics/fireplaces.png`
- Butterfly frame → `global.png`

One dormant runtime file, `public/assets/interior/fl_mosaic_blue.png`, is byte-identical to `fl_rose.png` and is not a separate launch product.

## Launch v1 selection

The authoritative selection is `data/economy/catalog-v1.json`.

| Selection | Count | Notes |
| --- | ---: | --- |
| Free customization records | 36 | 8 skin tones, 13 hair styles (each with 14 colors), 14 eye colors, 1 basic outfit |
| Paid outfits | 18 | Every non-`basic` Character v2 clothing master is included. Existing IDs are preserved; `witch` is rare and `clown`, `pumpkin`, and `spooky` are event/all-six. The other 14 use balanced A–F combinations. |
| Paid accessories | 8 | New stable `acc_*` IDs; runtime extraction is planned, not performed |
| Curated static interior | 40 | All current `INTERIOR_CATALOG` IDs preserved, including 4 pets |
| House-to-Interior review candidates | 6 | Existing `HOUSE_ITEMS` IDs preserved, including one generated door ID. Hidden from the official store until asset/behavior review and mapped to same-ID Interior targets. |
| Theme sets | 3 | All current set IDs and bundle membership preserved |
| Paid catalog records | 75 | 58 A–F general items, 14 rare/event/all-six items, and 3 all-six sets. Of these, 69 are approved and 6 House candidates are pending Interior review. |

The v1 contract does not expose the 8,457 generated records in the official store. They remain technically connected to the test-only `HouseDecorRoom`; no destructive ID or database merge occurs in this phase.

### House-to-Interior mapping plan

The authoritative mapping is `decorSystemPolicy` in `data/economy/catalog-v1.json`. `futureCategoryMappings` routes House TV, fireplace, lighting, and door candidates to `animated_furniture`, and pet candidates to `pet`, after review. `houseToInteriorReviewMappings` currently covers `house_tv_sun`, `house_fireplace_beige`, `house_aquarium_betta`, `house_cat_sleep`, `house_candelabra_gold`, and `house_asset_door1-darkbrown-gold_c4e1cbbe8540`.

Each candidate preserves its product ID and original source/runtime references. Review must cover source provenance, animation frames and timing, placement footprint/collision, preview treatment, mobile performance, and pet behavior. Only an approved candidate moves from `pending_interior_review` to the official `InteriorDecorRoom` catalog. A later migration must map entitlements, deduplicate ownership by item ID, convert placement quantities to placement instances, verify counts, and retain rollback data; this document does not authorize that migration.

## Extraction work deferred after Stage 3A

- Export the 7 additional body walk blocks, 12 additional hair-style walk blocks, and eye/blush/lipstick layers only when their later customization UI is scoped.
- Add an eyes/makeup renderer layer between body and clothes when those options become selectable; Stage 3A intentionally does not export or connect them.
- Keep palette-wide outfit/accessory unlock policy deferred. Stage 3A exports one canonical palette per catalog product only.
- Add preview assets for the three theme sets if the unified store requires cards.
