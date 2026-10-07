# Authority transition

## Final registry

| Authority | Count |
| --- | ---: |
| native | 1 |
| legacy | 17 |
| total | 18 |

`landmark-library` is `native`. Every other entry is `legacy`; `landmark-home` is explicitly asserted as legacy.

## Selection semantics

The compiler validates the Library candidate against its legacy rollback record, then emits exactly one selected record per object ID. Presentation follows the same record selection as render/navigation/collision:

- Library legacy: use `LEGACY_WORLD_MAP_V4_DESTINATION_PRESENTATIONS['Sound Library']`.
- Library native: use `WorldObject.minimap.{label,icon,color}`.
- No merge and no field-level fallback occurs.

The authority output contains 18 unique IDs and exactly one Library entry. Duplicate authority output remains a hard failure.

## Pre-transition gate

Before editing, the repository was verified at 18 legacy / 0 native, Library legacy, candidate parity PASS, generated `--check` PASS, production generated-facade use, and compiler isolation from production/generated outputs. The transition proceeded only after all checks passed.
