import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('production routes use dedicated maps for every reachable zone', async () => {
  const source = await read('app/page.js')
  assert.match(source, /const ZONES = \['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab'\]/)
  for (const zone of ['Music', 'Human', 'Nature', 'Urban', 'Animal', 'Lab']) {
    assert.match(source, new RegExp(`activeZone === '${zone}'`))
    assert.match(source, new RegExp(`<${zone}ZoneMap`))
  }
  assert.match(await read('app/lab-test/page.js'), /<ZoneMap[\s\S]*zone="Lab"/)
})

test('common ZoneMap placement ignores equivalent array references but tracks semantic layout changes', async () => {
  const source = await read('components/ZoneMap.js')
  assert.match(source, /function soundLayoutKey\(sounds\)/)
  assert.match(source, /sound\.sound_id/)
  assert.match(source, /sound\.block \|\| 1/)
  assert.match(source, /useMemo\(\(\) => sounds, \[layoutKey\]\)/)
  assert.match(source, /spawnSoundItems\(layoutSounds, zone\)/)
  assert.doesNotMatch(source, /spawnSoundItems\(sounds, zone\), \[sounds, zone\]/)
})

test('Stage 10B browser selectors contain no participant identity and reuse the protected route', async () => {
  const [zone, room, route, proxy, paths] = await Promise.all([
    read('components/ZoneMap.js'), read('components/InteriorDecorRoom.js'),
    read('app/stage8-e2e-test/page.js'), read('proxy.js'), read('lib/internalTestRoutes.mjs'),
  ])
  assert.match(zone, /data-sound-item-id/)
  assert.match(zone, /data-zone-character/)
  assert.match(room, /data-interior-room="ready"/)
  assert.match(route, /mode === 'room'/)
  assert.match(proxy, /\/stage8-e2e-test\/:path\*/)
  assert.match(paths, /'\/stage8-e2e-test'/)
  assert.doesNotMatch(zone + room, /data-(?:participant|auth|share-token)/)
})
