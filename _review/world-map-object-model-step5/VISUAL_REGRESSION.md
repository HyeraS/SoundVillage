# Visual regression

## Coverage

The legacy JSX presentation source and the final generated presentation source were captured at four viewports across six screens, for 24 paired comparisons:

- 1280×720, 1440×900, 390×844, 844×390
- spawn, Library close-up, objects QA, foreground QA, collision QA, minimap Library marker

## Result

| Check | Result |
| --- | --- |
| DOM/runtime metrics | 24/24 equal |
| Static QA decoded pixels | 12/12 exact |
| Fully byte-exact screenshots | 12/24 |
| Unexpected pixels outside allowed animation effects | 0 |
| SVG image node delta | 0 |
| Visible object ID/order | equal |
| Active culling chunks | equal |
| Asset request list delta | 0 |
| Decoded asset bytes delta | 0 |
| Missing assets | 0 |
| Console error/warning | 0/0 |
| Marker label/icon/color | equal |
| Marker aria-label/title/testid | equal |

The 12 dynamic screenshots differ only within the visual effect bounds of the existing current-marker `minimapPulse` and `world-map-enter-prompt` `pulse`/`popIn` animations. A 64px effect margin covers their glow, scale, and shadow; changed pixels outside those regions are exactly zero.

Captured PNGs and per-screen metrics are under `visual/baseline-legacy-presentation/` and `visual/current-native-presentation/`.
