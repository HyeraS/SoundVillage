# Urban City v3 — reference-exact asset plan

- Reference: `design/concepts/urban-advanced-city-2026-09-01/02-midnight-metro-media-core.png` (1448×1086)
- Coordinate transform: identity (reference pixels are world pixels)
- Product loader remains on v2 until every Gate 2 criterion passes.
- Identified placement instances: 176

## Inventory counts

- bench: 4
- bollard: 5
- building: 18
- control-box: 6
- ground: 11
- kiosk: 19
- landmark: 9
- metro: 13
- outdoor-table: 5
- planter: 16
- south-rail: 2
- street-light: 28
- tree: 30
- vehicle: 10

## Phase status

- Phase A inventory and analysis overlay generated and reviewed at 1448×1086.
- Phase B canonical restoration completed with 10 separate built-in ImageGen edits; pixels outside each mask are preserved.
- Phase C ground restoration completed with 17 regional candidates plus a final east-edge repair; the clean plate is accepted at 1448×1086.
- Phase D produced 165 provisional transparent instance extractions and 50 foreground splits. The full reconstruction reaches masked RMSE 1.854 and global luminance SSIM 0.99915, but Gate 1 fails because overlapping reference bounds contaminate individual alpha mattes (for example, `tree-01` contains metro pixels). Their manifest status remains `extracted-needs-alpha-review`, not accepted.
- v3 renderer activation: blocked until visual gates pass.

## Current checkpoint

- Last passed phase: Phase C (canonical and ground-only restoration).
- Gate 1: failed on individual sprite alpha purity; contact sheets are under `_review/urban-advanced-city/imagegen-reference-exact-v3/`.
- Gate 2/3/4: intentionally not started.
- Product loader: unchanged on v2 (`manifest.json.productionSwitched=false`).
- Resume by replacing each provisional difference matte with a reviewed per-instance isolation mask, beginning with the contaminated building/tree/prop contact-sheet entries, then rerun `python3 scripts/extract_urban_assets_v3.py` and `python3 scripts/render_urban_reference_comparison_v3.py`.

## Production rules

Visible source pixels are preserved; only overlay-hidden or object-hidden regions may be restored with built-in ImageGen. Distinct assets receive distinct calls. The full reference is never loaded as a single product background.
