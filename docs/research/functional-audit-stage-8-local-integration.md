# Functional audit stage 8: disposable local integration rehearsal

Date: 2026-09-12 (Asia/Seoul)

Status: **Stage 8 local integration and browser E2E complete. Production readiness remains blocked.**
The original 2026-09-12 browser run below was blocked by a missing production-path audio
asset. That failure history and its not-run matrix are intentionally retained, but the
2026-09-13 **Stage 8B completion** section supersedes its browser verdict: independent
Playwright A/B contexts subsequently passed normal annotation, vote, completion/restart, and
live private Realtime using eight provenance-checked historical fixtures in a disposable app.
Those fixtures do not establish production corpus coverage; production remains blocked on the
complete 995-canonical corpus and the other gates in the final section.

No production, Preview, staging, or other remote Supabase project was contacted. No SQL or
data change was run outside the disposable loopback project. Existing tracked and untracked
worktree changes were preserved; no reset, checkout, clean, stash, commit, or push was run.
`.env.local` was not used for migrations, integration runners, or browser E2E.

## Environment and safety boundary

The final run used Supabase CLI 2.117.0, Colima 0.10.3, Docker CLI 29.8.0, Node 26.5.0,
and npm 11.17.0. `scripts/security/stage8-local-bootstrap.sh` created a new random directory
under `/private/tmp/soundvillage-stage8.*`, initialized a unique project ID, captured generated
keys in mode-0600 files, and verified both the API hostname and the database container before
SQL ran. The API was loopback-only and PostgreSQL was reached through the identified local
container's Unix socket.

`scripts/security/local-supabase-guard.mjs` resolves hostnames and rejects any address that is
not loopback. All four integration runners and the registration script invoke it when the
local-only guard is required. Keys, participant IDs, auth IDs, and share tokens were not
printed or added to documentation.

## Restored base schema and local-only compatibility

`scripts/core_schema.sql` was restored from Git commits
`2113e189eb8e788ac8efbddb48178a3d08a13e01` and
`c6f84b06f059fe0990122471840f6cd67472e9ab`. Its provenance comment identifies it as the
2026-08-15 production Table Editor definition, and it supplies the missing `annotations`,
`votes`, foreign key, trigger, and `increment_vote_count` prerequisite.

Two gaps in the checked-in historical feature SQL were deliberately handled only in the
disposable rehearsal:

- `local-test-only-house-compatibility.sql` supplies `participant_house_items.quantity` and
  the layout identity shape expected by current code.
- `local-test-only-quest-compatibility.sql` supplies `participant_daily_quests.created_at`.

Both files are marked **LOCAL TEST ONLY / NON-PRODUCTION-AUTHORITATIVE**. Their success does
not establish compatibility with production or staging schema. The read-only preflights
continue to expose these required columns.

## Failure-to-fix history

Every failed attempt was stopped and the next attempt used a new disposable project.

1. Migration 002 attempted `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY` against
   a Supabase-managed table. Only that managed-table ALTER was removed; the private
   broadcast/presence policies and their verification remained.
2. The experiment preflight found the historical daily-quest table lacked `created_at`.
   The local-only quest compatibility fixture was added rather than claiming a production fix.
3. Migration 006 renamed the existing `ensure_today_quests(text[])` parameter, which
   PostgreSQL rejects under `CREATE OR REPLACE FUNCTION`. The existing
   `p_known_sub_categories` name was preserved throughout the definition and grants.
4. The first otherwise-successful full run failed bootstrap cleanup because psql variable
   syntax was used with `-c`. Cleanup now uses shell-expanded, fixed-prefix participant IDs,
   stops on error, and verifies zero QA identities plus the preserved catalog before printing
   success.

The full-catalog experiment runner was also corrected before the final run. It now requires
1,000 rows/995 canonical identities, computes the participant's complete assigned canonical
set, seeds only randomized participant-owned boundary rows, tests canonical aliases and
completion, and never deletes or truncates the shared catalog.

## Final fresh-project database run

The final project was a newly created disposable project, not a reused failed stack. The
successful order was:

1. restored core schema;
2. currency, shop, daily quest, attendance, interior, and house historical schemas, each
   transaction-wrapped by the bootstrap;
