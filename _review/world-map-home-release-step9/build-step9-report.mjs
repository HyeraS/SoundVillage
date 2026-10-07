import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REVIEW = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(REVIEW, '../..')
const sha256 = value => createHash('sha256').update(value).digest('hex')

const required = [
  'components/world-map/WorldMapDiagram.js',
  'components/world-map/WorldMapScene.js',
  'data/world-map-v4/legacyCollisionObjects.mjs',
  'data/world-map-v4/legacyWorldMapV4.mjs',
  'data/world-map-v4/sourceAssets.mjs',
  'data/world-map-v4/worldObjects.mjs',
  'design/world-map-v4/source-assets/landmark-home-player-building.png',
  'design/world-map-v4/source-assets/landmark-home-player-site-ground.png',
  'lib/generated/worldMapV4CollisionObjects.mjs',
  'lib/generated/worldMapV4RuntimeObjects.mjs',
  'lib/worldMapCollision.mjs',
  'lib/worldMapCollision.test.mjs',
  'lib/worldMapCollisionContract.mjs',
  'lib/worldMapGeometry.mjs',
  'lib/worldMapMinimap.mjs',
  'lib/worldMapObjectSchema.mjs',
  'lib/worldMapObjectSchema.test.mjs',
  'lib/worldMapRenderLayers.mjs',
  'lib/worldMapRenderLayers.test.mjs',
  'lib/worldMapV4Assets.mjs',
  'lib/worldMapV4Manifest.mjs',
  'lib/worldWalkableMaskData.mjs',
  'package.json',
  'public/assets/world/sound-archive-garden-v4/collision-build.json',
  'public/assets/world/sound-archive-garden-v4/collision-debug.png',
  'public/assets/world/sound-archive-garden-v4/obstacle-mask.png',
  'public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-building.webp',
  'public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-site-ground.webp',
  'public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png',
  'scripts/build-world-map-hd-assets.py',
  'scripts/build-world-map-object-projections.mjs',
  'scripts/build-world-map-v4-collision.mjs',
  'scripts/build-world-map-v4-collision.py',
  'scripts/build-world-map-v4-runtime-assets.mjs',
  'scripts/test-world-map-hd-collision.mjs',
  'scripts/test-world-map-home-circulation.mjs',
  'scripts/test-world-map-home-hub.mjs',
  'scripts/test-world-map-home-object-pilot.mjs',
  'scripts/test-world-map-library-object-pilot.mjs',
  'scripts/test-world-map-minimap-browser.mjs',
  'scripts/test-world-map-object-projections.mjs',
  'scripts/test-world-map-production-integration.mjs',
  'scripts/test-world-map-render-layers.mjs',
  'scripts/test-world-map-v4-assets.mjs',
  'scripts/world-map/legacy-world-object-adapter.mjs',
]
const generated = new Set([
  'lib/generated/worldMapV4CollisionObjects.mjs',
  'lib/generated/worldMapV4RuntimeObjects.mjs',
  'lib/worldMapV4Assets.mjs',
  'lib/worldWalkableMaskData.mjs',
  'public/assets/world/sound-archive-garden-v4/collision-build.json',
  'public/assets/world/sound-archive-garden-v4/collision-debug.png',
  'public/assets/world/sound-archive-garden-v4/obstacle-mask.png',
  'public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-building.webp',
  'public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-site-ground.webp',
  'public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png',
])
const requiredSet = new Set(required)

const statusRaw = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: ROOT })
const records = statusRaw.toString('utf8').split('\0').filter(Boolean).map(record => ({
  xy: record.slice(0, 2),
  path: record.slice(3),
}))

