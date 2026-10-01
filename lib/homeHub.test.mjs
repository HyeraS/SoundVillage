import test from 'node:test'
import assert from 'node:assert/strict'
import { HOME_INVITE_REQUIRED_COUNT, getHomeInviteState, getHomeLandmarkState, getUniquePlacedInteriorIds } from './homeHub.mjs'

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

test('invite progress counts unique valid owned movable product IDs only', () => {
  const runtimeItems = [
    { id:'starter_wall', kind:'wallpaper', starter:true },
    { id:'chair', kind:'furniture', layer:'floor', fw:1, fh:1 },
    { id:'lamp', kind:'small_prop', layer:'floor', fw:1, fh:1 },
    { id:'frame', kind:'wall_decor', layer:'wall', fw:1, fh:1 },
  ]
  const room = { items:[
    { uid:1, itemId:'chair', layer:'floor', col:1, row:1, flip:false },
    { uid:2, itemId:'chair', layer:'floor', col:2, row:1, flip:false },
    { uid:3, itemId:'lamp', layer:'floor', col:3, row:1, flip:false },
    { uid:4, itemId:'frame', layer:'floor', col:4, row:1, flip:false },
    { uid:5, itemId:'unknown', layer:'floor', col:5, row:1, flip:false },
  ] }
  assert.deepEqual(getUniquePlacedInteriorIds({ room, ownedItemIds:['chair','lamp','frame'], runtimeItems }), ['chair','lamp'])
})
