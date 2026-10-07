# Functional audit stage 9: local production-readiness preparation

Date: 2026-09-13 (Asia/Seoul)

Status: **Stage 9 local readiness preparation complete. Production readiness remains blocked.**

This stage is repository-only preparation. It did not connect to production, Preview,
staging, Supabase Storage, or any other remote database; did not read `.env.local`; did not
apply SQL or migrations; did not download or generate audio; and did not restore Git audio
objects into the worktree. Existing tracked and untracked changes were treated as user-owned.

## 1. Evidence boundary and confirmed Stage 1–8 result

The audit reread the handoff, Stage 6–8 reports, participant/RLS and transactional runbooks,
User Event design/inventory, migrations 001–006, preflights/verifiers, local-only fixtures,
integration/browser harnesses, current metadata, application read/write paths, and relevant
Git history (`2113e18`, `c6f84b0`, `b189395^`). The latest chronological evidence is Stage
8B, not the earlier Stage 8A browser-blocked section.

Confirmed existing outcomes, without extending them to production:

- Stage 1: internal test/debug/preview routes are server-blocked outside explicit local opt-in.
- Stage 2: anonymous Auth mapping, participant-derived RLS, constrained museum/share RPCs,
  service-only purchase/claim boundaries, and private Realtime policies exist in repository.
- Stage 3: idempotent/atomic result and reward operations, ledger protection, and public error
  envelopes exist; Stage 7 supersedes participant result writes with v4 RPCs.
- Stage 4: append-only `study_sessions`/`user_events`, bounded batch recording, identity
  derivation, sensitive-field allowlists, retry queue, and result-event linking exist.
- Stage 5: per-sound listening lifecycle and museum count aggregation fixes exist.
- Stage 6: overlay input blocking, repeat/in-flight guards, close reasons, readable feedback,
  and same-mount Realtime reconnect semantics exist.
- Stage 7: 1,000 metadata rows normalize to 995 canonical identities; normal annotations and
  votes are unique per participant/round/canonical; completion and final annotation are one
  transaction; KST boundaries and completed-session recovery exist.
- Stage 8/8B: a disposable local Supabase fresh install passed four of four integration runner
  processes; independent Playwright A/B contexts passed annotation, vote, aliases, completion,
  auth isolation, private Realtime, and 117-event reconciliation. Final recorded regression was
  60/60 and cleanup returned zero QA-owned rows with catalog 1,000/995.

None of those results prove the current staging schema, dashboard settings, production audio,
research governance, approved staging rollout, or pilot behavior.

## 2. Documentation/code reconciliation findings

1. The Stage 8 report title/status had been updated to “complete,” while its immediately
   following paragraph still called the 8A missing-audio browser run blocking. The opening is
   now explicitly labeled as retained history superseded by Stage 8B.
2. `house_decor_schema.sql` has no `participant_house_items.quantity` and uses
   `(participant_id,item_id)` as the layout primary key. Current `lib/houseDecor.js` requires a
   stack quantity and independent `participant_house_layout.id`. The Stage 8 compatibility SQL
   drops/replaces the layout PK only in an empty disposable database and is not authoritative.
3. `daily_quest_schema.sql` has no `participant_daily_quests.created_at`; the field exists only
   in the local-only fixture used for KST legacy analysis.
4. Stage 4 documentation says room save moved behind `save_participant_room_v3`, and the app
   calls that RPC. Migration 002 grants authenticated `INSERT/UPDATE` on `participant_room`,
   but migration 004 does not revoke those table writes. RLS still limits ownership, but a
   direct authenticated write can bypass the idempotency/result-event boundary. The schema
   validator treats this as a blocker. No grant was changed without a real schema rehearsal.
5. The claim route currently accepts participant ID and group after anonymous authentication;
   there is no claim secret, gateway rate limit, CAPTCHA, or operator reissue ceremony.
6. Friend-room praise is only a local toast, despite copy suggesting notes accumulate. It has
   no persistence, recipient notification, retention, moderation, or event/result record.
