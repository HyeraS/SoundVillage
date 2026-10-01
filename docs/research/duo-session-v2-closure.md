# Duo Session V2 closure

Date: 2026-10-01 (Asia/Seoul)

Scope: Stage 4B local audit, hardening, and disposable verification

Baseline: `4aa2b836` (`feat(economy): complete multi-village interior cutover`)

Stage 4A record correction: `cf19acdc` (`docs(economy): correct interior cutover closure record`)

## Final contract and threat model

Duo Session V2 is an authenticated, server-approved session for exactly one host and one visitor. A session UUID identifies the server record and private Realtime topic; it is not an invitation credential. A separate 256-bit invitation token is shown only to the host and is stored by PostgreSQL only as its SHA-256 digest. Sessions and invites expire after two hours.

The boundary assumes the Supabase service-role key and JWT signing secret remain server-only, TLS protects non-loopback deployments, and the database clock is authoritative. An attacker may know a session UUID, copy an authenticated user's normal access token, replay a request, race host/join operations, forge room JSON, choose a different client UUID, or attempt a direct private Realtime subscription. None of those facts alone grants a session lease or Realtime access.

Only active study participants may host or join. A session has one host role and at most one visitor role. A fresh lease is bound to `(session_id, auth_user_id, client_id)`; the same participant cannot acquire another fresh lease with a different client ID. Presence and Broadcast payloads accept only the `worldmap`, `interior`, and `waiting` screens, four facings, finite bounded coordinates, a boolean movement flag, and the peer role expected by the receiving client.

Visitors can read only the host room selected when the server creates the session. UI editing and shops are absent in visitor mode. Economy V1 purchase and room writes return `403 visitor_readonly`. The fingerprint-protected legacy purchase route and RPC remain byte-for-byte unchanged; migration 012 adds a transaction trigger that rejects a fresh active visitor before its legacy ledger insert can commit, so the whole purchase transaction rolls back.

## Migration, API, and Realtime structure

Migration `scripts/security/012_duo_session_v2.sql` adds:

- `duo_v2_sessions`, including server-selected `room_system` (`legacy` or `economy_v1`)
- role-unique `duo_v2_session_members`
- hashed-token-only `duo_v2_invites`
- exact-client `duo_v2_leases`
- idempotent host/join operation results with sensitive-field rejection
- service-role-only host, join, status, room, recover, heartbeat, leave, revoke, and visitor-mutation RPCs
- the legacy ledger visitor guard trigger
- claim-bound extension of the existing authenticated-only Realtime membership function

All Duo tables have RLS enabled and no browser table mutation grant. Route Handlers derive identity from the bearer access token, validate allow-listed JSON/query fields and UUIDs, call service-only RPCs, map stable error codes, and return allow-listed response fields with `private, no-store` and `no-referrer` headers.

The host API chooses the room system from the server runtime mode. `cutover` always uses the Economy V1 room; `legacy` and `preview` use the legacy room. Room reads never fall back between systems and require an active member, exact client lease, fresh heartbeat, active participant, active session, and unexpired session.

## Server-side four-item unlock

The host RPC reads the stored room and ownership tables itself. It counts distinct `itemId` values from the approved, connected, movable catalog allow-list. Duplicate placements count once. Starters, wallpaper, flooring, pending products, unknown products, and unowned products do not count. Economy sessions join `participant_economy_v1_rooms` to `participant_catalog_items`; legacy/preview sessions join `participant_room` to `participant_interior_items`. The client supplies neither the count nor the runtime mode. Fewer than four qualifying products returns `invite_locked`.

The integration suite covers 0 items, 3 unique items, four copies of one item, an unowned forged item, a starter, a pending item, and four official owned items.

## Token, session, and recovery lifecycle

The browser reads `?duo=<token>` during initial state construction and immediately removes it with `history.replaceState`; a layout effect repeats the scrub after hydration before ordinary effects. The token is absent before the join request is sent. It is not written to recovery storage, DOM, events, errors, or screenshots.

Host/join idempotency stores request hashes and sanitized results. The same key and payload returns the same result; the same key with a different payload returns `idempotency_key_reused`. After a successful visitor join, recovery storage contains only `{ sessionId, clientId, role }`. Recovery reuses that exact client ID. Terminal failures remove the in-memory invite; leave, expiry, or close invalidates the lease/session boundary.