3. local-only house compatibility;
4. local-only quest compatibility;
5. migration 001;
6. two bootstrap registrations and full catalog synchronization;
7. transactional preflight;
8. migrations 002 and 003;
9. User Event preflight;
10. migrations 004 and 005;
11. experiment-rules preflight;
12. migration 006;
13. User Event verify;
14. experiment-rules verify;
15. the RLS, transactional-integrity, User Event, and experiment-rules integration runners;
16. bootstrap identity cleanup and final count verification.

Catalog synchronization and post-cleanup verification both returned **1,000 rows and 995
distinct canonical audio identities**. Transactional preflight reported no duplicates,
ledger drift, vote-count drift, or missing required compatibility columns. User Event
preflight completed before 004. Experiment preflight reported the five expected alias pairs
and the three known classification conflicts, with no migration blocker. Both verify scripts
confirmed the expected functions, indexes, grants, completion links, identity backfill, and
KST date boundary.

All four integration processes exited 0:

| Runner | Result |
| --- | --- |
| `npm run test:rls-local` | pass |
| `npm run test:transactional-integrity-local` | pass |
| `npm run test:user-events-local` | pass |
| `npm run test:experiment-rules-local` | pass against the complete 1,000/995 catalog |

These runners are assertion scripts rather than `node:test` subtest reporters, so the honest
count is **4/4 runner processes**, not an invented internal assertion count. Together they
covered anonymous denial, claim and cross-participant isolation, private Realtime policy
authorization, atomic/idempotent writes, concurrency, append-only events, final flush,
canonical/alias uniqueness, playback gating at the RPC boundary, completion/resume, and KST.

## Browser E2E results

The app was started from a disposable copy on loopback with the protected `app-local.env`.
The copy contained no `.env.local`; `ENABLE_INTERNAL_TEST_ROUTES=true` applied only to this
development process. The existing user-owned development server on port 3000 was neither
used nor stopped. Because the available in-app browser exposes one browser profile, A and B
were isolated by distinct loopback origins (`127.0.0.1` and `localhost`), not by two fully
separate browser profiles. This limitation is material and a true two-context restart remains
unexecuted.

| Scenario | Actual result |
| --- | --- |
| A/B registration and session creation | pass; two tracked participants, two auth users, two sessions |
| Refresh recovery | pass in both origin-isolated sessions; refresh returned to the world without another session |
| Attendance retry behavior | pass for the observed flow; repeated loads produced two total attendance rows, one per participant |
| Local internal route opt-in | pass in the real browser; `/music-test` rendered only on the opted-in local development process |
| Production internal-route block | pass by built-server HTTP check: 404 plus `x-robots-tag: noindex, nofollow, noarchive`; the in-app browser itself refused the new port, so this part is not a browser-render assertion |
| World and Library navigation | pass for world load, Enter into Library, and Escape exit |
| Overlay input lifecycle | keyboard movement was blocked while the quest overlay was open; a D-pad click hit the overlay backdrop without moving the player; a fresh keydown after close moved again |
| Unprocessed annotation UI | pass through Music entry, proximity prompt, and opening the first unprocessed annotation panel |
| Normal annotation | **failed/blocked**: audio loading returned 404 and the UI showed the redacted friendly error; input remained disabled as designed |
| Skip and rapid repeat | pass; a rapid double-click produced one skipped annotation row and one success event |
| Completed-item exclusion, alias duplicate, normal double-submit | not run in browser because normal playback/submit was blocked; passed only in the database runner |
| Vote playback gate, vote uniqueness, alias vote, rapid/concurrent vote | not run in browser; passed only in the database runner |
| Final completion, result/event linkage, completed-session browser restart | not run in browser; passed only at the database/RPC integration boundary |
| A/B protected-data spoof attempt through the browser UI | no suitable UI read path; browser sessions stayed origin-separated, while direct cross-read/write denial passed in the RLS runner |
| A/B live Presence/Broadcast, unmount cleanup, reconnect semantics | not run in the browser; policy authorization passed in the RLS runner and reconnect semantics passed statically |
| Error redaction | pass for the observed UI: no SQL, stack trace, service-role value, participant ID, or internal DB detail was rendered |

The two E2E participants generated 408 semantic events while navigating. Before cleanup,
the stored event set contained the observed session, screen, attendance, quest, movement-edge,
zone, collectible, annotation, audio-failure, and skip events. Close reasons included the
actual navigation, backdrop, close-button, unmount, and skip paths. An aggregate payload scan
found no coordinate/pointer, share-token, service-role, or SQL-like metadata pattern. Raw
participant identifiers and event payloads were not printed.

