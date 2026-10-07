# Human Community Hall — implementation checkpoint

## V2 reference-match completion (2026-09-17)

### Why V1 did not match

V1 treated the concept as an art-direction reference and rebuilt it from a sparse modular atlas. That preserved the game contract, but replaced the reference's irregular dense village with large lawn fields, coarse rectangular paving, symmetric detached buildings, and much lower prop/vegetation density. The v2 brief explicitly removed the “no full-map background” restriction, so the reference composition is now the runtime source of truth.

### Master-map production

- Absolute reference: `public/design-previews/human-village-concepts/01-community-hall-plaza.png` (1448×1086).
- Layout measurements and 48×36 conversions: `design/human-community-hall/REFERENCE_LAYOUT.md`.
- ImageGen precise-object-edit donor 1 removed only the nine gold waveform markers and the south-gate player. The operative constraint was: “change only the 9 markers and the player; keep every other pixel-level design invariant; restore only the immediately surrounding grass, stone, dirt, and planting textures; do not reinterpret the map, camera, lighting, palette, buildings, props, or vegetation.”
- A second precise-object-edit donor removed only the nine residual oval marker shadows under the same invariant constraint.
- `scripts/prepare_human_master_v2.py` composites donor pixels only inside the approved masks. It asserts that the original reference has **0 changed pixels outside the combined edit mask**.
- Clean master: `public/assets/human-village/community-map-master-v2.png` (1448×1086).
- Runtime master: `public/assets/human-village/community-map-master-1536x1152-v2.png` (one-time nearest-neighbor normalization, 48×36 tiles at 32px).
- Runtime foreground: `public/assets/human-village/community-map-foreground-1536x1152-v2.png` (RGBA; exact master pixels only).
- Provenance and dimensions are recorded in `public/assets/human-village/manifest.json` v2. The v1 source and alpha atlas remain intact for recovery and are no longer the Human environment renderer.

Approved removal centers on the 1448×1086 reference were markers at `(330,157)`, `(997,216)`, `(398,350)`, `(723,389)`, `(1279,515)`, `(435,578)`, `(1290,714)`, `(217,860)`, `(1116,900)`, plus the player centered near `(725,972)`. Conservative boxes and logical coordinates are in `REFERENCE_LAYOUT.md`.

### Runtime layout, collision, foreground, and QA

- `lib/humanVillageConfig.mjs` now uses reference-measured irregular lanes, landmark anchors, visible ground-contact footprints, one connected walkable graph, six progression regions, and deterministic safe slots. It no longer uses the old cross-shaped visual layout.
- Collision covers the visible building bases, walls, planters, central raised tree bed, benches, cafe furniture, garden bed/fence, notice board, bicycles, and yard props while retaining readable door/step approaches. The outer non-lane field is solid, leaving the south gate as the exit.
- Walkability is a union of reference lanes rather than the whole map. The resulting graph contains 696 connected walkable tiles; every incremental block graph and every production spawn is reachable.
- Safe-slot capacity is `{1:92, 2:44, 3:56, 4:16, 5:43, 6:16}`, covering Group A 85 and Group B 84 production sounds without overlap.
- `lib/humanVillage.js` draws the 1536×1152 master 1:1 with smoothing disabled. Roofs, awnings, and the central canopy are redrawn from the exact RGBA foreground master only when their baseline should occlude the player; no modular building is double-drawn.
- Gameplay markers are dynamic gold circular waveform icons. Static-art mode hides player, markers, HUD, fog, exit cue, D-pad, modals, and debug overlays.
- `/human-village-test` remains the permanent write-free QA route. The root app also accepts development-only `?humanQa=world|gameplay|static` parameters so the production render branch can be tested without Supabase writes; local QA bypasses attendance, progress, room-share, and event persistence.
- Tailwind scanning is restricted to `app` and `components`, preventing public raster bytes from being misread as arbitrary utility classes. Both default Turbopack development and the requested Webpack production build now compile the root route.

### Visual comparison

`scripts/compare_human_visual_v2.py` generated the required files in `_review/human-community-hall-v2/`:

- `reference.png`
- `implementation-static.png`
- `reference-vs-implementation.png`
- `overlay-50.png`
- `diff-heatmap.png`
- `visual-metrics.json`

Measured at 1536×1152:

