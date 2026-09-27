import {
  WORLD_COLLISION_ROLES,
  validateCollisionObjects,
} from './worldMapCollisionContract.mjs'

export const WORLD_OBJECT_SCHEMA_VERSION = 1

export const WORLD_OBJECT_KINDS = Object.freeze([
  'baked-ground',
  'static-decoration-cluster',
  'landmark',
  'building',
  'prop',
  'occluder',
  'effect',
])

export const WORLD_OBJECT_VISUAL_ROLES = Object.freeze([
  'ground',
  'body',
  'foreground',
  'occluder',
  'overlay',
  'effect',
])

export const WORLD_OBJECT_RENDER_BANDS = Object.freeze([
  'ground',
  'world',
  'foreground',
  'overlay',
])

export const WORLD_OBJECT_QA_MODES = Object.freeze([
  'all',
  'objects',
  'foreground',
  'collision',
  'reference',
  'clean',
])

export const WORLD_OBJECT_DEPTH_MODES = Object.freeze([
  'ground-contact',
  'fixed-band',
  'none',
])

export const WORLD_OBJECT_BUILD_ONLY_FIELDS = Object.freeze(['provenance'])
export const WORLD_OBJECT_MIGRATION_ONLY_FIELDS = Object.freeze([
  'depth.legacySortY',
  'collision.colliders[].space=world',
])

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const pathFor = (object, path) => `${object?.id ? `WorldObject ${object.id}` : 'WorldObject'} at ${path}`

function fail(object, path, message) {
  throw new Error(`${pathFor(object, path)}: ${message}`)
}

function requireObject(value, object, path) {
  if (!isObject(value)) fail(object, path, 'must be an object')
  return value
}

function requireString(value, object, path) {
  if (typeof value !== 'string' || value.length === 0) fail(object, path, 'must be a non-empty string')
  return value
}

function requireFinite(value, object, path) {
  if (!Number.isFinite(value)) fail(object, path, 'must be a finite number')
  return value
}

function requireEnum(value, allowed, object, path) {
  if (!allowed.includes(value)) fail(object, path, `must be one of: ${allowed.join(', ')}`)
  return value
}

function validatePointCoordinates(point, object, path) {
  requireObject(point, object, path)
  requireFinite(point.x, object, `${path}.x`)
  requireFinite(point.y, object, `${path}.y`)
  return point
}

function validateSpacedPoint(point, object, path) {
  requireObject(point, object, path)
  requireEnum(point.space, ['world', 'object-local'], object, `${path}.space`)
  validatePointCoordinates(point, object, path)
  return point
}

function validateRect(rect, object, path) {
  requireObject(rect, object, path)
  requireFinite(rect.left, object, `${path}.left`)
  requireFinite(rect.top, object, `${path}.top`)
  requireFinite(rect.right, object, `${path}.right`)
  requireFinite(rect.bottom, object, `${path}.bottom`)
  if (!(rect.left < rect.right)) fail(object, path, 'must use half-open bounds with left < right')
  if (!(rect.top < rect.bottom)) fail(object, path, 'must use half-open bounds with top < bottom')
  return rect
}

function assertDeclarative(value, object, path, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    requireFinite(value, object, path)
    return
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint' || typeof value === 'undefined') {
    fail(object, path, 'must contain only JSON/MJS-serializable declarative values')
  }
  if (ancestors.has(value)) fail(object, path, 'must not contain circular references')
  ancestors.add(value)
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertDeclarative(entry, object, `${path}[${index}]`, ancestors))
  } else {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) fail(object, path, 'must contain only plain objects and arrays')
    for (const [key, entry] of Object.entries(value)) assertDeclarative(entry, object, `${path}.${key}`, ancestors)
  }
  ancestors.delete(value)
}

