import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeDir = join(root, 'public/assets/world/nature-farm-v2')

const required = [
  'brookside-bloom-map-v3.png',
  'watermill-v2.png',
  'north-cottage-v2.png',
  'greenhouse-v2.png',
  'south-cottage-v2.png',
  'grass-v2.png',
  'path-v2.png',
  'creek-bank-v2.png',
  'bridge-deck-v2.png',
  'bridge-rails-v2.png',
  'trees-v2.png',
  'forest-trees-v2.png',
  'apple-trees-v2.png',
  'farm-v2.png',
  'flowers-props-v2.png',
]

const forbidden = [
  '/assets/world/nature_village_map/nature.png',
  '/assets/world/terrain.png',
  '/assets/world/farm_items.png',
  '/assets/world/nature_village/house_cream.png',
  '/assets/world/nature_village/house_cabin.png',
  '/assets/world/greenhouse.png',
  '/assets/world/nature_village/bench.png',
]

const missing = []
for (const name of required) {
  try {
    await access(join(runtimeDir, name), constants.R_OK)
  } catch {
    missing.push(name)
  }
}

const rendererPath = join(root, 'lib/natureVillage.js')
const renderer = await readFile(rendererPath, 'utf8')
const oldReferences = forbidden.filter((path) => renderer.includes(path))

if (missing.length || oldReferences.length) {
  console.error('Nature v2 asset acceptance gate: NOT READY')
  if (missing.length) console.error(`Missing runtime assets (${missing.length}):\n- ${missing.join('\n- ')}`)
  if (oldReferences.length) console.error(`Forbidden renderer references (${oldReferences.length}):\n- ${oldReferences.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(`Nature v2 asset acceptance gate: PASS (${required.length} runtime assets, no forbidden references)`)
}
