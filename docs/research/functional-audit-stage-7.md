# Functional audit stage 7: experiment rules, canonical results, recovery, and completion

Date: 2026-09-11

This is a repository-only implementation and audit. No production Supabase connection was made, and no SQL, migration, or data change was executed against any database.

## Confirmed research rules

- A participant completes the experiment after one normal Stage 1 annotation for every canonical audio assigned to the participant's current A/B group. Skip rows remain as history and do not count as completion.
- A normal annotation is unique by participant, experiment round, and canonical audio. A vote uses the same uniqueness unit. A retry with the same operation key and an independent duplicate with another key both return the existing successful result.
- Museum voting is enabled only after playback actually starts. Completion of the audio is not required. Failure, target change, and component remount leave the new target locked until its own playback starts.
- Attendance and daily quests use the database's `Asia/Seoul` calendar day. Historical UTC-day rows are reported and never automatically rewritten.
- An active study session represents one experiment round. It is recovered across navigation, reload, and browser restart while authentication survives. The last normal annotation and session completion are one database transaction. General reconnect to a completed round returns the completed session and completion UI; only an operator-issued `experiment_round` increment can create an official retest.
- `difficulty` and `selected_features` are not measured by the current UI. New v4 annotation writes require those RPC arguments to be null and explicitly store null. Historical `3` and `[]` values are not rewritten and must be interpreted as unmeasured in analysis.

## Canonical audio identity audit

`canonical_audio_id` is derived as the normalized `source_dataset:original_filename`. `file_path` is retained as an independent reviewed source check. The browser helper is only for display/filtering; v4 write RPCs ignore any client identity claim and resolve the submitted `sound_id` through `study_sound_catalog`.

The checked-in metadata contains 1,000 rows and 995 canonical audio identities. Exactly five alias pairs point to the same source and path:

| Canonical ID | Alias IDs | Metadata classification |
| --- | --- | --- |
| `fsd50k:248110` | `NAT_248110`, `Nature_248110` | conflict: Rain / Thunder |
| `fsd50k:147182` | `NAT_147182`, `Nature_147182` | Ocean / Ocean |
| `fsd50k:420296` | `NAT_420296`, `Nature_420296` | Wind / Wind |
| `fsd50k:179173` | `LAB_179173`, `Lab_179173` | conflict: Bell / Dishes and pots and pans |
| `fsd50k:2510` | `LAB_2510`, `Lab_2510` | conflict: Explosion / Fireworks |

The three classification conflicts are not automatically resolved. They share a real source identity and therefore one result identity, while their analysis category requires human review. The former numeric-suffix bridge is not used by active progress or museum code: equal numeric suffixes from different datasets remain different canonical IDs. A regression fixture fixes that behavior.

`register-study-data.mjs` now validates duplicate `sound_id` values, canonical-to-source ambiguity, and every existing catalog row before its first write. An existing sound whose canonical ID, path, dataset, filename, zone, category, group, source type, or AudioSet class differs causes the sync to stop instead of silently overwriting the audited mapping.

## Migration 006

`006_experiment_rules_and_uniqueness.sql` adds source-backed result identity and `experiment_round`, then backfills only rows whose exact raw sound ID exists in the catalog. Unknown sound IDs, ambiguous source mappings, duplicate normal annotations, duplicate votes, multiple active sessions, incompatible nullability, legacy completed sessions, and already-complete active sessions abort the migration. It does not delete or merge result rows.

The database constraints are:

- normal annotation: unique `(participant_id, experiment_round, canonical_audio_id)` with a partial predicate excluding skips;
- vote: unique `(participant_id, experiment_round, canonical_audio_id)`;
- active session: at most one per `(participant_id, experiment_round)`;
- session completion annotation: foreign key to the actual annotation row.

`submit_annotation_v4` derives participant, group, round, catalog metadata, and canonical identity on the server. It uses the unique index plus `ON CONFLICT DO NOTHING`, so concurrent independent requests converge on the same normal annotation. Skips may repeat and remain incomplete. The RPC calculates distinct canonical progress after a successful normal insert and updates the active session to completed, including the last annotation ID and operation key, in the same transaction.

`submit_museum_vote_v4` derives identity from the catalog, requires an active current-round session and a positive successful-play count, validates an eligible other-group annotation, and converges concurrent duplicates on one vote. Candidate counts, candidate expressions, completed-audio lists, and voted-audio lists use canonical identity.

The old v3 write RPCs and `start_or_resume_study_session_v1` lose authenticated execute permission. The v1 completion RPC remains only as a verification/final-log handshake and cannot change an active session; early completion now fails. This closes direct-RPC bypasses that the first draft of 006 left available.

## Recovery and completed participants

`start_or_resume_study_session_v2` first validates an owned resume ID, then finds the server-side active session for the current round, then the completed session. It creates a session only when neither exists. A stale local-storage UUID from another participant or round is ignored rather than rebound.

The app loads canonical DB progress before showing gameplay. Failed progress retrieval blocks progression so completed sounds are not accidentally shown again. Completed participants see the completion screen and do not run attendance check-in, quest/world unlock refresh, room-share creation, friend-room navigation, or currency/equipment initialization. The final `session_completed` event is queued only after the annotation RPC reports DB completion. Event transport remains outside the result transaction; revised 004 permits the final queue to flush for ten minutes after `completed_at`.

