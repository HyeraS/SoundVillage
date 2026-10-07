# Urban reference-exact v3 handoff

## Outcome and current status

The v3 work is intentionally **not** activated in the product. Phase A, the canonical overlay restoration in Phase B, and the clean ground restoration in Phase C are complete. Phase D produced a complete set of provisional per-instance RGBA files, but Gate 1 failed because several alpha mattes include pixels from adjacent instances or ground. `public/assets/urban-city-v3/manifest.json` therefore keeps `productionSwitched: false`, and no v3 product-loader or renderer switch was made.

The last passed phase is **Phase C**. Gate 1 is failed. Gates 2, 3, and 4 were not started by design.

## Why v2 was not reused

The v2 runtime is organized around large family plates and crop/stretch constants. It reduces the north skyline density, shrinks and separates the district buildings, changes the road/plaza proportions, omits many street objects, and cannot preserve the finalized reference silhouettes at their native coordinates. It remains rollback material only.

## Coordinate system

- Positive reference: `02-midnight-metro-media-core.png`
- Reference pixels: 1448×1086
- World pixels: 1448×1086
- Transform: identity (`scaleX=1`, `scaleY=1`, `offsetX=0`, `offsetY=0`)
- Uniform/non-uniform runtime sprite scaling in the provisional manifest: 165/0
- Layout source: `public/assets/urban-city-v3/layout.json`

## Phase A inventory

`inventory.json` contains 176 placement instances:

| Category | Count |
| --- | ---: |
| ground | 11 |
| building | 18 |
| metro | 13 |
| landmark | 9 |
| vehicle | 10 |
| tree | 30 |
| street-light | 28 |
| kiosk | 19 |
| planter | 16 |
| bench | 4 |
| outdoor-table | 5 |
| bollard | 5 |
| control-box | 6 |
| south-rail | 2 |

Analysis files:

- `public/assets/urban-city-v3/reference/reference-analysis-overlay.png`
- `public/assets/urban-city-v3/reference/non-world-overlay-mask.png`
- `public/assets/urban-city-v3/reference/evaluable-art-mask.png`
- `public/assets/urban-city-v3/inventory.json`
- `public/assets/urban-city-v3/layout.json`
- `public/assets/urban-city-v3/manifest.json`
- `public/assets/urban-city-v3/asset-plan.md`

## Phase B canonical restoration

Ten spatially separate built-in ImageGen edits removed and restored the HUD, D-pad, entrance cue, player, and six concept sound orbs. Each accepted patch is composed only inside its recorded mask; outside-mask pixels are checked as pixel-identical.

- Source/runtime: `public/assets/urban-city-v3/reference/canonical-map-art-source.png` and `canonical-map-art-runtime.png`
- Log: `public/assets/urban-city-v3/reference/restoration-log.json`
- Accepted patches: `public/assets/urban-city-v3/accepted/restoration/`
- Prompts: `public/assets/urban-city-v3/prompts/restoration-*.md`
- Candidate history: `public/assets/urban-city-v3/candidates/restoration-*-v1.png`

## Phase C ground restoration

The ground was rebuilt by separate built-in ImageGen calls for north metro, northwest, northeast, west media plaza, east food court, southwest culture, southeast cinema/transit, central spine, and south entrance. The initial regional composite retained foreground fragments and is archived as `ground-only-first-pass-source.png`. A second non-overlapping seven-region cleanup and a final east-edge repair produced the accepted clean plate.

- Accepted source/runtime: `public/assets/urban-city-v3/ground/ground-only-source.png` and `ground-only-runtime.png`
- Pure generated restoration archive: `public/assets/urban-city-v3/ground/ground-only-restored-source.png`
- First-pass log: `public/assets/urban-city-v3/ground/removal-log.json`
- Cleanup log: `public/assets/urban-city-v3/ground/cleanup-log.json`
- Initial masks: `public/assets/urban-city-v3/ground/masks/`
- Cleanup masks: `public/assets/urban-city-v3/ground/masks-cleanup/`
- Accepted cleanup candidates: `public/assets/urban-city-v3/accepted/ground-cleanup/`

Superseded/rejected ground candidates remain in `public/assets/urban-city-v3/candidates/`; they were not deleted or overwritten. The known rejected versions are `ground-southeast-cinema-transit-v1.png` (wrong dimensions), `ground-central-spine-v1.png` (objects remained), and `ground-cleanup-center-mid-v1.png` (wrong dimensions).

## Phase D extraction method and failure

`scripts/extract_urban_assets_v3.py` creates every reference crop, visible mask, prompt, candidate, category PNG, and foreground split. Known-visible ground outside the union of inventory bounds is copied pixel-identically from the canonical map. Inside bounds, the script compares the restored ground and canonical map, uses a threshold of 12, and assigns overlap pixels by normalized instance-center distance with an anchor-depth term. Canonical RGB pixels are preserved; only alpha is generated mechanically.

Outputs currently present:

- 165 provisional non-ground RGBA instance files
- 50 provisional foreground RGBA splits
- 165 source crops, masks, and per-ID prompts
- All inventory placements linked to a manifest entry or the shared ground plate