- global SSIM: **0.979838**
- SSIM outside the approved removal mask: **1.000000**
- exact RGB pixels: **96.619783%**
- changed pixels outside the edit mask: **0**
- mean absolute RGB difference: **1.086443**
- edge Jaccard outside edits: **0.999865**
- landmark center and size maximum error: **0%**

The only intended visual differences are the restored pixels under the nine markers and player. Browser static output is separately retained as `implementation-browser-static-raw.png`; gameplay screenshots never feed the static similarity metric.

### Browser verification

The production Human branch rendered `community-map-master-1536x1152-v2.png@v2` with 85 Group A sounds and no console errors. Verified:

- static full map and visual comparison
- desktop 1440×844 and 1920×1080
- mobile portrait 390×844 and landscape 844×390
- keyboard movement and camera tracking
- collision and spawn-clearance overview
- block 1 versus all-six-block rendering
- a real production Human sound (`Human_10145`) opening the shared write-free `AnnotationPanel`
- root WorldMap QA entry into the same production `activeZone === 'Human'` branch without database writes

Screenshots are in `_review/human-community-hall-v2/`: `gameplay-desktop-1440x844.png`, `gameplay-desktop-1920x1080.png`, `gameplay-mobile-390x844.png`, `gameplay-mobile-844x390.png`, `collision-debug.png`, `sound-spawn-clearance.png`, `block-1.png`, `annotation-panel.png`, and `product-human-entry.png`.

### Final validation

- Human production validation — PASS (manifest/master/foreground, 696 connected walkable tiles, incremental reachability, collision slide, deterministic A=85/B=84 placement).
- Human-scoped ESLint including `app/page.js` — PASS.
- Music production regression — PASS.
- Urban production regression — PASS (existing module-type performance warning only).
- Nature layout regression — PASS, 6/6.
- Input lifecycle regression — PASS, 2/2.
- Stage 6 lifecycle regression — PASS, 8/8.
- Default Turbopack dev compile — PASS.
- `npx next build --webpack` — PASS, 27/27 pages, including `/` and `/human-village-test`.

No commit, push, deployment, Supabase schema/data mutation, or unrelated WIP rollback was performed. Remaining image differences are confined to the approved object-removal mask.

### Walkability, occlusion, and walk-cycle follow-up (2026-09-17)

- Replaced full-width building-front collision strips with split footprints that preserve the solid facade while opening the visible doorway/step cells for the community hall, bakery, northeast home, clinic, west home, southwest home, cafe, and laundry.
- Added the previously disconnected northeast-home and southwest-home approach paving to the reference-lane graph. The connected walkable set increased from 696 to 723 tiles without changing deterministic safe-slot capacity or sound counts.
- Added production assertions for the community-hall stair axis and each visible building approach. Browser movement reached the hall from tile `24,15` through the stairs to `24,10`.
- Moved dynamic sound markers below the player layer. A second browser check at the central tree's right planter (`27,17`) exposed a hard-edged foreground-mask slice, so the player now remains above both markers and map foreground everywhere; roofs, planters, and tree masks can no longer hide the character.
- Wired Human's animation counter into `PixelChar` and advance the production eight-frame walk sheet every 100 ms while a direction is held. Previously the counter was discarded and `PixelChar` always received its default zero frame.
- Follow-up screenshots: `_review/human-community-hall-v2/hall-stairs-fixed.png` and `_review/human-community-hall-v2/foreground-visibility-fixed.png`.
- Human/Music/Urban/input regression tests, Human-scoped ESLint, and `next build --webpack` all pass after the fix.

---

## V1 historical checkpoint

## Current state

- Confirmed Next.js 16.2.7 App Router and re-read the local `use client`, `page.js`, and public asset guides.
- Confirmed the reference concept is 1448×1086 and is not used as a runtime background.
- Confirmed `community-assets-alpha-v1.png` is 1536×1024 RGBA with 961,841 transparent pixels.
- Inspected the alpha image at original resolution. The generated checker field is transparent and the cream building faces remain intact.
- Measured connected alpha-component bounds instead of estimating atlas crops. These bounds are recorded in `public/assets/human-village/manifest.json`.
- Existing non-Human WIP is intentionally untouched. The product integration will be one import and one `activeZone === 'Human'` branch in `app/page.js`.

## Files created