7. The completion route is a static in-app thank-you screen. Whether it should redirect to a
   survey, show operator instructions, or permit only window close remains a study decision.

## 3. Stage 9A — complete audio corpus readiness

### Current and historical coverage

| Evidence class | Canonical count | Production interpretation |
| --- | ---: | --- |
| Current worktree, fully verified | 0/995 | fail; `public/audio` contains no audio files |
| Current worktree, missing expected file | 995/995 | fail |
| Current license and provenance verified | 0/995 | fail; metadata has no sufficient rights record |
| Current unresolved category conflict | 3/995 | fail pending researcher decision |
| Historical tree exact zone/path | 80/995 | reference-only; 85 metadata rows because all five aliases are in this bucket |
| Historical filename only in another zone | 22/995 | must not be substituted automatically |
| Historical no blob at expected path | 893/995 | unavailable from the audited Git tree |

The three historical buckets are disjoint and total 995. The historical tree contains 571
MP3 files overall, but unrelated files do not count toward current metadata coverage. The
eight Stage 8B files were disposable test fixtures only.

### Manifest and validator

`audio-corpus-readiness.mjs` groups the 1,000 rows by source-backed canonical identity and
records aliases, expected base path, zone/group/source consistency, category candidates,
actual candidate file, SHA-256, byte size, magic-byte MIME, codec, duration, full decode,
duplicate blobs, same filename across zones, and review records. The JSON contract is
`audio-corpus-manifest.schema.json`.

Production verification requires `ffprobe` and `ffmpeg`. A present file without both tools is
not silently accepted: codec, duration, and decode remain unverified. The tool never downloads
or creates audio and never treats another-zone filename as a match.

Example after an approved corpus and review file are supplied:

```sh
node scripts/security/audio-corpus-readiness.mjs \
  --corpus-root /absolute/approved/audio-root \
  --reviews /absolute/access-controlled/audio-reviews.json \
  --output /absolute/access-controlled/audio-manifest.json

node scripts/security/audio-corpus-readiness.mjs \
  --validate /absolute/access-controlled/audio-manifest.json
```

`--output` uses exclusive creation and will not overwrite an existing manifest. Exit status is
non-zero unless all 1,000 rows resolve to exactly 995 fully verified canonical entries with no
unreviewed conflict, duplicate cross-canonical blob, or cross-zone filename collision.

### Researcher-supplied review fields

The review JSON is keyed by `canonical_audio_id`. Every canonical needs:

- license: `status=verified`, license/SPDX or agreement identifier, terms/evidence URI, and
  required attribution;
- provenance: `status=verified`, source URI, source record ID, rights holder if applicable,
  acquisition date, evidence URI, reviewer identity, review timestamp, and notes;
- for conflicting aliases only: `classification.status=approved`, selected metadata category,
  reviewer, and decision timestamp. The rejected label remains in metadata/manifest history.

Unknown rights or origin must stay `unverified`. Approval must be supplied by the researcher
or rights owner; filename, dataset label, and old Git presence are not a license.

### Acquisition, validation, and deployment checklist

1. Obtain the corpus through an approved access-controlled channel and record the delivery
   hash/inventory; do not use this repository or chat for secrets or restricted agreements.
2. Confirm every file is legally usable for this experiment and complete the review mapping.
3. Keep the provider tree immutable; validate from a copy with recorded delivery checksum.
4. Run the generator with `ffprobe`/`ffmpeg`; archive manifest, tool versions, and stdout/stderr.
5. Resolve every missing, multi-candidate, MIME mismatch, decode failure, duplicate blob,
   cross-zone filename collision, and category conflict. Do not auto-rename or substitute.
6. Require 995/995 and independently sample playback from every zone/group.
7. Upload catalog first only when its paths are final; upload audio to those exact paths;
   verify remote object size/content type/checksum against the signed manifest.
8. Confirm anonymous clients can read only intended audio objects and cannot list private
   buckets or upload/overwrite objects.
9. Deploy the app only after remote 995/995 verification; rescan the built output so corpus
   files were not unintentionally bundled into `.next`.
