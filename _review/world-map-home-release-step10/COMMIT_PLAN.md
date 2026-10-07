# Step 10 Commit Plan

No staging or commit has been performed. Run these commands only after explicit approval and from:

`/private/tmp/soundvillage-home-step10.rUSop0`

## Recommended commit

Title:

`feat(world-map): promote Home to a native layered object`

Body draft:

```text
- add authored WorldObject and source-asset authorities with generated runtime projections
- render approved Home ground/body layers atomically and preserve legacy rollback data
- generate logical collision masks and direct-size Candidate A runtime assets
- add authority, rendering, collision, navigation, asset, and client-boundary regressions
- keep test review reports opt-in so normal verification does not mutate the changeset
```

## Exact 45-path allowlist

```text
components/world-map/WorldMapDiagram.js
components/world-map/WorldMapScene.js
data/world-map-v4/legacyCollisionObjects.mjs
data/world-map-v4/legacyWorldMapV4.mjs
data/world-map-v4/sourceAssets.mjs
data/world-map-v4/worldObjects.mjs
design/world-map-v4/source-assets/landmark-home-player-building.png
design/world-map-v4/source-assets/landmark-home-player-site-ground.png
lib/generated/worldMapV4CollisionObjects.mjs
lib/generated/worldMapV4RuntimeObjects.mjs
lib/worldMapCollision.mjs
lib/worldMapCollision.test.mjs
lib/worldMapCollisionContract.mjs
lib/worldMapGeometry.mjs
lib/worldMapMinimap.mjs
lib/worldMapObjectSchema.mjs
lib/worldMapObjectSchema.test.mjs
lib/worldMapRenderLayers.mjs
lib/worldMapRenderLayers.test.mjs
lib/worldMapV4Assets.mjs
lib/worldMapV4Manifest.mjs
lib/worldWalkableMaskData.mjs
package.json
public/assets/world/sound-archive-garden-v4/collision-build.json
public/assets/world/sound-archive-garden-v4/collision-debug.png
public/assets/world/sound-archive-garden-v4/obstacle-mask.png
public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-building.webp
public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-site-ground.webp
public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png
scripts/build-world-map-hd-assets.py
scripts/build-world-map-object-projections.mjs
scripts/build-world-map-v4-collision.mjs
scripts/build-world-map-v4-collision.py
scripts/build-world-map-v4-runtime-assets.mjs
scripts/test-world-map-hd-collision.mjs
scripts/test-world-map-home-circulation.mjs
scripts/test-world-map-home-hub.mjs
scripts/test-world-map-home-object-pilot.mjs
scripts/test-world-map-library-object-pilot.mjs
scripts/test-world-map-minimap-browser.mjs
scripts/test-world-map-object-projections.mjs
scripts/test-world-map-production-integration.mjs
scripts/test-world-map-render-layers.mjs
scripts/test-world-map-v4-assets.mjs
scripts/world-map/legacy-world-object-adapter.mjs
```

## Before staging

```sh
test "$(git branch --show-current)" = "codex/world-map-home-native"
test "$(git rev-parse HEAD)" = "8e6567f896dfde6781dd0f641db197a4255d111f"
test "$(git status --short --untracked-files=all | wc -l | tr -d ' ')" = "45"
git diff --check
npm run build:world-v4-runtime-assets -- --check
npm run build:world-object-projections -- --check
npm run build:world-v4-collision -- --check
```

Review `git status --short --untracked-files=all` against the allowlist above before proceeding.

## Staging command after approval

Use `git add --` followed by exactly the 45 allowlisted paths above. Do not use `git add .`, `git add -A`, or a broad directory path.

## After staging

```sh
test "$(git diff --cached --name-only | wc -l | tr -d ' ')" = "45"
test -z "$(git diff --name-only)"
git diff --cached --check
git status --short
git diff --cached --stat
```

Confirm that no cached path begins with `_review/`, `tmp/`, `.codex/`, `.next/`, or `node_modules/`.

## Commit command after separate approval

```sh
git commit -m "feat(world-map): promote Home to a native layered object"
```

## After commit

```sh
git show --stat --oneline --decorate HEAD
test "$(git diff HEAD^ --name-only | wc -l | tr -d ' ')" = "45"
git diff HEAD^ --check
git status --short
```

Do not push or deploy without separate approval.

## Rollback

- Before commit: unstage only the explicit allowlist with `git restore --staged -- <45 allowlisted paths>`. This preserves all working-tree files.
- After a local commit: use `git revert <commit-sha>` to create a reversible rollback commit. Do not rewrite branch history.
- If the isolated worktree is no longer needed, remove it only after explicit user approval; do not alter or clean the original dirty checkout.
