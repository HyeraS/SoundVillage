# Stage 10 external input handoff

Date: 2026-09-13 (Asia/Seoul)

This package tells the research and operations teams how to hand off the two authoritative
inputs still missing from the repository. Do not place restricted contract text, secrets,
private download URLs, participant information, authentication information, or credentials in
Git, issue trackers, chat, or the generated manifest.

## Approved audio corpus

Use `audio-corpus-delivery.example.json` as the checklist. Supply the validator host's local
absolute corpus path, a non-secret delivery identifier, a SHA-256 checksum for the immutable
delivery, and one review entry per canonical audio identity. Each entry records the original
source/record, license or contract reference, rights-evidence location, acquisition date,
reviewer, attribution requirement, and any approved category-conflict decision. Evidence
locations may be access-controlled local references; do not paste restricted agreement text or
signed/private URLs. The document and manifest must contain no participant, auth, session, or
share-token data.

Before validation, copy only the `reviews` object into an access-controlled JSON file accepted
by `audio-corpus-readiness.mjs`. Keep the delivery wrapper beside the resulting manifest as the
chain-of-custody record. Run from the immutable delivered tree:

```sh
node scripts/security/audio-corpus-readiness.mjs \
  --corpus-root /absolute/approved/audio-root \
  --reviews /absolute/access-controlled/audio-reviews.json \
  --output /absolute/access-controlled/audio-manifest.json
```

Stop unless the result is 1,000 metadata rows, 995 canonical identities, and 995 fully verified
canonicals with no unresolved conflict, cross-zone collision, duplicate cross-canonical blob,
MIME/codec/duration/decode problem, or rights/provenance gap.

## Sanitized staging schema inventory

An authorized operator—not this repository task—runs the snapshot remotely and returns only
the sanitized output:

```sh
psql -X -q -A -t -f scripts/security/schema-reconciliation-snapshot.sql \
  > /absolute/access-controlled/staging-schema-inventory.json

node scripts/security/schema-reconciliation-validator.mjs \
  /absolute/access-controlled/staging-schema-inventory.json
```

Also provide a separately exported migration ledger/version list containing version identifiers
only. The snapshot intentionally does not query that operational table so it remains purely
catalog-based. Record checksums for both files before transfer.

Allowed inventory fields are column/type/nullability/default; constraints; indexes; RLS and
policies; table/function grants; function signature and argument names; `SECURITY DEFINER`;
fixed search path; and migration version identifiers. Review role/object names before sharing.

Do not include connection strings, `.env` contents, secrets, service-role keys, participant or
auth IDs, application row data, User Event payloads, function bodies, or production logs. The
snapshot reads `information_schema` and PostgreSQL catalog metadata in a read-only transaction.
It uses neither `pg_get_functiondef` nor `prosrc`/`probin`, so function bodies are not emitted;
it does not query application result/event tables. If the operator's environment adds wrapper
output, inspect and remove it before transfer.

Receipt procedure: verify checksums; store the originals read-only; validate without changing
staging; compare errors with the actual migration ledger; and stop on every mismatch. A passing
inventory still requires protected staging preflights, dashboard checks, and authorized
rehearsal. It is not permission to connect this task to staging or production.

## Stage 10B clarification (2026-09-14)

The local validator and disposable database now also prove that authenticated, anon, and
PUBLIC cannot TRUNCATE `participant_room`; authenticated INSERT, UPDATE, and DELETE remain
independent blockers. This strengthens the acceptance criteria but does not substitute for
the requested sanitized staging inventory. The external operator should rerun the current
snapshot and validator unchanged, provide the separately checksummed migration ledger, and
stop on any room grant/policy/function mismatch.

The repository still has no approved 995-canonical audio delivery or review file. Historical
audio recovered for earlier narrow browser coverage is not an authoritative corpus and must
not be repackaged as one. Stage 11 policy choices are separately enumerated in
`docs/research/stage-11-policy-decision-package.md`; corpus and schema evidence remain required
regardless of those decisions.
