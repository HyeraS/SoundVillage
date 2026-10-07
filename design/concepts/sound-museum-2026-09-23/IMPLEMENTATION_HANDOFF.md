# Sound Museum Final B — implementation handoff

## Result

The Sound Museum now renders as a walkable 1672 × 941 pixel-art room rather than a single backdrop with hotspots. The room keeps the Final B visual hierarchy: the bright cream and honey-oak shell, five-station L-shaped listening lounge, six village exhibits, animated owl curator and ledger, right-side costume shop, lower reading lounge, and bottom entrance. The existing vote, exhibit, shop, currency, equipment, analytics, and lifecycle paths remain connected through `SoundMuseum`.

## Changed files

- `components/LibraryRoom.js` — fixed-world stage, contain scaling, physical-pixel snapping, movement/collision, interaction prompts, cards, D-pad reuse, lifecycle cleanup, and isolated QA hooks.
- `components/SoundMuseum.js` — connects the existing feature cards and dialogue to the new room, supplies active station/exhibit state, and passes the equipped outfit sprite.
- `components/AssetRegistry.js` — registers the Final B runtime asset set.
- `components/sound-museum/SoundMuseumScene.js` — fixed, foot-Y, and foreground rendering plus state glows and QA overlays.
- `components/sound-museum/SoundMuseumObject.js` — unoptimized, pixelated PNG rendering and the four-frame owl animation.
- `lib/soundMuseumFinalBLayout.mjs` — authoritative world, asset, collision, interaction, spawn, and card coordinates.
- `lib/soundMuseumFinalBLayout.test.mjs` — coordinate-based reachability and layout invariants.
- `app/page.js` — passes the currently equipped outfit into the museum player.
- `app/library-test/page.js` — local-only `open`, `walk`, `qa`, and exhibit `state` fixtures.
- `scripts/test-sound-museum-final-b-assets.mjs` — source-file, dimensions, alpha, scale, inventory, and bounds checks.
- `scripts/capture-sound-museum-final-b-qa.mjs` — deterministic 45-state Playwright capture matrix.

The working tree already contained unrelated user changes; they were preserved.

## Runtime assets and provenance

All runtime art lives under `public/assets/sound-museum-final-b/`; no generated runtime file is referenced from the Codex output directory.

| Asset | Purpose | Source |
| --- | --- | --- |
| `architecture/room-shell@2x.png` | cream walls, beams, arched windows, upper cabinets, floor, lamps, banners, entrance, sunlight, floor medallion | generated as a clean architectural plate from the Final B style reference; nearest-neighbour 2× master |
| `left-listening/l-shaped-listening-lounge.png` | L counter, exactly five headphones/cards/stools, waveform display, gramophone, rug, plants, six exhibit niches | separately generated transparent plate; regenerated to correct the station count to five |
| `center-archive/curator-desk-ledger.png` | curved desk, gramophone, books, ink, quill, headphones, lamp, and ledger pedestal | separately generated transparent plate |
| `center-archive/owl-curator-idle-4f.png` | original-style owl curator, four equal horizontal idle frames | separately generated animation sheet |
| `center-archive/waveform-frame.png` | central framed waveform | separately generated transparent prop |
| `right-shop/costume-shop.png` | hat shelf, clothes, bags, boxes, mirror, mannequin, counter, till, daily display, rug, flowers, and shopkeeper | separately generated transparent plate |
| `right-shop/mannequin-vest-skirt.png` | distinct second mannequin | separately generated transparent prop |
| `lounge/reading-lounge.png` | paired teal armchairs, tables, lamps, books, plants, and right gramophone | separately generated transparent plate |
| `foreground/rail-bookshelf.png` | lower rail, low bookcase, plants, corner occlusion | separately generated transparent foreground plate; nearest-neighbour 2× master |

The built-in image generator was used in image mode with the Final B image as the common style reference. Prompt groups explicitly requested warm cream plaster, honey-oak timber, teal-and-gold textiles, crisp orthographic 16-bit pixel work, consistent upper-right sunlight, full object silhouettes, transparent backgrounds for movable/depth-sorted plates, and no text/UI. Individual prompts then constrained each inventory group; the listening-lounge correction prompt required exactly five card stands, five wired headphones, and five stools. `manifest.json` records each rendered instance's source size, display size, anchor, position, depth mode, collision, interaction, and animation data.

## Coordinates, scale, and DPR

- Logical world: `1672 × 941` for art, player physics, collision, interactions, prompts, and QA overlays.
- Scaling: `stageScale = min(viewportWidth / 1672, viewportHeight / 941)` with centered offsets and dark wood letterboxing.
- The stage reserves manifest display dimensions before image decode, preventing layout shifts.
- Runtime PNGs are at least 2× their logical display size. Transparent plates are RGBA PNGs.
- Next Image is rendered with `unoptimized`; scene imagery uses pixelated sampling.
- Player render coordinates are rounded in physical pixels using the active device pixel ratio, then converted back to CSS pixels. DPR 1 and DPR 2 captures were checked.
- The same logical coordinate data drives rendering, collisions, prompts, and pointer-visible QA overlays.

## Collision, depth, and interaction map