function validateShape(shape, object, path) {
  requireObject(shape, object, path)
  if (shape.type === 'rect') return validateRect(shape, object, path)
  if (shape.type !== 'polygon') fail(object, `${path}.type`, 'must be rect or polygon')
  if (!Array.isArray(shape.points) || shape.points.length < 3) fail(object, `${path}.points`, 'must contain at least 3 points')
  shape.points.forEach((point, index) => {
    if (!Array.isArray(point) || point.length !== 2) fail(object, `${path}.points[${index}]`, 'must be an [x, y] pair')
    requireFinite(point[0], object, `${path}.points[${index}][0]`)
    requireFinite(point[1], object, `${path}.points[${index}][1]`)
  })
  return shape
}

function transformLocalPoint(object, point) {
  const scale = object.transform.scale
  const x = (point.x - object.anchor.x) * scale.x
  const y = (point.y - object.anchor.y) * scale.y
  const radians = object.transform.rotationDeg * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: object.transform.position.x + x * cos - y * sin,
    y: object.transform.position.y + x * sin + y * cos,
  }
}

export function projectWorldObjectPoint(object, point) {
  validateSpacedPoint(point, object, 'point')
  if (point.space === 'world') return { x: point.x, y: point.y }
  return transformLocalPoint(object, point)
}

