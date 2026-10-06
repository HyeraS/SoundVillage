import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import sharp from 'sharp'
import * as animalMask from './generated/animalWalkableMask.generated.mjs'
import * as humanMask from './generated/humanWalkableMask.generated.mjs'
import * as labMask from './generated/labWalkableMask.generated.mjs'
import * as natureMask from './generated/natureWalkableMask.generated.mjs'
import * as urbanMask from './generated/urbanV3WalkableMask.generated.mjs'
import { buildVillage as buildAnimalVillage, spawnAnimalItems } from './animalVillage.js'
import { COLLIDERS as ANIMAL_COLLIDERS, collidesAt as animalCollidesAt } from './animalVillageSunflowerConfig.mjs'
import { buildHumanVillage, collides as humanCollides, spawnHumanItems } from './humanVillageConfig.mjs'
import { EXIT as LAB_EXIT, buildVillage as buildLabVillage, collides as labCollides, spawnLabItems } from './labVillageConfig.mjs'
import { buildNatureFarmModel, createNatureFlowerDecor, spawnNatureItemsForModel } from './natureFarmLayout.mjs'
import { spawnUrbanV3SoundItems } from './urbanV3SoundItems.mjs'
import { collidesPlayerAt as urbanCollidesPlayerAt } from './urbanV3WorldConfig.mjs'
import { VILLAGE_RUNTIME_MANIFESTS } from './villageRuntimeManifest.mjs'
import {
  basePointToCurrent,
  basePolygonToCurrent,
  baseRectToCurrent,
  createWorldTransform,
  currentPointToBase,
  playerFootRectAt,
  screenPointToWorld,
  worldPointToScreen,
  worldPointToMaskCell,
} from './villageWorldTransform.mjs'

const SCALES = [0.75, 1, 1.3, 2]
const MASK_MODULES = {
  'urban-v3': urbanMask,
  lab: labMask,
  human: humanMask,
  animal: animalMask,
  nature: natureMask,
}
const EXPECTED_HASHES = {
  'urban-v3': '1438401782712ed4c315e69c6337d93dc060241ca2b77ded7eef1100b82dde02',
  lab: '6abc7f67aceadeb6d01a711c3bd0cd430c62d9f99108ee8cefbdec5c7142759d',
  human: '8e111e064fa25a8a2691ab1401d9f13a31370c626dbccc838bc2f727e4c71f2a',
  animal: '8325d5938f348b5b1b9a7cce92a9ec29f207aa3e76d10480bbd8bcb4e8b0e5ed',
  nature: '860c96f60d24009f733ecaf3fe492fa6c02fbc0a5422cc776716763752554810',
}

const publicAssetUrl = (src) => new URL(`../public${src}`, import.meta.url)

test('villageId manifest fixes each background, foreground, mask and generated module', () => {
  assert.deepEqual(Object.keys(VILLAGE_RUNTIME_MANIFESTS), ['urban-v3', 'lab', 'human', 'animal', 'nature'])
  assert.equal(VILLAGE_RUNTIME_MANIFESTS['urban-v3'].background.src, '/assets/urban-city-v3/reference/canonical-map-art-runtime.png')
  assert.equal(VILLAGE_RUNTIME_MANIFESTS.lab.background.src, '/assets/lab-witch/environment-master-v2.png')
  assert.equal(VILLAGE_RUNTIME_MANIFESTS.human.background.src, '/assets/human-village/community-map-master-1536x1152-v2.png')
  assert.equal(VILLAGE_RUNTIME_MANIFESTS.animal.background.src, '/assets/animal-village-sunflower/base-map.png')
  assert.equal(VILLAGE_RUNTIME_MANIFESTS.animal.foreground.src, '/assets/animal-village-sunflower/foreground-map.png')
  assert.equal(VILLAGE_RUNTIME_MANIFESTS.nature.background.src, '/assets/world/nature-farm-v2/brookside-bloom-map-v3.png')
  assert.equal(new Set(Object.values(VILLAGE_RUNTIME_MANIFESTS).map((entry) => entry.mask.src)).size, 5)
  assert.equal(new Set(Object.values(VILLAGE_RUNTIME_MANIFESTS).map((entry) => entry.mask.generatedModule)).size, 5)
})

