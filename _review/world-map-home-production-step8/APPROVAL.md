# Step 8 Approval

Status: **PASS**

- Candidate A was approved by the user for production integration on **2026-09-27**.
- Approved building SHA-256: `197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8`
- Approved ground SHA-256: `4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b`
- The promoted source PNGs are byte-identical to those approved files.
- Candidate B was not approved and is absent from source promotion, runtime assets, generated projections, and the client build.
- No ImageGen, regeneration, redesign, crop, color adjustment, sharpening, or non-uniform resize was performed.
- Conversion was limited to a lossless copy into the production source tree and direct-size WebP encoding.
- No commit, push, or deployment was performed.

The actual Next.js runtime shows Candidate A as the Home landmark with one ground-band node and one world-band body node. The legacy Home hub remains available only for rollback.