## Cleanup and shutdown

After closing all audit browser tabs, cleanup removed only the two exactly tracked E2E
identities and their auth, session, event, annotation, attendance, quest, idempotency,
currency, vote, outfit, room, house, share, and membership rows. Verification returned:

- tracked participant rows: 0;
- tracked auth users: 0;
- tracked participant-owned rows across the cleanup inventory: 0;
- shared catalog: 1,000/995.

The E2E app server was stopped. The exact final Supabase project ID and config were checked,
that project alone was stopped with `supabase stop --no-backup`, and no matching container
remained. Its single `/private/tmp/soundvillage-stage8.*` directory was then removed. The
unrelated user development server on port 3000 remained running.

## Final repository verification

- related static/unit tests: **53/53** (the Stage 7 baseline 44 plus Stage 8 readiness 9);
- Stage 8 readiness: **9/9**;
- four integration runners plus guard/registration scripts: `node --check` pass;
- bootstrap: `bash -n` pass;
- changed security JavaScript/MJS files: ESLint 0 errors, 0 warnings;
- `git diff --check`: pass;
- `next build --webpack`: pass with Next.js 16.2.7, 26 App Router routes;
- browser static bundle service-role identifier scan: no match;
- production internal route: 404 and non-indexable headers.

The build retained the pre-existing Node `module.register()` deprecation warning. It was run
from the disposable copy with process-scoped local values and no `.env.local`; the local
Supabase stack was already stopped, and no database-backed build step was performed.

## Remaining gates and decisions

Stage 8 cannot be called complete until the required audio corpus is available in the served
path (or the catalog is corrected to a reviewed reachable source) and the missing browser
matrix is rerun with genuinely separate contexts. That rerun must cover normal annotation
and exclusion after re-entry/refresh, alias and rapid duplicates, vote playback/uniqueness,
final completion and restart recovery, direct UI isolation where exposed, and actual A/B
private Presence/Broadcast with unmount/reconnect checks.

Production/staging schema compatibility also remains unverified because the successful local
run used the two local-only fixtures. Reconcile the real house and daily-quest columns from a
reviewed schema dump and repeat the complete rehearsal in an authorized staging environment.
The Realtime dashboard's public-access setting must be checked there; local SQL policy tests
alone do not prove that external setting.

The researcher must still decide the classification of these canonical aliases; migration
preflight reports them and does not rewrite evidence:

- `fsd50k:248110` — Rain / Thunder
- `fsd50k:179173` — Bell / Dishes and pots and pans
- `fsd50k:2510` — Explosion / Fireworks

Persistent friend-room praise remains outside Stage 8 and must not start until these gates
pass. This result is **not** production-application readiness or production-schema
compatibility.

## Stage 8B completion: historical audio fixture and separate-context E2E

Date: 2026-09-13 (Asia/Seoul)

This section supersedes only the earlier browser-blocked Stage 8 result. The database and
failed-audio history above is retained as provenance. Existing tracked and untracked changes
were preserved; no reset, checkout, clean, stash, commit, or push was run.

### Audio provenance and coverage

`scripts/security/audio-fixture-provenance.mjs` compares the synchronized catalog metadata in
`data/sound_metadata.json`, the raw 1,320-row `scripts/pilot_clips_v3.json`, and the audio tree
at `b189395^`. The current catalog has 1,000 rows/995 canonical identities. The historical
tree has 571 MP3 files, but only 85 current metadata rows/80 canonical identities have an
exact matching `public/audio/<zone>/<number>.mp3` path. Another 22 rows have the same filename
in a different historical zone and were deliberately not reused; 893 rows have no historical
blob at the expected path. All five catalog alias pairs have their exact shared historical
blob. This is coverage evidence for a local fixture, not proof of a deployable 995-file
production corpus.

Eight non-empty MPEG Layer III blobs were extracted with `git archive` into the disposable
app only: Music `13433`; Nature `248110`, `147182`, `420296`; Lab `179173`, `2510`, `270587`;
and Animal `390502`. They covered normal annotation, alias evidence, vote, completion, and a
Group B candidate. File sizes ranged from 12,733 to 532,836 bytes. Every fixture returned HTTP
200 with `audio/mpeg` and the expected positive Content-Length. Browser playback produced the
actual play-count UI and playback-start events. No audio was downloaded, generated, read from
remote storage, added to the worktree, committed, pushed, deployed, or included in `.next`.

