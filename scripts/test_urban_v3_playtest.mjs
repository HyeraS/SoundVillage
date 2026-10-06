import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  ACCESSIBILITY_TARGETS,
  OBJECT_COLLIDERS,
  REFERENCE_TRANSFORM,
  SPAWN_POINTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  collidesPlayerAt,
  isReachableTarget,
} from '../lib/urbanV3WorldConfig.mjs'

const repoFile = (path) => new URL(`../${path}`, import.meta.url)

function pngHeader(buffer, label) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${label} must be PNG`)
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', `${label} must have IHDR`)
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

for (const path of [
  'public/assets/urban-city-v3/playtest/base-map.png',
  'public/assets/urban-city-v3/playtest/foreground-map.png',
  'public/assets/urban-city-v3/reference/canonical-map-art-source.png',
]) {
  assert.deepEqual(pngHeader(await readFile(repoFile(path)), path), { width: WORLD_WIDTH, height: WORLD_HEIGHT })
}

const layout = JSON.parse(await readFile(repoFile('public/assets/urban-city-v3/layout.json'), 'utf8'))
assert.deepEqual(layout.worldPixels, { width: WORLD_WIDTH, height: WORLD_HEIGHT })
assert.deepEqual(layout.referenceTransform, REFERENCE_TRANSFORM)

const component = await readFile(repoFile('components/UrbanV3Playtest.js'), 'utf8')
const page = await readFile(repoFile('app/urban-v3-playtest/page.js'), 'utf8')
assert.match(page, /UrbanV3Playtest/)
assert.match(component, /data-v3-debug-collision/)
assert.match(component, /data-v3-collision/)
assert.match(component, /data-v3-teleport/)
assert.match(component, /data-zone-dpad|<DPad/)
assert.match(component, /moveUrbanV3Player/)
assert.match(component, /URBAN_V3_SCENE_SCALE\s*=\s*1\.3/)
assert.match(component, /SPEED as VILLAGE_SPEED, TILE/)
assert.match(component, /URBAN_V3_SPEED\s*=\s*VILLAGE_SPEED\s*\*\s*URBAN_V3_CAMERA_HEIGHT\s*\/\s*\(18\s*\*\s*TILE\)/)
assert.doesNotMatch(component, /const SPEED\s*=\s*3\.25\s*\/\s*URBAN_V3_SCENE_SCALE/)
assert.match(component, /useWalkFrame\(moving\)/)
assert.match(component, /frameIndex=\{frameIndex\}/)
assert.match(component, /spawnUrbanV3SoundItems/)
assert.match(component, /<AnnotationPanel/)
assert.match(component, /data-v3-audio-group/)
assert.match(component, /data-v3-sound-prompt/)
assert.doesNotMatch(component, /fetch\(['"]\/assets\/urban-city-v3\/inventory\.json/)
assert.doesNotMatch(component, /urban-city-v2|urbanVillageConfig/)

for (const spawn of Object.values(SPAWN_POINTS)) assert.equal(collidesPlayerAt(spawn.x, spawn.y), null)
for (const targetId of Object.keys(ACCESSIBILITY_TARGETS)) assert.ok(isReachableTarget(targetId, 'entrance', 8), targetId)

console.log('Urban v3 playtest validation passed')
console.log(`  world: ${WORLD_WIDTH}x${WORLD_HEIGHT} identity coordinates`)
console.log(`  active object colliders: ${OBJECT_COLLIDERS.length}`)
console.log(`  spawns: ${Object.keys(SPAWN_POINTS).join(', ')}`)
console.log(`  reachable targets at 8px: ${Object.keys(ACCESSIBILITY_TARGETS).join(', ')}`)