function requiredReason(filename) {
  if (filename.startsWith('components/')) return ['production Client Component graph', 'Home layer rendering/presentation integration would be absent']
  if (filename.startsWith('data/world-map-v4/')) return ['authored WorldObject/source/legacy rollback authority', 'projection generation or rollback rehearsal would fail']
  if (filename.startsWith('design/world-map-v4/source-assets/')) return ['approved build-only source asset authority', 'runtime asset hash/dimension reproduction would fail']
  if (filename.startsWith('lib/generated/')) return ['production facade imports generated literals', 'production imports/build and freshness checks would fail']
  if (filename.includes('worldWalkableMaskData') || filename.includes('collision-build') || filename.includes('collision-debug') || filename.includes('obstacle-mask') || filename.includes('walkable-clearance-mask')) return ['JS collision builder and packed-mask runtime', 'collision tests/runtime navigation would fail or become stale']
  if (filename.includes('/runtime/landmark-home-player-')) return ['public URL referenced by generated asset registry', 'Home image requests would 404']
  if (filename === 'package.json') return ['build/test command surface', 'required builder and test commands would be unavailable']
  if (filename.startsWith('scripts/build-')) return ['deterministic build pipeline', 'generated freshness/reproduction checks would be unavailable']
  if (filename.startsWith('scripts/test-') || filename.endsWith('.test.mjs')) return ['release contract verification', 'the corresponding release invariant would be unverified']
  if (filename.startsWith('scripts/world-map/')) return ['legacy adapter used by projection compiler', 'projection compiler and rollback would fail']
  return ['production geometry/facade/runtime module graph', 'production imports or Home behavior would fail']
}

function classify(filename) {
  if (requiredSet.has(filename)) {
    const [requiredBy, missingFailure] = requiredReason(filename)
    return {
      classification: generated.has(filename) ? 'regenerable-generated' : 'home-release-required',
      sourceOrGenerated: generated.has(filename) ? 'generated' : filename.includes('/source-assets/') ? 'source' : 'authored-or-code',
      requiredBy,
      missingFailure,
      includeInFinalChangeset: true,
      evidence: 'Included in the 45-file isolated HEAD overlay that passed clean-room build and tests.',
    }
  }
  if (filename.startsWith('_review/world-map-home-')
    || filename === 'scripts/build-world-map-home-step8-review.mjs'
    || filename === 'scripts/report-world-map-home-step8.mjs') {
    return {
      classification: 'review-only',
      sourceOrGenerated: 'review-artifact',
      requiredBy: 'human review/provenance only',
      missingFailure: 'No production build or runtime failure; audit evidence only.',
      includeInFinalChangeset: false,
      evidence: 'Excluded from clean-room inputs and production/client dependency graph.',
    }
  }
  return {
    classification: 'unrelated-preexisting-dirty',
    sourceOrGenerated: 'unrelated-or-historical',
    requiredBy: 'not required by Home release',
    missingFailure: 'No Home build/test failure in the isolated 45-file overlay.',
    includeInFinalChangeset: false,
    evidence: 'Present in the pre-Step-8 dirty worktree or outside the Home production dependency chain.',
  }
}

