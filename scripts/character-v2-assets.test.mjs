import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Character v2 runtime assets satisfy the pixel and catalog contract', () => {
  const result = spawnSync('python3', ['scripts/validate-character-v2-runtime-assets.py'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
})

test('the optional accessory layer is resolved after hair without changing the default stack', async () => {
  const source = fs.readFileSync(path.join(root, 'components/AssetRegistry.js'), 'utf8')
  const registry = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  const unchanged = registry.resolveWorldCharacterLayers()
  const withOutfit = registry.resolveWorldCharacterLayers({ outfitSrc: '/test-outfit.png' })
  const withAccessory = registry.resolveWorldCharacterLayers({ accessorySrc: '/test-accessory.png' })
  assert.equal(unchanged, registry.WORLD_CHARACTER.layers)
  assert.equal(unchanged.length, 3)
  assert.equal(withOutfit[1].src, '/test-outfit.png')
  assert.deepEqual(withOutfit.filter((_, index) => index !== 1), [unchanged[0], unchanged[2]])
  assert.equal(withAccessory.length, 4)
  assert.equal(withAccessory[2], unchanged[2])
  assert.deepEqual(withAccessory[3], { src: '/test-accessory.png', sheetW: 256, sheetH: 128 })
})
