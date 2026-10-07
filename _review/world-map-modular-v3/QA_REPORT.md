# Sound Archive Garden v3 — QA report

Status: PASS for renderer, assets, collision, navigation, browser console, and
required automated checks. One capture-tool limitation is documented below.

## Runtime architecture

- 3840×2880 world (120×90 at 32px), 960×704 nominal camera.
- Repeating grass/path/plaza/water textures plus manifest path centerlines.
- 37 active runtime assets, 147 placed instances including foreground.
- One manifest supplies object anchors, depth, interaction and foot colliders.
- 512px spatial chunks cull off-camera objects; spawn view renders 12 and culls 134.
- Collision is generated at 4 world-px/cell from path/plaza shapes and 145
  object colliders, eroded for the complete 28×16 player foot box.
- Runtime movement retains 3px substeps and independent X/Y sliding.
- The v2 whole-world image is absent from the production scene and exists only
  behind the development-only 50% reference overlay.

## Browser play test

The clean final browser run began at the default spawn and reached Animal,
Nature, Human, Urban, Music, Lab, Sound Library and Home without assigning the
player to destination coordinates. Development-only steering supplied direction
vectors, while every frame used the same production `moveWorldPlayer` collision
function. Entry used a real Enter key and return used Escape (plus the real Lab
confirmation control). All eight prompts, product components and returns passed.

The Music-first locked Animal test displayed the lock state and refused entry.
The unlocked QA run entered all villages. Mobile direction and confirm controls
remain wired to the same key state and `activateNearbyDestination` callback.

Final fresh-tab console errors: 0. Image 404/decode errors: 0.

## Visual QA

- PASS: 1280×720, 1440×900 and 1920×1080 at DPR 1.
- PASS: native 1280×720 CSS viewport at DPR 2.
- PASS: mobile portrait 390×844 and landscape 844×390.
- The in-app browser cannot combine an arbitrary resized CSS viewport with its
  native DPR 2 mode, so exact 1440×900 DPR 2 and 1920×1080 DPR 2 screenshots
  could not be captured. DPR 2 rendering itself was inspected at the native
  viewport, while all runtime assets independently pass ≥4× source-density
  validation, covering the stricter raster requirement.

No sharpening filter, `pixelated`, `crisp-edges`, rectangular alpha backdrop,
seam, or low-resolution whole-map flash was observed. Tree front/behind and the
south foreground arch demonstrate depth/occlusion.

## Performance

- Old initial whole-map WebP: 5,021,332 bytes.
- New total active WebP set: 5,240,756 bytes across 37 independently editable assets.
- New initial visible 10 assets: 1,249,150 bytes (75.1% below old initial image).
- Warm map-ready: 23.2ms; long-route run: 57.8ms.
- Long-route average: 119.9fps, 0 frames over 50ms, 9.4ms max sampled frame.
- After long movement: 19 rendered / 127 culled; heap delta −1,607,060 bytes.

These numbers are recorded in `performance-comparison.json`; warm-cache timing
is explicitly labeled because the browser controller provides no cache-disable switch.

## Automated validation

See the terminal/test section of the final report and the JSON files in this
folder. Asset validation reports 37 assets, 147 instances, no unused manifest
asset, correct transparency/corners and ≥4× source density. Collision coverage
reports all 207,007 clearance cells connected and all eight destinations reachable.

## Review artifacts

Files `01`–`13`, all viewport captures, eight entry screenshots, the contact
sheet, inventory, manifest validation, collision coverage, navigation, E2E,
performance and console reports are stored beside this report.
