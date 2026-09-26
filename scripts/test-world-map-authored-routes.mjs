import assert from 'node:assert/strict'
import { WORLD_DESTINATIONS, WORLD_PLAYER, moveWorldPlayer, worldDestinationContainsFoot, worldPlayerTopLeftAtFoot } from '../lib/worldMapGeometry.mjs'
import { getAllWorldNavigationRoutes } from '../lib/worldMapNavigation.mjs'

const SPEED = 5.85
const results = {}
for (const route of getAllWorldNavigationRoutes()) {
  let position = worldPlayerTopLeftAtFoot(route.points[0].x / 32, route.points[0].y / 32)
  let frames = 0
  let maxStalledFrames = 0
  let stalledFrames = 0
  for (const target of route.points.slice(1)) {
    while (frames < 20_000) {
      const footX = position.x + WORLD_PLAYER.width / 2
      const footY = position.y + WORLD_PLAYER.height - WORLD_PLAYER.footHeight / 2
      const dx = target.x - footX
      const dy = target.y - footY
      const distance = Math.hypot(dx, dy)
      if (distance <= 1.5) break
      const step = Math.min(SPEED, distance)
      const moved = moveWorldPlayer(position, dx / distance * step, dy / distance * step)
      if (moved.moved) stalledFrames = 0
      else stalledFrames += 1
      maxStalledFrames = Math.max(maxStalledFrames, stalledFrames)
      position = { x: moved.x, y: moved.y }
      frames += 1
      assert.ok(stalledFrames < 30, `${route.destination} does not stall for 30 frames`)
    }
  }
  const destination = WORLD_DESTINATIONS.find(candidate => candidate.id === route.destination)
  assert.ok(destination, `${route.destination} destination exists`)
  assert.equal(worldDestinationContainsFoot(position, destination.target), true, `${route.destination} production route arrives at its interaction point`)
  results[route.destination] = { arrived: true, frames, waypoints: route.points.length, maxStalledFrames, source: route.source }
}

console.log(JSON.stringify({ status: 'PASS', routes: results }, null, 2))
