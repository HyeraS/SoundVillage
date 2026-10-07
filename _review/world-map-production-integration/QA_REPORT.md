# SoundVillage world-map production integration QA

Date: 2026-09-20  
Status: **PARTIAL — backend verification required**

## Summary

The approved v2 world image remains unchanged and is the default environment in the real `screen === 'world'` branch. Six landmarks open the correct dedicated village components, every village returned to the same world map, the Museum opened even without a candidate, and Home no longer remains in an infinite loading state when room bootstrap fails.

The configured Supabase endpoint is remote. No production records were created or changed. Therefore a normal participant's persisted session restoration, a real saved Home room, and a database-driven Music Block 1 unlock were not browser-tested. Their production state contracts were verified statically and through the shared integration checks, while browser interaction used the existing development-only authenticated QA path.

## Confirmed mapping and round trips

| Landmark | Key/callback | Mounted destination | Return | Result |
|---|---|---|---|---|
| Top observatory | `Lab` | `LabZoneMap` / 미지의 소리 마을 | confirmation → world | PASS |
| Upper-right ranch | `Animal` | `AnimalZoneMap` / 동물 마을 | ESC → world | PASS |
| Right city block | `Urban` | `UrbanZoneMap` / 도시 마을 | ESC → world | PASS |
| Lower-right music garden | `Music` | `MusicZoneMap` / 음악 마을 | ESC → world | PASS |
| Lower-left community plaza | `Human` | `HumanZoneMap` / 사람 마을 | ESC → world | PASS |
| Left creek and bridge | `Nature` | `NatureZoneMap` / 자연 마을 | ESC → world | PASS |
| Central library | Museum callback | `SoundMuseum` / 전시 현황·상점 | ESC → world | PASS |
| Upper-left house | Home callback | `InteriorDecorRoom` fallback room | 나가기 → world | PARTIAL |

Each dedicated map was allowed to finish rendering before capture. A short movement input was sent after mount, and the world map was verified again after exit.

## Movement and collision

- Spawn: `(60,47)`.
- Runtime geometry is shared by `WorldMap` and both validation scripts through `lib/worldMapGeometry.mjs`.
- Eight destinations are connected and each has at least two reachable approach positions.
- The production integration test uses quarter-tile paths and validates every endpoint plus the midpoint of every edge against the same two player-foot samples used at runtime.
- Browser keyboard movement from the default spawn reached Nature and Music without `worldStart`.
- The library path was exercised from the default spawn; it is already within the library's proximity area and required only a short northward movement before entry.
- Nature water, the library body, north forest, and southwest garden samples remain blocked.

## Locking and input

- Initial fixture: Music open; Animal, Human, Nature, Urban, and Lab locked.
- Locked Animal rejected both keyboard Enter and the mobile confirmation button and stayed on the world map.
- Enter and Space use the same keyboard activation callback; mobile confirmation uses the same destination activation callback.
- The Music Block 1 completion branch sets `villagesUnlocked` and removes all five locks. Browser tests did not submit annotations to the remote database.

## Home backend limitation

The Home callback and component mount passed. Remote reads for the QA pseudo-account failed, so a real saved room and furniture persistence could not be verified. The previous behavior was an infinite `불러오는 중…` screen. The component now opens a clearly labeled, read-only starter room on bootstrap failure, disables shop/edit/invite actions to prevent accidental overwrite, and permits a safe return to the world map.

## Responsive and asset checks

- Desktop, 390×844 portrait, and 844×390 landscape were exercised.
- Mobile confirmation entered Music in portrait and Urban in landscape.
- The v2 base image was observed as a loaded page asset at `/assets/world/sound-archive-garden-v2/world-base-clean.png`.
- No asset 404 or aspect-ratio stretch was observed.
- Expected console errors were limited to unavailable remote Museum/Home data; they are recorded in `console-errors.json`.

## Automated verification

- `npm run lint`: PASS.
- `node scripts/verify-world-map-reskin.mjs`: PASS.
- `npm run test:world-production`: PASS.
- `npm run test:input-lifecycle`: 2/2 PASS.
- `npm run test:stage-6-lifecycle`: 8/8 PASS.
- `npm run build -- --webpack`: PASS, 28/28 static pages generated. The default Turbopack build was stopped after remaining silent in the optimization phase; the repository's previously verified webpack production build completed successfully.
- Production `next start`: PASS. A URL containing `natureQa`, `worldStart`, `worldOverview`, and `worldClean` still rendered `StartPanel`, proving those development controls are ignored in production.

## Evidence

- `portal-route-results.json`: shared-geometry continuous paths and assets.
- `collision-portal-validation.json`: independent collision and proximity summary.
- `screen-transition-results.json`: browser transition matrix.
- `console-errors.json`: unexpected vs backend-limited errors.
- `contact-sheet.png`: all sixteen required captures reviewed together.

The prior `_review/world-map-reference-match-v2/` directory was not modified.
