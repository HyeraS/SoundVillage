# Stage 5.1 Operations Runbook

This runbook is a procedure only. No production database, deployment, dashboard setting, or production data was changed during Stage 5 or Stage 5.1.

## Human dashboard gates

Confirm and record screenshots or exported settings before deployment:

- Auth → Providers → Anonymous: enabled.
- Realtime → Settings: public access disabled.
- Realtime private-channel policies duo_realtime_read and duo_realtime_send exist and only admit a current session member with an active, fresh lease.
- RLS enabled on all participant, wallet/ledger, attendance, Character loadout/result, Interior room/result/share, Duo session/member/invite/lease/result, study session, and user-event tables.
- anon has no direct mutation access to protected tables or service RPCs.
- authenticated has only the intended own-row reads and client RPC execute grants.
- Every admin Economy/Character/Duo RPC and snapshot RPC is executable by service_role only.
- Project JWT secret matches SUPABASE_JWT_SECRET; never reveal its value in evidence.
- Database backups/PITR retention and a restore point are healthy.

Any unchecked item blocks deployment.

## Read-only target and migration-history gate

The installed CLI used for this review is Supabase CLI 2.117.0. Its
`supabase migration up --help` output has `--local`, `--linked`, `--db-url`,
`--project-ref`, and `--include-all`, but no migration version, filename,
`--to`, or count limit. Therefore **do not run `supabase migration up --linked`**
for this release: one invocation can apply more than the reviewed file.

Before any write-capable tool is opened, run only these inventory commands and
save their non-secret output in the change record:

       supabase --version
       supabase projects list --output-format json
       supabase migration list --linked --output table
       shasum -a 256 -c _review/experiment-release-candidate/MIGRATION_SHA256SUMS.txt

Independently compare the linked project reference/name/region with the approved
change ticket. Compare the remote migration ledger with the version/file map
below and derive the pending list. An unexpected remote-only entry, an unknown
pending entry, a local/remote mismatch, or a hash failure is a hard stop. Never
reapply a version already present as applied, even if an application-level
verification later fails.

| Release step | Ledger version | Immutable source file |
|---:|---:|---|
| 001 | 20260911000900 | `scripts/security/001_auth_foundation.sql` |
| 002 | 20260911001000 | `scripts/security/002_enforce_participant_rls.sql` |
| 003 | 20260911001100 | `scripts/security/003_transactional_integrity.sql` |
| 004 | 20260911001200 | `scripts/security/004_user_event_logging.sql` |
| 005 | 20260911001300 | `scripts/security/005_functional_fixes.sql` |
| 006 | 20260911001400 | `scripts/security/006_experiment_rules_and_uniqueness.sql` |
| 007 | 20260911001500 | `scripts/security/007_participant_room_rpc_only.sql` |
| 008 | 20260929020000 | `scripts/security/008_multi_village_economy.sql` |
| 009 | 20260929030000 | `scripts/security/009_multi_village_character_loadout.sql` |
| 010 | 20260930010000 | `scripts/security/010_multi_village_runtime_cutover.sql` |
| 011 | 20261001010000 | `scripts/security/011_multi_village_interior_cutover.sql` |
| 012 | 20261001020000 | `scripts/security/012_duo_session_v2.sql` |
| 013 | 20261002010000 | `scripts/security/013_character_identity_loadout.sql` |
| 014 | 20261004010000 | `scripts/security/014_duo_character_identity_sync.sql` |

The ledger version is the approved release-package name; the SHA-256 file is
the source of truth for content. Local-test-only compatibility migrations from
the disposable rehearsal are not production release entries.

## Single-file application method

Because CLI 2.117.0 has no safe single-target `migration up` option, use either
the Supabase SQL Editor or the organization's approved `psql` migration
procedure. Select and apply exactly one immutable file from the table above,
with stop-on-error enabled. For approved `psql`, the command shape is:

       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/NNN_exact_name.sql

Replace `NNN_exact_name.sql` with exactly one reviewed filename; never use a
glob, loop, concatenated file, directory runner, or generic command that can
advance multiple pending migrations. Each release file already has its own
transaction boundary. After it commits, run its required verification, refresh
`supabase migration list --linked --output table`, and confirm exactly that
approved ledger version before selecting the next file.

If SQL Editor or the approved `psql` path does not record migration history,
use only the organization's separately approved Supabase migration-history
workflow after the SQL commit and verification. CLI 2.117.0 exposes
`supabase migration repair --status applied <version> --linked` for history
repair, but it must have its own approval and may only mark the one proven,
committed version. Never `insert`, `update`, or `delete` the migration ledger by
ad hoc SQL. If no approved history-recording workflow exists, stop; do not
apply the file.

## Exact deployment order