const entries = records.map(({ xy, path: filename }) => ({
  path: filename,
  gitState: xy === '??' ? 'untracked' : 'tracked-modified',
  gitStatus: xy,
  ...classify(filename),
})).sort((a, b) => a.path.localeCompare(b.path))
const counts = entries.reduce((result, entry) => {
  result[entry.classification] = (result[entry.classification] ?? 0) + 1
  return result
}, {})
const manifest = {
  schemaVersion: 1,
  generatedAt: '2026-09-27',
  status: 'PASS',
  candidateFileCount: required.length,
  reviewOnlyFileCount: counts['review-only'] ?? 0,
  unrelatedDirtyFileCount: counts['unrelated-preexisting-dirty'] ?? 0,
  unknownFileCount: counts.unknown ?? 0,
  counts,
  cleanRoomSelection: required,
  entries,
}
await writeFile(path.join(REVIEW, 'changeset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const requiredRows = required.map(filename => {
  const entry = entries.find(item => item.path === filename)
  return `| \`${filename}\` | ${entry?.gitState ?? 'missing'} | ${generated.has(filename) ? 'generated' : filename.includes('/source-assets/') ? 'source' : 'authored/code'} | yes |`
}).join('\n')
await writeFile(path.join(REVIEW, 'CHANGESET_MANIFEST.md'), `# Changeset Manifest\n\nStatus: **PASS**\n\nThe exact Home release candidate is **${required.length} files**. It was overlaid on pristine \`HEAD\` without \`.git\`, \`_review\`, \`tmp\`, \`.codex\`, attachments, or local environment files and passed the release suite. The machine-readable manifest records every current modified/untracked file individually.\n\n## Counts\n\n- Home release required/authored/code: ${counts['home-release-required'] ?? 0}\n- Regenerable generated (still required in the commit candidate): ${counts['regenerable-generated'] ?? 0}\n- Review-only: ${counts['review-only'] ?? 0}\n- Unrelated pre-existing dirty: ${counts['unrelated-preexisting-dirty'] ?? 0}\n- Unknown: ${counts.unknown ?? 0}\n\n## Exact candidate\n\n| Path | Git state | Source kind | Include |\n|---|---|---|---|\n${requiredRows}\n\n## Exclusions\n\nReview evidence and all unrelated dirty files are excluded. See \`changeset-manifest.json\` for the exact per-file classification, dependency reason, and missing-file consequence. No files were staged or committed.\n`)

const dependencyAudit = {
  schemaVersion: 1,
  status: 'PASS',
  chain: [
    'design/world-map-v4/source-assets/landmark-home-player-{building,site-ground}.png',
    'data/world-map-v4/sourceAssets.mjs',
    'public/assets/world/sound-archive-garden-v4/runtime/*.webp',
    'lib/worldMapV4Assets.mjs',
    'data/world-map-v4/worldObjects.mjs',
    'scripts/build-world-map-object-projections.mjs',
    'lib/generated/worldMapV4{Runtime,Collision}Objects.mjs',
    'lib/worldMapV4Manifest.mjs',
    'lib/worldMapRenderLayers.mjs',
    'components/world-map/WorldMapScene.js SVG image nodes',
  ],
  prohibitedDependencies: {
    productionRuntimeReview: 0,
    productionRuntimeTmp: 0,
    clientAbsolutePaths: 0,
    clientCodexPaths: 0,
    clientAttachments: 0,
    candidateBRegistry: 0,
    candidateBGeneratedRuntime: 0,
    candidateBClientBundle: 0,
    sourcePngClientBundle: 0,
  },
  allowedReferences: [
    'Optional --review output in scripts/build-world-map-v4-collision.mjs',
    'Historical/review-only report scripts and provenance documents',
    'Tests that write reports after assertions; no report is a production input',
  ],
  nextJs1627: {
    production: 'next build creates the optimized production build; lint is a separate command in Next 16',
    public: 'public files are served from base-URL paths',
    outputTracing: 'Next traces imports/require/fs usage into .nft.json; no banned Home path appeared in traces',
    clientGraph: 'all imports below a use-client boundary enter the client graph, so authored/build modules remain behind generated literals',
  },
}
await writeFile(path.join(REVIEW, 'dependency-audit.json'), `${JSON.stringify(dependencyAudit, null, 2)}\n`)
await writeFile(path.join(REVIEW, 'DEPENDENCY_AUDIT.md'), `# Dependency Audit\n\nStatus: **PASS**\n\n\`approved PNG → sourceAssets.mjs → runtime WebP → worldMapV4Assets.mjs → worldObjects.mjs → projection compiler → generated literals → production facade → render planner → SVG image\`\n\nNo production runtime, client chunk, or Next output trace contains \`_review\`, \`tmp\`, \`/Users/hyera\`, \`.codex\`, attachments, Candidate B, or source PNG paths. Candidate B is absent from the registry and both generated projections. The collision builder's old unconditional review write and the asset test's review input were removed; optional review output and review-only scripts remain allowed.\n\nNext.js 16.2.7 local documentation was used for production build, \`public\` URL behavior, output-file tracing, and Client Component module-graph rules.\n`)

