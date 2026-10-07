# Reproducibility

Status: **PASS**

Both approved source hashes and dimensions match. Two independent direct-size WebP encodes were byte-identical to each other and to production. The existing 31 runtime files have zero hash changes. Projection, collision PNG/JSON, and packed mask generation were run twice with byte-identical hashes, then every supported `--check` passed. No timestamp, temporary path, or machine path is serialized.

A pristine-HEAD clean room received only the 45-file candidate plus a local `node_modules` symlink. With no copied `.git`, `_review`, `tmp`, `.codex`, attachment, or `.env.local`, it passed generated freshness, lint, the Next.js 16.2.7 production build, Home/object/collision/routes/minimap/camera/asset tests. No dependency was downloaded.