- Spawn: bottom-entrance player-body origin at `(821, 838)` (foot centre `(836, 880)`), outside all collision boxes.
- Vote: five reachable station zones across the left L-shaped lounge; all open the existing vote card.
- Exhibits: the central owl desk and adjacent ledger share the existing exhibit card path.
- Shop: a reachable zone in front of the right checkout opens the existing shop card.
- Interaction regions are disjoint and bounded by the world.
- Furniture collisions use visible floor-contact regions rather than transparent image bounds.
- A follow-up playtest split the former lounge/shop rectangles into counter, stool, chair, table, mannequin, and display-footprint AABBs. Visible hardwood below the left L and between the reading furniture is no longer blocked.
- Wall art is fixed, desk/shop/lounge plates participate in foot-Y ordering, and the lower rail/bookcase is always foreground.
- An 8 px coordinate flood-fill confirms routes from the entrance to all three functional areas and eleven representative hardwood-aisle points. Minimum authored corridors exceed twice the player width.

## Existing behaviour preserved

- Candidate loading, exclusion rules, random order, and five-candidate cap remain in `SoundMuseum`.
- `useMuseumPlayer`, successful-play gating, progress/error handling, candidate selection, confidence 1–5, `saveVote`/`submit_museum_vote_v4`, idempotency, in-flight protection, retained selection on failure, and next-candidate flow are unchanged.
- Six-zone `ExhibitDisplay` state and `zoneCounts` feed both the card and room-niche light states.
- Shop balance, daily discount, purchase, duplicate ownership, equip/default outfit, error recovery, and `onCurrencyChange` remain wired to the existing shop implementation.
- The player continues to use `WORLD_CHARACTER` body/clothes/hair layers plus the equipped outfit source.
- Keyboard arrows/WASD, Enter/Escape, and the shared world D-pad are retained. Opening any card locks keyboard and touch movement.
- `library_card_opened`, `library_card_closed`, `shop_opened`, and `shop_closed` preserve close reasons for close button, Escape, backdrop, navigation, and component unmount. Existing museum audio, impression, selection, vote attempt/success/failure events remain in their original handlers.
- The test route uses local fixtures and disabled placeholder actions; it performs no Supabase purchase or vote writes.

## Verification

All requested checks passed:

```text
node scripts/test-sound-museum-final-b-assets.mjs          PASS (10 instances, 5 stations, 6 exhibits)
node --test lib/soundMuseumFinalBLayout.test.mjs           PASS (6/6)
node --test scripts/stage-6-lifecycle.test.mjs             PASS (8/8)
node --test scripts/security/experiment-rules.test.mjs     PASS (11/11)
node scripts/test-world-map-production-integration.mjs     PASS
npx eslint <Sound Museum changed/new files>                PASS
npm run build                                               PASS
```

The asset test opens every PNG, checks actual source dimensions, validates alpha for transparent plates, rejects blank images and duplicate IDs, enforces the source/display scale, verifies exact station/exhibit counts, and checks every physics rectangle against the world bounds.

## Visual QA

Root: `design/2d-map-redesign/previews/sound-museum-final-b/`

- `1280x720/` — nine required states at DPR 1.
- `1440x900/` — nine required states at DPR 1.
- `1920x1080/` — nine required states at DPR 1.
- `2560x1440/` — nine required states captured from a 1280 × 720 CSS viewport at DPR 2.
- `844x390/` — nine required landscape-mobile states.
- `qa-report.json` — 45 captures, zero capture errors.
- `reference-vs-1280-clean.png` — Final B reference and runtime clean view side by side.

Each viewport includes entrance, left access, vote card, owl/ledger access, exhibits card, shop access, shop card, collision overlay, and foreground/depth overlay. Visual review found no stretched assets, edge halos, missing close controls, clipped card scroll regions, or mismatched furniture collisions. The mobile view retains the whole room with letterboxing; cards use safe-area-aware height and internal scrolling.

## Intentional differences and remaining issues

- The reference is used as art direction, not as the runtime background. Newly generated modular plates preserve the composition but are not pixel-for-pixel crops. The playable version opens the central floor slightly to make all approach paths and depth transitions unambiguous.
- Station and exhibit status are intentionally subtle gold/teal light changes so functional state reads without turning the room into a debug UI.
- The app's in-product browser could not reach the sandboxed loopback development server. After its documented host/loopback checks were exhausted, the same installed Chromium engine was driven directly through Playwright for the 45 captures. This affects only the capture transport, not the rendered route or output.
- No functional or visual blocker remains in the implemented scope.

## Production data connection follow-up

- Normal `/` gameplay calls `submit_annotation_v4` from `AnnotationPanel`; only explicit QA modes set `dryRun` and skip the write.
- Museum entry calls `museum_annotation_counts_v2`, requires at least four non-empty annotations for a canonical audio identity, excludes already-voted audio, then loads up to five real expressions through `museum_candidate_expressions_v2`.
- Museum votes go through `submit_museum_vote_v4`; the database validates authenticated participant/session state, successful playback, other-participant eligibility, canonical identity, idempotency, and uniqueness before writing `votes`.
- The production bundle contains the configured remote Supabase target. Deployment must provide the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and must have migration `006_experiment_rules_and_uniqueness.sql` applied.
- The isolated `/library-test` route intentionally renders local fixtures and never reads or writes the research database.
- Static schema/data-contract verification passed 37/37 checks. A direct aggregate count against the configured remote project could not be completed from the Codex sandbox because DNS resolution for the remote Supabase host was unavailable; no claim about the current live row count is made.
