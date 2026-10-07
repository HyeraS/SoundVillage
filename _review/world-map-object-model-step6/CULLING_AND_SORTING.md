# Culling and sorting

## Two-stage culling

The compatibility object stores the world union of all visible layer rects and remains the spatial-index entry. The pure planner then applies:

1. object-union vs expanded viewport intersection;
2. individual layer vs expanded viewport intersection.

Both planner comparisons use half-open rect intersection: touching right/left or bottom/top edges do not intersect. Visual alpha is not consulted by culling or collision.

The test fixture proves an object touching the viewport boundary is object-culled, while a partial viewport that intersects only `site-ground` emits that layer and layer-culls the other four.

## Stable world queue

World layers and characters share one queue sorted by:

1. `sortY` ascending;
2. object ID or character key;
3. layer ID.

The fixture tie result is `fixture-layered-building/body`, `fixture-layered-building/body-trim`, then `local-player`. Existing single-layer object/character ties therefore retain the former stable-key behavior.

## Fixture coverage

The test-only object has five layers: `site-ground`, `body`, `body-trim`, `front-occluder`, and `optional-effect`. It validates world projection, union bounds, scale, layer offsets, band order, state visibility, stable ties, duplicate suppression, object/layer culling, invalid identifiers/assets/rotation/scale, and collision independence. It is not present in generated production output.
