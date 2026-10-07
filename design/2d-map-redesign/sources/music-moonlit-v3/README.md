# Moonlit v3 production master

`clean-production-master.png` is a precision edit of the selected Moonlit Concert Garden styleframe. The environment, composition, structures, paths, garden, vegetation, lighting and lived-in props are preserved. Only the five example sound-orb graphics were removed so SoundVillage's real runtime markers can occupy the scene.

The runtime does not load this source file directly. `build_music_moonlit_v3.mjs` resizes it to the authoritative 1536×1152 geometry with nearest-neighbor sampling, splits it into four runtime ground chunks, and creates a separate transparent foreground-occlusion layer.