The server issues a short-lived, HMAC-SHA256 Realtime JWT containing `sub`, `role=authenticated`, `duo_session_id`, `duo_client_id`, and `duo_role`. It is refreshed by heartbeat responses and is kept in memory. It is never logged or persisted.

## Heartbeat, lease, and reconnect policy

- Client heartbeat interval: 15 seconds
- Fresh lease window: 45 seconds
- Position send throttle: contract-defined and payload validated
- Stale peer position removal: contract-defined client timer
- Reconnect: bounded exponential retries on channel loss; online recovery uses the same client ID
- Wrong-client heartbeat, room, recover, or leave does not alter the valid lease
- Leave updates `left_at` only after exactly one matching active lease is released
- Host revoke closes the session, revokes the invite, releases all leases, and removes private Realtime authorization
- A disconnected/closed visitor retains only the stored host room as a read-only fallback, with an explicit ended-session notice

## Direct second-tab attack

The WebSocket integration signs the same short-lived claims used by the application and opens real private Realtime channels. The legitimate host and visitor can join Presence and exchange validated Broadcast positions. Outsiders and tampered topics are denied.

A second Supabase client then reuses the visitor's ordinary authenticated access token and known session UUID but has no server-issued lease/client claims. Its direct subscription is denied while the first visitor lease remains active and fresh. The browser suite separately confirms the API path returns `already_open_elsewhere` for the same authenticated visitor in a second context.

## Verification results

The disposable loopback rehearsal applied migrations 001–012 from a fresh local stack and passed:

- 012 preflight and structural verification
- Economy, Character, runtime, Interior, and Duo DB integration/concurrency suites
- real private Realtime Presence/Broadcast authorization
- authenticated Next HTTP boundaries
- legacy, preview, maintenance, and cutover browser modes
- Character and Interior product-path browser regressions
- A/B/C plus second-B-context Duo browser E2E
- production `next build --webpack` and `next start` for the long-lived Duo tab flow
- RLS, transactional integrity, user-event, and experiment-rule local integration
- pre-migration, post-011/012, and post-browser legacy fingerprint comparison

Separate repository checks passed for the 41-test multi-village suite, security boundary, transactional integrity, user events, experiment rules, functional fixes, Stage 8 readiness, World Home Hub, World production integration, changed-file ESLint, shell syntax, and `git diff --check`.

Review captures in `_review/duo-session-v2/` cover host invite readiness, token-scrubbed visitor entry, two players in Interior and World Map, visitor read-only state, third-user and same-auth second-tab denial, disconnect/reconnect guidance, host revoke/read-only fallback, 390×844, and 844×390.

## Preservation and cleanup evidence

No remote or linked Supabase command was used. All database and WebSocket work used a loopback URL guarded by `local-supabase-guard.mjs`. The rehearsal created a random directory under `/private/tmp`, ephemeral QA auth users/participants, a disposable Supabase project, generated local keys, isolated Next development/production copies, and isolated Next processes. Its exit trap stopped the app and Supabase project and removed the temporary directory and secrets. The initial Colima state was off and is restored to off after verification. An unrelated pre-existing user Next development server in the main workspace was not stopped or modified.

The protected Stage 3B source fingerprint, migration-era database rows, ACLs, policies, and protected legacy function definitions remained identical. The 008–011 Economy/Character/Interior contracts passed before and after Duo browser activity. World Map work outside the Duo hunks was left unstaged and unchanged by this task.

## Residual risk

- Session confidentiality still depends on protecting the host's one-time invitation URL until it is consumed or revoked.
- A fully compromised authorized browser can observe its own in-memory short-lived Realtime JWT until expiry; it cannot mint another client/role/session claim without the server secret.
- Lease freshness and session expiry use database time, so severe clock or infrastructure failure can interrupt availability, but do not widen access.
- The fingerprint-protected legacy purchase endpoint returns its historical generic `purchase_failed` response when the Stage 4B database trigger rejects an active visitor; it does not expose a new Duo-specific legacy error code. The transaction is nevertheless rolled back and verified to grant no item or ledger mutation.
- Review PNGs intentionally omit browser chrome, so URL token removal is proven by the pre-request browser assertion and storage/DOM checks rather than by an address-bar image.

No remote migration or push was performed.
