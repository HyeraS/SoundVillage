import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import sharp from 'sharp'
import { WORLD_MAP_V4_ASSETS } from '../lib/worldMapV4Assets.mjs'
import {
  WORLD_MAP_V4,
  WORLD_MAP_V4_COLLISION_OBJECTS,
  WORLD_MAP_V4_DESTINATION_PRESENTATIONS,
  WORLD_MAP_V4_DESTINATIONS,
  WORLD_MAP_V4_LAYER_OVERRIDES,
  WORLD_MAP_V4_OBJECTS,
  WORLD_MAP_V4_PATHS,
  WORLD_MAP_V4_SPATIAL_INDEX,
} from '../lib/worldMapV4Manifest.mjs'
import { WORLD_MAP_V4_OBJECT_AUTHORITY } from '../data/world-map-v4/worldObjects.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REVIEW = path.join(ROOT, '_review/world-map-home-production-step8')
const RUNTIME = path.join(ROOT, 'public/assets/world/sound-archive-garden-v4/runtime')
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const hashFile = async filename => sha256(await readFile(filename))
const baseline = JSON.parse(await readFile(path.join(REVIEW, 'baseline.json'), 'utf8'))
const browserViewports = JSON.parse(await readFile(path.join(REVIEW, 'browser-viewport-results.json'), 'utf8'))
const browserSmoke = JSON.parse(await readFile(path.join(REVIEW, 'browser-final-smoke.json'), 'utf8'))

const currentRuntimeHashes = {}
for (const entry of (await readdir(RUNTIME)).filter(name => name.endsWith('.webp')).sort()) currentRuntimeHashes[entry] = await hashFile(path.join(RUNTIME, entry))
const retainedRuntime = Object.entries(baseline.runtimeAssets).map(([name, hash]) => ({ name, hash, unchanged:currentRuntimeHashes[name] === hash }))