These files are **not Gate-1 accepted**. Their inventory and manifest status is `extracted-needs-alpha-review`. Contact-sheet review found semantic contamination, including `tree-01` retaining metro pixels, buildings retaining road/plaza pixels, and multiple props retaining neighboring paving or object fragments. The complete reconstructed composition remains close only because the contaminated pieces collectively reproduce the canonical map; that is not sufficient for the required independent sprite contract.

One additional built-in ImageGen extraction trial was made for `building-west-media-office`:

- Input crop: `public/assets/urban-city-v3/sources/building-west-media-office-reference-crop.png`
- ImageGen result: `public/assets/urban-city-v3/candidates/building-west-media-office-imagegen-v2.png`
- Canonical-RGB/alpha trial: `public/assets/urban-city-v3/candidates/building-west-media-office-canonical-alpha-v3.png`
- Result: rejected. It has genuine alpha, but the generated silhouette is reinterpreted and not coordinate-aligned with the reference crop, so proportional alpha transfer retains road/orb pixels and clips/misattributes building pixels.

No local segmentation model (`cv2`, `skimage`, `rembg`, Torch/SAM, Transformers, or ONNX Runtime) is available in the workspace. Installing or switching to an external API/CLI fallback was not authorized. The remaining blocker is therefore reviewed per-instance isolation mattes that preserve canonical pixels exactly.

## Manifest, anchor, collision, and layer state

The provisional manifest records native/runtime dimensions, identity bounds, anchors, z-layer, y-sort flag, collision rectangles, foreground rectangles/files, prompt/source paths, generation mode, alpha role, and review status. It has zero non-uniform scales. Collision and block layout values are present in `layout.json` and `inventory.json`, but they have not been connected to a v3 renderer or browser-tested because Gate 1 failed.

Required final render order remains:

1. ground-only
2. ground decals/road markings
3. static shadows
4. building and metro bases
5. y-sorted vehicles, vegetation, street furniture, and landmarks
6. runtime markers and player
7. canopy/crown/platform-lip/south-rail foreground
8. emissive/limited atmosphere
9. HUD

## Visual metrics and review

The provisional full reconstruction measures:

- masked RMSE: 1.85368
- masked MAE: 0.47397
- evaluable exact-pixel fraction: 0.90640
- dependency-free global luminance SSIM: 0.999149
- non-uniform scales: 0

These scene-level values pass the SSIM target but **do not override the failed individual-alpha visual gate**.

Review directory: `_review/urban-advanced-city/imagegen-reference-exact-v3/`

- `reference-clean.png`
- `art-only-runtime.png`
- `reference-vs-runtime.png`
- `reference-runtime-overlay-50.png`
- `reference-runtime-blink.gif`
- `reference-runtime-diff-heatmap.png`
- `inventory-overlay.png`
- `contact-sheet-buildings.png`
- `contact-sheet-metro-vehicles.png`
- `contact-sheet-props.png`
- `contact-sheet-overlays.png`
- `metrics.json`

The overlay/blink keeps the overall silhouettes stable, but the contact sheets visibly prove the Gate 1 failure.

## Gate and product results

| Gate | Result |
| --- | --- |
| Phase A inventory | complete |
| Phase B canonical | complete |
| Phase C ground-only | complete |
| Gate 1 asset alpha/contact sheets | **failed** |
| Gate 2 `/urban-art-preview` v3 | not started |
| Gate 3 `/urban-test` A/B | not started |
| Gate 4 real `/` A/B | not started |

The product remains on v2. A/B 83-item and six-block behavior was not modified by this work, but it was also not revalidated against a v3 renderer. No Supabase submit or skip action was performed.

## Tests, lint, build, and browser

The artifact-generation scripts ran successfully and produced valid 1448×1086 review plates. Product tests, targeted lint, build, and in-app browser checks were intentionally not run as completion evidence because the mandatory Gate 1 asset review failed before any v3 loader switch. Existing unrelated working-tree changes were not modified or reverted.

## Exact resume point

1. Start from `public/assets/urban-city-v3/inventory.json` and the four contact sheets.
2. Replace provisional visible masks one ID at a time, beginning with the visibly contaminated building, tree, metro, and prop entries. Preserve canonical RGB; edit alpha only unless a hidden portion genuinely requires a separate built-in ImageGen edit.
3. For each ID, inspect the crop, mask, candidate, and accepted PNG at original resolution. Record rejected candidate paths and reasons.
4. Set an object to `accepted` only after its isolated overlay aligns at its recorded bounds and contains no neighboring object, ground patch, halo, checker residue, or crop damage.
5. Rerun:

   ```text
   python3 scripts/extract_urban_assets_v3.py
   python3 scripts/render_urban_reference_comparison_v3.py
   ```

   The extractor currently regenerates provisional mattes, so add reviewed-mask overrides before rerunning it.
6. Only after every runtime object is accepted, implement/switch the v3 renderer, run Gate 2, then Gate 3 and Gate 4 in order.

## Last ImageGen operation

The last built-in ImageGen prompt asked for only `building-west-media-office` on genuine transparency while preserving the exact crop silhouette and removing road, plaza, vegetation, street furniture, and the orb. The result path is `public/assets/urban-city-v3/candidates/building-west-media-office-imagegen-v2.png`; it was rejected for silhouette/coordinate mismatch. The generated original is preserved by the Codex image-generation store, and the copied project candidate above is the resume reference.
