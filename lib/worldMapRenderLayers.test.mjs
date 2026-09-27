import assert from 'node:assert/strict'
import test from 'node:test'
import { WORLD_MAP_V4_AUTHORED_CANDIDATES } from '../data/world-map-v4/worldObjects.mjs'
import { projectNativeWorldObjectCandidate } from '../scripts/build-world-map-object-projections.mjs'
import { adaptLegacyWorldMapV4 } from '../scripts/world-map/legacy-world-object-adapter.mjs'
import { validateWorldObject } from './worldMapObjectSchema.mjs'
import {
  WORLD_MAP_RENDER_BAND_ORDER,
  halfOpenRectsIntersect,
  planWorldMapRenderLayers,
  renderLayerVisibleWhenMatches,
} from './worldMapRenderLayers.mjs'

const clone = value => structuredClone(value)
const legacy = adaptLegacyWorldMapV4()
const library = WORLD_MAP_V4_AUTHORED_CANDIDATES.find(object => object.id === 'landmark-library')

function layeredFixture() {
  const object = clone(library)
  object.id = 'fixture-layered-building'
  object.transform.position = { x: 100, y: 200 }
  object.anchor = { space: 'object-local', x: 0, y: 0 }
  object.visual.layers = [
    { id: 'site-ground', role: 'ground', assetId: 'landmark-home-hub', rect: { left: -20, top: 0, right: 120, bottom: 80 }, renderBand: 'ground', sortOffsetY: -10 },
    { id: 'body', role: 'body', assetId: 'landmark-library', rect: { left: 0, top: -50, right: 100, bottom: 100 }, renderBand: 'world', sortOffsetY: 0 },
    { id: 'body-trim', role: 'body', assetId: 'landmark-home', rect: { left: 20, top: -20, right: 80, bottom: 80 }, renderBand: 'world', sortOffsetY: 0 },
    { id: 'front-occluder', role: 'occluder', assetId: 'foreground-south-gate', rect: { left: 10, top: 70, right: 90, bottom: 120 }, renderBand: 'foreground', sortOffsetY: 5 },
    { id: 'optional-effect', role: 'effect', assetId: 'landmark-lab', rect: { left: 20, top: -60, right: 80, bottom: 0 }, renderBand: 'overlay', sortOffsetY: 20, visibleWhen: { qaModes: ['all', 'objects'], state: { active: true } } },
  ]
  object.groundContact = { space: 'world', point: { x: 150, y: 300 } }
  object.depth = { mode: 'ground-contact', sortOffsetY: 0 }
  object.collision = { mode: 'none', colliders: [] }
  object.compatibility = {
    ...object.compatibility,
    primaryVisualLayerId: 'body',
  }
  object.provenance = { sourceNote: 'test-only fixture' }
  return object
}

function projectedFixture() {
  return projectNativeWorldObjectCandidate(layeredFixture(), legacy)
}

test('multi-layer fixture projects five world-space render layers and union compatibility bounds', () => {
  const projected = projectedFixture()
  assert.equal(projected.renderLayers.length, 5)
  assert.deepEqual(projected.bounds, { left: 80, top: 140, right: 220, bottom: 320 })
  assert.deepEqual(projected.render, {
    id: 'fixture-layered-building',
    assetId: 'landmark-library',
    category: 'landmark',
    x: 80,
    y: 140,
    width: 140,
    height: 180,
    anchorX: 0,
    anchorY: 0,
    sortY: 300,
    layer: 'gameplay',
    interaction: { type: 'museum', id: 'Library' },
    portalId: 'Sound Library',
    collision: [],
  })
  assert.deepEqual(projected.renderLayers.map(layer => [layer.layerId, layer.x, layer.y, layer.width, layer.height, layer.sortY]), [
    ['site-ground', 80, 200, 140, 80, 290],
    ['body', 100, 150, 100, 150, 300],
    ['body-trim', 120, 180, 60, 100, 300],
    ['front-occluder', 110, 270, 80, 50, 305],
    ['optional-effect', 120, 140, 60, 60, 320],
  ])
  assert.deepEqual(projected.collisionObjects, [])
})

