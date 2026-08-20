import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMERA_CONFIG, dampingAlpha, getCameraHorizontalBasis, getResponsiveCameraSettings, screenInputToWorld } from './cameraConfig.mjs'

test('fixed camera basis is orthonormal and screen input stays normalized', () => {
  const { forward, right } = getCameraHorizontalBasis()
  assert.ok(Math.abs(Math.hypot(forward.x, forward.z) - 1) < 1e-12)
  assert.ok(Math.abs(Math.hypot(right.x, right.z) - 1) < 1e-12)
  assert.ok(Math.abs(forward.x * right.x + forward.z * right.z) < 1e-12)

  const up = screenInputToWorld(0, -1)
  const diagonal = screenInputToWorld(1, -1)
  assert.ok(Math.abs(up.x - forward.x) < 1e-12)
  assert.ok(Math.abs(up.z - forward.z) < 1e-12)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-12)
})

test('responsive framing and delta damping use stable bounded values', () => {
  assert.deepEqual(getResponsiveCameraSettings(1440, 900), { fov: CAMERA_CONFIG.fov, lookAhead: CAMERA_CONFIG.lookAhead, layout: 'desktop' })
  assert.equal(getResponsiveCameraSettings(390, 844).layout, 'mobile-portrait')
  assert.equal(getResponsiveCameraSettings(844, 390).layout, 'mobile-landscape')
  assert.equal(dampingAlpha(5, 0), 0)
  assert.ok(dampingAlpha(5, 1 / 60) > 0 && dampingAlpha(5, 1 / 60) < 1)
})
