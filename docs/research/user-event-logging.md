# Stage 4: study sessions and append-only user events

## Session definition

`participant_id` remains the registered study identity. `study_sessions.id` is a UUID for one experiment round. Stage 7 adds a server-owned `experiment_round`: reload and authenticated browser restart recover the same active session, and a completed current round returns its completed session instead of creating a new one. A new session after completion requires an audited operator-issued round increment; there is no public reset/retest endpoint. Each page load still creates a separate `client_instance_id` and sequence space.

## Database boundary

`study_sessions` stores server-derived `auth_user_id`, `participant_id`, and `group_id`, session status/times, experiment/browser context, and last activity. `user_events` is append-only and uniquely constrained by both event UUID and `(study_session_id, client_instance_id, sequence_no)`. `received_at` is always database time; `occurred_at` is client time and is rejected outside a 30-day past/24-hour future window.

`user_event_names` is a lookup table rather than an enum. Adding an event is an ordinary forward migration that inserts one reviewed row; existing event rows and functions do not need a type rewrite. Deactivate a name only after old clients stop sending it. The recording RPC also enforces allowlists for metadata, before/after values, and nested room-position keys so a direct RPC call cannot bypass the client sanitizer and add arbitrary fields.

Participants have no INSERT/UPDATE/DELETE policy and cannot SELECT event/session rows. Writes go through a validating `SECURITY DEFINER` RPC with an empty search path. Authenticated researcher reads require explicit membership in `private.user_event_researchers`; service role retains its normal RLS bypass. The server ignores no identity field: client identity fields are not allowed in the event JSON at all, and are derived from the owned session.

## RPCs and limits

- `start_or_resume_study_session_v2`: validates the owned participant and round, ignores stale foreign/old-round resume IDs, recovers the server-side active or completed session, and creates only when neither exists. Authenticated execute on v1 is revoked by 006.
- `record_user_events_v1`: accepts 1–25 events and at most 100 KiB per batch, 8 KiB per event, and 2 KiB metadata. It validates exact keys, event names, UUIDs, sequence numbers, timestamps, string lengths, session ownership, and active status. Same event-ID replay is counted as a duplicate.
- `complete_study_session_v1`: after 006, verifies and returns an already-completed owned session for the logger handshake; it cannot complete an active session. Actual completion is atomic with the final normal annotation in `submit_annotation_v4`.
- `save_participant_room_v3`: moves the previous direct room upsert behind the 003 idempotent-operation/result model so room save logs can be joined reliably.

All RPC execute privileges are revoked from PUBLIC/anon and granted only where required. `private.user_event_settings.collection_enabled` is the server-side kill switch.

## Client queue and failure isolation

The browser creates event IDs once, increments sequence per client instance, batches 25 events or flushes every five seconds, and accelerates important persistence-result flushes. Failed sends retain the same events in memory and participant/session-scoped local storage, use exponential backoff capped at 60 seconds, and stop automatic attempts after eight failures until a reconnect or page reload. Online, visibility-hidden, and pagehide trigger non-blocking flush attempts. Queues retain at most 500 rows for seven days; when full, noncritical rows are evicted first. Changing auth users or study sessions never relabels an old queue into the new identity.

Event transport is deliberately outside annotation/vote/purchase/room transactions. Logger errors are caught and never change the core result shown to the participant. Revised 004 allows an owned completed session to accept its remaining queue only through `completed_at + 10 minutes`; later events are rejected. This lets the DB commit the final annotation/session first and the `session_completed` event flush afterward without coupling transactions.

There is no external rate-limit service in this repository. Batch/payload caps and active-session ownership provide the database-side safety boundary. At deployment, add a gateway limit at `record_user_events_v1` (recommended starting point: 60 calls/minute per authenticated user with a short burst allowance), monitor rejection/queue metrics, and tune from measured study traffic.

## Data minimization

The allowlist rejects arbitrary top-level and metadata keys. Access tokens, service keys, participant claim material, passwords, full URLs/query strings, share tokens, localStorage dumps, internal SQL messages, and keystroke characters are never added. Expression edits record `{length, empty}` only; final expression text remains solely in `annotations`. Museum events use the already anonymized annotation UUID and never include the author participant ID.

## Deployment and emergency stop

Original Stage 4 order is superseded by the full Stage 7 maintenance-window order:

1. Apply 001.
2. Register participants and sound catalog; run its checks.
3. Apply 002, then 003.
4. Run `user-event-logging-preflight.sql`; review and apply the revised 004, then 005.
5. Run `experiment-rules-preflight.sql`, resolve all blockers, apply 006, and run both verify scripts and integration suites against a local/staging clone.
6. Deploy the instrumented v2/v4 app only after 006 is present. Existing old-001 staging must first reapply revised 001 and rerun the guarded catalog sync as described in the Stage 7 audit.

Emergency pause preserves all data and earlier security work:

```sql
update private.user_event_settings set collection_enabled=false,updated_at=now() where singleton;
```

For a harder rollback, revoke authenticated EXECUTE on the three collection/session RPCs. Do not drop `user_events`, `study_sessions`, existing result tables, or migrations 001–003. Restore collection by setting the flag true after remediation. The room-save RPC is part of the instrumented app deploy; if rolling the app back to the prior direct-upsert version, its execute privilege may remain harmlessly in place.

