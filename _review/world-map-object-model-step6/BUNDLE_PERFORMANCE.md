# Bundle and performance

## Production bundle

Measured from the successful webpack production build:

| Metric | Step 5 | Step 6 | Delta |
| --- | ---: | ---: | ---: |
| root route JS, raw | 1,667,776 B | 1,671,077 B | +3,301 B |
| root route JS, gzip | 406,900 B | 407,793 B | +893 B |
| all static JS, raw | 5,913,906 B | 5,917,207 B | +3,301 B |
| all static JS, gzip | 851,078 B | 851,971 B | +893 B |
| generated runtime projection | 16,437 B | 16,930 B | +493 B |
| generated collision projection | 2,195 B | 2,195 B | 0 B |

The root-route gzip increase is below the 2 KiB Step 6 budget. The pure render planner source is 4,444 raw bytes; minification and shared-module compression reduce its route impact.

## Client import audit

The built client chunks contain zero occurrences of authored provenance, source-asset metadata, schema validation, the projection compiler, the legacy adapter, or Node built-ins. The Library runtime asset path occurs once, as before. Only generated lean projections, the facade, and the pure render planner cross the Client Component boundary.

## Runtime work

- The existing object-union spatial index remains the first culling stage.
- Only surviving objects enter per-layer visibility and viewport checks.
- Legacy objects stay one flat record; their layer metadata is not duplicated.
- Native layer data is a sparse override map with one production key.
- Sorting uses one stable world queue and does not add per-object DOM wrappers.
