# Step 10 Isolation Result

Status: **PASS — commit-ready, not staged**

## Worktree

- Source checkout: `/Users/hyera/Documents/SoundVillage-house-decor-2d`
- Isolated worktree: `/private/tmp/soundvillage-home-step10.rUSop0`
- Branch: `codex/world-map-home-native`
- Base commit and current HEAD: `8e6567f896dfde6781dd0f641db197a4255d111f`
- Worktree was created with `mktemp -d` under `/private/tmp` and `git worktree add -b`.
- The worktree remains present for user inspection.

## Preflight

- Branch did not exist and was not attached to another worktree.
- Base commit resolved exactly to the requested SHA.
- Step 9 manifest selected 35 `home-release-required` plus 10 `regenerable-generated` paths.
- Candidate count was 45, unique path count was 45, and unknown count was 0.
- The worktree was pristine before the overlay was copied.

## Copy and integrity

- Exactly the 45 manifest-selected files were copied with metadata-preserving `rsync -a`.
- Immediately after copying, Git reported exactly 45 changed/untracked paths.
- Missing paths: 0.
- Extra paths: 0.
- Source/worktree SHA-256 mismatches immediately after copy: 0.
- Step 9 final-hash mismatches immediately after copy: 0.
- Permission-mode mismatches: 0.
- Symlink/type mismatches: 0.

## Final isolated state

- Final changed/untracked path count: exactly 45.
- Review-only paths in the final diff: 0.
- Unrelated paths in the final diff: 0.
- `_review`, `tmp`, `.codex`, attachment, `.env.local`, `.next`, and `node_modules` paths in the final diff: 0.
- Candidate B paths/assets: 0.
- Original source checkout drift from Step 9 hashes: 0 across all 45 files.
- Generated-file drift from Step 9 final hashes: 0 across all 10 generated files.
- Source asset, runtime asset, and generated binary hashes remained unchanged.

The isolated worktree reused the installed dependencies through an ignored `node_modules` symlink. Next build cache under ignored `.next` is not part of the release candidate. The production client chunks contain no authored compiler/schema, Node built-in, source PNG, review, Candidate B, or machine-path references.

## Step 10 blocker correction

One release blocker was found and resolved only in the isolated worktree. Two required test scripts wrote historical `_review` reports during every normal test run, which would have violated the exact-45-path final state. Their existing report output is now opt-in through `--report`; default tests are read-only.

Files intentionally different from the original Step 9 source after this correction:

- `scripts/test-world-map-hd-collision.mjs`
- `scripts/test-world-map-production-integration.mjs`

Both files were already within the 45-file allowlist. No file was added outside that boundary. The exact diff is limited to argument validation, a `writeReport` flag, and conditional report-directory/file writes.

## Git safety

- `git add`: not run.
- `git commit`: not run.
- `git push`: not run.
- Deploy: not run.
- Reset, clean, checkout restore, or history rewrite: not run.
- Original dirty checkout production files modified by Step 10: 0.
