import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  PARTICIPANT_ENTRY_SESSION_KEY,
  clearParticipantEntrySession,
  readParticipantEntrySession,
  writeParticipantEntrySession,
} from './participantEntrySession.mjs'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('participant entry session survives reloads within the same tab', () => {
  const storage = memoryStorage()

  assert.equal(writeParticipantEntrySession(storage, ' p001 '), true)
  assert.equal(storage.getItem(PARTICIPANT_ENTRY_SESSION_KEY), 'P001')
  assert.equal(readParticipantEntrySession(storage), 'P001')
})

test('a new browser session without the entry marker requires login', () => {
  const previousTab = memoryStorage()
  const newTab = memoryStorage()

  writeParticipantEntrySession(previousTab, 'P001')

  assert.equal(readParticipantEntrySession(newTab), null)
})

test('clearing the entry session does not touch any other auth storage', () => {
  const storage = memoryStorage()
  storage.setItem('supabase-auth-token', 'kept')
  writeParticipantEntrySession(storage, 'P001')

  assert.equal(clearParticipantEntrySession(storage), true)
  assert.equal(readParticipantEntrySession(storage), null)
  assert.equal(storage.getItem('supabase-auth-token'), 'kept')
})

test('unavailable browser storage fails closed without throwing', () => {
  const unavailable = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }

  assert.equal(readParticipantEntrySession(unavailable), null)
  assert.equal(writeParticipantEntrySession(unavailable, 'P001'), false)
  assert.equal(clearParticipantEntrySession(unavailable), false)
})

test('the main entry flow gates restore and records only a completed login', async () => {
  const page = await readFile(new URL('../app/page.js', import.meta.url), 'utf8')
  const readIndex = page.indexOf('readParticipantEntrySession(window.sessionStorage)')
  const restoreIndex = page.indexOf('restoreParticipantSession()', readIndex)
  const claimIndex = page.indexOf('const participant = await claimParticipantSession(pid, gid)')
  const enterIndex = page.indexOf('await enterParticipantSession(participant)', claimIndex)
  const writeIndex = page.indexOf('writeParticipantEntrySession(window.sessionStorage, participant.participantId)', enterIndex)

  assert.notEqual(readIndex, -1)
  assert.ok(restoreIndex > readIndex)
  assert.notEqual(claimIndex, -1)
  assert.ok(enterIndex > claimIndex)
  assert.ok(writeIndex > enterIndex)
})
