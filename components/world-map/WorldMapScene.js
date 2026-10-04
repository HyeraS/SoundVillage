'use client'

import { useMemo } from 'react'
import {
  WORLD_MAP_V4,
  WORLD_MAP_V4_ASSET_MANIFEST,
  WORLD_MAP_V4_FOREGROUND,
  WORLD_MAP_V4_LAYER_OVERRIDES,
  WORLD_MAP_V4_OBJECTS,
  WORLD_MAP_V4_TERRAIN_PANELS,
  objectBounds,
  queryWorldMapObjects,
  queryWorldMapTerrainPanels,
} from '@/lib/worldMapV4Manifest.mjs'
import { WORLD_MAP_V4_PREVIEW } from '@/lib/worldMapV4Assets.mjs'
import { planWorldMapRenderLayers } from '@/lib/worldMapRenderLayers.mjs'

const REFERENCE_SRC = '/assets/world/sound-archive-garden-v2/world-base-clean.png'
const COLLISION_DEBUG_SRC = '/assets/world/sound-archive-garden-v4/collision-debug.png'

export function WorldMapTerrain({ camera, mode = 'all', onAssetLoad, onAssetError }) {
  if (mode === 'objects' || mode === 'foreground' || mode === 'collision') return null
  const panels = queryWorldMapTerrainPanels(camera, mode === 'all' ? 96 : 0)
  return <g data-layer="terrain" data-source="reference-registered-panels" data-total-panels={WORLD_MAP_V4_TERRAIN_PANELS.length} data-visible-panels={panels.length}>
    <image data-layer="terrain-preview" href={WORLD_MAP_V4_PREVIEW.src} x="0" y="0"
      width={WORLD_MAP_V4.width} height={WORLD_MAP_V4.height} preserveAspectRatio="none"/>
    {panels.map(panel => <image
      key={panel.id}
      data-terrain-id={panel.id}
      href={WORLD_MAP_V4_ASSET_MANIFEST[panel.assetId].src}
      x={panel.x}
      y={panel.y}
      width={panel.width}
      height={panel.height}
      preserveAspectRatio="none"
      onLoad={() => onAssetLoad?.(panel.assetId)}
      onError={(event) => { event.currentTarget.style.display = 'none'; onAssetError?.(panel.assetId) }}
    />)}
  </g>
}

function WorldObject({ object, onAssetLoad, onAssetError }) {
  const asset = WORLD_MAP_V4_ASSET_MANIFEST[object.assetId]
  if (!asset) return null
  const bounds = objectBounds(object)
  return <image
    data-object-id={object.id}
    data-asset-id={object.assetId}
    data-layer={object.layer}
    href={asset.src}
    x={bounds.left}
    y={bounds.top}
    width={object.width}
    height={object.height}
    preserveAspectRatio="none"
    onLoad={() => onAssetLoad?.(object.assetId)}
    onError={(event) => { event.currentTarget.style.display = 'none'; onAssetError?.(object.assetId) }}
  />
}

function WorldRenderLayer({ item, onAssetLoad, onAssetError }) {
  const asset = WORLD_MAP_V4_ASSET_MANIFEST[item.assetId]
  if (!asset) return null
  return <image
    data-object-id={item.objectId}
    data-asset-id={item.assetId}
    data-layer={item.layer}
    data-layer-id={item.source === 'override' ? item.layerId : undefined}
    data-render-band={item.source === 'override' ? item.renderBand : undefined}
    href={asset.src}
    x={item.x}
    y={item.y}
    width={item.width}
    height={item.height}
    preserveAspectRatio="none"
    onLoad={() => onAssetLoad?.(item.assetId)}
    onError={(event) => { event.currentTarget.style.display = 'none'; onAssetError?.(item.assetId) }}
  />
}

export function WorldMapDebugOverlay({ activeChunks, foot, collisionInfo }) {
  return <g data-layer="debug" pointerEvents="none">
    <image href={COLLISION_DEBUG_SRC} x="0" y="0" width={WORLD_MAP_V4.width} height={WORLD_MAP_V4.height} opacity="0.62" preserveAspectRatio="none"/>
    {activeChunks.map(key => {
      const [cx, cy] = key.split(',').map(Number)
      return <rect key={key} x={cx * WORLD_MAP_V4.chunkSize} y={cy * WORLD_MAP_V4.chunkSize}
        width={WORLD_MAP_V4.chunkSize} height={WORLD_MAP_V4.chunkSize} fill="none" stroke="#45d7ff" strokeWidth="3" opacity="0.7"/>
    })}
    {foot && <g>
      <rect x={foot.x - 14} y={foot.y - 8} width="28" height="16" rx="4" fill="#ffffff55" stroke="#fff" strokeWidth="3"/>
      <circle cx={foot.x} cy={foot.y} r="5" fill="#fff" stroke="#152014" strokeWidth="2"/>
      {(collisionInfo?.blockedX || collisionInfo?.blockedY) && <text x={foot.x + 20} y={foot.y - 16} fontSize="13" fill="#fff" stroke="#111" strokeWidth="3" paintOrder="stroke">{collisionInfo.reason}</text>}
    </g>}
  </g>
}

