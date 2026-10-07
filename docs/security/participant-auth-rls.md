# Participant authentication and RLS runbook

## Decision

This project uses **Supabase anonymous Auth + an `auth.uid()` participant mapping + RLS**.
It preserves the browser Supabase and Realtime architecture without adding email/password UI.
Typing an ID is not authentication by itself: the Next.js claim route validates the Supabase
JWT, and a service-role-only database function atomically binds that auth user to one
pre-registered participant ID. The service-role key is imported only by a `server-only` module.

Anonymous Auth must be enabled in the Supabase Auth provider settings. Anonymous Auth users
use the Postgres `authenticated` role. A participant who clears browser storage loses the
anonymous session and needs an operator-assisted rebind; do not clear `auth_user_id` without
verifying the participant.

## Data boundary

| Data or feature | Browser permission after enforcement | Cross-participant path |
| --- | --- | --- |
| annotations | own SELECT/INSERT; sound and group validated | museum RPCs return ID/expression/confidence/count only |
| votes | own SELECT/INSERT; target validated | target lookup occurs inside a constrained helper |
| currency + ledger | own SELECT only | none |
| outfits/interior/house inventory | own SELECT only | none |
| equipped outfit | own SELECT/INSERT/UPDATE, owned item only | none |
| daily quests + attendance | own SELECT only | atomic RPCs calculate progress/rewards |
| own room | own SELECT; writes only through `save_participant_room_v3` | opaque enabled share token returns room JSON only |
| house layout | own SELECT/INSERT/UPDATE/DELETE, owned item only | none |
| Realtime duo | private channel with expiring membership | share-token topic only |

The browser no longer executes `increment_vote_count`, `increment_currency_balance`, or
`increment_house_item_quantity`. A vote trigger maintains the display count. Currency rewards
validate their source row and are idempotent. Purchases go through a Next.js route, which uses
the repository catalog price and calls a service-role-only atomic purchase function.

## Environment variables

Next.js client:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Next.js server only:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Never use `NEXT_PUBLIC_` for the service-role key. Keep the existing internal-route default:
`ENABLE_INTERNAL_TEST_ROUTES` absent/false in production and Preview; use the exact value
`true` only in local development.

The one-time registration command also needs `PARTICIPANT_REGISTRY_FILE` and the explicit
write confirmation `CONFIRM_STUDY_DATA_SYNC=true`. Do not commit the real registry CSV.

## Pre-registration

1. Copy `scripts/security/participants.example.csv` outside the repository or to an ignored,
   access-controlled location.
2. Use `participant_id,group_id` for ordinary participants or add the optional
   `access_scope` column (`group`/`all`) for deliberate researcher IDs. Accepted groups are
   `A` and `B`; ordinary participants must use `group`.
3. Include every real participant and every deliberate researcher/QA ID from
   `lib/studyAccess.mjs`. Only the group-neutral researcher IDs should use `all`. IDs are
   normalized to uppercase.
4. After applying migration 001 to the intended project, run:

```sh
CONFIRM_STUDY_DATA_SYNC=true \
PARTICIPANT_REGISTRY_FILE=/absolute/private/participants.csv \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/security/register-study-data.mjs
```

The script inserts missing participants without overwriting existing rows. It refuses group
conflicts and synchronizes the 1,000-row sound catalog used to reject invented reward sources.
It does not print IDs or credentials.

To disable a participant, an operator updates only `study_participants.status` to `inactive`
with an audited service-role/admin action. To rebind after a verified browser-loss incident,
the operator must first record the incident, then clear that single row's `auth_user_id` and
`claimed_at`. Never provide a public reset endpoint.

## Deployment order

1. Back up the database and capture current grants, policies, function definitions, table
   columns, Realtime settings, and row counts. Confirm no unexpected participant tables exist.
2. In a staging/local Supabase project, apply existing schema files in their historical order,
   then apply `scripts/security/001_auth_foundation.sql`.
3. Run `register-study-data.mjs` with a non-production registry. Confirm the sound catalog is
   non-empty and all expected IDs/groups exist.
4. Reconcile the deployed house schema before proceeding. Migration 002 intentionally aborts
   if `participant_house_items.quantity` or `participant_house_layout.id` is absent because the
   checked-in historical SQL does not match current application reads.
5. Deploy the application with the three Supabase variables. Enable Supabase Anonymous Auth.
6. In the same maintenance window, apply `scripts/security/002_enforce_participant_rls.sql`.
7. In Supabase Realtime settings, turn off **Allow public access**. Confirm both private-channel
   policies exist on `realtime.messages` and that only `broadcast`/`presence` extensions pass.
