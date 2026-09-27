export const WORLD_MAP_RENDER_BAND_ORDER = Object.freeze([
  'terrain',
  'environment',
  'ground',
  'world',
  'object-foreground',
  'global-foreground',
  'overlay',
  'interaction-debug',
])

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

function itemBounds(item) {
  return {
    left: item.x,
    top: item.y,
    right: item.x + item.width,
    bottom: item.y + item.height,
  }
}

export function halfOpenRectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function expandedView(view, margin) {
  if (!view) return null
  return {
    left: view.x - margin,
    top: view.y - margin,
    right: view.x + view.width + margin,
    bottom: view.y + view.height + margin,
  }
}

export function renderLayerVisibleWhenMatches(visibleWhen, { mode = 'all', state = {} } = {}) {
  if (visibleWhen === null || visibleWhen === undefined) return true
  if (visibleWhen.qaModes && !visibleWhen.qaModes.includes(mode)) return false
  if (visibleWhen.state) {
    for (const [key, expected] of Object.entries(visibleWhen.state)) {
      if (state[key] !== expected) return false
    }
  }
  return true
}

export function legacyObjectToRenderItem(object) {
  return {
    objectId: object.id,
    layerId: 'legacy-flat',
    role: 'body',
    renderBand: 'world',
    assetId: object.assetId,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    sortY: object.sortY,
    sortOffsetY: 0,
    visibleWhen: null,
    layer: object.layer,
    source: 'legacy',
  }
}

function isVisibleInMode(item, { mode, clean, state }) {
  if (clean) return false
  if (!renderLayerVisibleWhenMatches(item.visibleWhen, { mode, state })) return false
  if (item.layer === 'inspection') return mode === 'objects'
  if (item.renderBand === 'ground' || item.renderBand === 'world') return mode === 'all' || mode === 'objects'
  if (item.renderBand === 'foreground') return mode === 'all' || mode === 'foreground'
  if (item.renderBand === 'overlay') {
    return item.visibleWhen !== null && item.visibleWhen !== undefined && (mode === 'all' || mode === 'objects')
  }
  return false
}

function compareRenderEntries(a, b) {
  return a.sortY - b.sortY
    || a.stableKey.localeCompare(b.stableKey)
    || a.layerId.localeCompare(b.layerId)
}

function objectQueueEntry(item) {
  return {
    key: `${item.objectId}:${item.layerId}`,
    stableKey: item.objectId,
    layerId: item.layerId,
    sortY: item.sortY,
    type: 'object-layer',
    item,
  }
}

function characterQueueEntry(character) {
  return {
    ...character,
    stableKey: character.key,
    layerId: '',
    type: 'character',
  }
}

export function planWorldMapRenderLayers({
  objects,
  layerOverrides = {},
  view = null,
  margin = 180,
  mode = 'all',
  clean = false,
  state = {},
  characters = [],
}) {
  const viewport = expandedView(view, margin)
  const bands = { ground: [], world: [], foreground: [], overlay: [] }
  let objectCullCount = 0
  let layerCullCount = 0
  let fallbackItemCount = 0
  let overrideItemCount = 0

  for (const object of objects) {
    if (object.layer === 'environment') continue
    if (viewport && !halfOpenRectsIntersect(itemBounds(object), viewport)) {
      objectCullCount += 1
      continue
    }
    const hasOverride = hasOwn(layerOverrides, object.id)
    const items = hasOverride
      ? layerOverrides[object.id].map(item => ({ ...item, source: 'override' }))
      : [legacyObjectToRenderItem(object)]
    if (hasOverride) overrideItemCount += items.length
    else fallbackItemCount += 1

    for (const item of items) {
      // Native multi-layer objects cull atomically by their generated union
      // bounds above. Per-layer culling can otherwise leave a ground layer on
      // screen for a frame after its body has disappeared at a camera edge.
      if (viewport && !hasOverride && !halfOpenRectsIntersect(itemBounds(item), viewport)) {
        layerCullCount += 1
        continue
      }
      if (!isVisibleInMode(item, { mode, clean, state })) continue
      bands[item.renderBand].push(item)
    }
  }

  const stableSort = items => items.map(objectQueueEntry).sort(compareRenderEntries)
  const worldQueue = [
    ...bands.world.map(objectQueueEntry),
    ...(mode === 'all' && !clean ? characters.map(characterQueueEntry) : []),
  ].sort(compareRenderEntries)

  return {
    ground: stableSort(bands.ground),
    world: worldQueue,
    foreground: stableSort(bands.foreground),
    overlay: stableSort(bands.overlay),
    metrics: {
      objectCullCount,
      layerCullCount,
      fallbackItemCount,
      overrideItemCount,
    },
  }
}