## Tests and analysis

Unit tests exercise identity/sequence generation, client-instance separation, retry retention, same-ID replay, batch limits, participant queue isolation, strict-effect dedupe, allowlists, expression redaction, and payload limits. `user-event-logging.integration.mjs` is local-only and verifies auth, ownership, spoof rejection, replay, sequence collision, append-only grants, hidden SELECT, limits, event-name validation, service reads, completion, and completed-session rejection.

Use `user-event-analysis.sql` as service role or a registered researcher. It contains session summaries, timelines, dwell estimates, zone/audio counts, modal and confidence funnels, persistence/retry reconciliation, museum selection funnels, abandonment inference, sequence/time checks, and result/log mismatch checks.

## Event catalog

The canonical full list is the seeded values in `004_user_event_logging.sql` and the identical `USER_EVENT_NAMES` client constant. Stage 7 adds panel-instance `quest_row_impression` and proximity-edge `collectible_approached`; neither records paths, coordinates, pointer movement, or held-key frames.

## Stage 8 execution status

The User Event local integration runner was not executed in Stage 8 because no Supabase CLI
or container runtime was installed and no isolated local project existed. Static User Event
tests re-passed 6/6; this does not prove database grants, append-only behavior, completed-session
final flush, event/result linkage, or cleanup. No remote environment or `.env.local` value was
used. Resume requirements are recorded in
`docs/research/functional-audit-stage-8-local-integration.md`.

## Stage 8 executed local and browser result (2026-09-12)

The preceding status is retained as history but is superseded for local database validation.
On a new disposable loopback project, User Event preflight ran before 004, migrations 004–005
applied, User Event verify passed, and `user-event-logging.integration.mjs` exited 0. The runner
verified authenticated session ownership, identity-spoof rejection, event-ID replay, sequence
collision rejection, append-only grants, hidden participant SELECT, payload and batch limits,
event-name validation, service/researcher reads, completed-session final flush, and rejection
outside the allowed completion window.

Two origin-isolated browser sessions then produced 408 events during the exercised login,
screen, attendance, quest, world/Library/Music navigation, collectible, annotation-modal,
audio-failure, and skip paths. Stored close reasons included the actual navigation, backdrop,
close-button, component-unmount, and skip outcomes. An aggregate scan of stored event JSON
found no coordinate/pointer, share-token, service-role, or SQL-like metadata pattern. The UI
rendered a friendly audio-load error without SQL, stack, key, participant ID, or database
detail. Exact identities and raw payloads were never printed.

Result linkage was observed for the single skipped annotation: a rapid double-click converged
to one annotation row, one skip attempt, and one skip success. Full normal-annotation,
vote-result, final-completion, and live Realtime browser event reconciliation was not executed
because the first product-path audio file and its fallbacks returned 404. Reconnect behavior
therefore remains proven only by static tests, not by a live A/B browser session.

All E2E sessions, events, results, auth users, and other participant-owned rows were removed;
post-cleanup counts were zero for the tracked identities and the catalog remained 1,000/995.
No remote environment or `.env.local` value was used. The detailed pass/not-run matrix is in
`docs/research/functional-audit-stage-8-local-integration.md`.

## Stage 8B live browser reconciliation (2026-09-13)

The final genuinely separate A/B context run reconciled 117 semantic event rows. Required
playback-attempt/start, normal annotation, museum playback/vote, and session-completion events
were present. Rapid duplicate activation generated one Music annotation attempt/success pair
and one Music vote attempt/success pair. The single completion event referenced the same
annotation stored as the completed session boundary. Actual private Realtime interaction
produced connected, disconnected, and reconnected only after the still-mounted WorldMap first
observed presence, then absence, then presence again; initial connection was not mislabeled.

Selected payload fields contained no pointer/coordinate frames, share-token field,
authorization/service-role material, SQL-like text, or stack trace. Exact participant/auth
identities and raw payloads were not added to documentation. All event/session/result rows for
the randomized run were removed and aggregate cleanup returned zero tracked owned rows.

## Stage 10 room-event minimization

`room_save_succeeded` links to its idempotent operation through `operation_type=room_save` and
`operation_idempotency_key`. It deliberately omits `result_entity_id`, because the current room
primary key is the participant ID. The event never copies the raw room JSON, share token, auth
ID, or participant ID into target/result/value/metadata fields. Identity remains only in the
server-derived protected columns required by the User Event schema and is not client supplied.

## Stage 10B room-event browser reconciliation (2026-09-14)

The real room UI in two separate browser contexts produced six room-save event rows: the
forced failure and retry lifecycle for A plus B's independent save lifecycle. Each logical
save had exactly one `room_save_succeeded` row, sessions stayed separated by authenticated
owner, and operation type/key linkage matched the corresponding idempotent result. The
success events kept `result_entity_id` null as designed. Aggregate redaction checks found no
raw room document, share token, authorization material, auth ID, participant ID, or
identity-like test value in client-controlled event payload fields. The randomized events,
sessions, participants, and auth users were removed after the run.
