import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  WORLD_MAP_V4_DESTINATIONS,
  WORLD_MAP_V4_OBJECTS,
  WORLD_MAP_V4_PATHS,
  WORLD_MAP_V4_SPATIAL_INDEX,
  objectBounds,
} from './worldMapV4Manifest.mjs'
import { WORLD_MAP_V4_ASSETS } from './worldMapV4Assets.mjs'
import { WORLD_MAP_V4_COLLISION_OBJECTS } from './worldMapCollision.mjs'
import {
  WORLD_DESTINATIONS,
  worldDestinationInteractionPoint,
} from './worldMapGeometry.mjs'
import { WORLD_MINIMAP_DESTINATIONS } from './worldMapMinimap.mjs'
import { getWorldNavigationRoute } from './worldMapNavigation.mjs'
import {
  assertWorldObjectRuntimeProjection,
  deriveWorldObjectApproachPoint,
  deriveWorldObjectMinimapPoint,
  deriveWorldObjectSortY,
  deriveWorldObjectVisualBounds,
  projectWorldObjectColliders,
  projectWorldObjectPoint,
  unionWorldObjectLayerRects,
  validateWorldObject,
  validateWorldObjectSet,
} from './worldMapObjectSchema.mjs'

const clone = value => structuredClone(value)
const libraryRender = WORLD_MAP_V4_OBJECTS.find(object => object.id === 'landmark-library')
const libraryCollider = WORLD_MAP_V4_COLLISION_OBJECTS.find(object => object.objectId === 'landmark-library')
const libraryDestination = WORLD_DESTINATIONS.find(destination => destination.id === 'Sound Library')
const libraryMinimap = WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === 'Sound Library')
const libraryPath = WORLD_MAP_V4_PATHS.find(path => path.id === 'spoke-library')
const libraryRoute = getWorldNavigationRoute('Sound Library')
const assetManifest = JSON.parse(readFileSync(new URL('../public/assets/world/sound-archive-garden-v4/asset-manifest.json', import.meta.url)))
const librarySemantic = assetManifest.semanticLayers.find(object => object.id === 'landmark-library')
const librarySource = assetManifest.assets.find(object => object.id === 'landmark-library')

function libraryFixture() {
  return {
    schemaVersion: 1,
    id: 'landmark-library',
    kind: 'landmark',
    transform: {
      position: { x: libraryRender.x, y: libraryRender.y },
      rotationDeg: 0,
      scale: { x: 1, y: 1 },
    },
    anchor: { space: 'object-local', x: libraryRender.anchorX, y: libraryRender.anchorY, meaning: 'legacy-visual-top-left' },
    visual: {
      layers: [{
        id: 'body',
        role: 'body',
        assetId: libraryRender.assetId,
        rect: { left: 0, top: 0, right: libraryRender.width, bottom: libraryRender.height },
        renderBand: 'world',
        sortOffsetY: 0,
      }],
      bounds: { mode: 'generated-layer-union' },
    },
    groundContact: {
      space: 'world',
      point: { x: worldDestinationInteractionPoint(libraryDestination.target).x, y: libraryRender.sortY },
      confidence: 'legacy-derived',
    },
    depth: { mode: 'ground-contact', sortOffsetY: 0, legacySortY: libraryRender.sortY },
    collision: {
      mode: 'authored',
      colliders: [{
        colliderId: libraryCollider.colliderId,
        collisionRole: libraryCollider.collisionRole,
        space: 'world',
        shapes: clone(libraryCollider.shapes),
      }],
    },
    interaction: {
      type: 'museum',
      destinationId: 'sound-library',
      legacyIds: [libraryRender.interaction.id, libraryRender.portalId],
      point: { space: 'world', ...worldDestinationInteractionPoint(libraryDestination.target) },
      activation: { type: 'axis-distance', halfWidth: 64, halfHeight: 48, inclusive: true },
    },
    navigation: {
      approachPoint: { mode: 'from-interaction-point' },
      route: { mode: 'generated-from-walkable-clearance-mask' },
      guidePath: { mode: 'authored-guide', space: 'world', points: clone(libraryPath.points) },
    },
    minimap: {
      visible: true,
      point: { mode: 'from-navigation-approach' },
      label: 'Sound Museum',
      icon: '🏛',
      color: '#C8A96E',
    },
    state: { visibility: { default: true, qaModes: ['all', 'objects'] }, variants: [] },
    provenance: {
      sourceAssets: [{
        path: 'design/concepts/world-map-reskin-2026-09-18/02-sound-archive-garden-hd-master.png',
        crop: { left: 1730, top: 1250, right: 4060, bottom: 2330 },
      }],
      generator: 'scripts/build-world-map-v4-assets.py',
      registration: { width: 2896, height: 2172, worldWidth: 3840, worldHeight: 2880 },
      sourceNote: librarySource.source,
    },
  }
}

function expectInvalid(mutator, pattern, options) {
  const object = libraryFixture()
  mutator(object)
  assert.throws(() => validateWorldObject(object, options), pattern)
}