- `public/assets/human-village/community-assets-v1.png` — generated source/reference atlas; never loaded at runtime.
- `public/assets/human-village/community-assets-alpha-v1.png` — connected-background alpha extraction; runtime atlas.
- `public/assets/human-village/manifest.json` — generation provenance and measured source rectangles.
- `design/human-community-hall/HANDOFF.md` — this checkpoint.
- `lib/humanVillageConfig.mjs` — layout, footprints, block regions, collision, BFS, safe slots, deterministic placement.
- `lib/humanVillage.js` — atlas loading, procedural ground, y-sort sprites, markers, fog, exit and debug rendering.
- `components/HumanZoneMap.js` — input, camera, player, HUD, collection and exit flow.
- `scripts/test_human_production.mjs` — atlas, layout, connectivity, collision and real A/B data validation.

## Files modified

- `app/page.js` — added only the Human component import and Human render branch (plus adjacent explanatory comment).
- `app/human-village-test/page.js` — now mounts the production Human engine with real Group A data and write-free AnnotationPanel QA.
- `package.json` — added `test:human-production`.

## Important decisions

- Build a dedicated Canvas engine (`HumanZoneMap` + `humanVillage`) so the winter market code in `ZoneMap.js` remains dormant and recoverable.
- Use 48×36 tiles at 32px, a 24×18-tile vertical FOV, a south-center exit, and a separate spawn.
- Generate collision, candidate slots, and rendering placement from one Human layout module.
- Preserve item IDs, blocks, collection state, callbacks, and the shared HUD/player/D-pad/modal components.

## Final verification (2026-09-05)

- `npm run test:human-production` — PASS after opening a 3-tile garden entrance. Validated the 48×36 layout, 1,324 connected walkable tiles, all six incremental block graphs, real Human A=85/B=84 sounds, deterministic non-overlapping spawns, collider corner sliding, atlas alpha transparency, and preserved cream pixels.
- Human safe-slot capacity by block is `{1:125, 2:45, 3:36, 4:40, 5:80, 6:66}`. Production needs 15/15/15/15/15/10 slots for Group A and 15/15/15/15/15/9 for Group B.
- `npx eslint components/HumanZoneMap.js lib/humanVillage.js lib/humanVillageConfig.mjs app/human-village-test/page.js scripts/test_human_production.mjs app/page.js` — PASS.
- `node --test lib/*.test.mjs` — PASS (8/8).
- `npm run test:music-production` and `npm run test:urban-production` — PASS. Urban retains its pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning.
- `npx next build --webpack` — PASS with Next.js 16.2.7: compiled, TypeScript checked, and 26 static routes prerendered, including `/` and `/human-village-test`.
- The default Turbopack `npm run build` attempt did not produce further output after entering optimization and was stopped; the documented `--webpack` build path completed successfully in seconds.
- Repository-wide `npm run lint` still fails on 50 errors and 13 warnings in pre-existing generated/reference files and unrelated zone code (including `.next-nature-qa`, `support.js` references, `house-decor-test`, `interior-test`, `LibraryRoom`, `SoundMuseum`, and legacy `ZoneMap`). No Human-scoped lint error remains.

## Browser QA

- Tested the production Human engine at 1440×844, 1920×1080, 390×844 portrait, and 844×390 landscape viewports.
- Confirmed `community-assets-alpha-v1.png@v1`, 85 Group A items, DPR 2 backing canvas, responsive camera bounds, locked-block fog, collision overlay, and sound-marker clearance.
- Entered a real Human sound marker and opened the real `AnnotationPanel` in write-free QA mode.
- Loaded `/music-test` to confirm an unrelated dedicated zone still renders.
- Exercised the real product route: login → WorldMap movement → Human portal prompt → Enter → production `HumanZoneMap`. The mounted map reported ready=true, the expected atlas version, 85 items, and no browser warnings/errors.
- Reviewed screenshots are in `_review/human-community-hall/`, including the full overview, key districts, debug overlays, mobile layouts, annotation flow, and `product-worldmap-human-entry.png`.

## Remaining constraints

- No commit, push, deployment, Supabase schema change, or manual database edit was performed.
- Other dirty-tree work was preserved. The repository-wide lint backlog is outside this Human reskin scope; use the Human-scoped lint command above when validating this change in isolation.
- `community-assets-v1.png` is retained only as generation provenance. Runtime code loads the alpha atlas exclusively.