10. Retain the approved manifest and rights evidence with the study record; any file change
    creates a new manifest and requires revalidation.

## 4. Stage 9B — actual schema reconciliation preparation

### Prepared read-only inventory

`schema-reconciliation-snapshot.sql` runs in a read-only transaction and emits one sanitized
JSON catalog inventory: columns/nullability/defaults, constraints, indexes, policies, RLS,
functions/signatures/argument names/search path, and table/function grants. It reads no
participant, result, or event rows. An authorized operator should execute it with an account
that can see the complete catalog:

```sh
psql -X -q -A -t -f scripts/security/schema-reconciliation-snapshot.sql \
  > /absolute/access-controlled/staging-schema-inventory.json

node scripts/security/schema-reconciliation-validator.mjs \
  /absolute/access-controlled/staging-schema-inventory.json
```

Before sharing, inspect the JSON for unexpected role/object names. Do not include connection
strings, environment files, row data, function source bodies, secrets, auth IDs, participant
IDs, or event payloads. This inventory is preferred over treating the local compatibility
fixtures as production truth.

### Validator contract

The validator fails on:

- missing/type/nullability mismatch for the three compatibility columns and Stage 7 identity,
  round, and completion columns;
- wrong house inventory/layout PK/check/unique shape, missing quest uniqueness, catalog PK,
  or completion FK;
- missing canonical result, active-session, and User Event indexes;
- missing participant, researcher-read, or private Realtime policies/RLS;
- missing/renamed function signatures and argument names, non-`SECURITY DEFINER` boundary, or
  non-empty/unfixed search path;
- missing intended authenticated/service-role execute grant, forbidden PUBLIC/anon grant,
  or retained authenticated execute on v3 result/session functions and legacy increment RPCs;
- anon/PUBLIC access to participant tables, authenticated direct result/event writes, or the
  current `participant_room` direct-write bypass.

It always reports manual dashboard checks for Anonymous Auth and Realtime “Allow public
access,” because PostgreSQL schema cannot prove those settings. It also requires the existing
data preflights for duplicates, ledger/vote drift, historical dates, completed sessions, and
already-complete active sessions; a schema-only inventory cannot prove row compatibility.

### Reconciliation checklist and stop conditions

1. Receive and checksum the authorized inventory plus current migration ledger/version list.
2. Run the validator without changing the target. Any error is a stop, not an auto-fix.
3. Compare every reported column, PK/FK/unique/check/index/policy/grant/function with the
   application and 001–006. Preserve exact function argument names used by `CREATE OR REPLACE`.
4. Run the three existing read-only preflights against a protected staging clone and save all
   returned rows. No row is auto-deleted, merged, relabeled, or marked resolved.
5. Decide the house transformation with real row counts and dependency queries. Replacing the
   composite layout PK may permit repeated item instances and requires a reviewed forward data
   migration; the local fixture is not that migration.
6. Decide how an absent daily-quest timestamp can be backfilled or whether legacy KST analysis
   must use another authoritative time. Never stamp old rows with `now()` in production.
7. Add and test an explicit forward migration revoking authenticated direct
   `participant_room` writes only after confirming all deployed clients use v3.
8. Capture final backup, definitions, grants, counts, and hashes. Apply only in an approved
   maintenance window. Prefer a forward fix; do not disable RLS or delete audit/idempotency data.

Schema compatibility is **unverified** in this stage because no staging inventory was supplied.

## 5. Stage 9C — research and operations decision record

### Canonical classification conflicts (three separate approvals)

For `fsd50k:248110` (Rain/Thunder), `fsd50k:179173` (Bell/Dishes and pots and pans), and
`fsd50k:2510` (Explosion/Fireworks), the same source/file has two metadata labels. Options are:

- approve one primary analysis category while retaining both original rows/labels as evidence;
- explicitly model a multi-label category in analysis and UI; or
- split the canonical identity, which is not recommended because it creates two result targets
  for the same audio blob and invalidates the established uniqueness rule.