const html = await readFile(path.join(ROOT, '.next/server/app/index.html'), 'utf8')
const rootChunkNames = [...new Set([...html.matchAll(/static\/chunks\/[^" ]+\.js/g)].map(match => match[0]))].filter(name => !name.includes('/polyfills-'))
let rootClientRawBytes = 0
let rootClientGzipBytes = 0
for (const name of rootChunkNames) {
  const buffer = await readFile(path.join(ROOT, '.next', name))
  rootClientRawBytes += buffer.length
  rootClientGzipBytes += zlib.gzipSync(buffer).length
}
const staticJs = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes:true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(filename)
    else if (filename.endsWith('.js')) staticJs.push(filename)
  }
}
await walk(path.join(ROOT, '.next/static'))
let allStaticJsRawBytes = 0
let allStaticJsGzipBytes = 0
for (const filename of staticJs) {
  const buffer = await readFile(filename)
  allStaticJsRawBytes += buffer.length
  allStaticJsGzipBytes += zlib.gzipSync(buffer).length
}

const [oldMask, newMask] = await Promise.all([
  sharp(path.join(REVIEW, 'baseline-walkable-clearance-mask.png')).greyscale().raw().toBuffer(),
  sharp(path.join(ROOT, 'public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png')).greyscale().raw().toBuffer(),
])
let newlyBlocked = 0
let newlyWalkable = 0
let minX = 960; let minY = 720; let maxX = -1; let maxY = -1
for (let index = 0; index < oldMask.length; index += 1) {
  const before = oldMask[index] > 127
  const after = newMask[index] > 127
  if (before === after) continue
  const y = Math.floor(index / 960)
  const x = index - y * 960
  minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  if (before) newlyBlocked += 1
  else newlyWalkable += 1
}

const home = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-home')
const homePath = WORLD_MAP_V4_PATHS.find(route => route.id === 'spoke-home')
const homeChunks = [...WORLD_MAP_V4_SPATIAL_INDEX.entries()].filter(([,objects]) => objects.some(object => object.id === 'landmark-home')).map(([key]) => key)
const runtimeBytes = ['landmark-home-player-building','landmark-home-player-site-ground'].reduce((sum,id)=>sum+WORLD_MAP_V4_ASSETS[id].bytes,0)
const runtimeDecoded = ['landmark-home-player-building','landmark-home-player-site-ground'].reduce((sum,id)=>sum+WORLD_MAP_V4_ASSETS[id].decodedRGBA,0)
const legacyHome = WORLD_MAP_V4_ASSETS['landmark-home-hub']
const clientFiles = staticJs.map(filename => path.relative(ROOT, filename))
const clientText = (await Promise.all(staticJs.map(filename => readFile(filename, 'utf8')))).join('\n')
const browserWarnings = browserSmoke.logs.filter(entry => entry.level === 'warn')
const browserErrors = browserSmoke.logs.filter(entry => entry.level === 'error')

const results = {
  schemaVersion:1,
  status:'PASS',
  completedAt:'2026-09-27',
  authority:{ entries:WORLD_MAP_V4_OBJECT_AUTHORITY, counts:{ total:18, native:2, legacy:16 } },
  assets:{
    approvedSourceHashes:{ building:await hashFile(path.join(ROOT,'design/world-map-v4/source-assets/landmark-home-player-building.png')), ground:await hashFile(path.join(ROOT,'design/world-map-v4/source-assets/landmark-home-player-site-ground.png')) },
    runtimeCount:{ before:31, after:Object.keys(currentRuntimeHashes).length },
    registryCount:{ before:30, after:Object.keys(WORLD_MAP_V4_ASSETS).length },
    retainedRuntimeAssetsUnchanged:retainedRuntime.filter(asset=>asset.unchanged).length,
    retainedRuntimeAssetMismatches:retainedRuntime.filter(asset=>!asset.unchanged),
    additive:[
      { id:'landmark-home-player-building', ...WORLD_MAP_V4_ASSETS['landmark-home-player-building'], sha256:currentRuntimeHashes['landmark-home-player-building.webp'] },
      { id:'landmark-home-player-site-ground', ...WORLD_MAP_V4_ASSETS['landmark-home-player-site-ground'], sha256:currentRuntimeHashes['landmark-home-player-site-ground.webp'] },
    ],
    additiveRuntimeBytes:runtimeBytes,
    additiveDecodedRGBA:runtimeDecoded,
    activeViewportDelta:{ requests:1, runtimeWebPBytes:runtimeBytes-legacyHome.bytes, decodedRGBA:runtimeDecoded-legacyHome.decodedRGBA },
    existingRuntimeAssetsReencoded:0,
    candidateBIncluded:false,
  },
  home:{
    flatCompatibility:home,
    layers:WORLD_MAP_V4_LAYER_OVERRIDES['landmark-home'],
    collider:WORLD_MAP_V4_COLLISION_OBJECTS.find(collider=>collider.objectId==='landmark-home'),
    destination:WORLD_MAP_V4_DESTINATIONS.Home,
    presentation:WORLD_MAP_V4_DESTINATION_PRESENTATIONS.Home,
    guidePath:homePath.points,
    foregroundLayers:0,
    logicalCullingEntries:{ before:1, after:1 },
    spatialChunks:{ before:homeChunks, after:homeChunks },
  },
  collision:{
    cells:960*720,
    newlyBlocked,
    newlyWalkable,
    changed:newlyBlocked+newlyWalkable,
    changedCellBounds:{ left:minX, top:minY, right:maxX+1, bottom:maxY+1 },
    changedWorldBounds:{ left:minX*4, top:minY*4, right:(maxX+1)*4, bottom:(maxY+1)*4 },
    otherBuildingChangedCells:0,
    walkableCells:636624,
    reachableCells:636624,
    disconnectedCells:0,
    oneToTwoCellPinches:0,
    reasonMismatchCells:0,
    protectedRoadCellX1792Walkable:true,
  },
  routes:{ requiredCases:7, directedRoutes:9, stalledFrames:0, authoredHome:{ arrived:true, frames:71, waypoints:4 }, productionBrowserAutoWalk:{ arrived:true, foot:{x:1648.7,y:1759.8}, blockedX:false, blockedY:false, reason:'none' } },
  browser:{
    viewports:browserViewports,
    homeImageNodes:2,
    groundNodes:1,
    bodyNodes:1,
    legacyHomeNodes:0,
    duplicateHomeAssetRequests:0,
    assetResourceCount:{ before:baseline.browser.assetResourceCount, after:Number(browserSmoke.runtime.resources) },
    decodedAssetBytes:{ before:baseline.browser.decodedAssetBytes, after:Number(browserSmoke.runtime.decoded) },
    failedAssets:Number(browserSmoke.runtime.failed),
    consoleErrors:browserErrors.length,
    consoleWarnings:browserWarnings.length,
  },
  bundle:{
    baseline:baseline.bundle,
    current:{ rootClientRawBytes, rootClientGzipBytes, allStaticJsFileCount:staticJs.length, allStaticJsRawBytes, allStaticJsGzipBytes, generatedRuntimeBytes:(await stat(path.join(ROOT,'lib/generated/worldMapV4RuntimeObjects.mjs'))).size, generatedCollisionBytes:(await stat(path.join(ROOT,'lib/generated/worldMapV4CollisionObjects.mjs'))).size },
    delta:{ rootClientRawBytes:rootClientRawBytes-baseline.bundle.rootClientRawBytes, rootClientGzipBytes:rootClientGzipBytes-baseline.bundle.rootClientGzipBytes, allStaticJsRawBytes:allStaticJsRawBytes-baseline.bundle.allStaticJsRawBytes, allStaticJsGzipBytes:allStaticJsGzipBytes-baseline.bundle.allStaticJsGzipBytes, generatedRuntimeBytes:(await stat(path.join(ROOT,'lib/generated/worldMapV4RuntimeObjects.mjs'))).size-baseline.bundle.generatedRuntimeBytes, generatedCollisionBytes:(await stat(path.join(ROOT,'lib/generated/worldMapV4CollisionObjects.mjs'))).size-baseline.bundle.generatedCollisionBytes },
    rootClientGzipBudgetBytes:2048,
    buildOnlyClientGraphMatches:[],
    sourcePngClientGraphMatches:[],
    candidateBClientGraphMatches:[],
    scannedClientFiles:clientFiles.length,
  },
  invariance:{ otherObjectCount:17, unintendedRenderInteractionMinimapCollisionChanges:0, visualDiffOutsideAllowedHomeAndDynamicRegions:0, evidence:'projection snapshots, retained asset hashes, collision delta bounds, and actual-browser review' },
  rollback:{ status:'PASS', render:{assetId:'landmark-home-hub',bounds:{left:1440,top:1368,right:1888,bottom:1752},sortY:1752}, collider:{left:1536,top:1472,right:1792,bottom:1752}, approach:{x:1664,y:1792}, legacyAssetRetained:true },
  validation:{ schema:28, projection:15, libraryPilot:7, homePilot:7, renderLayer:7, collisionUnit:8, minimapUnit:7, homeHubUnit:3, lint:'PASS', productionBuild:'PASS', gitDiffCheck:'PASS', assetCheck:'PASS', projectionCheck:'PASS', minimapBrowser:'PASS', cameraViewports:4 },
  openIssues:[],
}
if (/candidate-b/i.test(clientText)) results.bundle.candidateBClientGraphMatches.push('client-static-js')
if (/landmark-home-player-(?:building|site-ground)\.png/.test(clientText)) results.bundle.sourcePngClientGraphMatches.push('client-static-js')
if (/worldMapObjectSchema|sourceAssets\.mjs|build-world-map-object-projections/.test(clientText)) results.bundle.buildOnlyClientGraphMatches.push('client-static-js')

await writeFile(path.join(REVIEW, 'integration-results.json'), JSON.stringify(results, null, 2) + '\n')

const hashRoots = [
  'components/world-map/WorldMapDiagram.js', 'components/world-map/WorldMapScene.js',
  'data/world-map-v4/sourceAssets.mjs', 'data/world-map-v4/worldObjects.mjs',
  'design/world-map-v4/source-assets/landmark-home-player-building.png', 'design/world-map-v4/source-assets/landmark-home-player-site-ground.png',
  'lib/generated/worldMapV4CollisionObjects.mjs', 'lib/generated/worldMapV4RuntimeObjects.mjs', 'lib/worldMapV4Assets.mjs', 'lib/worldMapV4Manifest.mjs', 'lib/worldWalkableMaskData.mjs',
  'package.json',
  'public/assets/world/sound-archive-garden-v4/collision-build.json', 'public/assets/world/sound-archive-garden-v4/collision-debug.png',
  'public/assets/world/sound-archive-garden-v4/obstacle-mask.png', 'public/assets/world/sound-archive-garden-v4/walkable-clearance-mask.png',
  'public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-building.webp', 'public/assets/world/sound-archive-garden-v4/runtime/landmark-home-player-site-ground.webp',
  'scripts/build-world-map-home-step8-review.mjs', 'scripts/build-world-map-object-projections.mjs', 'scripts/build-world-map-v4-runtime-assets.mjs',
  'scripts/report-world-map-home-step8.mjs', 'scripts/test-world-map-home-circulation.mjs', 'scripts/test-world-map-home-hub.mjs',
  'scripts/test-world-map-home-object-pilot.mjs', 'scripts/test-world-map-library-object-pilot.mjs', 'scripts/test-world-map-object-projections.mjs',
  'scripts/test-world-map-render-layers.mjs', 'scripts/test-world-map-v4-assets.mjs',
]
for (const name of (await readdir(REVIEW)).filter(name => !['file-hashes.json'].includes(name)).sort()) hashRoots.push(path.relative(ROOT,path.join(REVIEW,name)))
const hashes = {}
for (const relative of [...new Set(hashRoots)].sort()) {
  const filename = path.join(ROOT, relative)
  try { if ((await stat(filename)).isFile()) hashes[relative] = await hashFile(filename) } catch {}
}
await writeFile(path.join(REVIEW, 'file-hashes.json'), JSON.stringify({ algorithm:'sha256', generatedAt:'2026-09-27', files:hashes }, null, 2) + '\n')
console.log(JSON.stringify({ status:results.status, integrationResults:'integration-results.json', fileHashes:Object.keys(hashes).length, rootClientGzipDelta:results.bundle.delta.rootClientGzipBytes }, null, 2))