for (const [villageId, manifest] of Object.entries(VILLAGE_RUNTIME_MANIFESTS)) {
  test(`${villageId} asset dimensions and generated bits match its fixed manifest`, async () => {
    const background = await sharp(fileURLToPath(publicAssetUrl(manifest.background.src))).metadata()
    assert.deepEqual([background.width, background.height], [manifest.baseWorldWidth, manifest.baseWorldHeight])
    if (manifest.foreground) {
      const foreground = await sharp(fileURLToPath(publicAssetUrl(manifest.foreground.src))).metadata()
      assert.deepEqual([foreground.width, foreground.height], [manifest.baseWorldWidth, manifest.baseWorldHeight])
    }
    const source = await readFile(publicAssetUrl(manifest.mask.src))
    assert.equal(createHash('sha256').update(source).digest('hex'), EXPECTED_HASHES[villageId])
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.deepEqual([info.width, info.height], [manifest.mask.width, manifest.mask.height])
    const maskModule = MASK_MODULES[villageId]
    assert.equal(maskModule.WALKABLE_MASK_METADATA.villageId, villageId)
    assert.equal(maskModule.WALKABLE_MASK_METADATA.sourceSha256, EXPECTED_HASHES[villageId])
    for (let index = 0; index < info.width * info.height; index += 1) {
      const white = data[index * 4] === 255
      assert.equal(maskModule.isMaskCellWalkable(index % info.width, Math.floor(index / info.width)), white)
    }
  })

  test(`${villageId} normalized mask mapping is invariant at 0.75x, 1x, 1.3x and 2x`, () => {
    const maskModule = MASK_MODULES[villageId]
    const baseTransform = createWorldTransform({
      baseWorldWidth: manifest.baseWorldWidth,
      baseWorldHeight: manifest.baseWorldHeight,
    })
    const probes = []
    for (let row = 0; row < manifest.mask.height; row += Math.max(1, Math.floor(manifest.mask.height / 23))) {
      for (let column = 0; column < manifest.mask.width; column += Math.max(1, Math.floor(manifest.mask.width / 29))) {
        probes.push({
          x: (column + 0.5) * manifest.mask.baseCellSize,
          y: (row + 0.5) * manifest.mask.baseCellSize,
        })
      }
    }
    probes.push(
      { x: 0, y: 0 },
      { x: manifest.baseWorldWidth - 0.0001, y: manifest.baseWorldHeight - 0.0001 },
    )
    for (const point of probes) {
      const baseCell = worldPointToMaskCell(point.x, point.y, baseTransform, manifest.mask.width, manifest.mask.height)
      for (const scale of SCALES) {
        const transform = createWorldTransform({
          baseWorldWidth: manifest.baseWorldWidth,
          baseWorldHeight: manifest.baseWorldHeight,
          currentWorldWidth: manifest.baseWorldWidth * scale,
          currentWorldHeight: manifest.baseWorldHeight * scale,
        })
        const scaled = basePointToCurrent(point, transform)
        const scaledCell = worldPointToMaskCell(scaled.x, scaled.y, transform, manifest.mask.width, manifest.mask.height)
        assert.deepEqual(scaledCell, baseCell)
        assert.equal(
          maskModule.isMaskPointWalkable(point.x, point.y),
          maskModule.isMaskPointWalkable(scaled.x, scaled.y, transform.currentWorldWidth, transform.currentWorldHeight),
        )
      }
    }
  })
}

