# Visual Acceptance

Status: **PASS**

Fresh in-app browser contexts covered 1280×720, 1440×900, 390×844, and 844×390 at DPR 1, plus 1280×720 at DPR 2. Every state showed exactly two Home SVG image nodes (one ground, one body), zero legacy Home nodes, zero failed images, two unique Home asset URLs, and no console errors or warnings.

The actual approach point reported player foot `(1648,1760)`, the minimap Home marker reported the same coordinates and near state, and browser auto-walk arrived at `(1649,1760)` with zero failed assets. Collision/object QA rendered both layers.

A fresh boundary test exposed and then verified the fix for split layer culling: at the visible boundary both Home layers are present; beyond the boundary both are absent. DPR 1/2 comparison shows no thin-line flicker or material shape change. Step 8 reference comparison found no unexpected change outside the Home/site region.

Captures: `01-release-runtime.png` through `06-rollback-summary.png`.