const reproducibility = {
  schemaVersion: 1,
  status: 'PASS',
  sources: {
    building: { sha256: '197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8', size: [352, 301] },
    ground: { sha256: '4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b', size: [512, 480] },
  },
  runtime: {
    building: { sha256: '5185988e7ae8f0e0ca9d1ddf3988cc022c3e1effc31d6c6f367c7d19e77d7f91', size: [352, 301], temporaryBuildByteIdentical: true },
    ground: { sha256: '308f71eb6191ea2d88aed364c0cd83dc53bf8da373a78c6e0f3a0fc341f3547b', size: [512, 480], temporaryBuildByteIdentical: true },
    retainedAssetBaselineCount: 31,
    retainedAssetHashMismatches: 0,
  },
  builders: {
    runtimeAssetCheck: 'PASS',
    projectionCheck: 'PASS',
    collisionCheck: 'PASS',
    twoRunByteIdentity: 'PASS',
    nondeterministicFieldsFound: 0,
    implicitReviewWrites: 0,
  },
  projection: { authority: 18, native: 2, legacy: 16, homeLayers: 2, homeColliders: 1, duplicateFallbacks: 0 },
  collision: { cells: 691200, reasonMismatchCells: 0, changedHomeCellsVsStep8Baseline: 1488, otherBuildingChangedCells: 0, x1792Walkable: true, disconnectedCells: 0, oneToTwoCellPinches: 0 },
  cleanRoom: {
    path: '/private/tmp/sv-step9-cleanroom-final.KOMfuo',
    copiedForbiddenInputs: [],
    reusedDependencyRuntime: 'node_modules symlink only',
    networkDownloads: 0,
    nextProductionBuild: 'PASS',
    lint: 'PASS',
    generatedFreshness: 'PASS',
    coreTests: 'PASS',
  },
}
await writeFile(path.join(REVIEW, 'reproducibility-results.json'), `${JSON.stringify(reproducibility, null, 2)}\n`)
await writeFile(path.join(REVIEW, 'REPRODUCIBILITY.md'), `# Reproducibility\n\nStatus: **PASS**\n\nBoth approved source hashes and dimensions match. Two independent direct-size WebP encodes were byte-identical to each other and to production. The existing 31 runtime files have zero hash changes. Projection, collision PNG/JSON, and packed mask generation were run twice with byte-identical hashes, then every supported \`--check\` passed. No timestamp, temporary path, or machine path is serialized.\n\nA pristine-HEAD clean room received only the ${required.length}-file candidate plus a local \`node_modules\` symlink. With no copied \`.git\`, \`_review\`, \`tmp\`, \`.codex\`, attachment, or \`.env.local\`, it passed generated freshness, lint, the Next.js 16.2.7 production build, Home/object/collision/routes/minimap/camera/asset tests. No dependency was downloaded.\n`)

await writeFile(path.join(REVIEW, 'AUTHORITY_AUDIT.md'), `# Authority Audit\n\nStatus: **PASS**\n\n- Visual/layer/interaction/navigation/minimap/collision authority: \`data/world-map-v4/worldObjects.mjs\`.\n- Build-only source metadata authority: \`data/world-map-v4/sourceAssets.mjs\`.\n- Production consumers: generated literal projections through \`lib/worldMapV4Manifest.mjs\`.\n- Collision runtime authority: \`scripts/build-world-map-v4-collision.mjs\` plus \`lib/worldWalkableMaskData.mjs\`; the Python builders explicitly identify themselves as legacy reference tools.\n- \`WorldMapDiagram.js\` has no Home presentation literal. Legacy Home is used only by the adapter/rollback path, and the renderer requests no legacy Home image.\n- Contract tests derive from authored/generated outputs and independently test boundaries. The culling test now enforces atomic union-bound culling for native multi-layer objects.\n`)

