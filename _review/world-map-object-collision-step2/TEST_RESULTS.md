# Collision step 2 test results

Run on 2026-09-26 (Asia/Seoul).

## Build result

`npm run build:world-v4-collision` — PASS

- production source: `logical-object-collision-shapes`
- mask: 960×720 at 4 world px/cell
- walkable: 635,616 / 691,200 cells (91.96%)
- blocked: 55,584 cells (8.04%)
- old inclusive-ceil baseline → new mask: 1,343 newly walkable, 0 newly blocked
- future-home fixture: right 1776 accepted, blocked range ends at 1792 exclusive, x=1792 cell walkable

## Automated verification

- `npm run test:world-v4-collision` — PASS
  - 8 focused geometry/raster tests passed
  - rect half-open edge, polygon inside/outside, concave polygon, shape/object union, decorative exclusion, 29×17 clearance, exact cell boundary, future-home fixture, and reason parity covered
  - all eight existing destination approaches reachable
  - all eight existing building centers blocked
  - disconnected walkable cells: 0
  - 1–2-cell pinches: 0
  - reason/mask mismatches across all 691,200 cells: 0
  - sampled normal/throttled movement operations: 104,848
  - production `moveWorldPlayer()` route stopped frames: 0
- `npm run test:world-home-hub` — PASS
  - current production Home placement, artwork registration, interaction, and route unchanged
- `npm run test:world-authored-routes` — PASS
  - Lab, Animal, Urban, Music, Human, Nature, Sound Library, and Home all arrived
  - maximum stalled frames for every route: 0
- `npm run test:world-production` — PASS
  - all eight production destinations reachable
  - 41 asset registrations intact
- `npm run lint` — PASS

No production artwork, home-site coordinates, foreground artwork, or runtime landmark images were changed.
