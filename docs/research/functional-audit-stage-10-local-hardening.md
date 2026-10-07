# Functional audit stage 10: local boundary hardening and input handoff

Date: 2026-09-14 (Asia/Seoul)

Status: **Stage 10 local hardening and browser closure complete. Stage 11 policy decisions and authoritative external inputs remain blocked.**

No production, Preview, staging, Storage, or other remote Supabase project was contacted. No
`.env.local` value was used for SQL, integration, accepted build, or browser validation. No external
audio was downloaded/generated and no historical audio was restored. Existing tracked and
untracked work was preserved.

## 1. Room boundary decision and implementation

The repository has only one application room mutation: `lib/interiorDecor.js` calls
`save_participant_room_v3`. Browser source has no direct room insert/upsert/update/delete.
`stage8-browser-e2e.mjs` uses a service-role setup insert, which is an isolated QA/admin path.
The previous committed room client predates the RPC, so 007 intentionally ends compatibility
with direct-upsert clients.

The selected boundary is explicit RPC-only:

1. Revoke direct table write grants, including DELETE/TRUNCATE, from PUBLIC, anon, and
   authenticated.
2. Remove authenticated INSERT/UPDATE policies instead of retaining a dormant defense layer.
   They provide no protection without grants and would silently restore the bypass if a grant
   later regressed.
3. Retain authenticated SELECT plus `participant_room_select_own`.
4. Reassert `save_participant_room_v3(uuid,jsonb)` as `SECURITY DEFINER`, empty search path,
   PUBLIC/anon denied, authenticated EXECUTE granted.
5. Preserve service-role's normal admin/test capability without adding a browser-accessible
   grant.

This is implemented as forward migration `007_participant_room_rpc_only.sql`; migrations
001–006 were not rewritten. It must be applied only with a compatible app in a reviewed
maintenance window. Actual staging compatibility remains unverified.

The schema validator now requires the room-save RPC and rejects either direct room write grants
or authenticated write policies. Its previous contradiction—requiring those policies while
also rejecting their grants—is removed.

## 2. Disposable integration result

A fresh loopback-only Supabase installed historical/core schema, local-only compatibility
fixtures, 001–007, and the 1,000-row/995-canonical catalog. Four of four integration runner
processes passed. The expanded RLS runner verified:

- authenticated direct room INSERT, UPDATE, and DELETE fail;
- owner room SELECT succeeds and cross-owner SELECT is empty;
- RPC save succeeds and derives ownership from `auth.uid()` mapping;
- same operation-key replay returns the single stored result;
- simultaneous different-key saves serialize to one complete submitted snapshot (last
  committed whole snapshot; no fieldwise merge);
- an RPC payload cannot select another participant's target row;
- shared-room output and membership boundary remain constrained;
- a replayed room-success event stores once;
- selected User Event payload fields contain no raw room JSON, share token, auth ID, or
  participant ID.

The event links by operation type/key and no longer writes `result_entity_id`, because the
current room primary key is the participant ID. Server-derived protected identity columns in
`user_events` remain unchanged; the client cannot supply them.

Two failed rehearsal attempts are retained as test evidence: the first caught JSONB key-order
comparison in the new concurrency assertion; the second passed all runners but caught missing
idempotency cleanup. Each failed disposable stack stopped automatically. The final run cleaned
only its randomized data and returned auth users/QA participants 0/0 with catalog 1,000/995.
The exact final stack and temporary directory were removed. The unrelated port 3000 process
remained running.

Existing annotation, vote, completion, attendance, quest, ledger, uniqueness, session,
and User Event checks passed in the other three integration runners. The conclusion that no
new browser database E2E was needed was incomplete because migration 007 changed the browser
room-save boundary. Stage 10B added and passed that migration-aware A/B room browser E2E.
Stage 8B remains the full annotation/vote/completion/Realtime browser evidence; Stage 10B is
the authoritative browser evidence for room persistence after 007.