Recommendation: keep one canonical result identity and approve either one primary label or a
documented multi-label analysis rule. A researcher must choose the actual label/rule for each
of the three. Without a decision, category-stratified analysis and 995/995 readiness remain
blocked. After approval, update the controlled review mapping, catalog/category analysis view,
study protocol, and regression expectations; do not rewrite historical evidence.

### Participant first claim

Problem: participant ID + group is currently sufficient, so a guessed ID can be claimed first.
Options are ID-only (simplest/weakest), one-time secret, or externally authenticated accounts
(strongest identity burden). Recommendation: participant ID + per-participant one-time claim
secret stored only as a server-side hash, atomic claim, limited retries, gateway rate limit,
CAPTCHA only after measured abuse/risk, and explicit researcher reissue. This matches the
requested default and avoids routine email accounts. No decision risks claim theft and study
exclusion. Approval requires registry format, hash/consume migration, claim route/UI, redacted
events, rate-limit operations, reissue audit, and A/B concurrency tests.

### Lost Auth/browser storage

Options are no recovery, public self-reset, or operator-verified reissue. Recommendation:
operator verification followed by a new one-time recovery secret and atomic rebind; never a
public endpoint that clears `auth_user_id`. Define identity checks, incident log, old-session
revocation, and whether unfinished data continues in the same round. Without it, legitimate
participants can be locked out or unsafe ad-hoc resets can misbind data.

### Multiple tabs and devices

Options are fully concurrent clients, multiple tabs on one device only, or one active
experiment client lease. Recommendation: one active device/client lease per round; warn and
block the second writer while allowing a controlled takeover by researcher policy. This best
protects ordering and exposure conditions. Approval requires a server lease/heartbeat,
takeover audit, UI, queue ownership rules, and multi-context/device tests. Without a rule,
concurrent stimuli and event sequences may invalidate trial timing despite DB deduplication.

### Retest and experiment round

Options are never, participant self-service, or researcher-issued audited round increment.
Recommendation: disabled by default; researcher-only increment with reason, protocol approval,
and explicit analysis linkage to prior rounds. Never delete/reopen the completed round. Without
a rule, duplicate participation and selective retesting bias analysis. Approval requires an
operator procedure/tool, grant boundary, UI status, and round-aware export.

### Destination after completion

Options are the current static thank-you screen, an external survey/debrief redirect, or an
operator-controlled completion code/hand-off screen. Recommendation: a dedicated completion
screen showing non-sensitive confirmation plus protocol-approved next-step instructions;
redirect only after the result and final event flush are confirmed, with a visible fallback.
Without a decision, participants may close early or miss debrief/compensation steps. Update
completion UI, accessibility copy, redirect allowlist, and E2E after approval.

### Reconnect semantics

Options are count every remount/reload/app restart as Realtime reconnect, count only same-map
presence loss/recovery, or use server connection episodes. Recommendation: retain current
`duo_reconnected` for same-mounted-map presence recovery; record reload/remount as
`session_resumed`/`screen_viewed`, not reconnect, unless a future server episode ID proves a
continuous peer interaction. Without a rule, reconnect rates are incomparable. Approval may
require a connection-episode table and analysis query, not merely a client event rename.

### User Event governance

The unresolved items are retention duration, withdrawal/deletion, export format, researcher
access, and audit. Options range from indefinite identifiable retention to protocol-bound
pseudonymous retention with controlled deletion/export. Recommendation: the IRB/consent/data
management plan must set an exact retention date, role-based least-privilege researcher list,
access audit, encrypted export, withdrawal cutoff, and deletion/anonymization procedure that
preserves required regulatory audit without retaining participant linkage longer than allowed.
No generic duration is guessed here. Without approval, collecting production events is a
privacy/governance blocker. Changes include operator runbooks, access review, export/delete
jobs, backup retention alignment, and tested subject lookup without exposing raw payloads.

### Friend-room praise

