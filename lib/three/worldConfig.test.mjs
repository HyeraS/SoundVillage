import test from 'node:test'
import assert from 'node:assert/strict'
import { circleIntersectsAabb, isPositionWalkable } from './collision.mjs'
import { createHubInteractionTargets, getGatewayYaw, getHubReturnPose, getHubVillage, getLandmarkOrbMotion, getPrototypeScene, HUB_BOUNDS, HUB_BUILDINGS, HUB_COLLIDERS, HUB_EXITS, HUB_LANDMARK, HUB_MUSEUM_PATH, HUB_PLAYER_START, resolveHubInteraction } from './worldConfig.mjs'

test('scene query selects the hub without changing the default music scene', () => {
  assert.equal(getPrototypeScene('mock=1'), 'music')
  assert.equal(getPrototypeScene('mock=1&scene=hub'), 'hub')
  assert.equal(getPrototypeScene('scene=unknown'), 'music')
  assert.equal(getPrototypeScene('mock=1&scene=animal'), 'animal')
})

test('hub config provides six visual exits and separate landmark semantics', () => {
  assert.equal(HUB_EXITS.length, 6)
  assert.equal(new Set(HUB_EXITS.map(exit => exit.id)).size, 6)
  assert.equal(HUB_LANDMARK.id, 'hub-landmark-orb')
  assert.ok(!('sound' in HUB_LANDMARK))
  const targets = createHubInteractionTargets()
  assert.equal(targets.length, 7)
  assert.deepEqual(targets[0].position, [...HUB_LANDMARK.position])
  assert.equal(targets.filter(target => target.kind === 'village-exit').length, 6)
  assert.equal(new Set(targets.filter(target => target.villageId).map(target => target.villageId)).size, 6)
  assert.equal(targets.some(target => 'sound' in target), false)
  assert.equal(HUB_EXITS.find(exit => exit.id === 'unknown').dataZone, 'Lab')
  assert.equal(getHubVillage('unknown').dataZone, 'Lab')
})

test('all six village entrances resolve to an entry action', () => {
  for (const exit of HUB_EXITS) {
    const village = getHubVillage(exit.id)
    assert.equal(resolveHubInteraction(village).type, 'enter-village')
    assert.equal(resolveHubInteraction(village).village.villageId, exit.id)
  }
  assert.equal(getHubVillage('not-a-village'), null)
  assert.deepEqual(resolveHubInteraction({ kind: 'landmark' }), { type: 'show-landmark' })
  assert.deepEqual(resolveHubInteraction(null), { type: 'none' })
})

test('returning from Music places the player near its gate and faces inward', () => {
  const music = HUB_EXITS.find(exit => exit.id === 'music')
  const pose = getHubReturnPose('music')
  assert.ok(Math.hypot(pose.position[0] - music.position[0], pose.position[2] - music.position[2]) < 2.35)
  const facing = { x: Math.sin(pose.yaw), z: -Math.cos(pose.yaw) }
  const towardPlaza = { x: -pose.position[0], z: -pose.position[2] }
  assert.ok(facing.x * towardPlaza.x + facing.z * towardPlaza.z > 0)
  assert.deepEqual(getHubReturnPose('missing').position, [...HUB_PLAYER_START])
})

test('returning from Animal uses its own safe inward hub pose while Music stays unchanged', () => {
  const animal = HUB_EXITS.find(exit => exit.id === 'animal')
  const animalPose = getHubReturnPose('animal')
  const musicPose = getHubReturnPose('music')
  assert.ok(Math.hypot(animalPose.position[0] - animal.position[0], animalPose.position[2] - animal.position[2]) < 2.35)
  assert.notDeepEqual(animalPose, musicPose)
  const towardPlaza = { x: -animalPose.position[0], z: -animalPose.position[2] }
  const facing = { x: Math.sin(animalPose.yaw), z: -Math.cos(animalPose.yaw) }
  assert.ok(facing.x * towardPlaza.x + facing.z * towardPlaza.z > 0)
})