## 3. Lint classification and normalized baseline

The original full run reproduced 334 errors and 46 warnings across 35 files:

| Class | Errors | Warnings | Production source? | Treatment |
| --- | ---: | ---: | --- | --- |
| `.next-nature-qa` Next output (430 MB) | 304 | 34 | no | ignored as `.next-*/**`; directory preserved |
| three identical imported design `support.js` runtimes | 6 | 3 | no | exact-file ignores only; design directories preserved |
| `components/ZoneMap.js` | 20 | 0 | yes | ref/render purity and clock access fixed |
| `components/LibraryRoom.js` | 0 | 7 | yes | standalone images moved to `next/image`; native exception narrowed to layered character-sheet clipping |
| application pages | 4 | 2 | yes (mostly protected QA pages) | effects/query handling, Link, and native sprite QA exception fixed/scoped |

Rule classification included React hooks/ref (17), purity (3), synchronous effect state (3),
deprecated React APIs (3, design runtime), hook dependency (3 warnings, design runtime), native
image performance (9 warnings), and one internal-link error. Generated output also contained
plugin-internal rules and parser warnings that are not source findings.

The ignore changes do not exclude application, library, migration runner, security validator,
or test directories. Stage 10B removed both file-wide native-image overrides: independent
fence/decor sprites now use `next/image`, while a local disable spans only `LibraryChar`'s
layered sprite-sheet clipping and all clipped layers have empty alt text. After correction,
`npm run lint` checks the full remaining tree and reports zero errors and zero warnings.

The ZoneMap refactor uses memoized immutable spawn/path/object data and state-driven animation
ticks. A loopback disposable dev app browser-rendered `/lab-test`; an initial check exposed a
pre-existing server/browser floating-point hydration difference in animated SVG attributes.
Animation attributes are now rounded to stable four-decimal values. A fresh browser tab then
rendered the full common ZoneMap with one character element and no console errors. Port 3110
and its temporary app copy were removed afterward.

## 4. External input package and snapshot audit

`stage-10-external-input-handoff.md` is the operator/researcher procedure and
`audio-corpus-delivery.example.json` is the safe audio chain-of-custody template. It requests
the corpus absolute path, delivery ID/checksum, per-canonical original source, license/contract
reference, rights evidence location, acquisition date, reviewer, classification decision, and
attribution without storing restricted agreement text, private URLs, or identity/auth data.

The staging handoff allows only schema shape, constraints/indexes, RLS/policies, grants,
function signature/argument names, definer/search-path flags, and a separate version-only
migration ledger. The snapshot is a read-only PostgreSQL catalog query. Static audit confirms
it neither queries result/event rows nor emits function bodies (`pg_get_functiondef`, `prosrc`,
and `probin` are absent). Secrets, connection strings, `.env`, identifiers, row data, event
payloads, function bodies, and production logs are prohibited.

## 5. Research policy decision table (not implemented)

