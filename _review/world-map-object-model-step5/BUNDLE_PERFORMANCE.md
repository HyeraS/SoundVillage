# Bundle and performance

## Root client JavaScript

Measured after the final Next.js 16.2.7 webpack production build using the root main files plus root page client chunks, gzip-compressing each emitted file independently.

| Metric | Step 4 | Step 5 | Delta |
| --- | ---: | ---: | ---: |
| Root client raw | 1,667,763 B | 1,667,776 B | +13 B |
| Root client gzip | 406,887 B | 406,900 B | +13 B |
| All static JS raw | 5,913,893 B | 5,913,906 B | +13 B |
| All static JS gzip | 851,065 B | 851,078 B | +13 B |

The +13 B gzip delta is below the 1 KiB failure threshold and reflects replacing the JSX Library literal with a named generated presentation lookup.

## Generated modules

| Module | Step 4 | Step 5 | Delta |
| --- | ---: | ---: | ---: |
| Runtime projection | 16,271 B | 16,437 B | +166 B |
| Collision projection | 2,195 B | 2,195 B | 0 B |

## Client audit

- build-only/compiler/schema/Node marker occurrences: 0
- representative asset registry occurrence: 1
- presentation authority object: 1
- asset registry duplication: none
- image nodes, asset requests, decoded texture bytes: no change in 24/24 comparisons
