# SoundVillage Experiment Release Candidate

Freeze date: 2026-10-04 (Asia/Seoul)

Decision: **CONDITIONAL GO; ready for operator GO promotion**. The code candidate and disposable rehearsal are green, and Stage 5.1 closes the preflight-coverage and bulk-migration-command documentation risks. Production remains blocked until the linked-project/ledger, dashboard, production environment, backup, single-file migration, and read-only production-data gates in OPERATIONS_RUNBOOK.md are completed by a human operator.

## Release scope

### Include: Stage 5 release-critical

- scripts/security/multi-village-character-browser-e2e.mjs
- scripts/security/multi-village-economy-local-rehearsal.sh
- _review/experiment-release-candidate/**

### Include: Character Stage 1–4

- app/api/duo-v2/character-identity/route.js
- app/page.js
- components/character-studio/CharacterStudioPanel.js
- components/character-studio/CharacterStudioOnboarding.js
- components/character-studio/characterStudio.module.css
- components/character-studio/characterStudioOnboarding.module.css
- components/WorldMap.js, components/InteriorRoom.js, components/InteriorDecorRoom.js, components/LibraryRoom.js, components/SoundMuseum.js
- components/economy-v1/EconomyRuntimeProvider.js
- lib/duoApi.client.js, lib/duoApi.server.js, lib/duoSession.js, lib/duoSession.server.js
- lib/duoCharacterIdentityContract.mjs
- scripts/security/013_character_identity_loadout.sql
- scripts/security/014_duo_character_identity_sync.sql
- scripts/security/character-identity-stage4.test.mjs
- scripts/security/character-identity-stage4.integration.mjs
- scripts/security/character-identity-stage4-http.integration.mjs
- scripts/security/character-identity-stage4-browser-e2e.mjs
- scripts/security/character-studio-browser-e2e.mjs
- scripts/security/character-studio.test.mjs
- Character Stage 1–4 production assets and generated identity catalog referenced by the tests
- package.json Stage 4 test entries

### Include: quest, attendance, economy, and Interior stabilization

- app/attendance-test/page.js
- components/economy-v1/CharacterShopPanel.js
- lib/attendance.js, lib/rewardReliability.mjs
- scripts/security/quest-attendance-browser-e2e.mjs
- scripts/security/quest-attendance-reliability.test.mjs
- scripts/security/multi-village-main-runtime-browser-e2e.mjs
- scripts/security/security-boundary.test.mjs
- lib/temporaryUnlocks.js and scripts/test-world-map-production-integration.mjs
- scripts/security/economy-v1-character-regression.snapshot.json. Its attendance hash change corresponds to authenticated structured attendance-result handling and is covered by the 7/7 quest/attendance reliability tests plus two DB/browser rehearsals.
- migrations 001 through 012 unchanged

### Exclude

- Map/design work not required by this experiment: design/**, cozy-map source folders, world-map/urban/human/map review folders, standalone source PNGs.
- Functional-audit handoffs and unrelated research drafts under docs/**.
- CODEX_FUNCTIONAL_AUDIT_HANDOFF.md, the dated Codex screenshot, and SoundVillage-house-decor-2d.code-workspace.
- scripts/build-world-map-home-step8-review.mjs and scripts/report-world-map-home-step8.mjs.
- Nature-only QA scripts unless separately approved: scripts/security/nature-qa-*.
- tmp/**, Python __pycache__, .next/**, and disposable Supabase directories.
- Historical _review/** directories except evidence copied into _review/experiment-release-candidate/evidence/.

No excluded file should be deleted, reset, stashed, or cleaned as part of this freeze.

## Migration order

Apply exactly once, in one maintenance window, with stop-and-review between verification boundaries:

1. 001_auth_foundation.sql
2. 002_enforce_participant_rls.sql
3. 003_transactional_integrity.sql
4. 004_user_event_logging.sql
5. 005_functional_fixes.sql
6. Re-register/verify the study sound catalog as required by 006.
7. 006_experiment_rules_and_uniqueness.sql
8. 007_participant_room_rpc_only.sql
9. Run transactional-integrity-preflight.sql and multi-village-economy-preflight.sql; require zero blockers.
10. 008_multi_village_economy.sql
11. 009_multi_village_character_loadout.sql
12. 010_multi_village_runtime_cutover.sql
13. 011_multi_village_interior_cutover.sql
14. 012_duo_session_v2.sql
15. Run every 008–012 verify SQL named in the runbook, then character-identity-stage3-preflight.sql. This is a mandatory stop-and-verify boundary.
16. 013_character_identity_loadout.sql, then character-identity-stage3-verify.sql.
17. 014_duo_character_identity_sync.sql.
18. Run duo-session-v2-verify.sql and production-preflight.sql. Require all nine per-category counts and blocking_issue_count to be zero; separately resolve or explicitly accept every active-Duo operator review item before enabling cutover.

Migrations 001–014 were not edited or rewritten during Stage 5 or Stage 5.1. Apply no already-ledgered version, and do not use a generic `supabase migration up --linked` invocation: CLI 2.117.0 has no single-version target flag. The runbook requires one immutable SQL file at a time and a ledger refresh after every file.

## Required environment

Production/cutover:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server only)
- SUPABASE_JWT_SECRET (server only, at least 32 characters)
- MULTI_VILLAGE_ECONOMY_HMAC_SECRET (server only)
- DUO_SESSION_HMAC_SECRET (server only, at least 32 characters)
- SOUNDVILLAGE_ECONOMY_MODE=cutover
- NEXT_PUBLIC_APP_VERSION pinned to the approved experiment version
- NEXT_PUBLIC_AUDIO_BASE_URL only when assets are not same-origin

Must be absent/false in production:

- ENABLE_INTERNAL_TEST_ROUTES
- NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA

Local .env.local inspection found the Supabase URL, anon key, service-role key, audio-base setting, and unrelated development credentials present. It did not contain the cutover mode, app version, Supabase JWT secret, Economy HMAC secret, or Duo HMAC secret. Values were not printed.

## Capability and runtime match

- The ambient local runtime defaults to legacy because SOUNDVILLAGE_ECONOMY_MODE is absent; it is not an experiment deployment configuration.
- Both disposable rehearsals explicitly injected cutover mode and isolated Economy/Duo/JWT secrets.
- Economy cutover returned the six-wallet profile/catalog/attendance payload.
- Character Identity customization was enabled only for a complete six-field loadout.
- Duo Identity required 012 + 014, a current active lease, the contract version, and private Realtime authorization.
- Internal QA routes/flags were confined to the disposable test server and must be absent from production.

## Required tests

- npm run test:character-v2-stage4
- npm run test:multi-village-economy
- npm run test:security-boundary
- npm run test:quest-attendance
- npm run lint
- npm run build
- git diff --check
- shasum -a 256 -c _review/experiment-release-candidate/MIGRATION_SHA256SUMS.txt
- production-preflight.sql on a disposable 001–014 database, including rollback-only error fixtures
- sh scripts/security/multi-village-economy-local-rehearsal.sh twice, each from a newly created disposable Supabase project

## Review evidence

See EVIDENCE_INDEX.md. The two independent rehearsals passed migrations 001–014, DB/RLS/ACL/concurrency, HTTP redaction, private WebSocket, all runtime modes, Character Stage 3/4, Duo A/B/C, skew/delayed-response/reconnect/fallback/termination, shop, Interior, quest, and attendance checks.

## Known limitations

- Supabase dashboard toggles and live production data cannot be proven from this local repository.
- The ambient local .env.local intentionally does not represent cutover; rehearsals injected isolated ephemeral secrets.
- The preflight catalog count assumes the approved registry remains 1,000 aliases / 995 canonical identities. A registry change requires reviewed expected-count and fixture updates.
- Supabase CLI 2.117.0 cannot target exactly one pending migration with `migration up`; the approved SQL Editor/psql plus migration-history procedure in OPERATIONS_RUNBOOK.md is therefore required.
- Rollback is deployment/config rollback plus database point-in-time restore; migrations 008–014 are forward-only and must not be hand-reversed.

## Rollback and immediate-stop criteria

Rollback/stop on any migration error, non-zero preflight blocker, fingerprint drift, RLS/ACL mismatch, secret or identity redaction failure, unexpected console/page/unhandled/overlay error, asset 404, previous-peer frame, stale lease, duplicate reward/purchase, wallet/ledger mismatch, or two-rehearsal regression.
