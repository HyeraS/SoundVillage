import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../../app/api/participant-session/shared-demo/route.js', import.meta.url), 'utf8')
const participantAuth = await readFile(new URL('../../lib/participantAuth.js', import.meta.url), 'utf8')

test('shared demo route is limited to USER1 group A and keeps its password server-only', () => {
  assert.match(route, /const DEMO_PARTICIPANT_ID = 'USER1'/)
  assert.match(route, /const DEMO_GROUP_ID = 'A'/)
  assert.match(route, /process\.env\.SHARED_DEMO_USER_PASSWORD/)
  assert.doesNotMatch(route, /NEXT_PUBLIC_SHARED_DEMO/)
  assert.match(route, /data\.user\?\.id !== participant\.auth_user_id/)
  assert.match(route, /'Cache-Control': 'no-store'/)
})

test('USER1 bypasses the single-browser anonymous claim and installs the shared session', () => {
  assert.match(participantAuth, /normalizedParticipantId === SHARED_DEMO_PARTICIPANT_ID/)
  assert.match(participantAuth, /fetch\('\/api\/participant-session\/shared-demo'/)
  assert.match(participantAuth, /client\.auth\.setSession/)
  assert.match(participantAuth, /participant\?\.participantId !== SHARED_DEMO_PARTICIPANT_ID/)
})