## KST date boundary

`private.study_date_kst(timestamp)` and `private.study_day_start_kst(date)` are the single database boundaries used by v4 attendance and quest assignment/progress. `2026-09-10 14:59:59+00` is KST 2026-09-10 and `2026-09-10 15:00:00+00` is KST 2026-09-11. The verify SQL includes both boundary probes. The client supplies no date. Existing attendance and quest rows whose stored date differs from their KST creation date are listed by preflight only.

## User Event additions

- `quest_row_impression`: one event per visible quest per opened panel instance. React rerenders reuse the instance dedupe key; reopening generates a new instance.
- `collectible_approached` and `collectible_prompt_shown`: emitted on the proximity target edge. Remaining inside the range produces no repeat; leaving fully resets the edge, allowing a later re-entry event.

Coordinates, paths, pointer movement, held-key frames, and expression text are not added. The client and revised 004 allowlists contain the same event names, and logging failure never blocks result persistence.

## Read-only preflight blockers

Run `experiment-rules-preflight.sql` and resolve every returned row before 006. It reports incomplete catalog identity, alias/source ambiguity, category differences inside aliases, result rows with unknown sound IDs, canonical normal-annotation/vote duplicates, multiple active sessions, legacy completed sessions, active sessions whose work is already complete, nullability, and historical UTC/KST date conflicts. Resolution is an audited operator decision; no cleanup SQL is supplied.

## Application order

New local/staging installation:

1. Apply revised 001.
2. Run participant/catalog synchronization and review its 1,000-row/995-identity report.
3. Apply 002, 003, revised 004, then 005.
4. Run the read-only 006 preflight and resolve all blockers.
5. Apply 006, run verify SQL and all local integration runners.
6. Deploy the v2/v4 client only after the database functions exist.

Existing staging with old 001–005:

1. Capture schema, grants, function definitions, and a backup; pause writes.
2. Reapply the revised idempotent 001 to add nullable catalog identity columns. Do not deploy the Stage 7 app yet.
3. Rerun the guarded catalog synchronization. It stops on any existing mapping disagreement.
4. Reapply revised 004 so the new event names and completed-session final-flush rule are present; confirm 005 exists.
5. Run the 006 preflight, resolve every blocker manually, apply 006, then run verify and integration tests.
6. Deploy the v2/v4 app in the same reviewed maintenance window.

006 cannot be applied before catalog resynchronization: a failed attempt rolls back, but it is not a schema-upgrade substitute. The current project reports that production has none of 001–005, so only the new-install path applies there after staging approval.

## Rollback and forward fix

Prefer a forward fix. Pause writes and revoke authenticated execute on v4 write/session functions if rollout must stop. Do not disable RLS, regrant anon/table mutation, delete `idempotent_operations`, delete skips, merge aliases, decrement experiment rounds, or rewrite historical dates. Restore only reviewed function/grant definitions in a maintenance window. A retest is an audited server-side round increment, not a public reset endpoint.

## Verification status

The final repository verification passed:

- Stage 7 experiment rules: 11/11
- Stage 6 lifecycle: 7/7
- input lifecycle: 2/2
- User Event: 6/6
- audio lifecycle: 3/3
- functional fixes: 3/3
- security boundary: 4/4
- transactional integrity: 4/4
- internal route protection: 4/4
- total related static/unit tests: 44/44
- changed-file ESLint: 0 errors, 0 warnings
- `git diff --check`: pass
- `next build --webpack`: pass, 26 App Router routes generated
- built browser static bundle: no service-role identifier

The production build retained the previously known `module.register()` deprecation warning and four malformed generated-CSS variable warnings; no new build warning was observed. A separate diagnostic lint of the previously changed Stage 6 surfaces still reports seven existing `<img>` warnings in `LibraryRoom` and 20 existing React purity/ref errors in `ZoneMap`; Stage 7 did not modify those render paths or expand into that refactor.

The local-only integration runners were completed and passed `node --check`, but no `SECURITY_TEST_SUPABASE_*` credentials or explicit local/staging instance were provided, so no integration SQL or data fixture was executed. Browser E2E requiring Supabase was likewise not substituted with `.env.local` or production access.

## Follow-up: persistent friend-room praise

Implement praise as a separate security and privacy stage. The authenticated sender must be derived from `auth.uid()`; the recipient must be resolved server-side from an enabled opaque room share, never accepted as an arbitrary participant ID. Define a constrained RPC, private/RLS-protected storage, recipient visibility, duplicate cadence, per-sender and per-room rate limits, blocking, retention/deletion, moderation, share rotation behavior, and analysis exposure before implementation. Do not place tokens, raw participant IDs, or message text in User Events.

## Human approval before production

- Resolve the three alias category conflicts and every preflight row without deleting evidence.
- Approve the historical completed-session treatment and any official retest round changes.
- Confirm actual production column nullability and the historical house-schema prerequisite.
- Run all local/staging integration suites, A/B participant rehearsals, KST-boundary checks, concurrency checks, and final User Event/result reconciliation.
- Review the migration/app maintenance-window order and backups before any production action.