Options are ephemeral toast, constrained fixed reactions, or stored free-form praise.
Recommendation: keep it explicitly ephemeral and correct the misleading “notes accumulate”
copy for the pilot. If research needs persistence, prefer fixed reactions with recipient
visibility, rate limit, block/report, retention/deletion, and RLS; do not store free text by
default. Without a decision, current UI can mislead participants; persistent implementation
would create an unapproved social/privacy surface.

### Pilot size and Go/No-Go

Options are internal QA only, one balanced small pilot, or staged pilots. Recommendation: first
complete scripted researcher QA, then at least eight consented pilot participants balanced 4/4
A/B across supported device/network classes; expand only if the protocol/statistical owner
requires more. The exact number remains a researcher decision. A pilot is not production and
must use disposable/clearly tagged identities. Without balanced real-user evidence, usability,
timing, recovery, and logging failures can reach the experiment.

## 6. Stage 9D — authorized staging rehearsal runbook

### Entry conditions

- named researcher, security/data owner, developer, and operator approvals;
- immutable backup plus tested restore access, migration ledger, maintenance window, and
  participant/support communication;
- validator-passing schema inventory and reviewed data-preflight outputs;
- signed 995/995 audio manifest and exact deployment path/content-type mapping;
- decisions for all three classifications, claim/recovery/concurrency/retest/completion,
  User Event governance, praise scope, pilot size, and stop authority;
- isolated A/B QA identities and cleanup query inventory; no real participant IDs in logs.

### Required order

1. Record approvals, backup/checksum, restore owner, baseline counts, grants, policies,
   functions, dashboard settings, and app/audio/catalog versions.
2. Pause writes or enter the approved maintenance window.
3. Capture and validate schema-only inventory; stop on any difference.
4. Run transactional, User Event, and experiment-rule preflights read-only; researchers resolve
   every row explicitly. No automated merge/delete SQL.
5. Apply the reviewed forward migrations in dependency order. For a new installation:
   canonical base/historical feature schema → reconciled compatibility migration → 001 →
   registry/catalog sync → 002 → 003 → 004 → 005 → 006. Existing staging follows its actual
   ledger and never reapplies blindly.
6. Sync catalog only after reviewed canonical/category decisions; verify 1,000/995 and diff
   every existing mapping before write.
7. Place the complete audio corpus at exact catalog paths; independently compare remote size,
   checksum, MIME, codec/duration/decode evidence, and require 995/995.
8. In Dashboard verify Anonymous Auth, intended redirect/origin settings, RLS, private Realtime
   “Allow public access” disabled, broadcast/presence policies, Storage visibility/CORS, and no
   service-role value in client configuration.
9. Deploy the matching app build; confirm internal routes 404/noindex and build identifiers.
10. Run independent Chromium contexts and at least one additional supported browser/device for
    both A/B identities.
11. Reconcile result, idempotency, ledger, quest/attendance, session, completion, vote count,
    and User Event rows against the scripted actions.
12. Delete only exact QA identities/owned rows; confirm auth/participant/owned counts zero and
    shared catalog/audio unchanged.
13. Researcher and developer jointly sign the evidence bundle. Resume writes only on Go.

### Backup and forward-fix

Back up before the maintenance window and before any destructive transformation rehearsal.
Record restore tooling/version, encryption, checksum, owner, retention, and a completed restore
test in an isolated project. If a migration or app fails: keep writes paused, capture evidence,
revoke only affected new RPC execution where reviewed, roll forward with corrected definitions,
and rerun all dependent checks. Do not disable RLS, regrant anon, delete audit/idempotency rows,
merge aliases, decrement rounds, or stamp legacy timestamps. Restore is an incident decision,
not an untested default rollback.

## 7. Rehearsal matrices

### A/B browser matrix

For each group: first claim, incorrect group, refresh, route navigation, every zone playback,
normal annotation, skip then normal response, alias exclusion, rapid duplicate, museum empty/
load/play/vote/next, completion, reload/replacement context, attendance/quest/currency, room
save/load, shared-room membership, logout/storage-loss response, error redaction, and internal
route denial. Cross-test A→B and B→A read/insert/update plus candidate anonymity.