8. Run the local/staging integration suite and the manual checks below. Only then repeat the
   reviewed sequence for production. These repository changes do not apply either migration.

Do not deploy the new app before migration 001 (RPCs would be missing). Do not apply migration
002 with the old app active (old anonymous requests would fail). Keep the transition inside a
maintenance window.

## Validation

Static checks, safe anywhere:

```sh
npm run test:security-boundary
node --test scripts/internalTestRoutes.test.mjs
npm run build
git diff --check
```

Destructive test-data checks, local Supabase only (the script rejects non-local hostnames):

```sh
SECURITY_TEST_SUPABASE_URL=http://127.0.0.1:54321 \
SECURITY_TEST_SUPABASE_ANON_KEY=... \
SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:rls-local
```

The integration script creates randomized A/B test users and rows, checks unauthenticated
denial, claim conflicts/reconnect/group immutability, own/cross-participant room access,
limited museum output, and shared-room output, then removes its test rows/users.

Manual staging checks still required:

- annotation and skip submission work for each group; a group-mismatched sound is rejected;
- museum candidates contain no participant/session/device fields and voting increments once;
- attendance and quests award once under retries/concurrency;
- client-supplied participant B IDs cannot read/write B from participant A;
- outfit/interior/house purchase prices match UI, cannot produce a negative balance, and a
  failed purchase leaves inventory, ledger, and balance unchanged;
- an unshared/disabled/random room token returns no room;
- private Realtime joins work for owner and a visitor who called `get_shared_room`, while an
  authenticated non-member and unauthenticated client receive a channel error;
- browser bundles contain no service-role key or service-only environment variable;
- production and Preview internal test/debug/preview paths remain 404 and the main routes build.

## Emergency recovery

Prefer fixing forward. RLS protects existing rows and neither migration deletes participant
data. If rollout must stop before migration 002 commits, roll back the app and leave migration
001's unused foundation objects in place. If migration 002 committed, do **not** disable RLS or
re-grant `anon`. Put the site in maintenance mode, restore the captured policy/grant/function
definitions only after security review, or roll forward with the corrected app. Rebinding a
single participant is a separate audited operator action, not a database-wide rollback.

### Lost-browser anonymous session recovery

The application intentionally has no public self-rebind flow. `participantId + groupId` is not
proof of identity and must never be accepted by a browser API to replace `auth_user_id`. When
the UI reports `participant_claimed`, it tells the participant to contact an operator. The
operator must use the study's approved out-of-band verification, record the request and
evidence, resolve exactly one participant plus the old and new anonymous auth users, and run
the existing audited single-participant rebind procedure with service-role access. Verify the
new binding through `get_my_study_participant` and retain the audit record. Never bulk-clear
bindings or expose a service-role credential/client to the browser.

## Known risks and follow-ups

- Anonymous Auth recovery is device-local. A stronger recovery ceremony or one-time hashed
  claim secret is needed if the distributed participant ID is guessable or reused.
- The share token is a bearer capability and appears in URLs/history. Add rotation/revocation
  UI and a shorter lifetime if the room content becomes sensitive.
- Realtime policy behavior must be tested against the project's actual Realtime version and
  dashboard public-access setting; SQL policy tests alone do not prove WebSocket behavior.
- Current house application code expects schema columns absent from the historical
  `house_decor_schema.sql`; migration 002 refuses to guess. Reconcile this with a schema dump.
- Stage 7 moves annotation and vote writes to v4 RPCs and revokes the older browser writers;
  the canonical identity, current round, group, uniqueness, and completion state are now
  database-derived. Keep direct table INSERT revoked and verify the 006 grants before deploy.
- Internal developer pages remain server-side blocked outside explicit local development. In
  local RLS testing they must use a claimed test participant; changing `?pid=` cannot bypass RLS.
- Stage 8 fresh-install audit found that the repository does not contain the original schema
  that creates `annotations` and `votes`. The checked-in `house_decor_schema.sql` also lacks
  the `participant_house_items.quantity` and `participant_house_layout.id` columns that 002
  intentionally requires. Do not start a fresh migration rehearsal from these files alone;
  first supply a reviewed canonical base schema/local fixture. See
  `docs/research/functional-audit-stage-8-local-integration.md`.

## Stage 8 executed local result (2026-09-12)

