# Step 10 Final Code Review

Status: **PASS**

Open release blockers: **0**

## Authority

- `data/world-map-v4/worldObjects.mjs` owns authored visual layers, depth/ground contact, collision, interaction, navigation, minimap presentation, and compatibility projection metadata.
- `data/world-map-v4/sourceAssets.mjs` owns the approved source PNG paths, dimensions, alpha requirement, and SHA-256 values.
- Production consumers import generated literal projections through `lib/worldMapV4Manifest.mjs`; they do not import the compiler, adapter, schema, authored candidates, or source metadata.
- Exactly Home and Library are native. The other 16 authority entries remain legacy.
- Legacy Home render/collision/destination data remains build-only for rollback compilation and was not deleted.
- Generated modules are marked generated, contain literals only, and pass stale/determinism checks.

## Renderer

- Home's generated compatibility object uses the union rectangle `(1344,1344)–(1856,1824)`.
- Native overrides suppress the legacy flat Home render item.
- Home ground and body are culled atomically at the object-union boundary; per-layer culling applies only to legacy fallback items.
- Home renders one ground item and one depth-sorted body item. Empty foreground and overlay groups are not emitted.
- Render order remains terrain → environment → object ground → depth-sorted world/characters → object foreground → global foreground → overlay → interaction/debug.
- Ground sortY is 1695 and body/ground-contact sortY is 1696.

## Assets

- Approved building source: 352×301 RGBA, SHA-256 `197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8`.
- Approved site-ground source: 512×480 RGBA, SHA-256 `4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b`.
- Runtime conversion is direct-size WebP encoding; no resize is applied to either approved source.
- New building WebP SHA-256: `5185988e7ae8f0e0ca9d1ddf3988cc022c3e1effc31d6c6f367c7d19e77d7f91`.
- New site-ground WebP SHA-256: `308f71eb6191ea2d88aed364c0cd83dc53bf8da373a78c6e0f3a0fc341f3547b`.
- The 31 retained runtime files, including the preview, have zero hash or dimension mismatches.
- Registry entries and physical runtime files agree. Candidate B is absent.

## Collision and navigation

- Home collider is the half-open rectangle `(1520,1472)–(1776,1696)`.
- Clearance is applied once as a 29×17 pixel kernel before 4-pixel max pooling; runtime reason lookup uses the same effective cell/clearance contract.
- Collision-reason versus packed-mask mismatch cells: 0.
- Home interaction, approach, and minimap point are `(1648,1760)`.
- Home ground contact and body sortY are `1696`.
- The protected road cell at x=1792 is walkable.
- The site-ground layer does not create a collider.
- All walkable cells form one connected component and tested routes have zero stalled frames.

## Client boundary

- Client import-graph tests exclude authored data, the projection compiler, legacy adapter, schema, and all `node:` built-ins.
- Production `.next/static/chunks` contains no source-PNG path, `_review`, Candidate B, `/Users/hyera`, compiler, adapter, or schema reference.
- Home minimap presentation is generated from the authored object; the former duplicate presentation literal in `WorldMapDiagram.js` is removed.
- No production module reads `_review`, `tmp`, attachments, or `.env.local`.

The ignored `.next` dependency traces record the temporary worktree and dependency-symlink locations as build-environment metadata. Those caches are not among the 45 paths and do not appear in the production client chunks or generated assets.

## Tests and false-positive review

- Rollback compilation selects the actual legacy Home record and verifies render, collision, destination, minimap, path, and presentation restoration.
- Asset tests inspect current registry entries and physical runtime files; they do not consume historical review JSON.
- Projection tests regenerate without pre-existing generated modules and compare fresh outputs to production.
- Collision `--check` compares every production output without rewriting it.
- Schema, collision, render, navigation, and client-graph tests combine derived behavior checks with explicit release-contract fixtures; the suite does not depend solely on duplicated implementation literals.

## Finding resolved in Step 10

Severity: release blocker, resolved.

`test-world-map-hd-collision.mjs` and `test-world-map-production-integration.mjs` unconditionally created historical `_review` reports during normal test execution. Both now accept only the optional `--report` flag and write reports only when that flag is present. Default package-script execution is read-only and leaves the isolated change set at exactly 45 paths.

No art, authored Home geometry, runtime assets, generated outputs, or other landmark authority changed in Step 10.
