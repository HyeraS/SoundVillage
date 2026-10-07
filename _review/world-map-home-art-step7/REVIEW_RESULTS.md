# Step 7 review results

## Result: PASS

Candidate A is recommended. It has the calmest silhouette, the lowest measured edge load, and the clearest small-screen read while preserving the warm Home identity. Candidate B also passes the numeric building criteria and is retained as the more distinctive option.

## Numeric checks

| Target | Mean edge | Strong edge | Detail edge | alpha>16 bbox | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Current Home | 21.4389 | 9.1938% | 22.1092% | 323×301 | reference fail |
| Candidate A | 9.5236 | 2.7513% | 5.8612% | 352×301 | PASS |
| Candidate B | 10.2909 | 3.0146% | 6.6623% | 352×301 | PASS |
| Library | 8.0010 | 0.8541% | 3.1227% | 1539×698 | reference |
| Guesthouse | 9.7338 | 0.8471% | 4.3848% | 784×552 | reference |

## Geometry and layer checks

- Candidate A/B visible size at alpha>16: 352×301; half-open east edge x=1824; opaque building pixels at x>=1824: 0.
- Door axis and ground access center: x=1648; measured authored-axis error: 0 px.
- Shared ground rect: `(1344,1344)–(1856,1824)` / 512×480. Authored `siteBounds` remains `(1440,1344)–(1856,1824)`.
- Protected east road `(1824,1440)–(1952,1888)`: obstacle decorations 0.
- South passage `(1344,1728)–(1856,1792)`: raw authored width 64 px; tall decorations 0.
- Apron/waiting area: tall decorations 0.
- Duplicate fence/bed/shrub/shadow ownership between building and ground: 0.
- Foreground: not needed and intentionally not created.
- Depth simulation: front and west-passage characters remain visible; east-road character cannot intersect building alpha because the building ends before x=1824.
- Camera grid: roof, door, and windows remain legible at 0.9432, 1.1983, 0.6094, and 0.58 scale; no 1–2 px repeated roof pattern remains.

## Site seam review

The edited ground is opaque through the old central decoration footprint and alpha-feathered only at the layer boundary. The right-hand paving meets the road at `(1824,1760)` and carries no fence, shrub, wall, or lamp into the protected road. The master's paving texture is extended across x=1344..1440 so the full 64 px south passage reaches the western seam; the main site starts with a 24 px blend. `09-road-seam-detail.png` is the approval surface; any preference for a different paving joint pattern should be treated as an art revision, not a production-code fix.

## Production invariants

- `landmark-home` authority remains `legacy`; Library remains `native`.
- Generated runtime/collision projections, five collision/mask files, 31 runtime assets, Home interaction/collision inputs, production component/manifest, and existing client bundle digest are compared in `file-hashes.json`.
- Asset and collision builders were not run. No production projection was regenerated.
- Focused test outcomes are appended after execution; pre-existing dirty changes remain user-owned and were not modified by this script.

## Next-step handoff metadata

- Building: world rect `(1472,1395)–(1824,1696)`, band `world`, `sortY=1696`, ground contact `(1648,1696)`.
- Shared ground: world rect `(1344,1344)–(1856,1824)`, authored site starts x=1440, band `ground`, `sortY=1695`.
- Foreground: none.
- Door/approach `(1648,1760)`; road connection `(1824,1760)`; review-only future collision `(1520,1472)–(1776,1696)`.

No integration is authorized by this result. Select Candidate A or B before the next step.

## Verification executed on 2026-09-27

| Check | Result |
| --- | --- |
| `node scripts/build-world-map-object-projections.mjs --check` | PASS — projection check current |
| `npm run test:world-render-layers` | PASS — 7/7 unit tests plus integration |
| `npm run test:world-v4-collision` | PASS — 8/8 unit tests plus 691,200-cell parity; approved Home right=1776 case passes |
| `npm run test:world-home-hub` | PASS — existing production Home remains at approach `(1664,1792)` with legacy asset/collider |
| `npm run test:world-production` | PASS — all 8 destinations reachable |
| `git diff --check` | PASS |

The existing production Home coordinates shown by `test:world-home-hub` are intentionally unchanged; the Step 7 coordinates in this review are handoff metadata only. A direct registry check reports `landmark-home=legacy`, `landmark-library=native`, 18 authority entries. Post-test hash recheck found zero changes across protected production files, the five collision/mask artifacts, and all 31 runtime assets.