The earlier fresh-install blocker was resolved for local rehearsal only. `core_schema.sql` was
restored from the 2026-08-15 Table Editor definition recorded in Git commits `2113e18` and
`c6f84b0`; the incompatible house columns and daily-quest timestamp were supplied by files
explicitly marked `LOCAL TEST ONLY / NON-PRODUCTION-AUTHORITATIVE`.

A new disposable loopback Supabase applied the complete 001–006 sequence and synchronized the
full 1,000-row/995-canonical catalog. The RLS integration runner passed anonymous denial,
claim/reconnect/group immutability, owner/cross-participant access, constrained museum/shared
room output, direct-write denial, and private Realtime membership authorization. All runner
identities and auth users were removed afterward, and the catalog count remained 1,000/995.

On the current Supabase version, `realtime.messages` is managed and already RLS-enabled.
Migration 002 no longer attempts to alter that table. It still removes/replaces the scoped
policies, creates the authenticated private `broadcast`/`presence` SELECT/INSERT policies,
and verifies their presence and grants. The dashboard-level **Allow public access** setting
was not and cannot be established by this local SQL run; verify it in the authorized target
project.

Browser A/B sessions were isolated by separate loopback origins because the available browser
had one profile. Session restore and one-row-per-participant attendance were observed, but a
true separate-context spoof test and live A/B WebSocket Presence/Broadcast were not completed.
The first real annotation audio asset returned 404, so the remaining browser matrix is blocked.
This local pass does not establish production/staging schema compatibility or rollout readiness.

## Stage 8B separate-context browser result (2026-09-13)

Playwright created two independent Chromium incognito contexts with different anonymous auth
users and participant mappings; no storage or auth state was copied between A and B. A
browser-originated cross-participant annotation read returned no rows and a cross-participant
update affected no rows. Private Realtime Presence and Broadcast worked in both directions
after the visitor obtained membership through the constrained shared-room RPC. Unmount caused
observed absence, return caused re-presence, and the still-mounted production WorldMap emitted
connected, disconnected, then reconnected in that order. Cleanup left zero auth users, zero
tracked participants, and zero tracked owned rows. Dashboard-level public-access configuration
and authorized staging behavior remain production gates.

## Stage 10 RPC-only room boundary (2026-09-13)

Migration `007_participant_room_rpc_only.sql` is the forward correction after 001–006. It
revokes direct `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` from PUBLIC, anon, and
authenticated; retains authenticated `SELECT` plus `participant_room_select_own`; removes the
authenticated INSERT/UPDATE policies; and reasserts authenticated-only EXECUTE on the
fixed-search-path `SECURITY DEFINER` function `save_participant_room_v3(uuid,jsonb)`.

The write policies were removed rather than left dormant. With no table grant they add no
current protection, but they would silently reactivate the bypass if a future grant regressed.
The repository app already saves only through v3. Historical clients that directly upsert the
table are intentionally incompatible after 007 and must not be served during rollout. Apply
007 only as a reviewed forward migration in the same maintenance window as a compatible app;
do not rewrite 002 or claim staging compatibility before validating the sanitized inventory.

The disposable integration runner now proves direct authenticated insert/update/delete
failure, owner SELECT, RPC save, same-key replay, independent-key concurrent whole-snapshot
convergence, cross-owner isolation, shared-room read boundaries, deduplicated room-success
events, and absence of room payload/share/auth/participant values from event payload fields.
Service-role setup remains limited to local QA/admin code and is not a browser grant.

## Stage 10B browser and TRUNCATE closure (2026-09-14)

The schema validator now treats authenticated `TRUNCATE` as an independent RPC-bypass
failure alongside INSERT, UPDATE, and DELETE. It also independently rejects PUBLIC and anon
TRUNCATE while preserving only authenticated owner SELECT and the exact room-save RPC
contract. A catalog-only inventory generated from the fresh disposable 001–007 database
passed these checks, and direct SQL ACL inspection confirmed all six forbidden room-write
paths were absent.

Two genuinely separate Playwright contexts then exercised the real room UI and browser
session boundary. They proved owner recovery, cross-owner read/update denial, direct
INSERT/UPDATE/DELETE denial, same-operation-key replay, and caller confinement even when a
room value resembled another participant identifier. TRUNCATE was not attempted through the
browser API; its evidence is the validator fixture plus actual catalog ACL query. These are
local results only. The dashboard and sanitized staging inventory still require authorized
verification.
