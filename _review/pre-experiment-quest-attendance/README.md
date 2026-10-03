# Pre-experiment quest and attendance release blocker review

This folder is generated and verified by `scripts/security/quest-attendance-browser-e2e.mjs` against a disposable loopback Supabase stack and an isolated local Next.js server.

## Captures

- `qa-quest-panel.png`: deterministic QA quest fixture and no-write notice.
- `qa-attendance-before.png`: seven-day QA fixture before the in-memory claim.
- `qa-attendance-claimed.png`: claimed QA state; the button is disabled without a server mutation.
- `runtime-quest-panel.png`: authenticated local quest result after a recovered network failure.
- `runtime-attendance-before.png`: Economy V1 attendance before a claim.
- `runtime-attendance-claimed.png`: the persisted, single-award result after a guarded rapid double click.
- `network-error-retry.png`: contained network error with an explicit retry action and no Next.js overlay.
- `mobile-portrait.png`: QA quest panel at 390×844.

The browser test rejects `console.error`, `pageerror`, `unhandledrejection`, Next.js error overlays, unexpected failed requests, duplicate attendance rows, and duplicate ledger entries. It also asserts that QA quest, attendance, purchase, and room-save interactions emit no real reward or Economy mutation. Authenticated concurrent-client replay is covered by the disposable database integration test; the product's single-active-session guard intentionally prevents two live app tabs for one participant.

Screenshots intentionally contain no browser chrome or URL query. Before release, the review command also scans these files for JWTs, UUIDs, Supabase secrets, participant identifiers, and database error details.
