# Functional audit Stage 10B: room browser and common ZoneMap closure

Date: 2026-09-14 (Asia/Seoul)

Status: **Stage 10 local hardening and browser closure complete. Stage 11 policy decisions and authoritative external inputs remain blocked.**

This result is local-only. No production, Preview, staging, Storage, or remote Supabase project
was contacted or changed. The database used local-only house/quest compatibility fixtures, so
it is not evidence of staging schema compatibility. The complete audio corpus remains 0/995 in
the worktree and no 995-audio playback E2E was run.

## Schema validator closure

- authenticated `participant_room` INSERT, UPDATE, DELETE, and TRUNCATE are four independent
  blocker fixtures;
- PUBLIC and anon TRUNCATE remain forbidden;
- authenticated SELECT and `participant_room_select_own` are allowed;
- any authenticated room INSERT/UPDATE/DELETE policy is a blocker;
- `save_participant_room_v3(uuid,jsonb)` requires the exact argument names, authenticated
  EXECUTE, no PUBLIC/anon EXECUTE, `SECURITY DEFINER`, and fixed empty search path;
- the snapshot test fixes the `aclexplode(table ACL) → privilege_type` collection path that
  includes TRUNCATE;
- migration 007's revoke, all three policy drops, function hardening, revoke, and authenticated
  grant are statically fixed by tests.

The synthetic authenticated TRUNCATE inventory failed with
`participant_room_rpc_bypass_grant:TRUNCATE`. The fresh disposable inventory passed. This says
nothing about staging because no sanitized staging inventory was supplied.

## Disposable database result

The final fresh stack applied the restored core/historical schemas, two explicitly local-only
compatibility fixtures, 001, catalog synchronization, 002–007, preflights, and verifiers in
order. Results:

- catalog: 1,000 rows / 995 canonical identities before and after cleanup;
- authenticated direct room INSERT/UPDATE/DELETE: denied;
- authenticated/anon/PUBLIC TRUNCATE ACL: absent;
- authenticated room write policy: absent;
- owner SELECT and v3 RPC save: pass;
- same-key replay and different-key concurrent whole-snapshot convergence: pass;
- cross-participant and friend-room membership boundaries: pass;
- room event replay/redaction: pass;
- annotation, vote, completion, attendance, quest, User Event, currency, and ledger regressions:
  four of four runner processes passed;
- live schema inventory validator: pass.

Final cleanup aggregate was auth/QA participant/event/room `0/0/0/0`; catalog stayed
`1000/995`. The exact stack and directory were stopped/removed. Port 3000 and unrelated
containers/processes were preserved.

## A/B room browser result

One Chromium process created two genuinely separate contexts. Each had its own cookie jar,
local/session storage, anonymous auth user, participant claim, A/B group, study session,
client instance, and User Event queue. No A/B state was copied. A's post-authentication storage
state was used only to create a replacement A context.

Both A and B passed initial room load, UI wallpaper change, actual v3 save, view-mode transition,
reload recovery, and independent row verification. A additionally passed replacement-context
recovery. A's first save request was deliberately failed at the network boundary: the UI stayed
in edit mode, preserved the chosen wallpaper, showed failure feedback, and retried with the same
operation key. Rapid save activation produced one logical successful result. A separate in-page
probe proved same-key RPC replay returns the first result.

Both browser-authenticated clients were denied direct table INSERT/UPDATE/DELETE. Cross-room
SELECT returned no rows and cross-room UPDATE changed nothing. A payload containing a value
shaped like the other participant ID still updated only the authenticated caller's row.
TRUNCATE was not called through PostgREST and is supported only by ACL inventory/static/SQL
evidence.

The reconciled room event subset had six rows. A and B each had exactly one
`room_save_succeeded`; A also had the intended failure. Successes included the same
`room_save` operation type/key linkage and `participant_room` result type, with null result ID.
Study-session ownership was separate. Selected payload fields contained no raw room JSON,
participant/auth ID, share token, authorization, SQL, or stack trace.

## Common ZoneMap route calculation and browser result

| Direct route | Zone | Production-relevant | Result |
| --- | --- | --- | --- |
| `/lab-test` | Lab | no; internal local-only | full common-map browser regression passed |

There is no production-relevant direct consumer. The production home route's complete zone
set is Animal, Human, Nature, Urban, Music, and Lab, and every branch selects its dedicated map.
Music/Nature and the other dedicated engines are therefore not counted as common `ZoneMap`
results. They do import some shared primitive exports, which did not make them direct consumers.

The Lab common-map regression passed:

- hydration and console errors: zero;
- character, HUD, keyboard movement, pointer D-pad, and moving animation: pass;
- map-boundary collision and collectible approach: pass;
- annotation overlay open, background-input block, Enter-repeat suppression, Escape close,
  and movement restoration: pass;
- exit confirmation, cancel, and Escape exit callback: pass;
- narrow 390x844, notebook 1440x900, and wide 1920x1080 viewports: pass;
- camera/character render after resize and reload: pass.

Sound item identity and tile coordinates were compared across animation tick, ordinary/parent
rerender, a deliberately equivalent fresh `sounds` array/object graph, HUD/collected-set change,
annotation open/close, resize, block change, reload, and route re-entry. Every comparison was
stable. The fix caches placement on `zone + semantic layout key`, where the key contains only
sound ID and block. It excludes participant identity and response text, retains the first input
order to preserve existing layouts, and recalculates only when a sound identity/block or zone
actually changes.

## Lint, build, and route boundary

Full ESLint reported 0 errors and 0 warnings. `.next-*/**` matched only user-owned generated
Next output and no tracked production source. The three design support ignores name exact
`support.js` files; search found no application/build import. No directory-wide design source
ignore exists. Both former file-wide native `<img>` exceptions were removed: standalone
fence/decor sprites use `next/image`, and the only remaining suppression spans the exact
`LibraryChar` layered sprite-sheet clipping block. New Stage 10B app, runner, validator, and
test files were included in the full lint run.

All 84 auto-discovered static/unit tests passed. Runner `node --check`, bootstrap shell syntax,
and `git diff --check` passed. An `.env*`-free disposable copy built 27 routes with Next.js
16.2.7 webpack. The production server returned 404 and `X-Robots-Tag: noindex, nofollow,
noarchive` for `/stage8-e2e-test`. Browser static chunks contained no service-role variable or
placeholder value; `.next` contained no MP3/WAV/OGG. The known Node `module.register()`
deprecation warning remained and did not fail the build.

## Remaining blockers

- approved, licensed, provenance-reviewed complete corpus and 995/995 playback coverage;
- sanitized authoritative staging inventory, migration ledger, and house/quest reconciliation;
- authorized staging application of 007, dashboard Auth/Realtime checks, rehearsal, and pilot;
- all Stage 11 research/governance decisions.

This is not production readiness or experiment deployment completion.
