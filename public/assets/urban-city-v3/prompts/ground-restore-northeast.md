Use case: precise-object-edit
Asset type: ground-only restoration patch for SoundMimic Village Urban v3
Input images:
- Image 1 is the accepted canonical clean map and edit target.
- Image 2 is the `northeast` object-removal mask; only white pixels may change.
Primary request: remove every building, transit structure, vehicle, tree, prop, its cast shadow and local object glow inside the white mask; reconstruct only the asphalt, sidewalk, plaza paving, curb, lane marking, crosswalk, drainage and restrained wet-road reflection that logically continues from adjacent visible ground.
Constraints: change only white-mask pixels; preserve every pixel outside; do not add buildings, objects, characters, UI, markers, text, logos or decorative substitutes; preserve the exact orthographic camera, pixel density, midnight palette, road geometry and paving scale.
Output: the complete 1448x1086 map with the local ground-only restoration, no crop or resize.
