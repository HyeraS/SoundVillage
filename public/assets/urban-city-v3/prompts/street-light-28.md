Use case: reference-pixel-preserving background extraction

Asset: street-light-28 (street-light)
Reference bounds: x=1384, y=906, w=15, h=69

Image 1 is the finalized full Urban map and sole positive composition/style reference.
Image 2 is this exact target crop and is the primary geometry, pixel, color, material,
lighting, orientation, and scale reference. Preserve its visible source pixels.

For this accepted visible extraction, mechanical alpha matting removes reconstructed
ground while canonical RGB pixels remain unchanged. If a later hidden-region edit is
needed, change only the occluded portion and reject any result that moves, redesigns,
rescales, blurs, crops, or repaints visible reference pixels. Output must be one
uncropped orthographic pixel-art object on genuine transparent PNG background.
