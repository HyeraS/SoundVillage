# 2C-C Music Production Implementation

## Frozen design preserved

The production Music renderer now uses the approved B1–B4 vertical slice: B1 1536×1152 full-map ground/path/Garden, S1 low double-wave Stage, G1 open wave rail Gate with a central two-tile opening, the four B3.1 buildings and their approved entrance orientations, all 27 low-density prop placements, and the bright soft late-afternoon palette. The former night/neon/instrument-source renderer has been removed from Music production.

## Production assets

Runtime assets live only under `public/assets/music-village/`. The package contains 54 approved PNG files plus `manifest.json`:

- B1 full-map ground/path PNG
- nine approved S1 Stage layers
- six approved G1 Gate layers
- seven visual layers for each of four buildings
- ten approved prop-family PNGs, used by the 27 placements

The package is reproducible with `node design/2d-map-redesign/tools/build_music_production_assets_c.js`. The manifest records SHA-256, byte size, geometry, draw order, source versions, and exclusions. Runtime URLs never reference `public/design-previews/`.

Excluded from production: S2, G2, ImageGen concepts, all SVG masters, collision/interaction/clearance guides, mock character, montages, comparisons, and preview-only UI assets. Design sources remain untouched.

## Renderer and layer order

`MusicZoneMap` preloads the approved PNG set once and reuses it. Missing images resolve to a safe partial/fallback state instead of rejecting the map. Static layers are composed into one 1536×1152 offscreen canvas. `imageSmoothingEnabled` is disabled. CSS size and backing-store pixel size are separated with a capped device pixel ratio.

Draw order is: ground/path; contact shadows; Stage/Gate structure; building body/roof/door/trim; low props; foreground cutouts; emissive; existing character; neutral markers; HUD/annotation. A separate transparent marker canvas guarantees markers remain above foreground and character. No collision guide or bitmap alpha is read by participant runtime.

## Deterministic sound slots

`lib/musicVillageConfig.mjs` is the shared geometry and placement authority. Fifteen B4-inspired loop anchors were adjusted away from spawn, Gate approach, entrances, hard collision and props. Six fixed offset groups produce 15 slots for Blocks 1–5 and 8 for Block 6. A deterministic spiral finds the nearest safe unused tile where an offset is obstructed.

Safety rejects map edges, Stage rear, Gate posts, all four building footprints, every 3×3 entrance/Stage clearance, the spawn/Gate approach region, and a one-tile visual margin around approved props/foreground. Remaining safe tiles are sorted deterministically into reserve capacity. Sounds are grouped by block, sorted by `sound_id`, and assigned without using input order or source/category metadata.

Validated capacity and distribution:

| Case | Items | Unique slots | Result |
|---|---:|---:|---|
| Group A | 83 | 83 | pass |
| Group B | 83 | 83 | pass |
| Researcher bypass diagnostic | 166 | 166 | pass; not participant-equivalent |
| Primary block slots | 83 | 83 | pass |
| Total production-safe capacity | 837 | 837 | pass |

Group A and B each preserve blocks `15 / 15 / 15 / 15 / 15 / 8`. The initial canonical 24×18 FOV contains 3–5 markers from any current block. Future-block markers are hidden and non-interactive; completed markers remain visible at lower hierarchy. Reversing input array order produces the same sound-ID-to-coordinate mapping.

## Collision, spawn, Gate and interaction

Runtime authority remains `PLAYER_BOX = { w: 20, h: 14 }`; the B4 22×28 box remains visual QA reference only. The interaction rectangle remains 24×24.

Explicit hard collision includes map boundaries, the Stage rear 12×5 rectangle, two Gate post rectangles of 1×3, and the four building manifest rectangles. Contact shadows, emissive, low visual props, foreground edge clusters, marker slots, and entrance clearances do not create collision. Movement remains axis-separated through the existing Music map function.

The spawn foot point is `(784, 948)` world pixels: tile axis x=24 and y=29 plus the existing bottom-center foot offset. It is north of the Gate and outside the explicit exit trigger. The two walkable Gate lanes are centered at x=23.5 and x=24.5 tiles. Exit confirmation occurs only in the south trigger inside the opening; ESC exit is unchanged.

