import test from 'node:test'
import assert from 'node:assert/strict'
import {
  WORLD_DESTINATIONS,
  WORLD_MAP_HEIGHT_PX,
  WORLD_MAP_WIDTH_PX,
  worldDestinationInteractionPoint,
} from './worldMapGeometry.mjs'
import {
  WORLD_MINIMAP_DESTINATIONS,
  getWorldMinimapMarkerState,
  getWorldObjective,
  withWorldObjectiveArrival,
  worldToMinimap,
} from './worldMapMinimap.mjs'

const worldSize = { width:WORLD_MAP_WIDTH_PX, height:WORLD_MAP_HEIGHT_PX }
const minimapSize = { width:240, height:180 }

test('world corners map exactly to minimap corners', () => {
  assert.deepEqual(worldToMinimap({ x:0, y:0 }, worldSize, minimapSize), { x:0, y:0 })
  assert.deepEqual(worldToMinimap({ x:WORLD_MAP_WIDTH_PX, y:0 }, worldSize, minimapSize), { x:240, y:0 })
  assert.deepEqual(worldToMinimap({ x:0, y:WORLD_MAP_HEIGHT_PX }, worldSize, minimapSize), { x:0, y:180 })
  assert.deepEqual(worldToMinimap({ x:WORLD_MAP_WIDTH_PX, y:WORLD_MAP_HEIGHT_PX }, worldSize, minimapSize), { x:240, y:180 })
})

test('world center maps exactly to minimap center', () => {
  assert.deepEqual(
    worldToMinimap({ x:WORLD_MAP_WIDTH_PX / 2, y:WORLD_MAP_HEIGHT_PX / 2 }, worldSize, minimapSize),
    { x:120, y:90 },
  )
})

test('projected player coordinates are clamped inside minimap bounds', () => {
  assert.deepEqual(worldToMinimap({ x:-500, y:-1 }, worldSize, minimapSize), { x:0, y:0 })
  assert.deepEqual(worldToMinimap({ x:WORLD_MAP_WIDTH_PX + 500, y:WORLD_MAP_HEIGHT_PX + 1 }, worldSize, minimapSize), { x:240, y:180 })
})

test('all eight destinations use the canonical approach coordinates', () => {
  assert.equal(WORLD_MINIMAP_DESTINATIONS.length, 8)
  assert.deepEqual(
    WORLD_MINIMAP_DESTINATIONS.map(destination => destination.id),
    ['Lab', 'Animal', 'Urban', 'Music', 'Human', 'Nature', 'Sound Library', 'Home'],
  )
  for (const source of WORLD_DESTINATIONS) {
    const marker = WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === source.id)
    assert.deepEqual(marker.worldPoint, worldDestinationInteractionPoint(source.target), `${source.id} marker must use its approach point`)
  }
})

test('locked and open zone marker state stays distinct while landmarks remain open', () => {
  const options = { lockedZones:['Animal', 'Lab'], objectiveId:'Music' }
  const animal = getWorldMinimapMarkerState(WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === 'Animal'), options)
  const music = getWorldMinimapMarkerState(WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === 'Music'), options)
  const museum = getWorldMinimapMarkerState(WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === 'Sound Library'), options)
  assert.equal(animal.locked, true)
  assert.equal(animal.current, false)
  assert.equal(music.locked, false)
  assert.equal(music.current, true)
  assert.equal(museum.locked, false)
})

test('shared objective calculation prioritizes prerequisite then next incomplete village', () => {
  assert.deepEqual(
    getWorldObjective({ lockedZones:['Animal'], zoneProgress:{} }),
    { destinationId:'Music', reason:'prerequisite', arrived:false },
  )
  assert.deepEqual(
    getWorldObjective({ lockedZones:[], zoneProgress:{ Music:1, Animal:1 } }),
    { destinationId:'Human', reason:'incomplete-zone', arrived:false },
  )
  assert.deepEqual(
    getWorldObjective({ lockedZones:[], zoneProgress:Object.fromEntries(['Music', 'Animal', 'Human', 'Nature', 'Urban', 'Lab'].map(zone => [zone, 1])) }),
    { destinationId:null, reason:'complete', arrived:false },
  )
})

test('objective changes to arrived inside its canonical interaction range', () => {
  const objective = getWorldObjective({ lockedZones:['Animal'] })
  const music = WORLD_MINIMAP_DESTINATIONS.find(destination => destination.id === 'Music')
  assert.equal(withWorldObjectiveArrival(objective, music.worldPoint).arrived, true)
  assert.equal(withWorldObjectiveArrival(objective, { x:0, y:0 }).arrived, false)
})