test('representative Library fixture validates and locks production identities', () => {
  const object = libraryFixture()
  assert.equal(validateWorldObject(object), object)
  assert.deepEqual(object.interaction.legacyIds, ['Library', 'Sound Library'])
  assert.equal(librarySemantic.sortReferenceY, 1147)
  assert.equal(libraryRender.sortY, 1010 * (2880 / 2172))
  assert.notEqual(libraryRender.sortY, librarySemantic.sortReferenceY * (2880 / 2172))
  assert.deepEqual(WORLD_MAP_V4_DESTINATIONS.Library.approach, { x: 1918, y: 1438 })
  assert.deepEqual(WORLD_MAP_V4_ASSETS[libraryRender.assetId], {
    src: '/assets/world/sound-archive-garden-v4/runtime/landmark-library.webp',
    width: 1545,
    height: 717,
    hasAlpha: true,
    category: 'landmark',
    bytes: 249172,
    decodedRGBA: 4431060,
  })
})

test('visual layer union and world bounds reproduce the Library render rect', () => {
  const object = libraryFixture()
  assert.deepEqual(unionWorldObjectLayerRects(object.visual.layers), object.visual.layers[0].rect)
  assert.deepEqual(deriveWorldObjectVisualBounds(object), objectBounds(libraryRender))
  object.visual.bounds.rect = clone(object.visual.layers[0].rect)
  assert.equal(validateWorldObject(object), object)
})

test('world and object-local points project through anchor, scale and rotation', () => {
  const object = libraryFixture()
  object.collision = { mode: 'none', colliders: [] }
  object.transform = { position: { x: 100, y: 200 }, rotationDeg: 90, scale: { x: 2, y: 3 } }
  object.anchor = { space: 'object-local', x: 10, y: 20 }
  assert.deepEqual(projectWorldObjectPoint(object, { space: 'world', x: 7, y: 8 }), { x: 7, y: 8 })
  const projected = projectWorldObjectPoint(object, { space: 'object-local', x: 12, y: 22 })
  assert.ok(Math.abs(projected.x - 94) < 1e-9)
  assert.ok(Math.abs(projected.y - 204) < 1e-9)
})

test('groundContact derives sortY and legacySortY takes migration precedence', () => {
  const object = libraryFixture()
  delete object.depth.legacySortY
  object.depth.sortOffsetY = 7
  assert.equal(deriveWorldObjectSortY(object), libraryRender.sortY + 7)
  object.depth.legacySortY = libraryRender.sortY
  assert.equal(deriveWorldObjectSortY(object), libraryRender.sortY)
  assert.throws(() => validateWorldObject(object, { profile: 'native' }), /landmark-library.*depth\.legacySortY.*migration-only/)
})

test('native profile rejects migration-only world-space colliders', () => {
  const object = libraryFixture()
  delete object.depth.legacySortY
  assert.throws(() => validateWorldObject(object, { profile: 'native' }), /landmark-library.*collision\.colliders\[0\]\.space.*migration-only/)
})

test('WorldObject colliders project into the existing collision schema exactly', () => {
  assert.deepEqual(projectWorldObjectColliders(libraryFixture()), [libraryCollider])
})

test('object-local colliders inject objectId and transform into world space', () => {
  const object = libraryFixture()
  object.transform.position = { x: 100, y: 200 }
  object.anchor = { space: 'object-local', x: 10, y: 20 }
  object.collision.colliders[0].space = 'object-local'
  object.collision.colliders[0].shapes = [{ type: 'rect', left: 10, top: 20, right: 30, bottom: 50 }]
  assert.deepEqual(projectWorldObjectColliders(object), [{
    objectId: 'landmark-library',
    colliderId: 'library-body',
    collisionRole: 'building-body',
    shapes: [{ type: 'rect', left: 100, top: 200, right: 120, bottom: 230 }],
  }])
})

test('concave polygons and decorative-nonblocking colliders use the existing collision validator', () => {
  const object = libraryFixture()
  object.collision.colliders = [{
    colliderId: 'library-garden',
    collisionRole: 'decorative-nonblocking',
    space: 'world',
    shapes: [{ type: 'polygon', points: [[0, 0], [8, 0], [8, 8], [4, 4], [0, 8]] }],
  }]
  assert.equal(validateWorldObject(object), object)
})

test('interaction derives navigation approach and minimap points with distinct semantics', () => {
  const object = libraryFixture()
  assert.deepEqual(deriveWorldObjectApproachPoint(object), { x: 1918, y: 1438 })
  assert.deepEqual(deriveWorldObjectMinimapPoint(object), libraryMinimap.worldPoint)
  assert.deepEqual(libraryRoute.points.at(-1), deriveWorldObjectApproachPoint(object))
  assert.equal(object.navigation.guidePath.mode, 'authored-guide')
  assert.equal(object.navigation.route.mode, 'generated-from-walkable-clearance-mask')
})

test('Library keeps its current twelve spatial-index chunk keys', () => {
  const keys = [...WORLD_MAP_V4_SPATIAL_INDEX]
    .filter(([, objects]) => objects.some(object => object.id === 'landmark-library'))
    .map(([key]) => key)
  assert.deepEqual(keys, ['2,1', '3,1', '4,1', '5,1', '5,2', '5,3', '2,2', '3,2', '4,2', '2,3', '3,3', '4,3'])
})

