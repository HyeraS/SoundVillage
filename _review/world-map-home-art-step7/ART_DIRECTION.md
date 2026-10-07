# Step 7 Home art direction

## Outcome

Two actual transparent bitmap candidates and one shared site-ground layer were produced for offline review only. Candidate A is recommended because its single low roof mass is calmer at world scale and its edge metrics sit nearer the Library/guesthouse band. Candidate B remains a valid, more characterful alternative.

## Binding art rules

- Final visible building envelope: 352×301 at world rect `(1472,1395)–(1824,1696)`.
- Center door axis: x=1648. Ground contact/sortY: y=1696.
- Warm terracotta roof, cream walls, muted sage trim, upper-left light.
- Large readable painted masses; no dark hairline outline or repeated 1–2 px roof/brick/flower patterns.
- `home-building` owns only the house, attached stoop, and minimal structural steps.
- Shared `home-site-ground` owns removal coverage, grass/paving, access route, and the contact shadow.
- No `home-foreground` is authored: neither proposal contains pixels that need to cover a character.

## Candidates

- **A — recommended:** compact single-roof cottage. Mean edge `9.5236`, strong edge `2.7513%`.
- **B:** asymmetric paired-roof cottage with more identity. Mean edge `10.2909`, strong edge `3.0146%`.

## Shared site reconstruction

The generated master removes/replaces the potted topiary, inner benches inside the patch, small path lights, tall plaza lamp, curved low wall, dense flowerbed/shrub mass, and pixels beneath the future house. It supplies a calm grass pad, subtle contact shadow, central apron, full-width south passage, and east-road join. The master's horizontal paving is extended by crop/layer compositing across the west 96 px seam, while the main edited site begins at world x=1440 with a 24 px alpha blend.

## Generation provenance

The project-bound masters in `source-reference/` were created with the built-in image generation tool, then only cropped, alpha-cleaned, resized once to final display size, composited, and measured by this script. The final prompt set requested: (1) a low single-roof building-only cottage; (2) a characterful paired-roof building-only cottage; (3) an obstacle-free site-ground edit; and targeted revisions that reduced tile/stone microdetail and matched the world palette. No CLI/API fallback was used.

## Integration boundary

This step does not move assets to `public/`, alter authority, change collision or interaction coordinates, regenerate projections, or integrate render layers. Approval of A or B is required before any production change.