test('positive scale projects layer coordinates and sizes while invalid scales fail', () => {
  const object = layeredFixture()
  object.transform.scale = { x: 2, y: 0.5 }
  const projected = projectNativeWorldObjectCandidate(object, legacy)
  assert.deepEqual(projected.bounds, { left: 60, top: 170, right: 340, bottom: 260 })
  assert.deepEqual(projected.renderLayers.find(layer => layer.layerId === 'body'), {
    objectId: object.id,
    layerId: 'body',
    role: 'body',
    renderBand: 'world',
    assetId: 'landmark-library',
    x: 100,
    y: 175,
    width: 200,
    height: 75,
    sortY: 300,
    sortOffsetY: 0,
    visibleWhen: null,
    layer: 'gameplay',
  })
  for (const invalid of [0, -1]) {
    const candidate = layeredFixture()
    candidate.transform.scale.x = invalid
    assert.throws(() => validateWorldObject(candidate), /transform\.scale.*positive/)
  }
})

test('compiler rejects unsupported rotation, unknown assets, layers, and primary IDs', () => {
  const rotated = layeredFixture()
  rotated.transform.rotationDeg = 1
  assert.throws(() => projectNativeWorldObjectCandidate(rotated, legacy), /unsupported visual rotation.*rotationDeg=0/)

  const unknownAsset = layeredFixture()
  unknownAsset.visual.layers[0].assetId = 'missing-fixture-asset'
  assert.throws(() => projectNativeWorldObjectCandidate(unknownAsset, legacy), /site-ground.*unknown asset/)

  const missingPrimary = layeredFixture()
  missingPrimary.compatibility.primaryVisualLayerId = 'missing-body'
  assert.throws(() => projectNativeWorldObjectCandidate(missingPrimary, legacy), /primary visual layer missing-body does not exist/)

  const duplicateLayer = layeredFixture()
  duplicateLayer.visual.layers[1].id = 'site-ground'
  assert.throws(() => projectNativeWorldObjectCandidate(duplicateLayer, legacy), /duplicate layer ID site-ground/)

  const unknownVisibility = layeredFixture()
  unknownVisibility.visual.layers[0].visibleWhen = { predicate: 'always' }
  assert.throws(() => projectNativeWorldObjectCandidate(unknownVisibility, legacy), /visibleWhen\.predicate.*not a supported declarative visibility condition/)

  const implicitOverlay = layeredFixture()
  delete implicitOverlay.visual.layers.at(-1).visibleWhen.state
  assert.throws(() => projectNativeWorldObjectCandidate(implicitOverlay, legacy), /visibleWhen\.state.*required for overlay layers/)
})

test('planner suppresses flat duplicates and orders every render band around the world queue', () => {
  const projected = projectedFixture()
  const plan = planWorldMapRenderLayers({
    objects: [projected.render],
    layerOverrides: { [projected.id]: projected.renderLayers },
    view: { x: 0, y: 0, width: 400, height: 400 },
    margin: 0,
    state: { active: true },
    characters: [{ key: 'local-player', sortY: 300, node: 'player' }],
  })
  assert.deepEqual(WORLD_MAP_RENDER_BAND_ORDER, [
    'terrain', 'environment', 'ground', 'world', 'object-foreground', 'global-foreground', 'overlay', 'interaction-debug',
  ])
  assert.deepEqual(plan.ground.map(entry => entry.layerId), ['site-ground'])
  assert.deepEqual(plan.world.map(entry => [entry.stableKey, entry.layerId]), [
    ['fixture-layered-building', 'body'],
    ['fixture-layered-building', 'body-trim'],
    ['local-player', ''],
  ])
  assert.deepEqual(plan.foreground.map(entry => entry.layerId), ['front-occluder'])
  assert.deepEqual(plan.overlay.map(entry => entry.layerId), ['optional-effect'])
  assert.equal(plan.metrics.fallbackItemCount, 0)
  assert.equal(plan.metrics.overrideItemCount, 5)
  assert.equal([...plan.ground, ...plan.world, ...plan.foreground, ...plan.overlay]
    .filter(entry => entry.type === 'object-layer' && entry.item.source === 'legacy').length, 0)
})