export default function WorldMapScene({
  camera,
  characters = [],
  interactionLayer = null,
  qa = {},
  foot = null,
  collisionInfo = null,
  onAssetLoad,
  onAssetError,
}) {
  const mode = qa.layer || 'all'
  const query = useMemo(() => queryWorldMapObjects(camera), [camera])
  const foreground = useMemo(() => WORLD_MAP_V4_FOREGROUND.filter(object => {
    const bounds = objectBounds(object)
    return bounds.right >= camera.x - 180 && bounds.left <= camera.x + camera.width + 180 && bounds.bottom >= camera.y - 180 && bounds.top <= camera.y + camera.height + 180
  }), [camera])
  const environment = useMemo(() => query.objects.filter(object => object.layer === 'environment'), [query.objects])
  const renderPlan = useMemo(() => planWorldMapRenderLayers({
    objects: query.objects,
    layerOverrides: WORLD_MAP_V4_LAYER_OVERRIDES,
    view: camera,
    mode,
    clean: Boolean(qa.clean),
    state: qa.layerState,
    characters,
  }), [camera, characters, mode, qa.clean, qa.layerState, query.objects])
  if (mode === 'reference') return <>
    <image data-layer="qa-reference" href={REFERENCE_SRC} x="0" y="0" width={WORLD_MAP_V4.width} height={WORLD_MAP_V4.height} preserveAspectRatio="none"/>
    <metadata data-map-version="4" data-reference-only="true"/>
  </>
  // Clean overview is the strict visual-comparison surface: the ImageGen
  // underlay panels plus the authored environment clusters reconstruct every
  // reference pixel. Depth-only landmark copies are omitted in that mode.
  const showEnvironment = mode === 'all' || mode === 'objects'
  const showForeground = mode === 'foreground' || (mode === 'all' && !qa.clean)
  return <>
    <WorldMapTerrain camera={camera} mode={mode} onAssetLoad={onAssetLoad} onAssetError={onAssetError}/>
    {showEnvironment && <g data-layer="environment-clusters">{environment.map(object => <WorldObject key={object.id} object={object} onAssetLoad={onAssetLoad} onAssetError={onAssetError}/>)}</g>}
    {renderPlan.ground.length > 0 && <g data-layer="object-ground">{renderPlan.ground.map(entry => <WorldRenderLayer key={entry.key} item={entry.item} onAssetLoad={onAssetLoad} onAssetError={onAssetError}/>)}</g>}
    {renderPlan.world.length > 0 && <g data-layer="depth-sorted">{renderPlan.world.map(entry => entry.type === 'character'
      ? entry.node
      : <WorldRenderLayer key={entry.key} item={entry.item} onAssetLoad={onAssetLoad} onAssetError={onAssetError}/>)}</g>}
    {renderPlan.foreground.length > 0 && <g data-layer="object-foreground">{renderPlan.foreground.map(entry => <WorldRenderLayer key={entry.key} item={entry.item} onAssetLoad={onAssetLoad} onAssetError={onAssetError}/>)}</g>}
    {showForeground && <g data-layer="foreground">{foreground.map(object => <WorldObject key={object.id} object={object} onAssetLoad={onAssetLoad} onAssetError={onAssetError}/>)}</g>}
    {renderPlan.overlay.length > 0 && <g data-layer="object-overlay">{renderPlan.overlay.map(entry => <WorldRenderLayer key={entry.key} item={entry.item} onAssetLoad={onAssetLoad} onAssetError={onAssetError}/>)}</g>}
    {qa.referenceOverlay && <image href={REFERENCE_SRC} x="0" y="0" width={WORLD_MAP_V4.width} height={WORLD_MAP_V4.height} opacity="0.5" pointerEvents="none" preserveAspectRatio="none"/>}
    {interactionLayer}
    {(qa.collisionDebug || mode === 'collision') && <WorldMapDebugOverlay activeChunks={query.chunks} foot={foot} collisionInfo={collisionInfo}/>} 
    <metadata data-map-version="4" data-rendered-objects={query.objects.length} data-culled-objects={WORLD_MAP_V4_OBJECTS.length - query.objects.length} data-active-chunks={query.chunks.join('|')}/>
  </>
}

export const WORLD_MAP_V4_OBJECT_COUNT = WORLD_MAP_V4_OBJECTS.length
