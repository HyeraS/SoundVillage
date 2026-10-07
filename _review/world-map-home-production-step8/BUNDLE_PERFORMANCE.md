# Bundle and Performance

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Root client raw | 1,671,077 | 1,672,107 | +1,030 B |
| Root client gzip | 407,793 | 407,968 | **+175 B** |
| All static JS raw | 5,917,207 | 5,920,139 | +2,932 B |
| All static JS gzip | 851,971 | 852,627 | +656 B |
| Generated runtime projection | 16,930 | 17,951 | +1,021 B |
| Generated collision projection | 2,195 | 2,195 | 0 B |

The root gzip increase is 175 bytes, below the 2 KiB budget by 1,873 bytes.

Active 1280×720 runtime comparison:

- Image nodes: Home 1 → 2; logical culling entries remain 1
- Map runtime resource requests: 9 → 10; duplicate Home requests 0
- Active Home WebP bytes: 53,806 legacy → 88,994 two-layer, +35,188 bytes
- Active decoded estimate: +718,720 bytes
- Total additive WebP storage: 88,994 bytes; existing rollback asset remains intentionally retained
- Browser decoded asset estimate: 45,236,356 → 45,955,076 bytes at the matching viewport
- Failed assets: 0
- Home spatial chunks: 4 → 4

The production build's 74 static client JS files were scanned. Build-only source registry/compiler/schema paths, source PNG paths, and Candidate B strings have zero client matches. The source PNGs are served neither by the client bundle nor the runtime manifest.

