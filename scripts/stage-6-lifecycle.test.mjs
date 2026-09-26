import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const sources = Object.fromEntries(await Promise.all([
  'app/page.js',
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
  'components/UrbanZoneMap.js',
  'components/AnimalZoneMap.js',
  'components/LabZoneMap.js',
  'components/ZoneMap.js',
  'lib/userEvents.js',
].map(async path => [path, await read(path)])))

test('movement input clears and stops while overlays are active', () => {
  const engine = sources['components/GameEngine.js']
  assert.match(engine, /if \(disabled\) clearMovementKeys\(keys\.current\)/)
  assert.match(engine, /if \(!direction \|\| isTyping\(\) \|\| disabledRef\.current\) return/)
  assert.match(sources['components/LibraryRoom.js'], /useKeys\(\{ disabled: Boolean\(openCard\)/)
  assert.match(sources['components/LibraryRoom.js'], /keysDown: openCardRef\.current \? \{\} : keys\.current/)
  assert.match(sources['components/WorldMap.js'], /disabled\s*:\s*questOpen \|\| attendanceOpen/)
  assert.match(sources['components/InteriorRoom.js'], /disabled: inputBlocked/)
  assert.match(sources['app/page.js'], /zoneInputBlocked = screen === 'annotate' \|\| showFeedback \|\| Boolean\(blockUnlockInfo\)/)
  for (const path of [
    'components/MusicZoneMap.js', 'components/NatureZoneMap.js', 'components/HumanZoneMap.js',
    'components/UrbanZoneMap.js', 'components/AnimalZoneMap.js', 'components/ZoneMap.js',
  ]) assert.match(sources[path], /useKeys\(\{[\s\S]{0,80}?disabled: (?:baseOnly \|\| )?isAnnotating \|\| exitConfirm/)
  assert.match(sources['components/LabZoneMap.js'], /disabled:isAnnotating\|\|!!modal\|\|complete/)
})

test('meaningful controls log once per activation and Enter repeat is ignored', () => {
  const engine = sources['components/GameEngine.js']
  assert.match(engine, /!e\.repeat && !keys\.current\[direction\]/)
  assert.match(engine, /target_id: `map-control-\$\{direction\}`/)
  assert.match(engine, /metadata: \{ source: 'dpad' \}/)
  for (const path of ['components/HumanZoneMap.js', 'components/UrbanZoneMap.js']) {
    assert.match(sources[path], /press\(direction, interactionMethod\)/, `${path} must preserve mouse versus touch input`)
  }
  assert.match(sources['components/LabZoneMap.js'], /press\(direction,interactionMethod\)/)
  for (const path of [
    'components/LibraryRoom.js', 'components/WorldMap.js', 'components/MusicZoneMap.js',
    'components/NatureZoneMap.js', 'components/HumanZoneMap.js', 'components/UrbanZoneMap.js',
    'components/AnimalZoneMap.js', 'components/LabZoneMap.js', 'components/ZoneMap.js',
  ]) assert.match(sources[path], /repeat/, `${path} must reject repeated keyboard activation`)
})

test('library and world panels preserve precise close reasons', () => {
  const library = sources['components/LibraryRoom.js']
  for (const reason of ['close_button', 'escape', 'backdrop', 'navigation', 'component_unmounted']) {
    assert.match(library, new RegExp(`['"]${reason}['"]`))
  }
  assert.match(library, /library_card_opened/)
  assert.match(library, /library_card_closed/)
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
  assert.match(interior, /navigator\.clipboard\.writeText\(inviteUrl\)/)
  assert.match(interior, /error_code: 'clipboard_write_failed'/)
  assert.doesNotMatch(interior, /metadata:\s*\{[^}]*inviteUrl/)
})

test('duo reconnect requires a prior observed partner connection', () => {
  const world = sources['components/WorldMap.js']
  assert.match(world, /partnerEverConnectedRef\.current \? 'duo_reconnected' : 'duo_connected'/)
  assert.match(world, /if \(connected\) partnerEverConnectedRef\.current = true/)
})