| 결정 항목 | 권장 선택 | 대안 | 결정하지 않을 때의 위험 | 승인 후 필요한 코드·DB·운영 변경 |
| --- | --- | --- | --- | --- |
| 세 canonical category 충돌 | canonical은 하나로 유지하고 연구자가 primary 또는 명시적 multi-label 규칙 승인 | blob을 둘로 분리(비권장) | category 분석 불일치, 995/995 승인 불가 | controlled review, 분석 view/protocol, regression 기대값 |
| participant ID + 1회용 secret | participant별 1회용 secret의 server-side hash와 제한된 재시도 | ID-only, 외부 계정 인증 | 최초 claim 탈취 | registry/hash migration, claim API/UI, rate limit, reissue audit |
| auth 분실 복구·재발급 | 운영자 확인 후 새 1회용 recovery secret으로 atomic rebind | 복구 없음, 공개 self-reset | 정당한 참가자 lockout 또는 오연결 | incident 절차, old-session revoke, rebind tool/test |
| 여러 탭·기기 lease/takeover | round당 한 active client lease와 통제된 takeover | 완전 동시, 동일 기기 다중 탭 | 자극 순서·timing 오염 | heartbeat/lease DB, UI, queue ownership, multi-context test |
| retest와 experiment round | 기본 금지, 연구자 사유 기록 후 round 증가 | 영구 금지, self-service | 선택적 재시험 편향·중복 | operator RPC/tool, grants, round-aware export/UI |
| 완료 화면·외부 설문 이동 | 저장과 final flush 확인 후 승인된 안내/redirect와 fallback | 현재 정적 화면, operator code | 조기 종료·debrief/보상 누락 | allowlist, completion UI/a11y, flush handshake, E2E |
| reload/remount reconnect 의미 | 동일 mounted map의 presence loss/recovery만 reconnect | 모든 remount, server episode | reconnect 지표 비교 불가 | 필요 시 episode schema/query; 현재는 분석 정의 문서화 |
| User Event 보존·삭제·export | IRB/consent의 정확한 기한·최소권한·감사·암호화 export | 식별형 무기한 보존(비권장) | privacy/governance blocker | access review, export/delete jobs, backup alignment, audit |
| friend-room praise 범위 | pilot에서는 명시적 ephemeral copy | 제한 fixed reaction, free text(비권장) | 사용자 오해 또는 미승인 social/privacy 표면 | copy 수정 또는 RLS/rate limit/moderation/retention |
| pilot 규모·중단 기준 | scripted QA 후 최소 4/4 A/B 8명 balanced pilot, P0 즉시 중단 | 내부 QA만, 다단계 확대 | 실사용 timing/recovery/logging 결함 유입 | protocol sign-off, stop owner, support script, evidence review |

No participant schema, claim secret/recovery API, lease, retest, completion redirect, praise
persistence, or event-governance job was implemented in this stage.

## 6. Remaining blockers

- approved complete production corpus and controlled rights/provenance review: still 0/995;
- sanitized staging schema inventory and migration ledger: not supplied, compatibility unknown;
- real house/quest schema reconciliation; local-only fixtures remain non-authoritative;
- authorized staging application of 007 and full A/B/slow-network/multi-client/Realtime matrix;
- dashboard Anonymous Auth/Realtime public-access checks;
- all policy decisions in section 5, approved pilot, backup/restore evidence, and Go sign-off.

## 7. This-run verification

- all auto-discovered Node static/unit tests: 75/75;
- disposable database integration runners: 4/4 processes;
- schema/audio validator subset and new 007 static contract: pass;
- `npm run lint`: 0 errors, 0 warnings across all non-generated/non-reference source;
- integration runner syntax, bootstrap shell syntax, and `git diff --check`: pass;
- Next.js 16.2.7 clean webpack build from a disposable copy with no `.env*`: pass, 27 routes;
- common ZoneMap loopback browser render after stable SVG rounding: no console errors;
- final QA cleanup: auth users/participants 0/0, catalog 1,000/995;
- final disposable database/app stacks and temporary directories: removed; port 3000 preserved.

One earlier build invocation mistakenly executed in the source directory after preparing the
copy; Next reported `.env.local`. It was invalidated. Process-level loopback placeholders were
already set, the build has no database-backed step, and no remote query or mutation occurred.
The reported build is the later clean run inside the `.env*`-free disposable copy.

## 8. Stage 10B closure (2026-09-14)

The schema validator now rejects authenticated `TRUNCATE` on `participant_room` in addition
to `INSERT`, `UPDATE`, and `DELETE`. Each privilege has an independent fixture. Separate
fixtures keep PUBLIC/anon `TRUNCATE` forbidden, preserve authenticated owner `SELECT`, reject
authenticated room write policies, and retain the exact authenticated-only, `SECURITY
DEFINER`, empty-search-path `save_participant_room_v3(uuid,jsonb)` contract. The catalog-only
snapshot ACL expansion is statically tested; a live disposable inventory passed. No staging
inventory was supplied or claimed.

