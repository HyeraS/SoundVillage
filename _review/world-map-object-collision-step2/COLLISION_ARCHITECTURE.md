# World map v4 object collision architecture

## Scope and authority

The production collision authority is `scripts/build-world-map-v4-collision.mjs`. It consumes the logical object declarations in `lib/worldMapCollision.mjs` and writes the existing 4px runtime walkable mask. Runtime movement still performs one lookup in that pre-expanded mask.

`scripts/build-world-map-v4-collision.py` and the navigation-mask portion of `scripts/build-world-map-hd-assets.py` are legacy reference-registration generators. They use image colors and hand-authored reference polygons and must not be mixed with the JavaScript output. No render asset, foreground crop, landmark alpha, or environment cluster is a collision source.

This step does not change the production home artwork, placement, interaction point, or visual bounds. The approved future-home coordinates are test fixtures only.

## Schema

Each independently reasoned collider has this structure:

```js
{
  objectId: 'landmark-home',
  colliderId: 'home-body',
  collisionRole: 'building-body',
  shapes: [
    { type: 'rect', left: 1536, top: 1472, right: 1792, bottom: 1752 },
    { type: 'polygon', points: [[x1, y1], [x2, y2], [x3, y3]] },
  ],
}
```

All coordinates are world pixels. Rectangles use `[left,right) × [top,bottom)`. Polygon filling uses the even/odd rule, supports concavity, and applies the same half-open maximum X/Y boundary convention. Shapes within one collider and colliders across logical objects are unioned.

Supported roles are `building-body`, `fence`, `wall`, `trunk`, `furniture`, and `decorative-nonblocking`. The last role is validated but omitted from the obstacle mask. Roof overhangs, shadows, flowers, grass, low shrubs, paths, stairs/aprons, and visual-only foreground are nonblocking unless an independently justified logical collider is authored later.

The eight current destination buildings were migrated as explicit rect shapes. Their coordinates are no longer calculated from destination `tx/ty/w/h`; interaction metadata and physical collision can now evolve independently.

## Raster pipeline

1. Validate object IDs, unique collider IDs, roles, shapes, and non-empty bounds.
2. Rasterize rects and actual polygon interiors at one world pixel using pixel-center samples. A polygon is never replaced by its bounding rectangle.
3. Apply a separable rectangular max filter with horizontal half-extent 14px and vertical half-extent 8px. This is the required 29×17 player-foot kernel, not a square dilation.
4. Max-pool each 4×4 pixel block into one collision cell.
5. Invert the obstacle cells to the packed `WORLD_WALKABLE_MASK_BASE64` format used by the runtime.

The old `ceil` plus inclusive-loop behavior is retained only as an in-memory deterministic review baseline. Production loops and pixel bounds are exclusive at the maximum coordinate.

## Blocking reasons

`worldMapV4BlockingReasonAt()` maps the queried foot point to the same 4px cell as runtime movement, applies the same 29×17 source-pixel search, and returns `collision:<objectId>:<colliderId>`. This makes clearance cells outside the raw shape attributable to the actual collider rather than incorrectly returning `world:boundary`.

The production validation compares the reason and walkability result for every one of the 691,200 mask cells.

## Future-home fixture

The fixture uses the approved visual footprint `(1520,1472)–(1776,1696)` without changing production Home data. With the corrected half-open rasterizer and 29×17 clearance:

- logical right edge: `1776`
- blocked cell coverage ends at: `1792` exclusive
- the cell beginning at `x=1792`: walkable
- `right=1774` correction: not used

## Review images

- `01-existing-vs-object-mask.png`: reconstructed old inclusive-ceil mask on the left, new object mask on the right.
- `02-rect-polygon-overlay.png`: rect and concave polygon example; the polygon notch remains empty.
- `03-clearance-before-after.png`: authored Home collision pixels on the left, 29×17 clearance on the right.
- `04-home-fixture-protected-road.png`: future-home fixture (red), clearance (orange), x=1792 boundary (dark), south passage (green), protected main road (blue).
- `05-collider-colors-debug.png`: one color per logical production collider.
- `06-mask-diff-heatmap.png`: cyan cells became walkable; magenta would indicate newly blocked cells; dark gray is unchanged.

