import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  PARTICIPANT_ENTRY_SESSION_KEY,
  PARTICIPANT_SESSION_NOTICE_KEY,
  clearParticipantEntrySession,
  consumeParticipantSessionNotice,
  readParticipantEntrySession,
  writeParticipantEntrySession,
  writeParticipantSessionNotice,
} from './participantEntrySession.mjs'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('the legacy entry marker still normalizes IDs before it is cleared on load', () => {
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
  assert.equal(writeParticipantSessionNotice(unavailable, 'session_moved'), false)
  assert.equal(consumeParticipantSessionNotice(unavailable), null)
})

test('a moved-session notice is accepted once and then removed', () => {
  const storage = memoryStorage()

  assert.equal(writeParticipantSessionNotice(storage, 'unknown_notice'), false)
  assert.equal(writeParticipantSessionNotice(storage, 'session_moved'), true)
  assert.equal(storage.getItem(PARTICIPANT_SESSION_NOTICE_KEY), 'session_moved')
  assert.equal(consumeParticipantSessionNotice(storage), 'session_moved')
  assert.equal(consumeParticipantSessionNotice(storage), null)
})

test('the main entry flow always asks for an ID and monitors browser ownership', async () => {
  const page = await readFile(new URL('../app/page.js', import.meta.url), 'utf8')
  const claimIndex = page.indexOf('const participant = await claimParticipantSession(pid, gid)')
  const enterIndex = page.indexOf('await enterParticipantSession(participant)', claimIndex)

  assert.doesNotMatch(page, /readParticipantEntrySession\(window\.sessionStorage\)/)
  assert.doesNotMatch(page, /writeParticipantEntrySession\(window\.sessionStorage/)
  assert.match(page, /clearParticipantEntrySession\(window\.sessionStorage\)/)
  assert.match(page, /consumeParticipantSessionNotice\(window\.sessionStorage\)/)
  assert.match(page, /window\.setInterval\(verifyActiveBrowser, PARTICIPANT_SESSION_CHECK_MS\)/)
  assert.match(page, /writeParticipantSessionNotice\(window\.sessionStorage, 'session_moved'\)/)
  assert.match(page, /window\.location\.reload\(\)/)
  assert.notEqual(claimIndex, -1)
  assert.ok(enterIndex > claimIndex)
})
