# World map reskin QA

Date: 2026-09-18  
Route: local Next.js development server, `natureQa=1`; capture-only query flags are development-gated.

## Browser interaction results

| Target | Proximity prompt | Enter transition | Result |
|---|---:|---:|---|
| Animal | yes | `동물 마을` rendered | PASS |
| Lab | yes | `미지의 소리 마을` rendered | PASS |
| Urban | yes | `도시 마을` rendered | PASS |
| Nature | yes | `자연 마을` rendered | PASS |
| Music | yes | `음악 마을` rendered | PASS |
| Human | yes | `사람 마을` rendered | PASS |
| Sound Museum | yes | museum `전시 현황` rendered | PASS |
| Home | yes | world map unmounted and house branch mounted | PASS* |

`*` The local `NATURE_QA_LOCAL` pseudo-account reached the existing room data-loading screen; its persistence calls do not resolve without the configured backend. The world-map hitbox and `onEnterHouse` transition itself passed, and that downstream data-loading implementation was not changed by this reskin.

## Collision and route checks

`node scripts/verify-world-map-reskin.mjs` passed:

- map contract remains 120×90 tiles;
- camera contract remains 30×22 tiles;
- the six gateway centers are in bounds and in the walkable set;
- each gateway has one hub spoke plus two ring-road approaches;
- collision band and visual path band are both seven tiles, for a measured delta of 0 tiles;
- all 16 runtime reskin images exist and are registered.

Machine-readable output: `collision-portal-validation.json`.

## Visual checks

- Desktop: center/library, Nature, Urban, Music, and full-map overview captured.
- Mobile: 390×844 portrait and 844×390 landscape captured; critical progress/currency/actions remain visible and map controls remain usable.
- Grayscale: player, cream plaza/path network, library entrance, and interaction prompt retain clear tonal separation.
- Reference comparison: overall garden hierarchy, radial library hub, six differentiated landmarks, warm soil paths, green outer field, and wooded frame are preserved without reproducing the reference one-to-one.