1. Freeze writes and Duo session creation. Put the application in maintenance mode with SOUNDVILLAGE_ECONOMY_MODE=maintenance.
2. Record the deployed commit SHA, environment-variable names/presence, linked project identity, the read-only migration ledger/pending inventory above, dashboard evidence, and current application/database versions.
3. Take and verify a database backup or PITR restore point. Export schema-only and the migration ledger. Do not continue until a restore health check is documented.
4. For 001–007, skip every ledger version already applied. Apply only a confirmed pending version, one immutable file at a time with the single-file method above. Re-register and verify the approved study sound catalog before 006 as stated in RELEASE_MANIFEST.md. Refresh and reconcile the ledger after every file.
5. At the boundary after 007 and before 008, run:

       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/transactional-integrity-preflight.sql
       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/multi-village-economy-preflight.sql

   Require zero blocking detail rows. Do not repair rows inside a preflight transaction.
6. Apply 008, verify its commit and ledger entry, then repeat separately for 009, 010, 011, and 012. Do not queue 008–012 in one command.
7. At the mandatory 008–012 verification boundary, run:

       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/multi-village-economy-verify.sql
       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/multi-village-character-verify.sql
       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/multi-village-runtime-verify.sql
       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/multi-village-interior-verify.sql
       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/duo-session-v2-verify.sql

8. Still before 013, run:

       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/character-identity-stage3-preflight.sql

9. Apply 013 alone, confirm its commit/ledger entry, and run:

       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/character-identity-stage3-verify.sql

10. Only after the 013 verification passes, apply 014 alone and confirm its commit/ledger entry. Then run:

       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/security/duo-session-v2-verify.sql
       psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f _review/experiment-release-candidate/production-preflight.sql

   Require all nine `blocking_summary.issue_count` values and the final
   `blocking_issue_count` to be zero. Review every `operator_review_detail` and
   the final `operator_review_count`; wait for or close active Duo sessions
   through the supported product path, never by ad hoc deletion or update.
11. Configure required variables from RELEASE_MANIFEST.md; keep internal test flags absent. Verify secrets by presence and length only.
12. Deploy the frozen application artifact in maintenance mode. Run authenticated smoke checks for bootstrap redaction, private Realtime authorization, assets, Character loadout, quest/attendance reads, and Interior reads.
13. Enable SOUNDVILLAGE_ECONOMY_MODE=cutover only after all database, dashboard, environment, and smoke gates pass.
14. Start with the approved cohort, monitor error/404/authorization/reward/ledger/session signals, and record the release timestamp/operator.

## Migration failure stop rule

On the first SQL error, verification mismatch, unexpected pending/applied migration, fingerprint drift, long-running lock, blocking preflight detail, non-zero blocking summary, or unreviewed active Duo session:

1. Stop. Do not run the next migration.
2. Keep maintenance mode enabled and prevent new experiment/Duo sessions.
3. Capture the exact statement, SQLSTATE, migration ledger, server logs, and database health/lock state.
4. Do not edit an applied migration or manually complete partial DDL.
5. If the failed transaction rolled back fully, verify schema and migration ledger against the pre-migration snapshot before deciding whether a corrected new migration is required.
6. If anything committed or state is ambiguous, restore the pre-deployment backup into an isolated project first, validate it, then follow the approved production restore procedure.

## Rollback

- Application failure before cutover: keep or return maintenance mode, redeploy the recorded previous artifact/environment, and verify legacy reads.
- Failure after cutover with database integrity intact: return to maintenance, stop the cohort, deploy the previous artifact, and first prove it is schema-compatible.
- Database/RLS/ACL/data-integrity failure: stop all writes and Duo creation, preserve logs, restore the verified pre-release backup/PITR point with the provider-approved procedure, then deploy the prior artifact/config.
- Never reverse 008–014 by editing migration files or issuing improvised DROP/UPDATE statements.

## Immediate experiment stop

Stop enrollment and switch to maintenance on any of:

- prior B peer visible during or after A–B → A–C replacement, even for one frame;
- delayed response or stale Realtime event overwriting the current peer;
- lease/session cleanup failure, cross-session nonce contamination, or nonce cache above 64;
- unsaved preview propagated to a peer, or saved appearance not restored after reconnect/fallback;
- duplicate/non-idempotent reward, purchase, attendance, or room save;
- wallet/ledger mismatch, participant/auth mismatch, catalog drift, or active-completed session inconsistency;
- RLS/ACL bypass, public Realtime access, service secret/client leak, token/identity response leak;
- console/page/unhandled/Next.js overlay error or Character/major-asset 404 in the experiment path;
- migration/verification/fingerprint failure or any unexplained increase in 401/403/409/410/5xx rates.