test('duplicate object IDs fail with an object path', () => {
  const first = libraryFixture()
  const second = libraryFixture()
  assert.throws(() => validateWorldObjectSet([first, second]), /landmark-library.*id.*duplicate object ID/)
})

test('duplicate layer IDs fail', () => {
  expectInvalid(object => object.visual.layers.push(clone(object.visual.layers[0])), /landmark-library.*visual\.layers\[1\]\.id.*duplicate layer ID/)
})

test('duplicate collider IDs fail across the complete set', () => {
  const second = libraryFixture()
  second.id = 'landmark-library-annex'
  assert.throws(() => validateWorldObjectSet([libraryFixture(), second]), /landmark-library-annex.*collision\.colliders.*duplicate collider ID library-body/)
})

test('empty shapes fail', () => {
  expectInvalid(object => { object.collision.colliders[0].shapes = [] }, /landmark-library.*collision\.colliders\[0\]\.shapes.*at least one shape/)
})

test('invalid rects fail with half-open bounds guidance', () => {
  expectInvalid(object => { object.collision.colliders[0].shapes[0].right = 1728 }, /landmark-library.*shapes\[0\].*left < right/)
})

test('polygons require three valid points', () => {
  expectInvalid(object => { object.collision.colliders[0].shapes = [{ type: 'polygon', points: [[0, 0], [1, 1]] }] }, /landmark-library.*points.*at least 3/)
})

test('unknown collision roles fail', () => {
  expectInvalid(object => { object.collision.colliders[0].collisionRole = 'roof-alpha' }, /landmark-library.*collisionRole.*building-body/)
})

test('NaN and Infinity coordinates fail', () => {
  expectInvalid(object => { object.transform.position.x = Number.NaN }, /landmark-library.*transform\.position\.x.*finite/)
  expectInvalid(object => { object.interaction.point.y = Number.POSITIVE_INFINITY }, /landmark-library.*interaction\.point\.y.*finite/)
})

test('collision objects reject rotation and non-unit scale in v1', () => {
  expectInvalid(object => { object.transform.rotationDeg = 1 }, /landmark-library.*rotationDeg=0/)
  expectInvalid(object => { object.transform.scale.x = 2 }, /landmark-library.*scale x=1 and y=1/)
  expectInvalid(object => { object.transform.scale.y = 0.5 }, /landmark-library.*scale x=1 and y=1/)
})

test('ground-contact depth requires groundContact', () => {
  expectInvalid(object => { object.groundContact = null }, /landmark-library.*groundContact.*required/)
})

test('interaction requires a point', () => {
  expectInvalid(object => { delete object.interaction.point }, /landmark-library.*interaction\.point.*object/)
})

test('unknown visual roles and render bands fail', () => {
  expectInvalid(object => { object.visual.layers[0].role = 'sprite' }, /landmark-library.*visual\.layers\[0\]\.role/)
  expectInvalid(object => { object.visual.layers[0].renderBand = 'sky' }, /landmark-library.*visual\.layers\[0\]\.renderBand/)
})

test('manual or stale visual bounds fail', () => {
  expectInvalid(object => { object.visual.bounds = { mode: 'manual', rect: object.visual.layers[0].rect } }, /landmark-library.*visual\.bounds\.mode.*manual bounds/)
  expectInvalid(object => { object.visual.bounds.rect = { left: 0, top: 0, right: 10, bottom: 10 } }, /landmark-library.*visual\.bounds\.rect.*generated layer union/)
})

test('functions and React-like nodes are forbidden in authored state', () => {
  expectInvalid(object => { object.state.visibleWhen = () => true }, /landmark-library.*state\.visibleWhen.*declarative/)
  expectInvalid(object => { object.state.node = Object.create({ reactNode: true }) }, /landmark-library.*state\.node.*plain objects/)
})

test('invalid provenance crops fail', () => {
  expectInvalid(object => { object.provenance.sourceAssets[0].crop.bottom = 1200 }, /landmark-library.*provenance\.sourceAssets\[0\]\.crop.*top < bottom/)
})

test('authored and generated collision authority cannot coexist', () => {
  expectInvalid(object => { object.collision.generatedFrom = 'visual-alpha' }, /landmark-library.*collision.*authored and generated.*visual alpha/)
})

test('interaction remains inclusive while collision remains independently half-open', () => {
  const object = libraryFixture()
  assert.equal(object.interaction.activation.inclusive, true)
  assert.equal(object.interaction.activation.halfWidth, 64)
  assert.deepEqual(object.collision.colliders[0].shapes[0], { type: 'rect', left: 1728, top: 1184, right: 2112, bottom: 1398 })
})

test('runtime projection contract rejects build-only provenance', () => {
  const runtime = { id: 'landmark-library', visual: { assetId: 'landmark-library' } }
  assert.equal(assertWorldObjectRuntimeProjection(runtime), runtime)
  assert.throws(() => assertWorldObjectRuntimeProjection({ ...runtime, provenance: libraryFixture().provenance }), /build-only provenance/)
})
