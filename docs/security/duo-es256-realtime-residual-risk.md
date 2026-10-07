# Duo Realtime ES256 authorization boundary

Migration 015 authorizes private Duo Realtime channels with the current
Supabase Auth access token. Realtime verifies the project-issued ES256 token;
`private.is_realtime_room_member(text)` then derives authorization from
`auth.uid()` plus the exact Duo topic, active study participant, active and
unexpired session, live membership, and an active lease whose heartbeat is no
older than 45 seconds. The legacy room-membership branch is unchanged.

The product path continues to send `clientId` only to server APIs. Host, join,
recover, status, heartbeat, leave, and close validate that identifier against
the lease, so a normal second tab with a different `clientId` receives
`already_open_elsewhere`. Duo tables remain unavailable to `anon` and
`authenticated`; private Realtime channels remain protected by authenticated-
only SELECT/INSERT policies on `realtime.messages`.

## Residual same-user replay risk

A standard Supabase access token identifies an auth user, not an individual
browser tab. Consequently, a malicious tab controlled by the same auth user
can copy an existing topic and access token from developer tools and open a
private Realtime WebSocket while that user's membership and lease remain
valid. Realtime RLS cannot distinguish that copied connection from the
legitimate tab. Presence keys and payload fields are application data, not a
cryptographic client binding.

This does not let another auth user enter the topic, cross into another
session, read Duo tables, or reconnect after participant revocation, leave,
session close/expiry, or lease staleness. Eliminating same-user manual replay
would require an additional server-verifiable per-client credential or a
trusted token-exchange/signing design. Migration 015 deliberately does not
generate, import, rotate, or replace any Supabase signing key.