### Slow network and retry matrix

Run offline-before-request, disconnect during audio, timeout before RPC reaches server, response
lost after commit, 429, 5xx, reconnect, and queued-event final flush under at least Fast 3G and
high-latency profiles. For every result writer verify stable operation key, one domain row, one
reward, preserved input on retryable failure, correct UI state, bounded event queue, and no raw
error leakage. Audio failure must never unlock annotation/vote.

### Multiple tabs/devices matrix

Until policy approval, results are observational and block launch. Test two tabs same auth,
two anonymous auth contexts claiming one ID simultaneously, two devices after recovery/rebind,
concurrent same and different operation keys, one context completing while another is stale,
and event sequence/client-instance separation. Verify the chosen lease/takeover policy rather
than relying only on unique constraints.

### Realtime matrix

Test owner/visitor private join, non-member and unauthenticated denial, two-way Presence and
Broadcast, duplicate subscription, route unmount, browser background, offline/online, token
refresh, membership expiry, share disable/rotation, owner exit, visitor exit, same-map reconnect,
reload/remount semantics, and cleanup. Compare client events with channel state without logging
topic/share token/peer identifiers.

### User Event reconciliation

1. Predeclare expected semantic actions and operation keys without participant identifiers.
2. Compare attempted/succeeded/failed events to actual result IDs and idempotent operations.
3. Require exactly one logical success for rapid/retried actions and verify completion links.
4. Reconcile attendance, quests, currency ledger/cache, votes/vote_count, session status, and
   canonical progress.
5. Scan selected payload fields for coordinates, pointer frames, tokens, authorization material,
   participant/auth IDs, SQL, stack traces, URLs, and raw expression edits.
6. Report missing/extra/out-of-order events; do not mutate evidence to make counts match.
7. Export only under the approved governance policy, then run exact QA cleanup and recount.

## 8. Pilot and production Go/No-Go

Pilot Go requires: zero open P0; signed schema/audio/policy approvals; staging matrix pass;
995/995 audio; zero cross-identity or secret exposure; exact result/event reconciliation;
successful backup restore rehearsal; named on-call/stop authority; and consent/support scripts.

Recommended pilot acceptance criteria:

- all pilot participants complete or every non-completion has a classified, explainable cause;
- zero duplicate reward/result, lost completed result, cross-participant access, secret leak,
  unapproved claim/rebind/retest, or unresolved P0/P1 data-integrity defect;
- 100% linkage for required annotation/vote/completion success events to stored results;
- ledger and vote-count delta zero; QA cleanup delta zero; 995/995 audio unchanged;
- no audio decode/MIME/path failure; retry behavior matches the matrix;
- support interventions and protocol deviations are logged and jointly reviewed.

Production No-Go is immediate for any security/privacy boundary failure, incorrect A/B
assignment, claim takeover, data loss/corruption, corpus below 995/995, schema/preflight error,
unapproved migration, Realtime public access, unreconciled required events/results, failed
backup/restore access, unresolved policy decision, or pilot stop criterion. Pause enrollment and
writes where safe, preserve evidence, notify the named owners, and use the reviewed forward-fix
path. Resume only after root cause, fix, full dependent rerun, and joint sign-off.

## 9. Remaining blockers and required inputs

### P0 before staging/production

- approved complete corpus and controlled license/provenance review: current result 0/995;
- sanitized staging schema inventory and migration ledger; actual compatibility unverified;
- reviewed forward treatment for house quantity/layout ID and quest historical timestamp;
- resolution of the `participant_room` direct-write grant before relying on RPC-only logging;
- claim, recovery, multi-client, retest, completion, and User Event governance decisions;
- authorized staging window, backup/restore evidence, dashboard checks, full rehearsal, and
  pilot approval/completion.

### P1

- researcher decisions for three category conflicts and pilot size/thresholds;
- remote catalog/audio checksum verification, supported-browser/device matrix, performance and
  retry thresholds, QA cleanup sign-off;
- operational rate limiting, reissue/takeover tooling, access review, export/deletion procedure.

