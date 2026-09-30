'use client'

import { getClient } from '@/lib/supabase'

export const USER_EVENT_NAMES = Object.freeze([
  'session_started','session_resumed','session_completed','screen_viewed','screen_exited',
  'zone_entered','zone_exited','navigation_attempted','navigation_succeeded','navigation_failed',
  'network_offline','network_online','unexpected_error','map_control_activated',
  'zone_entry_attempted','zone_entry_blocked','zone_entry_succeeded','collectible_approached',
  'collectible_prompt_shown','collectible_activated','annotation_modal_opened',
  'annotation_modal_closed','audio_play_attempted','audio_play_started','audio_paused',
  'audio_resumed','audio_completed','audio_failed','expression_input_started',
  'expression_input_changed','expression_input_cleared','confidence_selected','confidence_changed',
  'confidence_deselected','annotation_submit_attempted','annotation_submit_succeeded',
  'annotation_submit_failed','annotation_skip_attempted','annotation_skip_succeeded',
  'annotation_skip_failed','museum_entered','museum_exited','museum_candidate_load_attempted',
  'museum_candidate_loaded','museum_candidate_empty','museum_candidate_load_failed',
  'museum_expression_impression','museum_expression_selected','museum_expression_deselected',
  'museum_expression_changed','museum_audio_play_attempted','museum_audio_play_started',
  'museum_audio_failed','museum_vote_submit_attempted','museum_vote_submit_succeeded',
  'museum_vote_submit_failed','museum_next_candidate','attendance_check_attempted',
  'attendance_check_succeeded','attendance_check_failed','attendance_panel_opened','attendance_panel_closed',
  'quest_panel_opened','quest_panel_closed','quest_row_impression','library_card_opened','library_card_closed',
  'quest_completed','reward_applied','currency_balance_viewed','shop_opened','shop_closed',
  'shop_item_viewed','purchase_attempted','purchase_succeeded','purchase_failed',
  'outfit_equip_attempted','outfit_equip_succeeded','outfit_equip_failed','interior_entered',
  'interior_exited','interior_item_selected','interior_item_deselected','interior_item_added',
  'interior_item_moved','interior_item_rotated','interior_item_removed','interior_change_undone',
  'room_save_attempted','room_save_succeeded','room_save_failed','friend_room_open_attempted',
  'friend_room_open_succeeded','friend_room_open_failed','duo_connect_attempted','duo_connected',
  'duo_disconnected','duo_reconnected','invite_link_copy_succeeded','invite_link_copy_failed',
  'economy_v1_preview_opened','village_wallets_viewed','character_item_previewed',
  'character_item_equipped','character_item_unequipped','character_item_equip_failed',
])

const ALLOWED = new Set(USER_EVENT_NAMES)
const TOP_LEVEL_FIELDS = new Set([
  'screen','zone','sound_id','target_type','target_id','interaction_method','value_before',
  'value_after','outcome','close_reason','duration_ms','operation_type',
  'operation_idempotency_key','result_entity_type','result_entity_id','error_code','metadata',
])
const METADATA_FIELDS = new Set([
  'retryable','candidate_index','candidate_count','locked','blocked_reason','price_displayed',
  'price_confirmed','balance','reward_amount','quest_ids','is_new','item_type','position',
  'previous_position','input_empty','previous_empty','source','reason','attempt_number',
  'visibility_state','queue_size','offline','modal_instance_id','transaction_id','play_count',
  'item_id','product_group','price_tier','currency_combination','insufficient_village_count','result_code',
])
const VALUE_FIELDS = new Set(['length','empty','confidence','candidate_index','flipped'])
const POSITION_FIELDS = new Set(['layer','col','row','x','y'])
const CLOSE_REASONS = new Set(['submitted','skipped','close_button','escape','backdrop','navigation','component_unmounted','unknown'])
const METHODS = new Set(['mouse','touch','keyboard','programmatic'])
const MAX_BATCH = 25
const MAX_QUEUE = 500
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const FLUSH_MS = 5000
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'v0.4-web'

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function shortString(value, max = 160) {
  if (value == null) return undefined
  return String(value).slice(0, max)
}

function sanitizePosition(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const clean = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!POSITION_FIELDS.has(key)) continue
    if (typeof raw === 'string') clean[key] = shortString(raw, 40)
    else if (typeof raw === 'number' && Number.isFinite(raw)) clean[key] = raw
  }
  return clean
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const clean = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!METADATA_FIELDS.has(key)) continue
    if (typeof raw === 'string') clean[key] = shortString(raw, 160)
    else if (typeof raw === 'number' && Number.isFinite(raw)) clean[key] = raw
    else if (typeof raw === 'boolean' || raw === null) clean[key] = raw
    else if (Array.isArray(raw)) clean[key] = raw.slice(0, 20)
      .filter(v => ['string', 'number', 'boolean'].includes(typeof v))
      .map(v => typeof v === 'string' ? shortString(v, 80) : v)
    else if ((key === 'position' || key === 'previous_position') && byteLength(raw) <= 512) {
      clean[key] = sanitizePosition(raw)
    }
  }
  return clean
}

function sanitizeValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const clean = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!VALUE_FIELDS.has(key)) continue
    if (typeof raw === 'string') clean[key] = shortString(raw, 80)
    else if (typeof raw === 'number' && Number.isFinite(raw)) clean[key] = raw
    else if (typeof raw === 'boolean' || raw === null) clean[key] = raw
  }
  return clean
}

export function inferInteractionMethod(event) {
  if (!event) return 'programmatic'
  if (event.pointerType === 'touch' || event.type?.startsWith('touch')) return 'touch'
  if (event.type?.startsWith('key')) return 'keyboard'
  return 'mouse'
}

export class UserEventQueue {
  constructor({ transport, storage = null, now = () => Date.now(), randomUUID = () => crypto.randomUUID() } = {}) {
    this.transport = transport
    this.storage = storage
    this.now = now
    this.randomUUID = randomUUID
    this.clientInstanceId = randomUUID()
    this.sequence = 0
    this.queue = []
    this.userId = null
    this.studySessionId = null
    this.context = { screen: null, zone: null }
    this.dedupe = new Set()
    this.flushing = null
    this.retryCount = 0
    this.nextRetryAt = 0
  }

  storageKey(userId = this.userId) { return `sound-village:user-events:${userId || 'unbound'}` }

  bind({ userId, studySessionId }) {
    if (!userId || !studySessionId) return
    if ((this.userId && this.userId !== userId) || (this.studySessionId && this.studySessionId !== studySessionId)) this.queue = []
    this.userId = userId
    this.studySessionId = studySessionId
    this.restore()
  }

  setContext(next) { this.context = { ...this.context, ...next } }

  restore() {
    if (!this.storage || !this.userId) return
    try {
      const rows = JSON.parse(this.storage.getItem(this.storageKey()) || '[]')
      const cutoff = this.now() - MAX_AGE_MS
      this.queue = Array.isArray(rows)
        ? rows.filter(e => e.__study_session_id === this.studySessionId && Date.parse(e.occurred_at) >= cutoff).slice(-MAX_QUEUE)
        : []
    } catch { this.queue = [] }
  }

  persist() {
    if (!this.storage || !this.userId) return
    try { this.storage.setItem(this.storageKey(), JSON.stringify(this.queue.slice(-MAX_QUEUE))) } catch {}
  }

  create(eventName, payload = {}) {
    if (!ALLOWED.has(eventName)) throw new Error(`unknown_user_event:${eventName}`)
    const event = {
      id: this.randomUUID(),
      client_instance_id: this.clientInstanceId,
      sequence_no: ++this.sequence,
      event_name: eventName,
      occurred_at: new Date(this.now()).toISOString(),
      app_version: APP_VERSION,
    }
    for (const [key, value] of Object.entries({ ...this.context, ...payload })) {
      if (!TOP_LEVEL_FIELDS.has(key) || value == null) continue
      if (key === 'metadata') event[key] = sanitizeObject(value)
      else if (key === 'value_before' || key === 'value_after') event[key] = sanitizeValue(value)
      else if (key === 'interaction_method') event[key] = METHODS.has(value) ? value : 'programmatic'
      else if (key === 'close_reason') event[key] = CLOSE_REASONS.has(value) ? value : 'unknown'
      else if (typeof value === 'string') event[key] = shortString(value, key === 'error_code' ? 80 : 160)
      else if (typeof value === 'number' && Number.isFinite(value)) event[key] = value
    }
    if (byteLength(event) > 4096) throw new Error('user_event_payload_too_large')
    return event
  }

  track(eventName, payload = {}, options = {}) {
    if (!this.userId || !this.studySessionId) return null
    if (options.dedupeKey) {
      if (this.dedupe.has(options.dedupeKey)) return null
      this.dedupe.add(options.dedupeKey)
    }
    const event = this.create(eventName, payload)
    if (this.queue.length >= MAX_QUEUE) {
      const removable = this.queue.findIndex(row => !row.__critical)
      this.queue.splice(removable >= 0 ? removable : 0, 1)
    }
    this.queue.push({ ...event, __study_session_id: this.studySessionId, ...(options.critical ? { __critical: true } : {}) })
    this.persist()
    if (options.flush || this.queue.length >= MAX_BATCH) void this.flush()
    return event
  }

