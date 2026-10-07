# Visual regression

## Coverage

The in-app browser captured six screens at four viewports (24 comparisons):

- spawn;
- Library close-up;
- objects QA;
- foreground QA;
- collision QA;
- minimap with the Sound Library marker;
- viewports: 1280x720, 1440x900, 390x844, and 844x390.

## Results

| Check | Result |
| --- | --- |
| DOM/runtime metrics | 24/24 equal |
| Static QA layers | 12/12 decoded-pixel exact |
| Full screenshot byte-exact captures | 13/24 |
| Unexpected pixel differences | 0 |
| SVG image-node delta | 0 at every screen/viewport |
| Visible object IDs/order | equal |
| Active culling chunks | equal |
| Asset request-count delta | 0 |
| Decoded asset-byte delta | 0 |
| Missing assets | 0 |
| Clean-session console errors/warnings | 0/0 |
| Labels/IDs | `Library` and `Sound Library` unchanged |

The 11 non-byte-identical full screenshots differ only inside existing animated UI regions: the minimap current-marker `minimapPulse` area and, on the minimap QA screen, the `world-map-enter-prompt` `pulse`/`popIn` area. Connected-component bounds contain every changed pixel; all non-animated pixels have a zero diff. The objects, foreground, and collision QA screens are exact at all four viewports. This distinction is recorded rather than treating animation phase as measurement noise.

The clean post-restart browser session logged only the React DevTools informational message and HMR connection log; it contained no error or warning.