test('Urban V3 1.3x regression keeps mask, collider, polygon, pointer and foot geometry aligned', () => {
  const manifest = VILLAGE_RUNTIME_MANIFESTS['urban-v3']
  const transform = createWorldTransform({
    baseWorldWidth: manifest.baseWorldWidth,
    baseWorldHeight: manifest.baseWorldHeight,
    currentWorldWidth: manifest.baseWorldWidth * 1.3,
    currentWorldHeight: manifest.baseWorldHeight * 1.3,
  })
  assert.equal(transform.currentWorldWidth, 1882.4)
  assert.equal(transform.currentWorldHeight, 1411.8)
  assert.deepEqual(baseRectToCurrent({ x: 200, y: 100, w: 100, h: 50 }, transform), {
    x: 260, y: 130, w: 130, h: 65,
  })
  const collider = baseRectToCurrent({ id: 'fixture', x: 440, y: 320, w: 60, h: 24 }, transform)
  assert.deepEqual(collider, { id: 'fixture', x: 572, y: 416, w: 78, h: 31.200000000000003 })
  assert.deepEqual(basePolygonToCurrent([{ x: 10, y: 20 }, { x: 30, y: 40 }], transform), [
    { x: 13, y: 26 }, { x: 39, y: 52 },
  ])
  const scaledPoint = basePointToCurrent({ x: 720, y: 958 }, transform)
  assert.deepEqual(currentPointToBase(scaledPoint, transform), { x: 720, y: 958 })
  const foot = playerFootRectAt(scaledPoint, manifest.playerFootBox, transform)
  assert.equal(foot.w, 26)
  assert.equal(foot.h, 18.2)
  const baseCell = worldPointToMaskCell(250, 125, createWorldTransform({
    baseWorldWidth: manifest.baseWorldWidth, baseWorldHeight: manifest.baseWorldHeight,
  }), manifest.mask.width, manifest.mask.height)
  const scaledCell = worldPointToMaskCell(325, 162.5, transform, manifest.mask.width, manifest.mask.height)
  assert.deepEqual(scaledCell, baseCell)
})

test('Nature 1.3x foot box renders as 23.4x13 in the same world transform', () => {
  const manifest = VILLAGE_RUNTIME_MANIFESTS.nature
  const transform = createWorldTransform({
    baseWorldWidth: manifest.baseWorldWidth,
    baseWorldHeight: manifest.baseWorldHeight,
    currentWorldWidth: manifest.baseWorldWidth * 1.3,
    currentWorldHeight: manifest.baseWorldHeight * 1.3,
  })
  const foot = playerFootRectAt(basePointToCurrent({ x: 592, y: 1072 }, transform), manifest.playerFootBox, transform)
  assert.ok(Math.abs(foot.w - 23.4) < 1e-10)
  assert.equal(foot.h, 13)
})

test('camera and pointer conversions are exact inverses in the current world coordinate system', () => {
  const camera = { x: 241.5, y: 183.25, zoomX: 1.3, zoomY: 1.3, offsetX: 27, offsetY: 11 }
  const world = { x: 936.2, y: 704.8 }
  const screen = worldPointToScreen(world, camera)
  const restored = screenPointToWorld(screen, camera)
  assert.ok(Math.abs(restored.x - world.x) < 1e-10)
  assert.ok(Math.abs(restored.y - world.y) < 1e-10)
})

test('production components pass explicit current world dimensions into their runtime models', async () => {
  const componentFiles = {
    'urban-v3': 'UrbanV3ZoneMap.js',
    animal: 'AnimalZoneMap.js',
    human: 'HumanZoneMap.js',
    lab: 'LabZoneMap.js',
    nature: 'NatureZoneMap.js',
  }
  for (const [villageId, file] of Object.entries(componentFiles)) {
    const source = await readFile(new URL(`../components/${file}`, import.meta.url), 'utf8')
    assert.match(source, /currentWorldWidth/)
    assert.match(source, /currentWorldHeight/)
    assert.match(source, /worldScale/)
    assert.match(source, /maskSource/)
    assert.match(source, new RegExp(villageId === 'urban-v3' ? 'moveUrbanV3Player' : 'moveWithCollision'))
  }
  const page = await readFile(new URL('../app/page.js', import.meta.url), 'utf8')
  assert.match(page, /activeZone === 'Urban'[\s\S]*?<UrbanV3ZoneMap/)
  assert.doesNotMatch(page, /activeZone === 'Urban'[\s\S]*?<UrbanZoneMap/)
  const urban = await readFile(new URL('../components/UrbanV3ZoneMap.js', import.meta.url), 'utf8')
  assert.match(urban, /urbanV3WorldConfig/)
  assert.match(urban, /spawnUrbanV3SoundItems/)
  assert.match(urban, /VILLAGE_MANIFEST\.background\.src/)
})