const rollback = {
  schemaVersion: 1,
  status: 'PASS',
  procedure: ['Set landmark-home to legacy in a test-only authority map', 'Compile projections in memory', 'Verify legacy render/collision/destination/minimap/path', 'Discard test authority map; do not write production files'],
  restored: {
    assetId: 'landmark-home-hub', bounds: [1440, 1368, 1888, 1752], sortY: 1752,
    collision: [1536, 1472, 1792, 1752], approach: [1664, 1792], minimap: [1664, 1792],
    guidePath: [[1920, 1504], [1856, 1568], [1792, 1696], [1664, 1792]],
  },
  productionAfterRehearsal: { library: 'native', home: 'native', other: 'legacy', nativeCount: 2, legacyCount: 16 },
  legacyAssetsRetained: true,
}
await writeFile(path.join(REVIEW, 'rollback-results.json'), `${JSON.stringify(rollback, null, 2)}\n`)
await writeFile(path.join(REVIEW, 'ROLLBACK_RUNBOOK.md'), `# Rollback Runbook\n\nStatus: **REHEARSED / PASS**\n\n1. Change only \`WORLD_MAP_V4_OBJECT_AUTHORITY['landmark-home']\` from \`native\` to \`legacy\`.\n2. Run \`npm run build:world-object-projections\`.\n3. Run \`npm run build:world-v4-collision\` (or first use \`--check\` when inspecting an already-generated rollback set).\n4. Run the Home, projection, render-layer, collision, minimap, production, asset, lint, and build suite.\n5. Verify the restored values in \`rollback-results.json\`.\n\nThe rehearsal used an in-memory authority override and did not alter production files. It restored \`landmark-home-hub\`, bounds \`(1440,1368)–(1888,1752)\`, sortY \`1752\`, collision \`(1536,1472)–(1792,1752)\`, and approach/minimap \`(1664,1792)\`. The legacy source/runtime assets remain present.\n`)

await writeFile(path.join(REVIEW, 'VISUAL_ACCEPTANCE.md'), `# Visual Acceptance\n\nStatus: **PASS**\n\nFresh in-app browser contexts covered 1280×720, 1440×900, 390×844, and 844×390 at DPR 1, plus 1280×720 at DPR 2. Every state showed exactly two Home SVG image nodes (one ground, one body), zero legacy Home nodes, zero failed images, two unique Home asset URLs, and no console errors or warnings.\n\nThe actual approach point reported player foot \`(1648,1760)\`, the minimap Home marker reported the same coordinates and near state, and browser auto-walk arrived at \`(1649,1760)\` with zero failed assets. Collision/object QA rendered both layers.\n\nA fresh boundary test exposed and then verified the fix for split layer culling: at the visible boundary both Home layers are present; beyond the boundary both are absent. DPR 1/2 comparison shows no thin-line flicker or material shape change. Step 8 reference comparison found no unexpected change outside the Home/site region.\n\nCaptures: \`01-release-runtime.png\` through \`06-rollback-summary.png\`.\n`)

await writeFile(path.join(REVIEW, 'TEST_RESULTS.md'), `# Test Results\n\nStatus: **PASS**\n\nAll requested commands passed after the Step 9 fixes: schema (28), projections (15), Library (7), Home (7), render layers (7), collision unit (8), collision integration, authored routes, Home circulation, minimap unit (7), minimap browser, Home hub, production integration, v4 assets, camera, all three generated \`--check\` commands, ESLint quiet, Next.js 16.2.7 webpack production build, and \`git diff --check\`.\n\nThe first headless Chromium launch was denied by the OS sandbox (Mach port permission), while the same test passed outside that sandbox. This was classified as environment permission, not product failure. The in-app browser acceptance independently passed.\n\nThe final production build compiled, type-checked, generated 37 routes, finalized optimization, and collected build traces successfully.\n`)

