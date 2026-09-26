Use case: precise-object-edit
Asset type: canonical restoration patch for the SoundMimic Village Urban reference map
Input images:
- Image 1 is the finalized full-map positive composition/style reference and edit target.
- Image 2 is the binary restoration mask for `sound-orb-southwest`; white pixels are the only editable region.
Primary request: Remove only the game overlay inside the white mask and reconstruct the world art that naturally continues from immediately adjacent pixels.
Style and camera: preserve Image 1 exactly: orthographic top-down crisp 2D pixel art, identical pixel density, cool midnight navy/indigo/blue-gray palette, cyan glass and restrained warm windows.
Constraints: change only white-mask pixels; do not alter any pixel outside the mask; preserve all roads, buildings, rails, trees, furniture, lighting, scale, and composition outside it; no UI, characters, sound markers, readable text, logo, watermark, blur, or checkerboard.
Output: the complete 1448x1086 map image with the requested local restoration; no crop and no resize.
Reject if any content outside the white mask changes or if the restored continuations do not align at the mask edge.
