import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { VILLAGE_RUNTIME_MANIFESTS } from '../lib/villageRuntimeManifest.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = path.join(ROOT, '_review/village-world-scaling')
const COMPONENTS = {
  'urban-v3': 'components/UrbanV3ZoneMap.js',
  animal: 'components/AnimalZoneMap.js',
  human: 'components/HumanZoneMap.js',
  lab: 'components/LabZoneMap.js',
  nature: 'components/NatureZoneMap.js',
}

await fs.mkdir(OUTPUT, { recursive: true })
let previous = { villages: {} }
try { previous = JSON.parse(await fs.readFile(path.join(OUTPUT, 'report.json'), 'utf8')) } catch {}

const villages = {}
for (const [villageId, manifest] of Object.entries(VILLAGE_RUNTIME_MANIFESTS)) {
  const maskPath = path.join(ROOT, 'public', manifest.mask.src)
  const source = await fs.readFile(maskPath)
  const sha256 = createHash('sha256').update(source).digest('hex')
  const modulePath = path.resolve(ROOT, 'lib', manifest.mask.generatedModule)
  const generated = await import(pathToFileURL(modulePath))
  const metadata = generated.WALKABLE_MASK_METADATA || generated.URBAN_V3_WALKABLE_MASK_METADATA
  if (metadata.villageId !== villageId) throw new Error(`${villageId}: generated module villageId mismatch`)
  if (metadata.sourceSha256 !== sha256) throw new Error(`${villageId}: generated module SHA mismatch`)
  if (metadata.width !== manifest.mask.width || metadata.height !== manifest.mask.height) {
    throw new Error(`${villageId}: generated module dimensions mismatch`)
  }
  const screenshots = [1, 1.3].map((scale) => ({
    scale,
    path: `_review/village-world-scaling/${villageId}-${String(scale).replace('.', '_')}x.png`,
  }))
  villages[villageId] = {
    ...(previous.villages?.[villageId] || {}),
    villageId,
    productionComponent: COMPONENTS[villageId],
    background: `public${manifest.background.src}`,
    foreground: manifest.foreground ? `public${manifest.foreground.src}` : null,
    mask: `public${manifest.mask.src}`,
    generatedModule: `lib/${manifest.mask.generatedModule.replace(/^\.\//, '')}`,
    sha256,
    baseWorldWidth: manifest.baseWorldWidth,
    baseWorldHeight: manifest.baseWorldHeight,
    playerFootBox: manifest.playerFootBox,
    interpolation: 'nearest-neighbor',
    testedScales: [0.75, 1, 1.3, 2],
    screenshots,
  }
}

const report = { generatedAt: new Date().toISOString(), villages }
await fs.writeFile(path.join(OUTPUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