test('starts, exits and group A sound markers stay accessible through every logical world scale', async () => {
  const soundMetadata = JSON.parse(await readFile(new URL('../data/sound_metadata.json', import.meta.url)))
  const soundsFor = (zone) => soundMetadata.sounds.filter((sound) => sound.game_zone === zone && sound.group === 'A')

  const animalBase = buildAnimalVillage()
  const animalMarkers = spawnAnimalItems(soundsFor('Animal'), animalBase)
    .map((item) => ({ x: item.tx * 32 + 16, y: item.ty * 32 + 22 }))
  const humanMarkers = spawnHumanItems(soundsFor('Human'))
    .map((item) => ({ x: item.tx * 32 + 16, y: item.ty * 32 + 16, block: item.block }))
  const labSounds = soundsFor('Lab')
  const labBase = buildLabVillage(labSounds)
  const labMarkers = spawnLabItems(labSounds, labBase)
  const natureBase = buildNatureFarmModel()
  const natureDecor = new Set(createNatureFlowerDecor(natureBase).map((flower) => `${flower.tx},${flower.ty}`))
  const natureMarkers = spawnNatureItemsForModel(soundsFor('Nature'), natureBase, natureDecor)
    .map((item) => ({ x: item.tx * 32 + 16, y: item.ty * 32 + 16 }))
  const urbanMarkers = spawnUrbanV3SoundItems(soundsFor('Urban'))

  for (const scale of SCALES) {
    const sizeFor = (villageId) => ({
      currentWorldWidth: VILLAGE_RUNTIME_MANIFESTS[villageId].baseWorldWidth * scale,
      currentWorldHeight: VILLAGE_RUNTIME_MANIFESTS[villageId].baseWorldHeight * scale,
    })
    const scaled = (villageId, point) => basePointToCurrent(point, createWorldTransform({
      baseWorldWidth: VILLAGE_RUNTIME_MANIFESTS[villageId].baseWorldWidth,
      baseWorldHeight: VILLAGE_RUNTIME_MANIFESTS[villageId].baseWorldHeight,
      ...sizeFor(villageId),
    }))

    const animalSize = sizeFor('animal')
    for (const point of [animalBase.spawn, animalBase.exit]) {
      const current = scaled('animal', point)
      assert.equal(animalCollidesAt(ANIMAL_COLLIDERS, current.x, current.y, animalSize), null)
    }
    for (const point of animalMarkers) {
      const current = scaled('animal', point)
      assert.equal(animalCollidesAt(ANIMAL_COLLIDERS, current.x, current.y, animalSize), null)
    }

    const humanSize = sizeFor('human')
    const humanVillage = buildHumanVillage(humanSize)
    assert.equal(humanCollides(humanVillage, humanVillage.spawn.x, humanVillage.spawn.y, 6), null)
    assert.equal(humanCollides(
      humanVillage,
      humanVillage.exitTrigger.x + humanVillage.exitTrigger.w / 2,
      humanVillage.exitTrigger.y + humanVillage.exitTrigger.h / 2,
      6,
    ), null)
    for (const point of humanMarkers) {
      const current = scaled('human', point)
      assert.equal(humanCollides(humanVillage, current.x, current.y, point.block), null)
    }

    const labSize = sizeFor('lab')
    const labVillage = buildLabVillage(labSounds, labSize)
    assert.equal(labCollides(labVillage, labVillage.spawn.x, labVillage.spawn.y), null)
    const labExit = scaled('lab', { x: LAB_EXIT.x + LAB_EXIT.w / 2, y: LAB_EXIT.y + 20 })
    assert.equal(labCollides(labVillage, labExit.x, labExit.y), null)
    for (const point of labMarkers) {
      const current = scaled('lab', point)
      assert.equal(labCollides(labVillage, current.x, current.y, 0, point.block), null)
    }

    const natureSize = sizeFor('nature')
    const natureVillage = buildNatureFarmModel(natureSize)
    assert.equal(natureVillage.canStand(natureVillage.spawn.x, natureVillage.spawn.y), true)
    assert.equal(natureVillage.canStand(natureVillage.exit.x, natureVillage.exit.y), true)
    for (const point of natureMarkers) {
      const current = scaled('nature', point)
      assert.equal(natureVillage.canStand(current.x, current.y), true)
    }

    const urbanSize = sizeFor('urban-v3')
    for (const point of [{ x: 720, y: 958 }, { x: 720, y: 1060 }]) {
      const current = scaled('urban-v3', point)
      assert.equal(urbanCollidesPlayerAt(current.x, current.y, urbanSize), null)
    }
    for (const point of urbanMarkers) {
      const current = scaled('urban-v3', point)
      assert.equal(urbanCollidesPlayerAt(current.x, current.y, urbanSize), null)
    }
  }
})
