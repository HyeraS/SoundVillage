# Step 10 Test Results

Status: **PASS**

## Required tests

- `node --test lib/worldMapObjectSchema.test.mjs` — PASS (28 tests)
- `npm run test:world-object-projections` — PASS (15 tests)
- `npm run test:world-library-object` — PASS (7 tests)
- `npm run test:world-home-object` — PASS (7 tests)
- `npm run test:world-render-layers` — PASS (7 unit tests plus integration check)
- `npm run test:world-v4-collision` — PASS (8 unit tests plus full collision integration)
- `npm run test:world-authored-routes` — PASS
- `npm run test:world-home-circulation` — PASS
- `npm run test:world-minimap` — PASS (7 tests)
- `npm run test:world-minimap-browser` — PASS against `http://localhost:43761`
- `npm run test:world-home-hub` — PASS
- `npm run test:world-production` — PASS
- `npm run test:world-v4-assets` — PASS
- `npm run test:world-camera` — PASS

The first Playwright launch inside the OS sandbox was rejected by macOS Mach-port permissions. The same test was rerun in the allowed environment and passed all browser assertions. The local server used Next.js 16.2.7 webpack mode because Turbopack rejects a dependency symlink that points outside the temporary worktree root.

## Generated freshness and reproducibility

- Runtime asset `--check` — PASS; production files unchanged.
- Projection `--check` — PASS; production files unchanged.
- Collision `--check` — PASS; production files unchanged.
- Two independent temporary WebP generations — byte-identical to each other and production.
- Two independent temporary projection generations — byte-identical to each other and production.
- Two independent temporary collision/mask generations — byte-identical to each other and production.
- Serialized timestamp, temporary path, worktree path, or `/Users/hyera` in generated production files — 0.
- Implicit review writes during default required tests/builders — 0 after the Step 10 correction.

## Quality and production build

- `npm run lint -- --quiet` — PASS.
- `npm run build` — PASS with Next.js 16.2.7 and `next build --webpack`.
- Production build compiled, type-checked, generated 37 routes, finalized page optimization, and collected traces.
- `git diff --check` — PASS.
- Final changed/untracked paths after tests and build — exactly 45.
- Test/build-created release paths — 0.
- Source/runtime/generated hash changes caused by tests/build — 0.

The Next.js 16.2.7 local production checklist, deployment, and ESLint documentation were reviewed before judging the build and lint results.
