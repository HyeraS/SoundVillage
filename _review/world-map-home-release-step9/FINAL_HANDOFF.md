# Final Handoff

## Decision

**Home is release-ready.** The exact candidate contains **45 files** (35 authored/code and 10 regenerable generated). Review-only files: **108**. Unrelated pre-existing dirty files: **1341**. Unknown: **0**.

## Final authority

`worldObjects.mjs` owns Home visual/layers/interaction/navigation/minimap/collision; `sourceAssets.mjs` owns approved source metadata; generated projections and the facade are production consumers. JS collision builder + packed mask are authoritative.

## Final hashes

- Source building: `197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8`
- Source ground: `4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b`
- Runtime building: `5185988e7ae8f0e0ca9d1ddf3988cc022c3e1effc31d6c6f367c7d19e77d7f91`
- Runtime ground: `308f71eb6191ea2d88aed364c0cd83dc53bf8da373a78c6e0f3a0fc341f3547b`
- Runtime projection: `696883f247c92a24e3c827ebd9c79e81314172f1fba85845be06de0679d1ae72`
- Collision projection: `4304831d801375981c079afde0966e53e315bca398a6d7229c162aa270608288`
- Packed mask module: `a1546e6624e73241c57e9273456b252e048852e5865d68cfb07c0e6b32b92be0`
- Walkable mask PNG: `c85237a143a741ffde89c766b8fd19219339981f8056f570ac0ecdb8e5b48474`

## Before commit

Review the exact 45-file allowlist in `CHANGESET_MANIFEST.md`, confirm the three narrow Step 9 code fixes, and exclude all review-only/unrelated paths. Run the rollback steps only if choosing legacy Home. Do not delete legacy assets.

No commit, staging, push, or deployment was performed.