A fresh loopback Supabase applied the historical/core schemas, local-only compatibility
fixtures, 001–007, and the full 1,000/995 catalog. It passed all four integration runners plus
the live inventory validator. Direct room INSERT/UPDATE/DELETE failed in authenticated clients;
catalog ACL inventory proved authenticated, anon, and PUBLIC TRUNCATE absent; room write
policies were absent; owner SELECT, RPC save, replay, concurrent whole-snapshot convergence,
cross-owner denial, friend-room membership, User Event deduplication/redaction, and the existing
annotation/vote/completion/attendance/quest/ledger suite passed.

The room browser E2E used two genuinely separate Playwright Chromium contexts. A and B had
independent anonymous auth, cookies, local storage, session storage, participant mapping,
group, study session, client instance, and User Event queue. A's storage state was captured
only after A authenticated, used only for a replacement A context, and never copied to B.
Both participants loaded their initial room, changed it through `InteriorDecorRoom`, saved via
the actual v3 RPC, reloaded, and recovered. A also recovered from the replacement context.
An injected one-request network failure proved edit/input preservation and failure UI; retry
used the same operation key. Rapid activation produced one logical success. Direct browser
INSERT/UPDATE/DELETE, cross-room reads/writes, and payload identity spoofing were blocked or
confined to the authenticated caller. TRUNCATE was not represented as a browser test.

The final room event set contained six attempted/failed/succeeded rows. Each participant had
exactly one success, ownership/study sessions were separate, operation type/key linkage was
present, `result_entity_type=participant_room`, and `result_entity_id` was null. Selected event
payload fields contained no room JSON, participant/auth identifier, share token, authorization,
SQL, or stack trace.

Static route calculation found no production-relevant route that directly renders the common
`ZoneMap` component: `app/page.js` routes all six reachable zones to dedicated components
(`MusicZoneMap`, `HumanZoneMap`, `NatureZoneMap`, `UrbanZoneMap`, `AnimalZoneMap`, and
`LabZoneMap`). The only direct rendered common-map route is protected local `/lab-test` with
zone `Lab`; the dedicated maps import shared primitive exports but not the common component.
The common component regression covered that one real direct-use route and did not mislabel
Music/Nature or the other dedicated maps as common-map users.

The `/lab-test` browser run passed hydration/console, character/HUD, keyboard and pointer D-pad
movement, moving animation, map-boundary collision, collectible approach, annotation overlay
open/close, background-input blocking, post-close recovery, Enter repeat suppression, Escape,
exit confirmation, and 390x844/1440x900/1920x1080 viewports. Item identity and tile coordinates
stayed stable across animation ticks, parent rerenders deliberately recreating equivalent sound
objects, HUD/collected-set changes, annotation open/close, resize, block change, reload, and
route re-entry.

Placement no longer uses the `sounds` array reference as its respawn condition. A semantic
layout key contains only sound ID and experiment block; it excludes participant ID and response
content. Equivalent arrays reuse the original placement, while a real sound/block change
recomputes it. The first array order is retained, preserving the established layout. SSR and
the first browser render remain deterministic.

Final verification passed 84/84 auto-discovered static/unit tests, both Stage 10B browser
runners, four database integration runners, live/synthetic schema validation, full ESLint with
zero errors and zero warnings, runner/shell syntax, `git diff --check`, and an `.env*`-free
Next.js 16.2.7 webpack build of 27 routes. Production `/stage8-e2e-test` returned 404 with
`noindex, nofollow, noarchive`; browser static chunks contained no service-role name/value and
the build contained no MP3/WAV/OGG. Exact disposable app/database stacks stopped and their
temporary directories were removed. Cleanup was auth/QA participant/event/room 0/0/0/0 with
catalog 1,000/995. The unrelated port 3000 process remained running.

Final judgment: **Stage 10 local hardening and browser closure complete. Stage 11 policy decisions and authoritative external inputs remain blocked.**
