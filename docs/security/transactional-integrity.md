# Transactional integrity (stage 3)

This change is review-only until it is applied to a non-production Supabase project. It does not apply SQL to production.

## Existing write inventory

| User action | Caller | Previous writes | Partial/duplicate risk | New boundary |
| --- | --- | --- | --- | --- |
| Annotation submit | `AnnotationPanel` → `saveAnnotation` | annotation insert, reward RPC, quest RPC | reward/quest detached; retry inserted again | `submit_annotation_v3` |
| Annotation skip | `AnnotationPanel` → `saveAnnotation` | annotation insert | error swallowed; modal still closed | `submit_annotation_v3` (`annotation_skip`) |
| Museum vote | `SoundMuseum` → `saveVote` | vote insert, trigger count, reward RPC, quest RPC | error swallowed; completion still advanced | `submit_museum_vote_v3` |
| Attendance | `app/page` → `ensureTodayCheckIn` | attendance + reward in old RPC | date uniqueness existed, no request identity | `ensure_today_check_in_v3` |
| Quest progress/reward | annotation/vote UI → progress RPC | recount + reward | detached from source write | private function inside submit RPCs |
| Currency reward | currency helper → award RPC | ledger + balance | source write was already committed | private source-specific credit inside submit/check-in RPCs |
| Outfit/interior/house purchase | client → purchase Route Handler | ownership, ledger, balance | server generated a new key per retry | client key → `secure_purchase_admin` |
| Outfit equip | shop → direct upsert | equipped row | optimistic UI followed any resolved call | `set_equipped_outfit_v3` |
| Interior room | decor component → direct upsert | room snapshot | retries could bypass result/event linkage | `save_participant_room_v3`; direct table writes revoked by 007 |
| House layout | house decor component → direct insert/update/delete | layout rows | not coupled to rewards or purchases | existing owner-only RLS retained; schema mismatch is a preflight blocker |

The codebase also contains test utilities and seed/delete scripts. They remain service/test-only and are not a browser production mutation path.

## Idempotency and atomicity

Every covered user action uses a UUID generated once at the start of the action. A retry retains the UUID; success clears it. `idempotent_operations` has a primary key on `(auth_user_id, operation_type, idempotency_key)`. Results belong to the authenticated user and the table has no browser grants.

The operation row is created inside the same transaction as domain writes. A PostgreSQL error rolls back both, so a failed request can be retried and cannot leave a permanent `processing` row. A concurrent conflict waits for the first transaction and then returns its stored result. Reward source, participant, group, and fixed reward amounts are resolved in the database. Purchases are the exception for catalogs: the server-only Route Handler resolves the item, grant list, and current price from server imports; the service-only SQL function never accepts browser calls.

`currency_transactions` is the ledger. `participant_currency.balance` is a locked cache updated in the same transaction. A non-negative balance constraint is added only after the preflight proves existing balances are valid. The annotation reward is 5 and vote reward is 2, preserving current rules. Skips receive no reward and do not progress quests.

`vote_count` remains a cache maintained by the existing `AFTER INSERT` trigger. Trigger work shares the vote transaction and rolls back with it. The preflight reports drift against the `votes` source table.

## Duplicate semantics not inferred

No new business-level uniqueness is imposed on annotations or votes. Current code does not establish whether a new block, stage, experiment version, group, reconnection, or post-skip response is a new trial. The researcher must decide:

- whether participant + sound is unique, and which block/stage/version/session fields define a trial;
- whether a skip can later be replaced by an annotation;
- whether one vote is allowed per sound, candidate, museum visit, or experiment trial;
- whether reconnecting preserves the same experiment trial and whether `group_id` participates.

Until then, only replay of the same user action is deduplicated. The preflight lists candidate historical duplicates without changing them.

## Apply and validate

1. Back up the database and pause writes.
2. Run `transactional-integrity-preflight.sql` read-only. Resolve, do not auto-delete, ledger drift, negative balances, vote-count drift, and house schema mismatch.
3. Apply `001_auth_foundation.sql`.
4. Register participants and synchronize `study_sound_catalog`.
5. Apply `002_enforce_participant_rls.sql`.
6. Deploy application code and apply `003_transactional_integrity.sql` in the same maintenance window.
7. Run the preflight grant query again and the integration suite in staging.

The local integration runner requires `SECURITY_TEST_SUPABASE_URL`, `SECURITY_TEST_SUPABASE_ANON_KEY`, and `SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY`; it refuses non-local hosts. Run `npm run test:transactional-integrity-local` after applying all three migrations locally. The static suite is `npm run test:transactional-integrity`.

## Rollback

Prefer a forward fix. For emergency application rollback, pause writes first. Revoke execute on the four v3 browser RPCs, deploy the previous app, and explicitly restore only the reviewed old grants required by that app. Do not disable RLS and do not grant participant tables to `anon`. Keep `idempotent_operations` and ledger keys for audit; dropping them loses replay history and is not part of emergency rollback. Re-run the grant query after any rollback.

## Future user events

