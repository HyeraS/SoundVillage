# SoundVillage world-map reference match v2 QA

Date: 2026-09-20  
Reference: `design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png`  
Runtime asset: `public/assets/world/sound-archive-garden-v2/world-base-clean.png`

## Result

PASS. The runtime environment is the normalized clean reference master, not a reconstruction from landmark stickers or repeated terrain. The player baked into the source was removed with a precise ImageGen edit; only a feathered 49×66-pixel area around that character was composited back into the untouched reference. The production master is an exact 2×, 2896×2172 upscale.

## Visual comparison

- normalized clean capture: 1448×1086, identical 4:3 framing;
- SSIM similarity: 0.958264 (target ≥ 0.95);
- mean RGB absolute error: 6.983194/255 (target ≤ 8/255);
- landmark center maximum error: 0 px / 0%;
- road outline maximum error: 0 tiles;
- the diff contains browser color/raster sampling across existing edges, not moved geometry;
- no white margin, viewport stretch, mismatched crop, UI, label, player, or Next development badge appears in the clean capture.

## World and interaction contract

- world: 120×90 tiles;
- tracking camera: 30×22 tiles;
- clean full-map capture flag: `worldClean=1` (development only);
- gameplay-only capture flag: `worldCapture=1` (development only);
- spawn: (60,47), on the circular plaza in front of the library;
- Lab: (60,17);
- Animal: (101,19);
- Urban: (111,43);
- Music: (101,71);
- Human: (14,71);
- Nature: (17,42);
- Home: (22,17);
- Sound Library: (60,41).

The new walkable network follows the central plaza, elliptical ring, radial paths, bridge, destination yards, and south gate. The library body, Nature water, forest, and garden obstacle samples are blocked. Every destination is connected to the spawn in the deterministic validation grid.

## Browser interaction

| Target | Proximity cue | Enter transition | Result |
|---|---:|---:|---|
| Sound Library | yes | museum `전시 현황` rendered | PASS |
| Nature | yes | `자연 마을` rendered | PASS |
| Human | yes | `사람 마을` rendered | PASS |
| Music | yes | `음악 마을` rendered | PASS |
| Lab | yes | `미지의 소리 마을` rendered | PASS |
| Animal | yes | `동물 마을` rendered | PASS |
| Urban | yes | `도시 마을` rendered | PASS |
| Home | yes | world map unmounted and house loading branch mounted | PASS* |

`*` The local QA pseudo-account has no configured persistence backend, so the existing house branch remains on `불러오는 중…`. The Home hitbox and `onEnterHouse` transition passed; house persistence code was not changed.

## Responsive and camera QA

- desktop destination captures show no empty camera strips; tracking uses proportional `slice` framing;
- 390×844 portrait keeps progress, currency, quest/attendance, objective, Enter cue, and touch controls visible;
- 844×390 landscape keeps the same critical controls visible without overlap;
- full-map overview continues to use proportional `meet` framing at exact 4:3.

## Automated checks

- `npm run lint`: PASS;
- `node scripts/verify-world-map-reskin.mjs`: PASS;
- `npm run test:input-lifecycle`: 2/2 PASS;
- `npm run test:stage-6-lifecycle`: 8/8 PASS;
- `NEXT_NATURE_QA=1 npx next build --webpack`: PASS, 28/28 static pages generated.

Music-first locking, zone/museum/house callbacks, analytics, quest, attendance, duo, annotation, progress, Supabase, and house-decor implementations were left intact. Only their world-map coordinates and visual environment layer were changed.

## Known difference

Only the original player's 49×66-pixel neighborhood at the center plaza differs from the supplied reference. That area now contains reconstructed concentric paving. No other deliberate scene difference remains.