  async flush() {
    if (this.flushing || !this.transport || !this.studySessionId || this.queue.length === 0) return this.flushing
    if (this.retryCount >= 8 || this.now() < this.nextRetryAt) return null
    const batch = this.queue.slice(0, MAX_BATCH).map(({ __critical: _critical, __study_session_id: _session, ...event }) => event)
    this.flushing = Promise.resolve(this.transport(this.studySessionId, batch)).then(result => {
      if (!result?.ok) throw result?.error || new Error('event_transport_failed')
      const ids = new Set(batch.map(event => event.id))
      this.queue = this.queue.filter(event => !ids.has(event.id))
      this.retryCount = 0
      this.nextRetryAt = 0
      this.persist()
      return result
    }).catch(error => {
      this.retryCount += 1
      this.nextRetryAt = this.now() + Math.min(60_000, 1000 * (2 ** (this.retryCount - 1)))
      this.persist()
      throw error
    }).finally(() => { this.flushing = null })
    return this.flushing
  }
}

let queue = null
let flushTimer = null
let lifecycleInstalled = false

function getQueue() {
  if (!queue) queue = new UserEventQueue({
    storage: typeof localStorage === 'undefined' ? null : localStorage,
    transport: async (studySessionId, events) => {
      const { data, error } = await getClient().rpc('record_user_events_v1', {
        p_study_session_id: studySessionId,
        p_events: events,
      })
      return error ? { ok: false, error } : { ok: true, data }
    },
  })
  return queue
}

function installLifecycle() {
  if (lifecycleInstalled || typeof window === 'undefined') return
  lifecycleInstalled = true
  const q = getQueue()
  const flushSoon = () => { q.persist(); void q.flush().catch(() => {}) }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSoon()
  })
  window.addEventListener('pagehide', flushSoon)
  window.addEventListener('offline', () => q.track('network_offline', { metadata: { offline: true } }, { critical: true }))
  window.addEventListener('online', () => {
    q.retryCount = 0
    q.nextRetryAt = 0
    q.track('network_online', { metadata: { offline: false } }, { critical: true })
    flushSoon()
  })
  flushTimer = window.setInterval(() => void q.flush().catch(() => {}), FLUSH_MS)
}

export async function startStudySession(initialScreen = 'world') {
  if (typeof window === 'undefined') return null
  const { data: auth } = await getClient().auth.getSession()
  const userId = auth?.session?.user?.id
  if (!userId) return null
  const resumeKey = `sound-village:study-session:${userId}`
  const resumeId = localStorage.getItem(resumeKey)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 2000)
  let data
  let error
  try {
    const response = await getClient().rpc('start_or_resume_study_session_v2', {
      p_resume_session_id: resumeId || null,
      p_client_instance_id: getQueue().clientInstanceId,
      p_initial_screen: initialScreen,
      p_experiment_version: APP_VERSION,
      p_user_agent: navigator.userAgent.slice(0, 512),
      p_viewport_width: window.innerWidth,
      p_viewport_height: window.innerHeight,
      p_locale: navigator.language,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).abortSignal(controller.signal)
    data = response.data
    error = response.error
  } catch (requestError) {
    error = requestError
  } finally {
    window.clearTimeout(timeout)
  }
  if (error || !data?.studySessionId) {
    if (process.env.NODE_ENV === 'development') console.debug('[user-events] session unavailable', error?.code)
    return null
  }
  localStorage.setItem(resumeKey, data.studySessionId)
  const q = getQueue()
  q.bind({ userId, studySessionId: data.studySessionId })
  q.setContext({ screen: initialScreen })
  installLifecycle()
  if (data.status === 'active') q.track(data.resumed ? 'session_resumed' : 'session_started', {
    target_type: 'study_session', target_id: data.studySessionId,
  }, { critical: true, flush: true, dedupeKey: `session:${q.clientInstanceId}` })
  return data
}

export function trackEvent(eventName, payload, options) {
  try { return getQueue().track(eventName, payload, options) }
  catch (error) {
    if (process.env.NODE_ENV === 'development') console.debug('[user-events] dropped', error?.message)
    return null
  }
}

export function setUserEventContext(context) { getQueue().setContext(context) }
export async function flushEvents() {
  const q = getQueue()
  let result = null
  for (let batch = 0; batch < 8 && q.queue.length > 0; batch += 1) {
    const before = q.queue.length
    result = await q.flush().catch(() => null)
    if (q.queue.length >= before) break
  }
  return result
}

export async function completeStudySession(reason = 'explicit_completion', result = {}) {
  const q = getQueue()
  if (!q.studySessionId) return null
  const { data, error } = await getClient().rpc('complete_study_session_v1', {
    p_study_session_id: q.studySessionId,
    p_completion_reason: reason,
  })
  if (error || data?.status !== 'completed') return null
  q.track('session_completed', {
    outcome: 'succeeded', metadata: { reason },
    operation_type: result.operationType,
    operation_idempotency_key: result.idempotencyKey,
    result_entity_type: result.annotationId ? 'annotation' : undefined,
    result_entity_id: result.annotationId,
  }, { critical: true, dedupeKey: `session-completed:${q.studySessionId}` })
  await flushEvents()
  return data
}

export const __testing = { MAX_BATCH, MAX_QUEUE, sanitizeObject, sanitizeValue, byteLength }
