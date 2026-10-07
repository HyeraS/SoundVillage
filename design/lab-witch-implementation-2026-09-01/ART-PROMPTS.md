# ImageGen production art log

Built-in ImageGen was used (not the API/CLI). Final selected sheets were copied into `public/assets/lab-witch/`; shared assets were not overwritten. The first sheet came back with an opaque checker pattern, so a second ImageGen edit replaced it with a flat chroma key. `prepare_lab_assets.mjs` only packages the returned pixel art: key→alpha, remove stray neighbouring cell fragments, trim, nearest-neighbour downsample, and split body/foreground. It does not synthesize replacement art. No Python image editing was used.

## 1. Architectural atlas

Reference: `design/lab-halloween-concepts-2026-09-01/03-violet-witch-lanes-teal-v2.png`.

```text
Use case: stylized-concept. Create ONE production sprite atlas PNG, actual transparent background, 1536x1024, 4 columns x 2 rows of equally sized 384x512 cells. This is NOT a map. Reference image provides exact architectural style of cozy teal witch lanes. Exactly eight isolated full objects centered in their own cell with generous empty transparent margin, no crossing cells. Row 1 left to right: (1) signature cream timber witch cottage, very crooked curled tall purple roof, honey windows, small steps and brown door, (2) terracotta roof cream timber pumpkin shop with cream/rust striped awning and produce counter, (3) dark brown timber potion shop with crooked violet roof and small purple striped awning, (4) cream timber small residence with terracotta pitched roof and honey windows. Row 2 left to right: (1) small cream timber cottage with violet crooked roof, (2) violet and ivory striped canvas market stall with wooden table, jars and orange pumpkins, (3) gray stone village well with violet gabled roof and wood supports, (4) wooden two-wheel handcart filled with orange pumpkins. Match reference's orthographic topdown three-quarter 2D PIXEL game view with visible front face and roof, NOT isometric, all doors toward camera. Single coherent coarse pixel grid, readable restrained details, material color clusters, stepped edges, dark plum brown outlines, no smoothing no antialias no gradient. Intended final sprites reduced to 96x128 native pixels and rendered at 2x in game alongside a 32px-tile character. Do not add terrain patches or trees behind objects. No lettering, HUD, people, floating collectibles, or checkerboard painted background. Real alpha background. Full unclipped silhouette of each object.
```

## 2. Architectural extraction edit

Edit target: first atlas. Final output: `public/assets/lab-witch/architecture-source.png`.

```text
Use case: background-extraction. Edit the provided game sprite sheet. Keep ALL eight sprites, exact positions, dimensions, colors and pixel art details unchanged. Replace the entire white/checkerboard background, including all gaps around/between sprites and the open space between the well supports, with a perfectly flat solid chroma key magenta #FF00FF background (RGB 255,0,255). No checkerboard, no white, no background shadows or gradient. Do not add magenta to opaque sprite interiors. The goal is clean mechanical color-key extraction into transparent production sprites. Output same 1536x1024 sheet. Keep foreground sprites EXACTLY unchanged.
```

## 3. Environmental atlas

Reference: final approved village concept. Output: `public/assets/lab-witch/nature-source.png`.

```text
Use case: stylized-concept. ONE production game sprite atlas 1536x1024 pixels, exactly 4 columns x 2 rows, equally sized 384x512 cells. Background must be perfectly flat solid chroma key #FF00FF magenta for mechanical alpha extraction, no checkerboard no white no shadows outside objects. Reference is art style only. Eight separate environmental prop sprites, one per cell with generous margin, full silhouettes no clipping. First row: (1) round dense jade/teal tree with chunky mint highlight clusters and visible brown trunk, (2) same tree in plum and violet palette, (3) bare crooked brown tree with two tiny hanging ivory cloth ghosts, (4) dark brown stone-and-wood street lantern with honey yellow warm lamp. Second row: (1) low sage teal rounded leafy shrub with a few tiny ivory flowers, (2) two bright orange carved pumpkin lanterns side by side, (3) low rough gray stone fence section with three uneven posts, straight front view, (4) cluster of three gray-blue mossy shoreline rocks. Match reference's top-down three-quarter orthographic 2D PIXEL game view. Coarse stepped silhouette and flat clustered pixels, no 3D, no isometric, no gradients, no airbrushed lighting, no ground patches or extra props. Intended tree native size 48x64 pixels at 2x in a 32px-tile game, lantern 16x48, smaller props 32x24. Keep details simple enough for reduction. No text, characters, sound collectibles, UI.
```

Native sizes actually used are in manifest.json. Visual QA caught and corrected color-key removal of violet highlight pixels; final alpha/reconstruction checks are in `asset-qa.json`.

## 4. 최종 환경 마스터 정리 편집

Built-in ImageGen 편집 모드를 사용했다. 첫 시도는 잘못된 최근 이미지가 함께
참조되어 폐기했고 프로젝트에 복사하지 않았다. 아래 두 번째 결과만
`public/assets/lab-witch/environment-source-v2.png`로 사용했다.

```text
Use case: precise-object-edit
Asset type: production 2D pixel game environment master layer
Input image: the provided violet witch lanes concept PNG is the sole edit target.
Primary request: Remove only (1) the small player character standing near the bottom-center path and (2) all five glowing cyan/white diamond-shaped sound pickup markers, including each marker's glow and tiny ground shadow. Reconstruct only the path or teal grass directly underneath those removed elements.
Constraints: Preserve the exact original canvas dimensions and exact camera framing. Preserve every other pixel-art element and its position: top HUD, bottom entrance label, all buildings, roof silhouettes, trees, fences, lanterns, pumpkins, flowers, mushrooms, rocks, pond, all three docks, boat, fishing structure, market, cart, road edges, palette, lighting, and pixel density. Do not crop, zoom, shift, redraw, restyle, add, or remove anything else. No new characters, no new text, no watermark. Keep crisp hard-edged 2D pixel art with no smoothing.
```
