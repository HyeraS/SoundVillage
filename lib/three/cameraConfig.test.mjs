import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CAMERA_CONFIG,
  HUB_THIRD_PERSON_CAMERA_CONFIG,
  dampAngle,
  dampingAlpha,
  getCameraHorizontalBasis,
  getCameraOrbitTargetYaw,
  getResponsiveCameraSettings,
  getResponsiveHubThirdPersonSettings,
  getYawForward,
  movementDirectionToFacingYaw,
  screenInputToWorld,
  shortestAngleDelta,
  shouldAutoFollowCamera,
  shouldRotateAutoFollow,
  shouldRefreshMovementBasis,
  stepAutoFollowYaw,
  updateStableFacingCandidate,
} from './cameraConfig.mjs'

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
  assert.equal(getResponsiveCameraSettings(1280, 720).layout, 'desktop')
  assert.equal(getResponsiveCameraSettings(390, 844).layout, 'mobile-portrait')
  assert.equal(getResponsiveCameraSettings(844, 390).layout, 'mobile-landscape')
  assert.equal(dampingAlpha(5, 0), 0)
  assert.ok(dampingAlpha(5, 1 / 60) > 0 && dampingAlpha(5, 1 / 60) < 1)
})

test('hub third-person framing is forward-facing and responsive', () => {
  assert.deepEqual(screenInputToWorld(0, -1, [0, 0, 1]), { x: 0, z: -1 })
  assert.deepEqual(screenInputToWorld(1, 0, [0, 0, 1]), { x: 1, z: 0 })
  assert.equal(getResponsiveHubThirdPersonSettings(1440, 900).fov, HUB_THIRD_PERSON_CAMERA_CONFIG.fov)
  assert.equal(getResponsiveHubThirdPersonSettings(1280, 720).fov, HUB_THIRD_PERSON_CAMERA_CONFIG.fov)
  assert.equal(getResponsiveHubThirdPersonSettings(390, 844).fov, HUB_THIRD_PERSON_CAMERA_CONFIG.mobilePortraitFov)
  assert.equal(getResponsiveHubThirdPersonSettings(844, 390).fov, HUB_THIRD_PERSON_CAMERA_CONFIG.mobileLandscapeFov)
})

test('player facing yaw follows the normalized world movement direction and keeps the camera behind', () => {
  const diagonal = screenInputToWorld(1, -1, [0, 0, 1])
  const facingYaw = movementDirectionToFacingYaw(diagonal)
  const facing = getYawForward(facingYaw)
  assert.ok(Math.abs(facing.x - diagonal.x) < 1e-12)
  assert.ok(Math.abs(facing.z - diagonal.z) < 1e-12)

  const orbitYaw = getCameraOrbitTargetYaw(facingYaw)
  const orbitForward = getYawForward(orbitYaw)
  const cameraOffset = { x: -orbitForward.x, z: -orbitForward.z }
  assert.ok(cameraOffset.x * facing.x + cameraOffset.z * facing.z < -0.999999)
})

test('angle damping crosses the pi boundary by the shortest delta and is frame-rate independent', () => {
  const from = Math.PI - 0.05
  const to = -Math.PI + 0.05
  assert.ok(shortestAngleDelta(from, to) > 0)
  assert.ok(Math.abs(shortestAngleDelta(from, to) - 0.1) < 1e-12)
  const oneStep = dampAngle(from, to, 6, 1 / 30)
  const twoSteps = dampAngle(dampAngle(from, to, 6, 1 / 60), to, 6, 1 / 60)
  assert.ok(Math.abs(shortestAngleDelta(oneStep, twoSteps)) < 1e-12)
  assert.ok(Math.abs(shortestAngleDelta(oneStep, to)) < Math.abs(shortestAngleDelta(from, to)))
})

test('manual camera control has priority, grace time is respected, and moving resumes follow', () => {
  const graceSeconds = HUB_THIRD_PERSON_CAMERA_CONFIG.manualGraceSeconds
  assert.equal(shouldAutoFollowCamera({ dragging: true, moving: true, secondsSinceManualInput: 99, graceSeconds }), false)
  assert.equal(shouldAutoFollowCamera({ dragging: false, moving: true, secondsSinceManualInput: graceSeconds - 0.01, graceSeconds }), false)
  assert.equal(shouldAutoFollowCamera({ dragging: false, moving: false, secondsSinceManualInput: graceSeconds + 1, graceSeconds }), false)
  assert.equal(shouldAutoFollowCamera({ dragging: false, moving: true, secondsSinceManualInput: graceSeconds, graceSeconds }), true)
})

test('stopped movement leaves yaw stable and held input keeps a fixed movement basis', () => {
  const yaw = 1.25
  assert.equal(shouldAutoFollowCamera({ dragging: false, moving: false, secondsSinceManualInput: Infinity, graceSeconds: 1.1 }), false)
  assert.equal(stepAutoFollowYaw(yaw, yaw, 2.4, 75 * Math.PI / 180, 22 * Math.PI / 180, 1 / 60), yaw)
  assert.equal(shouldRefreshMovementBasis(null, { x: 0, z: -1 }, false), true)
  assert.equal(shouldRefreshMovementBasis({ x: 0, z: -1 }, { x: 0, z: -1 }, true), false)
  assert.equal(shouldRefreshMovementBasis({ x: 0, z: -1 }, { x: 1, z: 0 }, true), true)
})