export function unionWorldObjectLayerRects(layers) {
  if (!Array.isArray(layers) || layers.length === 0) return null
  return layers.reduce((bounds, layer) => ({
    left: Math.min(bounds.left, layer.rect.left),
    top: Math.min(bounds.top, layer.rect.top),
    right: Math.max(bounds.right, layer.rect.right),
    bottom: Math.max(bounds.bottom, layer.rect.bottom),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
}

export function projectWorldObjectLayerRect(object, layer) {
  const corners = [
    { x: layer.rect.left, y: layer.rect.top },
    { x: layer.rect.right, y: layer.rect.top },
    { x: layer.rect.right, y: layer.rect.bottom },
    { x: layer.rect.left, y: layer.rect.bottom },
  ].map(point => transformLocalPoint(object, point))
  return {
    left: Math.min(...corners.map(point => point.x)),
    top: Math.min(...corners.map(point => point.y)),
    right: Math.max(...corners.map(point => point.x)),
    bottom: Math.max(...corners.map(point => point.y)),
  }
}

export function deriveWorldObjectVisualBounds(object) {
  const local = unionWorldObjectLayerRects(object.visual.layers)
  if (!local) return null
  const corners = [
    { x: local.left, y: local.top },
    { x: local.right, y: local.top },
    { x: local.right, y: local.bottom },
    { x: local.left, y: local.bottom },
  ].map(point => transformLocalPoint(object, point))
  return {
    left: Math.min(...corners.map(point => point.x)),
    top: Math.min(...corners.map(point => point.y)),
    right: Math.max(...corners.map(point => point.x)),
    bottom: Math.max(...corners.map(point => point.y)),
  }
}

function equalRect(a, b) {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom
}

function validateVisual(object) {
  const visual = requireObject(object.visual, object, 'visual')
  if (!Array.isArray(visual.layers)) fail(object, 'visual.layers', 'must be an array')
  const layerIds = new Set()
  visual.layers.forEach((layer, index) => {
    const path = `visual.layers[${index}]`
    requireObject(layer, object, path)
    requireString(layer.id, object, `${path}.id`)
    if (layerIds.has(layer.id)) fail(object, `${path}.id`, `duplicate layer ID ${layer.id}`)
    layerIds.add(layer.id)
    requireEnum(layer.role, WORLD_OBJECT_VISUAL_ROLES, object, `${path}.role`)
    requireString(layer.assetId, object, `${path}.assetId`)
    validateRect(layer.rect, object, `${path}.rect`)
    requireEnum(layer.renderBand, WORLD_OBJECT_RENDER_BANDS, object, `${path}.renderBand`)
    if (hasOwn(layer, 'sortOffsetY')) requireFinite(layer.sortOffsetY, object, `${path}.sortOffsetY`)
    if (hasOwn(layer, 'visibleWhen')) {
      const visibleWhen = requireObject(layer.visibleWhen, object, `${path}.visibleWhen`)
      assertDeclarative(visibleWhen, object, `${path}.visibleWhen`)
      for (const key of Object.keys(visibleWhen)) {
        if (!['qaModes', 'state'].includes(key)) fail(object, `${path}.visibleWhen.${key}`, 'is not a supported declarative visibility condition')
      }
      if (!hasOwn(visibleWhen, 'qaModes') && !hasOwn(visibleWhen, 'state')) fail(object, `${path}.visibleWhen`, 'must declare qaModes and/or state')
      if (hasOwn(visibleWhen, 'qaModes')) {
        if (!Array.isArray(visibleWhen.qaModes) || visibleWhen.qaModes.length === 0) fail(object, `${path}.visibleWhen.qaModes`, 'must be a non-empty array')
        const modes = new Set()
        visibleWhen.qaModes.forEach((mode, modeIndex) => {
          requireEnum(mode, WORLD_OBJECT_QA_MODES, object, `${path}.visibleWhen.qaModes[${modeIndex}]`)
          if (modes.has(mode)) fail(object, `${path}.visibleWhen.qaModes[${modeIndex}]`, `duplicate QA mode ${mode}`)
          modes.add(mode)
        })
      }
      if (hasOwn(visibleWhen, 'state')) requireObject(visibleWhen.state, object, `${path}.visibleWhen.state`)
    }
    if (layer.renderBand === 'overlay' && (!layer.visibleWhen || !hasOwn(layer.visibleWhen, 'state'))) {
      fail(object, `${path}.visibleWhen.state`, 'is required for overlay layers')
    }
  })

  const bounds = requireObject(visual.bounds, object, 'visual.bounds')
  if (bounds.mode !== 'generated-layer-union') fail(object, 'visual.bounds.mode', 'must be generated-layer-union; manual bounds are not allowed')
  if (hasOwn(bounds, 'rect')) {
    validateRect(bounds.rect, object, 'visual.bounds.rect')
    const generated = unionWorldObjectLayerRects(visual.layers)
    if (!generated || !equalRect(bounds.rect, generated)) fail(object, 'visual.bounds.rect', 'must exactly match the generated layer union')
  }
}

function validateGroundContactAndDepth(object, options) {
  if (object.groundContact !== null) {
    requireObject(object.groundContact, object, 'groundContact')
    requireEnum(object.groundContact.space, ['world', 'object-local'], object, 'groundContact.space')
    validatePointCoordinates(object.groundContact.point, object, 'groundContact.point')
    if (hasOwn(object.groundContact, 'confidence')) requireString(object.groundContact.confidence, object, 'groundContact.confidence')
  }

  const depth = requireObject(object.depth, object, 'depth')
  requireEnum(depth.mode, WORLD_OBJECT_DEPTH_MODES, object, 'depth.mode')
  if (hasOwn(depth, 'sortOffsetY')) requireFinite(depth.sortOffsetY, object, 'depth.sortOffsetY')
  if (depth.mode === 'ground-contact' && object.groundContact === null) fail(object, 'groundContact', 'is required when depth.mode is ground-contact')
  if (hasOwn(depth, 'legacySortY')) {
    requireFinite(depth.legacySortY, object, 'depth.legacySortY')
    if (options.profile === 'native') fail(object, 'depth.legacySortY', 'is migration-only and is forbidden in the native profile')
  }
}

export function deriveWorldObjectSortY(object) {
  if (hasOwn(object.depth, 'legacySortY')) return object.depth.legacySortY
  if (object.depth.mode !== 'ground-contact') return null
  const groundContact = projectWorldObjectPoint(object, {
    space: object.groundContact.space,
    ...object.groundContact.point,
  })
  return groundContact.y + (object.depth.sortOffsetY ?? 0)
}

function projectShape(object, collider, shape) {
  if (collider.space === 'world') {
    if (shape.type === 'rect') return { ...shape }
    return { type: 'polygon', points: shape.points.map(point => [...point]) }
  }
  if (shape.type === 'polygon') {
    return {
      type: 'polygon',
      points: shape.points.map(([x, y]) => {
        const point = transformLocalPoint(object, { x, y })
        return [point.x, point.y]
      }),
    }
  }
  const topLeft = transformLocalPoint(object, { x: shape.left, y: shape.top })
  const bottomRight = transformLocalPoint(object, { x: shape.right, y: shape.bottom })
  return { type: 'rect', left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y }
}

export function projectWorldObjectColliders(object) {
  if (object.collision.mode === 'none') return []
  return object.collision.colliders.map(collider => ({
    objectId: object.id,
    colliderId: collider.colliderId,
    collisionRole: collider.collisionRole,
    shapes: collider.shapes.map(shape => projectShape(object, collider, shape)),
  }))
}

function validateCollision(object, options) {
  const collision = requireObject(object.collision, object, 'collision')
  requireEnum(collision.mode, ['none', 'authored'], object, 'collision.mode')
  if (hasOwn(collision, 'generated') || hasOwn(collision, 'generatedFrom') || hasOwn(collision, 'generatedColliders')) {
    fail(object, 'collision', 'cannot declare authored and generated collision authority together; visual alpha is never a collision source')
  }
  if (collision.mode === 'none') {
    if (Array.isArray(collision.colliders) && collision.colliders.length > 0) fail(object, 'collision.colliders', 'must be empty when collision.mode is none')
    return
  }
  if (!Array.isArray(collision.colliders) || collision.colliders.length === 0) fail(object, 'collision.colliders', 'must contain at least one collider')
  if (object.transform.rotationDeg !== 0) fail(object, 'transform.rotationDeg', 'collision objects require rotationDeg=0 in schema v1')
  if (object.transform.scale.x !== 1 || object.transform.scale.y !== 1) fail(object, 'transform.scale', 'collision objects require scale x=1 and y=1 in schema v1')

  collision.colliders.forEach((collider, index) => {
    const path = `collision.colliders[${index}]`
    requireObject(collider, object, path)
    requireString(collider.colliderId, object, `${path}.colliderId`)
    requireEnum(collider.collisionRole, WORLD_COLLISION_ROLES, object, `${path}.collisionRole`)
    requireEnum(collider.space, ['world', 'object-local'], object, `${path}.space`)
    if (options.profile === 'native' && collider.space === 'world') fail(object, `${path}.space`, 'world-space colliders are migration-only and forbidden in the native profile')
    if (!Array.isArray(collider.shapes) || collider.shapes.length === 0) fail(object, `${path}.shapes`, 'must contain at least one shape')
    collider.shapes.forEach((shape, shapeIndex) => validateShape(shape, object, `${path}.shapes[${shapeIndex}]`))
  })

  try {
    validateCollisionObjects(projectWorldObjectColliders(object))
  } catch (error) {
    fail(object, 'collision.colliders', `existing collision validator rejected projection: ${error.message}`)
  }
}

function validateInteraction(object) {
  if (object.interaction === null) return
  const interaction = requireObject(object.interaction, object, 'interaction')
  requireString(interaction.type, object, 'interaction.type')
  requireString(interaction.destinationId, object, 'interaction.destinationId')
  if (!Array.isArray(interaction.legacyIds)) fail(object, 'interaction.legacyIds', 'must be an array')
  const aliases = new Set()
  interaction.legacyIds.forEach((alias, index) => {
    requireString(alias, object, `interaction.legacyIds[${index}]`)
    if (aliases.has(alias)) fail(object, `interaction.legacyIds[${index}]`, `duplicate legacy alias ${alias}`)
    aliases.add(alias)
  })
  validateSpacedPoint(interaction.point, object, 'interaction.point')
  const activation = requireObject(interaction.activation, object, 'interaction.activation')
  if (activation.type !== 'axis-distance') fail(object, 'interaction.activation.type', 'must be axis-distance')
  requireFinite(activation.halfWidth, object, 'interaction.activation.halfWidth')
  requireFinite(activation.halfHeight, object, 'interaction.activation.halfHeight')
  if (activation.halfWidth < 0 || activation.halfHeight < 0) fail(object, 'interaction.activation', 'half extents must be non-negative')
  if (activation.inclusive !== true) fail(object, 'interaction.activation.inclusive', 'must be true to preserve inclusive activation boundaries')
}

function validateNavigation(object) {
  const navigation = requireObject(object.navigation, object, 'navigation')
  if (navigation.approachPoint !== null) {
    const approach = requireObject(navigation.approachPoint, object, 'navigation.approachPoint')
    if (approach.mode !== 'from-interaction-point') fail(object, 'navigation.approachPoint.mode', 'must derive from-interaction-point')
    if (object.interaction === null) fail(object, 'navigation.approachPoint', 'requires interaction.point')
    if (hasOwn(approach, 'offset')) validatePointCoordinates(approach.offset, object, 'navigation.approachPoint.offset')
  }
  if (navigation.route !== null) {
    const route = requireObject(navigation.route, object, 'navigation.route')
    if (route.mode !== 'generated-from-walkable-clearance-mask') fail(object, 'navigation.route.mode', 'must be generated-from-walkable-clearance-mask')
  }
  if (navigation.guidePath !== null) {
    const guide = requireObject(navigation.guidePath, object, 'navigation.guidePath')
    requireEnum(guide.space, ['world', 'object-local'], object, 'navigation.guidePath.space')
    if (!Array.isArray(guide.points) || guide.points.length < 2) fail(object, 'navigation.guidePath.points', 'must contain at least 2 guide points')
    guide.points.forEach((point, index) => validatePointCoordinates(point, object, `navigation.guidePath.points[${index}]`))
    if (hasOwn(guide, 'mode') && guide.mode !== 'authored-guide') fail(object, 'navigation.guidePath.mode', 'must be authored-guide and never an actual walkable route')
  }
}

export function deriveWorldObjectApproachPoint(object) {
  if (object.navigation.approachPoint === null) return null
  const point = projectWorldObjectPoint(object, object.interaction.point)
  const offset = object.navigation.approachPoint.offset ?? { x: 0, y: 0 }
  return { x: point.x + offset.x, y: point.y + offset.y }
}

function validateMinimap(object) {
  const minimap = requireObject(object.minimap, object, 'minimap')
  if (typeof minimap.visible !== 'boolean') fail(object, 'minimap.visible', 'must be a boolean')
  if (minimap.point !== null) {
    const point = requireObject(minimap.point, object, 'minimap.point')
    if (point.mode !== 'from-navigation-approach') fail(object, 'minimap.point.mode', 'must derive from-navigation-approach')
    if (object.navigation.approachPoint === null) fail(object, 'minimap.point', 'requires navigation.approachPoint')
    if (hasOwn(point, 'offset')) validatePointCoordinates(point.offset, object, 'minimap.point.offset')
  }
  if (minimap.visible) {
    if (minimap.point === null) fail(object, 'minimap.point', 'is required when minimap.visible is true')
    requireString(minimap.label, object, 'minimap.label')
    requireString(minimap.icon, object, 'minimap.icon')
    requireString(minimap.color, object, 'minimap.color')
  }
}

export function deriveWorldObjectMinimapPoint(object) {
  if (object.minimap.point === null) return null
  const approach = deriveWorldObjectApproachPoint(object)
  const offset = object.minimap.point.offset ?? { x: 0, y: 0 }
  return { x: approach.x + offset.x, y: approach.y + offset.y }
}

function validateProvenance(object) {
  const provenance = requireObject(object.provenance, object, 'provenance')
  if (hasOwn(provenance, 'sourceAssets')) {
    if (!Array.isArray(provenance.sourceAssets) || provenance.sourceAssets.length === 0) fail(object, 'provenance.sourceAssets', 'must be a non-empty array')
    provenance.sourceAssets.forEach((source, index) => {
      const path = `provenance.sourceAssets[${index}]`
      requireObject(source, object, path)
      requireString(source.path, object, `${path}.path`)
      if (hasOwn(source, 'crop')) validateRect(source.crop, object, `${path}.crop`)
    })
  }
  if (hasOwn(provenance, 'generator')) requireString(provenance.generator, object, 'provenance.generator')
  if (hasOwn(provenance, 'registration')) assertDeclarative(provenance.registration, object, 'provenance.registration')
  if (hasOwn(provenance, 'contentHash')) requireString(provenance.contentHash, object, 'provenance.contentHash')
  if (hasOwn(provenance, 'sourceNote')) requireString(provenance.sourceNote, object, 'provenance.sourceNote')
}

export function assertWorldObjectRuntimeProjection(value) {
  const visit = (entry, path, ancestors) => {
    if (entry === null || typeof entry !== 'object') return
    if (ancestors.has(entry)) throw new Error(`Runtime projection at ${path} must not contain circular references`)
    ancestors.add(entry)
    if (!Array.isArray(entry) && hasOwn(entry, 'provenance')) throw new Error(`Runtime projection at ${path}.provenance contains build-only provenance`)
    if (Array.isArray(entry)) entry.forEach((item, index) => visit(item, `${path}[${index}]`, ancestors))
    else Object.entries(entry).forEach(([key, item]) => visit(item, `${path}.${key}`, ancestors))
    ancestors.delete(entry)
  }
  visit(value, '$', new Set())
  return value
}

export function validateWorldObject(object, options = {}) {
  requireObject(object, object, '$')
  assertDeclarative(object, object, '$')
  if (object.schemaVersion !== WORLD_OBJECT_SCHEMA_VERSION) fail(object, 'schemaVersion', `must equal ${WORLD_OBJECT_SCHEMA_VERSION}`)
  requireString(object.id, object, 'id')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(object.id)) fail(object, 'id', 'must be a kebab-case identifier')
  requireEnum(object.kind, WORLD_OBJECT_KINDS, object, 'kind')

  const transform = requireObject(object.transform, object, 'transform')
  validatePointCoordinates(transform.position, object, 'transform.position')
  requireFinite(transform.rotationDeg, object, 'transform.rotationDeg')
  const scale = requireObject(transform.scale, object, 'transform.scale')
  requireFinite(scale.x, object, 'transform.scale.x')
  requireFinite(scale.y, object, 'transform.scale.y')
  if (scale.x <= 0 || scale.y <= 0) fail(object, 'transform.scale', 'must be positive')

  const anchor = requireObject(object.anchor, object, 'anchor')
  if (anchor.space !== 'object-local') fail(object, 'anchor.space', 'must be object-local')
  requireFinite(anchor.x, object, 'anchor.x')
  requireFinite(anchor.y, object, 'anchor.y')
  if (hasOwn(anchor, 'meaning')) requireString(anchor.meaning, object, 'anchor.meaning')

  const normalizedOptions = { profile: options.profile ?? 'migration' }
  if (!['migration', 'native'].includes(normalizedOptions.profile)) fail(object, 'validation.profile', 'must be migration or native')
  validateVisual(object)
  validateGroundContactAndDepth(object, normalizedOptions)
  validateCollision(object, normalizedOptions)
  validateInteraction(object)
  validateNavigation(object)
  validateMinimap(object)
  requireObject(object.state, object, 'state')
  assertDeclarative(object.state, object, 'state')
  validateProvenance(object)
  return object
}

export function validateWorldObjectSet(objects, options = {}) {
  if (!Array.isArray(objects)) throw new Error('WorldObject set must be an array')
  const objectIds = new Set()
  const colliderIds = new Map()
  const projectedColliders = []
  for (const object of objects) {
    validateWorldObject(object, options)
    if (objectIds.has(object.id)) fail(object, 'id', `duplicate object ID ${object.id}`)
    objectIds.add(object.id)
    for (const collider of projectWorldObjectColliders(object)) {
      if (colliderIds.has(collider.colliderId)) {
        fail(object, 'collision.colliders', `duplicate collider ID ${collider.colliderId}; first declared by ${colliderIds.get(collider.colliderId)}`)
      }
      colliderIds.set(collider.colliderId, object.id)
      projectedColliders.push(collider)
    }
  }
  validateCollisionObjects(projectedColliders)
  return objects
}
