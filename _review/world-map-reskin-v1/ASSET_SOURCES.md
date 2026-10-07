# Sound Archive Garden asset sources

All new raster artwork in this directory was generated specifically for this reskin with OpenAI ImageGen on 2026-09-18. The user-supplied concept image at `design/concepts/world-map-reskin-2026-09-18/01-sound-archive-garden-reference.png` was used only as the visual-direction reference. No third-party game asset pack, font, or stock illustration was copied into the runtime assets.

## Generation prompts

1. Landmark atlas: seven isolated, transparent, top-down three-quarter landmarks in this exact set—domed sound archive/library, observatory/lab, animal barn, urban clock pavilion, nature creek bridge, human plaza/cafe, music garden pavilion. Warm hand-painted pixel-hybrid style, readable silhouettes, unified light, no characters, no UI, no text.
2. Garden prop atlas: isolated transparent broadleaf cluster, pine cluster, hedge, bench with lamp, blank wooden signpost, and foreground garden arch. Same projection, palette, outline softness, and light as the landmark atlas; no UI or lettering.
3. Ground-material atlas: three seamless materials—mossy grass, cream garden stone, honey-colored compacted soil—with restrained detail and the same warm garden palette.
4. Library cleanup edit: preserve the building exactly while replacing pseudo-lettering on the pediment with a small botanical/rosette relief; add no text or symbols.

## Runtime files

| File | Role | Dimensions |
|---|---|---:|
| `library-v2.png` | central archive/library | 1267×1157 |
| `gateway-lab.png` | Lab gateway | 459×395 |
| `gateway-animal.png` | Animal gateway | 459×421 |
| `gateway-urban.png` | Urban gateway | 448×429 |
| `gateway-nature.png` | Nature gateway | 433×422 |
| `gateway-human.png` | Human gateway | 466×401 |
| `gateway-music.png` | Music gateway | 506×407 |
| `props-broadleaf.png` | broadleaf border/prop cluster | 505×516 |
| `props-pine.png` | pine border/prop cluster | 528×519 |
| `props-hedge.png` | plaza hedge | 528×495 |
| `props-bench-lamp.png` | plaza bench and lamp | 528×519 |
| `props-signpost.png` | blank wayfinding sign | 528×528 |
| `foreground-arch.png` | southern foreground arch | 528×473 |
| `ground-grass-base.png` | repeating grass material | 1024×1024 |
| `ground-cream-stone.png` | repeating plaza material | 1024×1024 |
| `ground-honey-path.png` | repeating path material | 1024×1024 |

## Preserved generation sources

- `landmark-atlas-source.png` — original seven-landmark generation.
- `garden-props-atlas-source.png` — original props generation.
- `ground-materials-atlas-source.png` — original ground-material generation.
- `library.png` — first library crop, superseded at runtime by `library-v2.png` after the no-text cleanup edit.

The runtime crops were trimmed from the generated atlases using connected alpha bounds. Ground textures were center-cropped and mirrored at the seams to produce 1024×1024 repeatable textures. `components/AssetRegistry.js` records explicit source dimensions, source rectangles, and anchor points for every runtime image.
