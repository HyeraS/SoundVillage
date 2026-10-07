# Bundle and performance

## Production root-route JavaScript

Measured from the root main files plus the root page client chunks, gzip-compressing each emitted file independently.

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Raw client JS | 1,662,837 B | 1,667,763 B | +4,926 B |
| Gzip client JS | 406,160 B | 406,887 B | +727 B |

The gzip increase is below the 1 KB failure threshold. Across every emitted static JS chunk, raw size is 5,913,893 B and gzip size is 851,065 B (baseline: 5,908,967 B / 852,200 B).

## Generated module size

| Module | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Runtime projection | 26,088 B | 16,271 B | -9,817 B |
| Collision projection | 2,195 B | 2,195 B | 0 B |

The runtime reduction comes from named exports and removing the duplicated asset registry.

## Runtime metrics

- Static SVG image-node count: unchanged at all 24 captures.
- Initial asset request count: unchanged at all 24 captures.
- Initial decoded asset bytes: unchanged at all 24 captures.
- Failed assets: 0.
- Map-ready state: true before and after.
- Representative asset registry path occurrences in root chunks: 1.
- Build-only/compiler/schema/Node module markers in root chunks: 0.