test('auto follow waits for a stable direction for 0.35 seconds', () => {
  const config = HUB_THIRD_PERSON_CAMERA_CONFIG
  let stable = updateStableFacingCandidate(null, 0, Math.PI / 2, 0, config.autoFollowDirectionTolerance)
  stable = updateStableFacingCandidate(stable.candidateYaw, stable.stableSeconds, Math.PI / 2, 0.34, config.autoFollowDirectionTolerance)
  assert.equal(shouldRotateAutoFollow({ cameraYaw: 0, targetYaw: stable.candidateYaw, stableSeconds: stable.stableSeconds, delay: config.autoFollowDelay, deadZone: config.autoFollowDeadZone }), false)
  stable = updateStableFacingCandidate(stable.candidateYaw, stable.stableSeconds, Math.PI / 2, 0.01, config.autoFollowDirectionTolerance)
  assert.equal(shouldRotateAutoFollow({ cameraYaw: 0, targetYaw: stable.candidateYaw, stableSeconds: stable.stableSeconds, delay: config.autoFollowDelay, deadZone: config.autoFollowDeadZone }), true)
})

test('auto follow ignores its 22 degree dead zone and rotates beyond it', () => {
  const config = HUB_THIRD_PERSON_CAMERA_CONFIG
  assert.equal(shouldRotateAutoFollow({ cameraYaw: 0, targetYaw: 22 * Math.PI / 180, stableSeconds: 1, delay: config.autoFollowDelay, deadZone: config.autoFollowDeadZone }), false)
  assert.equal(shouldRotateAutoFollow({ cameraYaw: 0, targetYaw: 22.01 * Math.PI / 180, stableSeconds: 1, delay: config.autoFollowDelay, deadZone: config.autoFollowDeadZone }), true)
})

test('auto follow yaw step respects the 75 degree per second limit', () => {
  const config = HUB_THIRD_PERSON_CAMERA_CONFIG
  const delta = 1 / 60
  const next = stepAutoFollowYaw(0, Math.PI, config.autoFollowYawDamping, config.autoFollowMaxYawSpeed, config.autoFollowDeadZone, delta)
  assert.ok(Math.abs(shortestAngleDelta(0, next)) <= config.autoFollowMaxYawSpeed * delta + 1e-12)
})

test('auto follow produces similar results at 30fps and 60fps', () => {
  const config = HUB_THIRD_PERSON_CAMERA_CONFIG
  const simulate = (fps, duration) => {
    let yaw = 0
    for (let frame = 0; frame < fps * duration; frame += 1) {
      yaw = stepAutoFollowYaw(yaw, Math.PI, config.autoFollowYawDamping, config.autoFollowMaxYawSpeed, config.autoFollowDeadZone, 1 / fps)
    }
    return yaw
  }
  assert.ok(Math.abs(shortestAngleDelta(simulate(30, 2), simulate(60, 2))) < 0.01)
})

test('rapid alternating directions never become stable enough to move the camera', () => {
  const config = HUB_THIRD_PERSON_CAMERA_CONFIG
  let candidateYaw = null
  let stableSeconds = 0
  let cameraYaw = 0
  for (let index = 0; index < 10; index += 1) {
    const next = updateStableFacingCandidate(candidateYaw, stableSeconds, index % 2 ? -Math.PI / 2 : Math.PI / 2, 0.1, config.autoFollowDirectionTolerance)
    candidateYaw = next.candidateYaw
    stableSeconds = next.stableSeconds
    if (shouldRotateAutoFollow({ cameraYaw, targetYaw: candidateYaw, stableSeconds, delay: config.autoFollowDelay, deadZone: config.autoFollowDeadZone })) {
      cameraYaw = stepAutoFollowYaw(cameraYaw, candidateYaw, config.autoFollowYawDamping, config.autoFollowMaxYawSpeed, config.autoFollowDeadZone, 0.1)
    }
  }
  assert.equal(cameraYaw, 0)
})

test('stable facing tolerates small float changes but resets on a meaningful turn', () => {
  const config = HUB_THIRD_PERSON_CAMERA_CONFIG
  const stable = updateStableFacingCandidate(0, 0.2, 3 * Math.PI / 180, 0.1, config.autoFollowDirectionTolerance)
  assert.equal(stable.candidateYaw, 0)
  assert.equal(stable.stableSeconds, 0.30000000000000004)
  const changed = updateStableFacingCandidate(stable.candidateYaw, stable.stableSeconds, 20 * Math.PI / 180, 0.1, config.autoFollowDirectionTolerance)
  assert.equal(changed.stableSeconds, 0)
})

test('music scene camera contract stays unchanged', () => {
  assert.deepEqual(CAMERA_CONFIG.positionOffset, [3.1, 5.2, 5.4])
  assert.equal(CAMERA_CONFIG.fov, 38)
  assert.equal(CAMERA_CONFIG.positionDamping, 4.8)
  assert.equal(CAMERA_CONFIG.targetDamping, 6.5)
})
