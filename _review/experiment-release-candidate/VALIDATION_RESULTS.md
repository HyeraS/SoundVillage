# Stage 5 / 5.1 Validation Results

Date: 2026-10-04 (Asia/Seoul)

## Requested commands

| Command | Passed | Failed | Result |
|---|---:|---:|---|
| npm run test:character-v2-stage4 | 29 | 0 | PASS |
| npm run test:multi-village-economy | 43 | 0 | PASS |
| npm run test:security-boundary | 6 | 0 | PASS |
| npm run test:quest-attendance | 7 | 0 | PASS |
| **Node test total** | **85** | **0** | **PASS** |
| npm run lint | 1 command | 0 | PASS |
| npm run build | 39 static pages generated; dynamic routes compiled | 0 | PASS |
| git diff --check | 1 command | 0 | PASS |

An earlier Character invocation observed a newly added CSS contract assertion that required a semicolon after a final declaration. The implementation already contained the required .544 value. The current assertion accepts the valid closing-brace form, and the complete suite was rerun at 29/29. No assertion was deleted, skipped, or weakened in meaning.

## Independent disposable rehearsals

| Run | Fresh temporary project | Result |
|---|---|---|
| 1 | /private/tmp/soundvillage-stage8.wknw0C | PASS |
| 2 | /private/tmp/soundvillage-stage8.vGx0lV | PASS |

Both stacks were independently created, migrated, tested, and removed by rehearsal cleanup. Each run passed:

- migrations 001–014 and forward-only preconditions;
- legacy fingerprint comparison before/after/final;
- DB, RLS, ACL, idempotency, concurrency, and redaction;
- private WebSocket Presence/Broadcast authorization;
- legacy, preview, maintenance, and cutover modes;
- Character Stage 3 QA/live and Stage 4 A–B → A–C;
- immediate peer removal, no previous-peer frame, delayed response protection;
- +10/-10 minute clock skew, session-scoped bounded nonce behavior;
- termination, stale/terminal/pagehide/reconnect cleanup;
- preview not propagated, saved state propagated, reconnect/fallback restore;
- shop purchase/equip, six villages, library, Interior purchase/save/share;
- quest and attendance.

The timing-stabilized Character preview E2E passed once in each independent run without a wrapper retry. Character Stage 3/4 asserted zero asset failures, page errors, console errors, and Next.js overlays. Quest/attendance asserted zero console/page errors, unhandled rejections, failed requests, unexpected HTTP responses, and overlays. Character V2 and monitored major assets had zero 404s.

Final local result: code/rehearsal gates pass; external dashboard, production environment, backup, and production-data gates remain human-operated.

## Stage 5.1 operating-gate closure

Supabase CLI 2.117.0 was inspected with `supabase migration up --help`. It has
no version, filename, `--to`, or migration-count limit, so the runbook no longer
uses `supabase migration up --linked`. `supabase migration list --linked` is the
read-only ledger/pending inventory command; the approved execution path is one
immutable SQL file at a time with stop-on-error and a ledger refresh after each
file.

A fresh disposable 001–014 Supabase project was created under
`/private/tmp/soundvillage-stage8.VFoLNu` and removed after the run. The final
normal fixture produced nine `blocking_summary` rows with `issue_count=0`,
`blocking_issue_count=0`, and `operator_review_count=0`.

Rollback-only fixtures then proved these detections:

| Fixture | Observed result |
|---|---|
| normalized participant ID duplicate | participant duplicate count 1 |
| one auth user mapped to two participants | auth-user duplicate count 1 |
| missing auth mapping | missing-mapping count 1 |
| catalog alias count drift | alias-count detail emitted |
| catalog required field blank | required-field detail emitted |
| canonical-to-file/source conflict | canonical conflict detail emitted |
| file path mapped to two canonical IDs | file-path conflict detail emitted |
| source identity mapped to two canonical IDs | source conflict detail emitted |
| contradictory active study session | session contradiction count 1 |
| stale active Duo lease | Duo lease count 1 |
| lease on terminal Duo session | terminal-session reason emitted |
| lease on expired Duo session | expired-session reason emitted |
| active participant without loadout | missing-loadout count 1 |
| catalog-invalid outfit and accessory | catalog-invalid count 2 |
| unowned equipped outfit and accessory | not-owned count 2 |

The stale-Duo fixture also produced `blocking_issue_count=1` and the separate
`operator_review_count=1`. No preflight update/delete occurred. Each injected
fixture was rolled back, and a final normal preflight was byte-identical to the
initial normal output.

The requested regression commands were rerun after the Stage 5.1 edits: 29/29
Character, 43/43 Economy, 6/6 security-boundary, and 7/7 quest/attendance tests
passed (85/85 total); lint passed; the Next.js 16.2.7 webpack production build
passed with 39 static pages; and all 001–014 SHA-256 checks passed. `git diff
--check` and the final release-document consistency check also passed.