One preliminary server start revealed that the initial disposable copy had inherited
`.env.local`. It was stopped before any browser request, that attempt was invalidated, and the
file was moved outside the app. All counted DB, browser, and build runs used only the protected
loopback environment produced by the disposable bootstrap. No remote endpoint was contacted.

### Browser and database result

The final browser harness used Playwright 1.62.1 and installed Chromium. One Chromium process
held two separately created incognito contexts A and B, with independent cookie jars, Web
Storage, IndexedDB/cache/service-worker state, anonymous auth users, and participant mappings.
No A/B auth or local-storage state was copied. Completion restart used A's own captured
storage state only to create a replacement A context after closing the original; it was never
shared with B.

The final run passed:

- normal Music playback, locked-before-play input, one normal annotation under two same-task
  clicks, one attempted/succeeded event pair, readable 2.4-second feedback, and canonical
  exclusion after route re-entry and reload;
- first Nature alias annotation, direct second-alias browser submission converging on the same
  canonical result, and exactly one normal annotation row;
- Music and alias vote candidates from the other group, locked-before-play vote, actual
  playback unlock, rapid double-click convergence, canonical exclusion after reload, and one
  vote per participant/canonical identity; independent concurrent-key behavior also re-passed
  in the database integration runner;
- service-role preparation of only the tracked participant's remaining normal annotations,
  followed by the last real browser annotation through `submit_annotation_v4`; the session
  completed in that transaction, its completion annotation matched the result row, and the
  single `session_completed` event referenced that annotation;
- completed-state persistence after route change, reload, closing the original A context, and
  opening a replacement A context; exactly one study session and one attendance row remained
  before cleanup, and no new experiment session or unfinished audio UI appeared;
- browser-originated cross-participant read/update probes returning no protected rows;
- two-context private Presence and Broadcast in both directions, absence after one context
  unmounted, re-presence after return, and actual `WorldMap` connected/disconnected/reconnected
  events while the observing map remained mounted. Initial connection was not recorded as a
  reconnect.

The final run reconciled 117 stored semantic events. It required playback-attempt/start,
annotation, vote, and session-completion events; verified one Music submit attempt/success and
one Music vote attempt/success despite rapid duplicate activation; and found no pointer or
coordinate frames, share-token fields, authorization/service-role material, SQL-like text, or
stack traces in the selected event payload fields. The UI exposed no participant ID, SQL,
stack trace, or key material.

Browser E2E exposed and fixed a real Strict Mode lifecycle defect: annotation and museum
components set `mountedRef` false during development effect replay but did not restore it on
the second setup, suppressing successful async completion callbacks. Both effects now restore
the ref during setup, and a new static regression test fixes the contract.

### Cleanup, regression, and final gate

The final harness deleted only its randomized identities and participant-owned rows. A direct
aggregate database check returned auth users 0, matching E2E participants 0, tracked owned
rows 0, and catalog 1,000/995. The browser and app server were closed before build. The exact
disposable Supabase project was then stopped with `--no-backup`, its matching containers were
confirmed absent, and its two temporary directories were deleted. Unrelated port 3000 and
unrelated containers/processes were not touched.

Final verification passed 60/60 combined static/unit tests, Stage 8 readiness, audio
provenance, browser-harness and integration-runner syntax, bootstrap shell syntax, changed-file
ESLint with zero errors/warnings, `git diff --check`, and Next.js 16.2.7 webpack build with 27
routes. The browser static bundle had no service-role identifier and `.next` contained no MP3.
The production build returned 404 plus `X-Robots-Tag: noindex, nofollow, noarchive` for the new
local-only `/stage8-e2e-test` route. The existing Node `module.register()` deprecation warning
remained.

Final judgment: **Stage 8 local integration and browser E2E complete. Production readiness
remains blocked.** Production still requires the complete 995-canonical audio deployment and
coverage decision, removal or reconciliation of local-only house/quest compatibility,
authorized staging schema rehearsal, Realtime dashboard setting verification, and researcher
decisions for the three alias category conflicts listed above.