test('planner atomically culls native layers by object union bounds', () => {
  const projected = projectedFixture()
  const overrides = { [projected.id]: projected.renderLayers }
  const outside = planWorldMapRenderLayers({
    objects: [projected.render], layerOverrides: overrides, view: { x: 220, y: 140, width: 20, height: 20 }, margin: 0,
  })
  assert.equal(outside.metrics.objectCullCount, 1)
  assert.equal(outside.metrics.layerCullCount, 0)

  const partial = planWorldMapRenderLayers({
    objects: [projected.render], layerOverrides: overrides, view: { x: 80, y: 200, width: 20, height: 20 }, margin: 0,
  })
  assert.deepEqual(partial.ground.map(entry => entry.layerId), ['site-ground'])
  assert.deepEqual(partial.world.map(entry => entry.layerId), ['body', 'body-trim'])
  assert.deepEqual(partial.foreground.map(entry => entry.layerId), ['front-occluder'])
  assert.equal(partial.metrics.layerCullCount, 0)
  assert.equal(halfOpenRectsIntersect(
    { left: 0, top: 0, right: 10, bottom: 10 },
    { left: 10, top: 0, right: 20, bottom: 10 },
  ), false)
})

test('QA defaults and declarative state visibility preserve clean and inspection semantics', () => {
  const projected = projectedFixture()
  const overrides = { [projected.id]: projected.renderLayers }
  const base = { objects: [projected.render], layerOverrides: overrides, view: { x: 0, y: 0, width: 400, height: 400 }, margin: 0 }
  assert.equal(planWorldMapRenderLayers(base).overlay.length, 0)
  assert.equal(planWorldMapRenderLayers({ ...base, state: { active: true } }).overlay.length, 1)
  assert.equal(planWorldMapRenderLayers({ ...base, mode: 'foreground' }).foreground.length, 1)
  assert.equal(planWorldMapRenderLayers({ ...base, mode: 'foreground' }).world.length, 0)
  assert.equal(planWorldMapRenderLayers({ ...base, clean: true, state: { active: true } }).overlay.length, 0)
  assert.equal(renderLayerVisibleWhenMatches({ qaModes: ['objects'], state: { active: true } }, { mode: 'all', state: { active: true } }), false)

  const inspection = { ...projected.render, id: 'fixture-inspection', layer: 'inspection' }
  assert.equal(planWorldMapRenderLayers({ ...base, objects: [inspection], layerOverrides: {} }).world.length, 0)
  assert.equal(planWorldMapRenderLayers({ ...base, objects: [inspection], layerOverrides: {}, mode: 'objects' }).world.length, 1)
})

test('collision projection is independent of visual layer count and never derives from alpha', () => {
  const oneLayer = clone(library)
  const manyLayers = clone(library)
  manyLayers.visual.layers.push({
    id: 'non-collision-overlay',
    role: 'overlay',
    assetId: 'landmark-lab',
    rect: { left: 0, top: 0, right: 10, bottom: 10 },
    renderBand: 'overlay',
    visibleWhen: { state: { active: true } },
  })
  assert.deepEqual(
    projectNativeWorldObjectCandidate(oneLayer, legacy).collisionObjects,
    projectNativeWorldObjectCandidate(manyLayers, legacy).collisionObjects,
  )
  manyLayers.collision.generatedFrom = 'visual-alpha'
  assert.throws(() => projectNativeWorldObjectCandidate(manyLayers, legacy), /visual alpha is never a collision source/)
})
