import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveWorldCharacterLayersWithBase } from '../lib/worldCharacterLayers.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Character v2 runtime assets satisfy the pixel and catalog contract', () => {
  const result = spawnSync('python3', ['scripts/validate-character-v2-runtime-assets.py'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
})

const world = {
  frame:32,
  rows:{ down:0, up:1, left:3, right:2 },
  cols:[0, 1, 2, 3, 4, 5, 6, 7],
  layers:[
    { src:'/assets/world/player_body.png', sheetW:256, sheetH:128 },
    { src:'/assets/world/player_clothes.png', sheetW:256, sheetH:128 },
    { src:'/assets/world/player_hair.png', sheetW:256, sheetH:128 },
  ],
}

test('the legacy resolver contract remains unchanged', () => {
  const unchanged = resolveWorldCharacterLayersWithBase(world)
  const withOutfit = resolveWorldCharacterLayersWithBase(world, { outfitSrc:'/test-outfit.png' })
  const withAccessory = resolveWorldCharacterLayersWithBase(world, { accessorySrc:'/test-accessory.png' })
  assert.equal(unchanged, world.layers)
  assert.equal(unchanged.length, 3)
  assert.equal(withOutfit[1].src, '/test-outfit.png')
  assert.deepEqual(withOutfit.filter((_, index) => index !== 1), [unchanged[0], unchanged[2]])
  assert.equal(withAccessory.length, 4)
  assert.equal(withAccessory[2], unchanged[2])
  assert.deepEqual(withAccessory[3], { src: '/test-accessory.png', sheetW: 256, sheetH: 128 })
})

test('extended loadouts change only their corresponding runtime layers', () => {
  const base = resolveWorldCharacterLayersWithBase(world, {
    skinId:'skin_01', eyesId:'eyes_green_light', hairStyleId:'hair_buzzcut', hairColorId:'black',
    outfitId:'basic', outfitSrc:'/assets/world/player_clothes.png', accessorySrc:'/test-accessory.png',
  })
  assert.deepEqual(base.map((layer) => layer.kind), ['skin', 'outfit', 'hair', 'accessory'])
  assert.equal(base.find((layer) => layer.kind === 'skin').src, '/assets/character-v2/skin/skin-01-walk.png')
  assert.equal(base.find((layer) => layer.kind === 'hair').src, '/assets/character-v2/hair/buzzcut/black-walk.png')

  const skin = resolveWorldCharacterLayersWithBase(world, { skinId:'skin_08' })
  assert.equal(skin.find((layer) => layer.kind === 'skin').src, '/assets/character-v2/skin/skin-08-walk.png')
  assert.equal(skin.find((layer) => layer.kind === 'hair').src, base.find((layer) => layer.kind === 'hair').src)

  const eyes = resolveWorldCharacterLayersWithBase(world, { eyesId:'eyes_red' })
  assert.equal(eyes.find((layer) => layer.kind === 'eyes').src, '/assets/character-v2/eyes/red-walk.png')
  assert.equal(eyes.find((layer) => layer.kind === 'skin').src, base.find((layer) => layer.kind === 'skin').src)

  const hairStyle = resolveWorldCharacterLayersWithBase(world, { hairStyleId:'hair_bob' })
  assert.equal(hairStyle.find((layer) => layer.kind === 'hair').src, '/assets/character-v2/hair/bob/black-walk.png')
  const hairColor = resolveWorldCharacterLayersWithBase(world, { hairStyleId:'hair_bob', hairColorId:'turquoise' })
  assert.equal(hairColor.find((layer) => layer.kind === 'hair').src, '/assets/character-v2/hair/bob/turquoise-walk.png')
  assert.deepEqual(hairColor.map(({ sheetW, sheetH }) => [sheetW, sheetH]), hairColor.map(() => [256, 128]))
})

test('long hair skirt compatibility is centralized and invalid identities fail loudly', () => {
  const regular = resolveWorldCharacterLayersWithBase(world, { hairStyleId:'hair_extra_long', outfitId:'basic' })
  const skirt = resolveWorldCharacterLayersWithBase(world, { hairStyleId:'hair_extra_long', outfitId:'skirt' })
  assert.equal(regular.find((layer) => layer.kind === 'hair').src, '/assets/character-v2/hair/extra-long/black-walk.png')
  assert.equal(skirt.find((layer) => layer.kind === 'hair').src, '/assets/character-v2/hair/extra-long/black-skirt-walk.png')
  assert.throws(() => resolveWorldCharacterLayersWithBase(world, { skinId:'skin_missing', strictIdentity:true }), /Unsupported Character V2 loadout/)
  const safe = resolveWorldCharacterLayersWithBase(world, { skinId:'skin_missing', strictIdentity:false })
  assert.equal(safe.find((layer) => layer.kind === 'skin').src, '/assets/character-v2/skin/skin-01-walk.png')
})

function hashes(paths) {
  return Object.fromEntries(paths.map((relative) => [relative, createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')]))
}

test('the identity asset build is deterministic and leaves source masters unchanged', () => {
  const sourcePaths = fs.readdirSync(path.join(root, 'assets/Character v.2/hair')).filter((name) => name.endsWith('.png')).map((name) => `assets/Character v.2/hair/${name}`)
    .concat(fs.readdirSync(path.join(root, 'assets/Character v.2/characters')).filter((name) => name.endsWith('.png')).map((name) => `assets/Character v.2/characters/${name}`))
    .concat(['assets/Character v.2/eyes/eyes.png'])
  const outputPaths = fs.readdirSync(path.join(root, 'public/assets/character-v2/skin')).map((name) => `public/assets/character-v2/skin/${name}`)
    .concat(fs.readdirSync(path.join(root, 'public/assets/character-v2/eyes')).map((name) => `public/assets/character-v2/eyes/${name}`))
  const sourcesBefore = hashes(sourcePaths)
  const outputsBefore = hashes(outputPaths)
  const result = spawnSync('python3', ['scripts/build-character-v2-runtime-assets.py'], { cwd:root, encoding:'utf8' })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.deepEqual(hashes(sourcePaths), sourcesBefore)
  assert.deepEqual(hashes(outputPaths), outputsBefore)
})

test('the asset builder rejects an unexpected palette width', () => {
  const code = [
    'import importlib.util,tempfile',
    'from pathlib import Path',
    'from PIL import Image',
    `spec=importlib.util.spec_from_file_location("builder",${JSON.stringify(path.join(root, 'scripts/build-character-v2-runtime-assets.py'))})`,
    'builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)',
    'root=Path(tempfile.mkdtemp())',
    'master=root/"master.png";walk=root/"walk.png"',
    'Image.new("RGBA",(256,128),(0,0,0,0)).save(master)',
    'Image.new("RGBA",(256,128),(0,0,0,0)).save(walk)',
    'builder.checked_walk_blocks(master,walk,14,"bad_palette")',
  ].join(';')
  const result = spawnSync('python3', ['-c', code], { cwd:root, encoding:'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /expected 14 palettes/)
})