Automated collision checks cover spawn, Stage rear, both Gate posts/open lanes, all building bodies and entrance clearances, Stage approach, exit separation, and prop-adjacent passages. Marker slots are checked against all hard collision and clearance rules.

## Marker state mapping

Production connects only authoritative states: Unavailable/hidden, Active, Nearby, Interacting, and Completed. Submitting, Save error, and Technical audio error are not inferred and require follow-up UI-state plumbing. Full details are in `2C_C_MUSIC_MARKER_STATE_MAPPING.md`.

The marker is a neutral ring/wave grammar. The prompt is `Enter ↵ 이 소리 전사하기`; no sound label or answer category is exposed. `onCollectSound(item.sound)`, `collectedIds`, `blockNum`, `blockTotal`, annotation discovery blocking, Enter, D-pad confirm, and ESC are preserved.

## Verification

- `npm run test:music-production`: pass — metadata, A/B/bypass placement, deterministic order, safe capacity, collision and asset manifest
- scoped ESLint on Music runtime/config/test/asset builder: pass
- `npm run build`: pass — Next.js 16.2.7 production build, 20 static routes including `/music-test` and `/music-responsive-test`
- actual `next start` `/music-test`: pass — asset status `ready`, background and marker backing canvases 2560×1328 at DPR 2, browser console warning/error 0

### Browser and input QA

- Desktop Group A Block 1: 83 total in HUD; only the current block's 15 are active across the map; start FOV shows five.
- Desktop Group B Block 1: same 83 total and deterministic production slots; no console output.
- Block 6: remount-free control change renders the 8-item current block using the same map instance.
- Completed states: 15 completed and all 83 completed were separately rendered and captured; completed rings remain low-alpha and future active markers are not exposed.
- Responsive route: a real 390×640 iframe viewport and 720×390 iframe viewport rendered the production component. Both retain the 24×18 FOV, DPR-separated canvases, character foot point, marker overlay, and D-pad. The portrait harness hides its QA controls to avoid covering participant UI.
- Keyboard: a focused-browser held Down Arrow produced visible character movement on the central Gate axis. The host denied subsequent system-level key injection with macOS accessibility error 1002, so a complete automated physical walkthrough of every loop/entrance was not claimed.
- Geometry fallback for that automation limitation: the Music test suite directly executes the production collision/movement functions for the two Gate lanes/posts, Stage, four buildings/clearances, spawn/exit separation and prop-adjacent passages. The collision/slot overlay and 20×14 corner board record those results.

## Files changed or added

- `lib/musicVillage.js`
- `lib/musicVillageConfig.mjs`
- `components/MusicZoneMap.js`
- `app/music-test/page.js`
- `public/assets/music-village/**`
- `public/assets/music-village/manifest.json`
- `design/2d-map-redesign/tools/build_music_production_assets_c.js`
- `scripts/test_music_production.mjs`
- `package.json` (Music test script only)
- this implementation record and marker mapping
- `design/2d-map-redesign/previews/2c-c-music-production/**`

## Research/data non-change confirmation

No changes were made to sound metadata, IDs, groups, blocks, paths, participant/session handling, group filtering, Music-first rules, block progression, annotation storage, Museum behavior, Supabase/SQL/RPC, rewards/currency, house decor, other villages, or the world map. Existing unrelated dirty changes in `app/page.js` and `components/ZoneMap.js` were preserved.

## Known residual risks

- Submitting/save/audio-error visuals remain intentionally unconnected until authoritative state is passed to Music.
- The researcher bypass shows 166 diagnostic markers across safe reserve slots and must not be treated as a participant layout.
- Full route QA uses the isolated production `/music-test` harness; persistence/reconnect authority remains the unchanged parent application contract.
- A human sustained-input walkthrough of both loop directions, Garden shortcut and every building corner remains recommended because macOS blocked the browser automation's second held-key sequence. Deterministic production collision tests passed, but they are not presented as a substitute for that final tactile pass.