### P2

- whether praise remains explicitly ephemeral or becomes a governed fixed-reaction feature;
- whether server-side connection episodes are worth adding for cross-remount reconnect analysis;
- cleanup of stale historical wording elsewhere after the approved policies are final.

Required from the user/research team: corpus location and rights evidence; the sanitized schema
inventory; the three classification decisions; approved claim/recovery/concurrency/retest/
completion/log-governance/praise/pilot policies; and explicit authorization for a later staging
rehearsal. No production-ready claim is permitted until all are complete.

## 10. Next-task handoff

Start by obtaining one of two missing authoritative inputs, without touching a remote system:

1. If the corpus arrives, install approved `ffprobe`/`ffmpeg`, run the manifest generator from
   the immutable delivery, resolve only researcher-approved review entries, and stop unless it
   reports 995/995.
2. If the schema inventory arrives, run `schema-reconciliation-validator.mjs`, compare every
   error with the migration ledger and saved preflight evidence, and draft reviewed forward SQL
   only for explicitly approved differences. Do not use the local fixtures as the answer.

If neither arrives, the next useful action is to record the policy decisions in this document;
do not start staging, alter participant flow, or implement persistent praise.

## 11. This-run verification

Executed and passed:

- all discovered Node static/unit tests: **71/71**;
- Stage 8 readiness subset: **9/9**;
- historical Git audio provenance command: exit 0, confirming 1,000/995 and the
  80 exact / 22 wrong-zone-only / 893 absent canonical partition;
- Stage 9 audio validator tests: 4/4; schema validator tests: 5/5;
- all four integration runners, registration/guard, browser harness, both new validators:
  `node --check` pass; bootstrap `bash -n` pass;
- new Stage 9 MJS files: ESLint 0 errors, 0 warnings;
- `git diff --check`: pass;
- environment-isolated Next.js 16.2.7 `next build --webpack`: pass, 27 routes;
- built browser static bundle: no service-role identifier or placeholder;
- build tree: zero MP3/WAV/OGG files.

Expected failure, correctly enforced: current production-path corpus validation returned
1,000 metadata rows, 995 canonicals, five aliases, zero discovered files, zero fully verified,
995 unverified, three category conflicts, and `canonical_coverage_not_995_of_995`.

Full repository `npm run lint` did not pass: it reported 334 errors and 46 warnings, dominated
by the pre-existing user-owned `.next-nature-qa` generated output plus existing map/design
reference React ref/purity/deprecation findings. No auto-fix or unrelated cleanup was run.

The valid production build ran from a disposable copy containing no `.env*` file and used
process-scoped loopback placeholders. An earlier build invocation mistakenly ran in the source
directory; Next reported `.env.local`, so that result was invalidated. Process-level loopback
placeholders were already set and the build has no database-backed data step; no remote query
or mutation was made. The corrected disposable build is the result reported above. Exact
Stage 9 temporary directories and report files were deleted after verification.

The disposable Supabase and browser E2E suites were not rerun. This stage changes only offline
validators, tests, package commands, and documentation; it does not alter annotation, vote,
completion, Auth, RLS, Realtime, or audio playback runtime behavior. Stage 8B remains the latest
integration/browser evidence. A live schema reconciliation validator could not run because no
sanitized staging inventory was provided; a 995-file media probe could not run because the
corpus was not provided.

## Stage 10B superseding schema note (2026-09-14)

Stage 9 correctly identified the room direct-write contradiction but predated migration 007
and its browser closure. The current validator independently rejects authenticated INSERT,
UPDATE, DELETE, and TRUNCATE on `participant_room`, rejects PUBLIC/anon TRUNCATE, preserves
authenticated owner SELECT, and checks the exact authenticated-only room-save function
contract. A fresh local 001–007 catalog inventory and separate-context room browser run passed.
This supersedes the local room-boundary gap only; the absent sanitized staging inventory,
migration ledger, dashboard review, and authoritative 995-canonical audio corpus remain
unchanged blockers.