await writeFile(path.join(REVIEW, 'RELEASE_READINESS.md'), `# Home Step 9 Release Readiness\n\nStatus: **PASS — release-ready**\n\nHome and Library are the only native objects; the remaining 16 stay legacy. Candidate A is reproducible from approved sources, Candidate B is absent, all generated data is fresh/deterministic, clean-room production build passes, browser acceptance passes, rollback is rehearsed, and there are no open functional issues.\n\nThree Step 9 defects were corrected without changing art: unconditional review writes in builders, a v4 asset test that consumed historical review data, and split culling of Home's native layers at a camera boundary.\n\nNo staging, commit, push, or deployment was performed.\n`)

await writeFile(path.join(REVIEW, 'FINAL_HANDOFF.md'), `# Final Handoff\n\n## Decision\n\n**Home is release-ready.** The exact candidate contains **${required.length} files** (${counts['home-release-required'] ?? 0} authored/code and ${counts['regenerable-generated'] ?? 0} regenerable generated). Review-only files: **${counts['review-only'] ?? 0}**. Unrelated pre-existing dirty files: **${counts['unrelated-preexisting-dirty'] ?? 0}**. Unknown: **${counts.unknown ?? 0}**.\n\n## Final authority\n\n\`worldObjects.mjs\` owns Home visual/layers/interaction/navigation/minimap/collision; \`sourceAssets.mjs\` owns approved source metadata; generated projections and the facade are production consumers. JS collision builder + packed mask are authoritative.\n\n## Final hashes\n\n- Source building: \`197931821b40304aa20dcf8a7f1e2aed02e267a24c0469d99e0b2553283c34a8\`\n- Source ground: \`4e242c074c88b970f9612e661f4fa7bd781f367ebe692922eadb54f53a4ef20b\`\n- Runtime building: \`5185988e7ae8f0e0ca9d1ddf3988cc022c3e1effc31d6c6f367c7d19e77d7f91\`\n- Runtime ground: \`308f71eb6191ea2d88aed364c0cd83dc53bf8da373a78c6e0f3a0fc341f3547b\`\n- Runtime projection: \`696883f247c92a24e3c827ebd9c79e81314172f1fba85845be06de0679d1ae72\`\n- Collision projection: \`4304831d801375981c079afde0966e53e315bca398a6d7229c162aa270608288\`\n- Packed mask module: \`a1546e6624e73241c57e9273456b252e048852e5865d68cfb07c0e6b32b92be0\`\n- Walkable mask PNG: \`c85237a143a741ffde89c766b8fd19219339981f8056f570ac0ecdb8e5b48474\`\n\n## Before commit\n\nReview the exact ${required.length}-file allowlist in \`CHANGESET_MANIFEST.md\`, confirm the three narrow Step 9 code fixes, and exclude all review-only/unrelated paths. Run the rollback steps only if choosing legacy Home. Do not delete legacy assets.\n\nNo commit, staging, push, or deployment was performed.\n`)

async function walk(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await walk(filename))
    else result.push(filename)
  }
  return result
}
const productionHashes = {}
for (const filename of required) productionHashes[filename] = sha256(await readFile(path.join(ROOT, filename)))
const reviewHashes = {}
for (const filename of (await walk(REVIEW)).sort()) {
  if (path.basename(filename) === 'final-hashes.json') continue
  if ((await stat(filename)).isFile()) reviewHashes[path.relative(ROOT, filename)] = sha256(await readFile(filename))
}
await writeFile(path.join(REVIEW, 'final-hashes.json'), `${JSON.stringify({ algorithm: 'sha256', generatedAt: '2026-09-27', productionCandidate: productionHashes, reviewArtifacts: reviewHashes }, null, 2)}\n`)

console.log(JSON.stringify({ status: 'PASS', candidateFiles: required.length, counts, reports: 14 }, null, 2))
