# Visual Regression

Actual Next.js development rendering was inspected in the in-app browser, not only through offline composites.

Validated states:

- Default scene
- Object QA
- Collision QA
- Foreground QA
- Full minimap open
- Home proximity/interaction
- Production Home auto-walk arrival

Validated viewports: 1280×720, 1440×900, 390×844, and 844×390.

Results:

- Candidate A appears at the approved placement and scale.
- Body is exactly 352×301 world pixels and is not non-uniformly transformed.
- Site ground is exactly 512×480 and covers the prior central-garden bleed below Home.
- The east road connection and south passage remain visually and physically open.
- At the approach point the player is in front of the body; the ground stays below the player.
- The east-road character path is not occluded by the Home collider or a foreground layer.
- Home foreground/overlay output is zero; the scene does not create a Home foreground node.
- Legacy `landmark-home-hub` nodes are zero.
- Actual Home SVG nodes are exactly two: one `ground/site-ground`, one `world/body`.
- Runtime failed assets, 404s, and decode errors are zero.
- Fresh final browser smoke has zero console errors and zero warnings.

The actual runtime views were compared with Step 7 Candidate A, road-seam, camera-grid, and depth-simulation approvals. Differences are confined to the approved Home/site replacement and permitted player/UI animation regions. Projection snapshots for the other 17 objects, retained asset hashes, and collision-delta bounds show zero unexpected changes outside the Home area.

Review images `01` through `08` contain the final comparisons. The raw browser captures and machine-readable viewport/smoke results are retained beside them.

