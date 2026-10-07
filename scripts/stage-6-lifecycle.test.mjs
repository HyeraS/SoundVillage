import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const sources = Object.fromEntries(await Promise.all([
  'app/page.js',
  'app/library-test/page.js',
  'components/GameEngine.js',
  'components/LibraryRoom.js',
  'components/WorldMap.js',
  'components/world-map/WorldMapUI.js',
  'components/FeedbackPanel.js',
  'components/AnnotationPanel.js',
  'components/StartPanel.js',
  'components/SoundMuseum.js',
  'components/InteriorDecorRoom.js',
  'components/InteriorRoom.js',
  'components/MusicZoneMap.js',
  'components/NatureZoneMap.js',
  'components/HumanZoneMap.js',
  'components/UrbanV3ZoneMap.js',
  'components/AnimalZoneMap.js',
  'components/LabZoneMap.js',
  'components/ZoneMap.js',
  'lib/userEvents.js',
  'lib/duoSession.js',
].map(async path => [path, await read(path)])))

function functionBody(source, signature) {
  const start = source.indexOf(signature)
  assert.notEqual(start, -1, `missing function signature: ${signature}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`unterminated function body: ${signature}`)
}

function eventPayload(source, eventName) {
  const start = source.indexOf(`trackEvent('${eventName}', {`)
  assert.notEqual(start, -1, `missing event: ${eventName}`)
  const end = source.indexOf('\n      })', start)
  assert.notEqual(end, -1, `unterminated event payload: ${eventName}`)
  return source.slice(start, end)
}

test('movement input clears and stops while overlays are active', () => {
  const engine = sources['components/GameEngine.js']
  assert.match(engine, /if \(disabled\) clearMovementKeys\(keys\.current\)/)
  assert.match(engine, /if \(!direction \|\| isTyping\(\) \|\| disabledRef\.current\) return/)
  assert.match(sources['components/LibraryRoom.js'], /useKeys\(\{ disabled: Boolean\(openCard\)/)
  assert.match(sources['components/LibraryRoom.js'], /inputBlocked = Boolean\(openCardRef\.current \|\| exitConfirmRef\.current\)/)
  assert.match(sources['components/LibraryRoom.js'], /keysDown: inputBlocked \? \{\} : keys\.current/)
  assert.match(sources['components/WorldMap.js'], /disabled\s*:\s*questOpen \|\| attendanceOpen/)
  assert.match(sources['components/InteriorRoom.js'], /disabled: inputBlocked/)
  assert.match(sources['app/page.js'], /zoneInputBlocked = screen === 'annotate' \|\| showFeedback \|\| Boolean\(blockUnlockInfo\)/)
  for (const path of [
    'components/MusicZoneMap.js', 'components/NatureZoneMap.js', 'components/HumanZoneMap.js',
    'components/UrbanV3ZoneMap.js', 'components/AnimalZoneMap.js', 'components/ZoneMap.js',
  ]) assert.match(sources[path], /useKeys\(\{[\s\S]{0,80}?disabled: (?:baseOnly \|\| )?isAnnotating \|\| exitConfirm/)
  assert.match(sources['components/LabZoneMap.js'], /disabled:isAnnotating\|\|!!modal\|\|complete/)
})

test('meaningful controls log once per activation and Enter repeat is ignored', () => {
  const engine = sources['components/GameEngine.js']
  assert.match(engine, /!e\.repeat && !keys\.current\[direction\]/)
  assert.match(engine, /target_id: `map-control-\$\{direction\}`/)
  assert.match(engine, /metadata: \{ source: 'dpad' \}/)
  for (const path of ['components/HumanZoneMap.js']) {
    assert.match(sources[path], /press\(direction, interactionMethod\)/, `${path} must preserve mouse versus touch input`)
  }
  assert.match(sources['components/UrbanV3ZoneMap.js'], /<DPad press=\{press\}/)
  assert.match(sources['components/LabZoneMap.js'], /press\(direction,interactionMethod\)/)
  for (const path of [
    'components/LibraryRoom.js', 'components/WorldMap.js', 'components/MusicZoneMap.js',
    'components/NatureZoneMap.js', 'components/HumanZoneMap.js', 'components/UrbanV3ZoneMap.js',
    'components/AnimalZoneMap.js', 'components/LabZoneMap.js', 'components/ZoneMap.js',
  ]) assert.match(sources[path], /repeat/, `${path} must reject repeated keyboard activation`)
})

test('library and world panels preserve precise close reasons', () => {
  const library = sources['components/LibraryRoom.js']
  const libraryHarness = sources['app/library-test/page.js']
  for (const reason of ['close_button', 'escape', 'backdrop', 'navigation', 'component_unmounted']) {
    assert.match(library, new RegExp(`['"]${reason}['"]`))
  }
  assert.match(library, /library_card_opened/)
  assert.match(library, /library_card_closed/)
  assert.match(library, /data-testid="museum-floor-exit"/)
  assert.match(library, /data-testid="museum-exit-button"/)
  assert.match(library, /overlapsMuseumExitTrigger\(result\)/)
  assert.match(library, /role="dialog" aria-modal="true" aria-labelledby="museum-exit-title"/)
  assert.match(libraryHarness, /import QaCharacterStudioPanel/)
  assert.match(libraryHarness, /shop:\{ render:\(\) => <QaCharacterStudioPanel sessionKey="library-test-shop"\/> \}/)
  const world = sources['components/WorldMap.js'] + sources['components/world-map/WorldMapUI.js']
  assert.match(world, /quest_panel_closed/)
  assert.match(world, /attendance_panel_opened/)
  assert.match(world, /attendance_panel_closed/)
  assert.match(world, /onClose\('backdrop', event\)/)
  assert.match(world, /onClose\('close_button', event\)/)
})

test('feedback timer is readable and resets with each feedback identity', () => {
  const feedback = sources['components/FeedbackPanel.js']
  assert.match(feedback, /FEEDBACK_DURATION_MS = 2400/)
  assert.match(feedback, /clearTimeout\(closeTimer\); clearInterval\(tick\)/)
  assert.match(feedback, /\[onClose, zone\]/)
  assert.match(sources['app/page.js'], /<FeedbackPanel\s+key=\{feedbackZone\}/)
})

test('major start, purchase, equip, vote, annotation, skip, and room-save handlers have synchronous locks', () => {
  assert.match(sources['components/StartPanel.js'], /startInFlightRef\.current/)
  const museum = sources['components/SoundMuseum.js']
  assert.match(museum, /purchaseInFlightRef\.current/)
  assert.match(museum, /equipInFlightRef\.current/)
  assert.match(museum, /voteInFlightRef\.current/)
  const annotation = sources['components/AnnotationPanel.js']
  assert.match(annotation, /inFlightRef\.current/)
  assert.match(annotation, /skipInFlightRef\.current/)
  assert.match(sources['components/InteriorDecorRoom.js'], /roomSaveInFlightRef\.current/)
})

test('async result guards recover their mounted state after Strict Mode effect replay', () => {
  const annotation = sources['components/AnnotationPanel.js']
  const museum = sources['components/SoundMuseum.js']
  assert.match(annotation, /mountedRef\.current = true;[\s\S]*return \(\) => \{ mountedRef\.current = false; \}/)
  assert.match(museum, /mountedRef\.current = true[\s\S]*return \(\) => \{ mountedRef\.current = false \}/)
})

test('new semantic events are accepted by both client and unapplied migration 004', async () => {
  const sql = await read('scripts/security/004_user_event_logging.sql')
  for (const name of [
    'library_card_opened', 'library_card_closed', 'attendance_panel_opened', 'attendance_panel_closed',
    'invite_link_copy_succeeded', 'invite_link_copy_failed',
  ]) {
    assert.match(sources['lib/userEvents.js'], new RegExp(`['"]${name}['"]`))
    assert.match(sql, new RegExp(`\\('${name}'\\)`))
  }
  const interior = sources['components/InteriorDecorRoom.js']
  const copy = functionBody(interior, 'const copy = async')
  assert.match(copy, /\(event, url = inviteUrl, targetId = 'interior-invite-copy'\)/)
  assert.match(copy, /if \(copyInFlightRef\.current \|\| !url\) return/)
  assert.match(copy, /copyInFlightRef\.current = true/)
  assert.match(copy, /await navigator\.clipboard\.writeText\(url\)/)
  assert.ok(copy.indexOf('await navigator.clipboard.writeText(url)') < copy.indexOf("trackEvent('invite_link_copy_succeeded'"))
  assert.ok(copy.indexOf('await navigator.clipboard.writeText(url)') < copy.indexOf("trackEvent('invite_link_copy_failed'"))
  assert.match(copy, /finally \{\s*copyInFlightRef\.current = false\s*\}/)
  assert.match(interior, /copy\(event, liveInviteState\.inviteUrl, 'duo-invite-copy'\)/)
  assert.match(interior, /onClick=\{\(event\) => copy\(event\)\}/)
  assert.match(eventPayload(copy, 'invite_link_copy_succeeded'), /target_id: targetId/)
  assert.match(eventPayload(copy, 'invite_link_copy_failed'), /target_id: targetId/)
  assert.match(eventPayload(copy, 'invite_link_copy_failed'), /error_code: 'clipboard_write_failed'/)
  for (const eventName of ['invite_link_copy_succeeded', 'invite_link_copy_failed']) {
    assert.doesNotMatch(eventPayload(copy, eventName), /inviteUrl|liveInviteState|\burl\b|token/i)
  }
})

test('duo reconnect requires a prior observed partner connection', () => {
  const duo = sources['lib/duoSession.js']
  assert.match(duo, /reduceDuoPeerPresence\(peerLifecycleRef\.current, peerPresent\)/)
  assert.match(duo, /channel\.on\('presence', \{ event:'sync' \}/)
  assert.match(duo, /Object\.hasOwn\(state, peerRole\)/)
  assert.match(duo, /target_type:'duo_session', target_id:'duo-peer'/)
  const subscribed = functionBody(duo, 'channel.subscribe')
  assert.doesNotMatch(subscribed, /duo_connected|duo_reconnected/)
})