Every result exposes `operationType` and `idempotencyKey` in the client result envelope; successful DB results include domain IDs, reward/transaction IDs, balance, and quest completions. Failures carry a stable public error code and retryability flag. These fields can be connected to the later `user_events` work without changing transaction semantics.

Room saves use the same operation-key result boundary. A same-key replay returns the stored
result without another write. Different keys are separate whole-snapshot saves; concurrent
requests serialize through the room primary key and the final row is one complete submitted
snapshot, never a fieldwise merge. Stage 10 migration 007 makes this RPC the only
authenticated room-write path.

## Stage 10B room-save browser result (2026-09-14)

Separate browser contexts A and B used the actual `InteriorDecorRoom` UI. A forced first
network failure retained the unsaved edit and input, showed the failure state, and succeeded
on retry; rapid retry activation still produced one logical successful result. Reload, an A
replacement context restored only from A's authenticated storage state, and B's independent
edit all recovered the correct owner snapshots. Same-key replay did not create a second
success result, and identity-like JSON values remained ordinary caller-owned room content.

The six observed room events were the expected attempt/failure/retry/success sequence across
the two owners, with exactly one success per logical save. Success linkage retained the
operation type and idempotency key but no result entity ID, raw room JSON, share token, auth
ID, or participant ID in event payload fields. This closes local browser behavior; staging
schema compatibility and migration ordering remain unverified without the authorized
inventory and ledger.

## Stage 7 superseding result rules

Migration 006 supersedes the v3 annotation, vote, attendance, and session-start browser boundaries after 001–005 are installed and the source catalog is resynchronized. Authenticated execute on the v3 writers and `start_or_resume_study_session_v1` is revoked. The client uses `submit_annotation_v4`, `submit_museum_vote_v4`, `ensure_today_check_in_v4`, and `start_or_resume_study_session_v2`.

V4 preserves operation-key replay and adds business uniqueness by `(participant_id, experiment_round, canonical_audio_id)`. Canonical identity and round are database-derived. Independent-key and concurrent duplicates return the existing result without a second reward. Skips remain repeatable and do not satisfy completion. The last assigned normal annotation and the linked study-session completion update share one transaction. The v1 completion RPC can only verify an already-completed session, preventing premature direct-RPC completion. See `docs/research/functional-audit-stage-7.md` for preflight blockers and deployment order.

## Stage 8 local rehearsal readiness

The security migrations are explicitly transaction-wrapped, but the historical feature
schema files are not. A disposable rehearsal must apply each base file with `psql -v
ON_ERROR_STOP=1 --single-transaction` and recreate the disposable database after any failure.
The current repository is not a complete new-install source: it lacks the `annotations` and
`votes` definitions and its checked-in house schema does not satisfy 002. No integration
result is valid until a reviewed canonical base schema is supplied. The full blocked result
and resume procedure are in `docs/research/functional-audit-stage-8-local-integration.md`.

## Stage 8 executed local result (2026-09-12)

The reviewed `core_schema.sql` restored from Git history and the explicitly local-only house
and quest compatibility fixtures made a fresh disposable rehearsal possible without guessing
or changing a remote schema. Transactional preflight returned no duplicate result rows,
ledger drift, negative balance, vote-count drift, or missing locally supplied compatibility
column. Migrations 002 and 003 then applied transactionally.

`transactional-integrity.integration.mjs` exited 0 against the same full-catalog project used
for every other Stage 8 runner. It verified operation-key replay, concurrent convergence,
atomic annotation/vote rewards and quest progress, attendance and purchase idempotency,
non-negative balance, failed-operation rollback, and owner-only room/layout paths. The later
experiment-rules runner also passed independent-key and alias duplicates, final-annotation
completion linkage, completed-session resume, and rejection of additional completed-round
writes.

In the browser, repeated loads for two tracked participants produced only two attendance rows,
and a rapid double-click on skip produced one skipped annotation and one success event. Normal
annotation and vote could not be exercised because the selected catalog audio file and its
fallback extensions were absent from `public/audio`, producing a 404 before listening was
established. Those browser paths remain unverified even though their RPC-level integration
tests passed.

After browser shutdown, every tracked participant-owned row and auth user was deleted and the
shared catalog remained 1,000 rows/995 canonical identities. The exact local stack was stopped
without backup. Because the successful schema used local-only compatibility fixtures, repeat
the preflight against a reviewed production/staging schema before any rollout.

## Stage 8B browser transaction result (2026-09-13)

Historical Git audio fixtures made the remaining real browser writers executable. Rapid
same-task activation produced one Music annotation and one Music vote with one semantic
attempt/success pair each. A direct second alias annotation and alias vote converged on their
existing canonical rows. The full database runner also re-passed independent-key and
concurrent convergence. After service-only boundary preparation for the exact randomized
participant, the final browser annotation completed the active session in the same v4
transaction; `completion_annotation_id` and the single `session_completed` event both linked
to that actual annotation. Reload and a replacement authenticated context created no new
session or attendance reward. Cleanup returned tracked owned rows 0 and catalog 1,000/995.
