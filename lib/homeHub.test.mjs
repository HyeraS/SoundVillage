import test from 'node:test'
import assert from 'node:assert/strict'
import { HOME_INVITE_REQUIRED_COUNT, getHomeInviteState, getHomeLandmarkState } from './homeHub.mjs'

test('invite remains locked until four placed items', () => {
  const state = getHomeInviteState({ placedCount: HOME_INVITE_REQUIRED_COUNT - 1, shareStatus: 'ready', inviteUrl: 'https://example.test/?house=token' })
  assert.equal(state.id, 'decorating')
  assert.equal(state.copyEnabled, false)
  assert.equal(state.progress, 75)
})

test('an empty or failed share token can never be copied', () => {
  assert.equal(getHomeInviteState({ placedCount: 4, shareStatus: 'ready', inviteUrl: '' }).copyEnabled, false)
  assert.equal(getHomeInviteState({ placedCount: 4, shareStatus: 'error', inviteUrl: '' }).id, 'share-error')
  assert.equal(getHomeInviteState({ placedCount: 4, shareStatus: 'qa', inviteUrl: '' }).id, 'qa-unavailable')
})

test('ready links and landmark states are explicit', () => {
  assert.equal(getHomeInviteState({ placedCount: 4, shareStatus: 'ready', inviteUrl: 'https://example.test/?house=token' }).copyEnabled, true)
  assert.equal(getHomeLandmarkState({ placedCount: 4, shareStatus: 'ready' }), 'invite-ready')
  assert.equal(getHomeLandmarkState({ placedCount: 2, shareStatus: 'ready' }), 'decorating')
  assert.equal(getHomeLandmarkState({ placedCount: 4, shareStatus: 'ready', visitorConnected: true }), 'visitor')
})