test('all gateway passages follow their radial paths and crossbars span them perpendicularly', () => {
  assert.deepEqual(HUB_EXITS.map(exit => exit.id), ['animal', 'human', 'nature', 'urban', 'music', 'unknown'])
  for (const exit of HUB_EXITS) {
    const length = Math.hypot(exit.position[0], exit.position[2])
    const path = { x: exit.position[0] / length, z: exit.position[2] / length }
    const yaw = getGatewayYaw(exit.position)
    assert.equal(exit.rotationY, yaw)
    const passage = { x: Math.sin(yaw), z: Math.cos(yaw) }
    const crossbar = { x: Math.cos(yaw), z: -Math.sin(yaw) }
    assert.ok(Math.abs(Math.abs(passage.x * path.x + passage.z * path.z) - 1) < 1e-12)
    assert.ok(Math.abs(crossbar.x * path.x + crossbar.z * path.z) < 1e-12)
    const inwardFront = { x: -Math.sin(yaw), z: -Math.cos(yaw) }
    assert.ok(inwardFront.x * -path.x + inwardFront.z * -path.z > 0.999999)
  }
})

test('museum path reaches its front approach without becoming a village exit', () => {
  assert.equal(HUB_MUSEUM_PATH.id, 'sound-museum-path')
  assert.ok(HUB_MUSEUM_PATH.width >= 1.4)
  const museum = HUB_BUILDINGS.find(building => building.id === 'sound-museum')
  const museumCollider = HUB_COLLIDERS.find(collider => collider.id === museum.id)
  const end = HUB_MUSEUM_PATH.points.at(-1)
  const frontEdge = museumCollider.position[1] + museumCollider.size[1] / 2
  assert.ok(Math.abs(end[0] - museum.position[0]) < 0.25)
  assert.ok(end[2] > frontEdge && end[2] - frontEdge < 0.6)
  assert.equal(HUB_EXITS.some(exit => exit.id === HUB_MUSEUM_PATH.id), false)
  assert.equal(createHubInteractionTargets().some(target => target.id === HUB_MUSEUM_PATH.id), false)
})

test('museum path is walkable and clears the landmark and configured colliders', () => {
  const orbClearance = 1.9
  for (let segmentIndex = 0; segmentIndex < HUB_MUSEUM_PATH.points.length - 1; segmentIndex += 1) {
    const start = HUB_MUSEUM_PATH.points[segmentIndex]
    const end = HUB_MUSEUM_PATH.points[segmentIndex + 1]
    for (let step = 0; step <= 20; step += 1) {
      const amount = step / 20
      const position = {
        x: start[0] + (end[0] - start[0]) * amount,
        z: start[2] + (end[2] - start[2]) * amount,
      }
      assert.ok(Math.hypot(position.x - HUB_LANDMARK.position[0], position.z - HUB_LANDMARK.position[2]) > orbClearance)
      assert.equal(isPositionWalkable(position, 0.42, HUB_BOUNDS, HUB_COLLIDERS), true)
    }
  }
})

test('hub start and central route are walkable while buildings, trees, and fences collide', () => {
  assert.equal(isPositionWalkable({ x: HUB_PLAYER_START[0], z: HUB_PLAYER_START[2] }, 0.42, HUB_BOUNDS, HUB_COLLIDERS), true)
  assert.equal(isPositionWalkable({ x: 0, z: 2.8 }, 0.42, HUB_BOUNDS, HUB_COLLIDERS), true)
  const home = HUB_BUILDINGS.find(building => building.id === 'player-home')
  assert.equal(circleIntersectsAabb({ x: home.position[0], z: home.position[2] }, 0.42, HUB_COLLIDERS.find(collider => collider.id === home.id)), true)
  for (const colliderId of ['hub-tree-0', 'hub-fence-0']) {
    const collider = HUB_COLLIDERS.find(item => item.id === colliderId)
    assert.equal(circleIntersectsAabb({ x: collider.position[0], z: collider.position[1] }, 0.42, collider), true)
  }
})

test('reduced motion keeps the landmark orb stable', () => {
  assert.deepEqual(getLandmarkOrbMotion(20, true), { yOffset: 0, rotationY: 0 })
  assert.notDeepEqual(getLandmarkOrbMotion(20, false), { yOffset: 0, rotationY: 0 })
})
