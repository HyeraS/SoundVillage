# Functional audit: stage 5 fixes

This stage remains review-only. No SQL or data change was applied to Supabase.

## User Log boundary correction

The stage 4 client already removed expression text and known sensitive fields, but the recording RPC accepted arbitrary keys inside `metadata`, `value_before`, and `value_after`. Migration 004 now enforces the same reviewed field allowlists in PostgreSQL, including the restricted nested room-position shape. This keeps direct RPC calls from bypassing the client sanitizer.

## Audio listening lifecycle

Listening time is now managed by a small independently tested timer. Annotation and museum players reset both the active Howl instance and the timer when a sound changes or the component unmounts. Closing or submitting the annotation modal also resets immediately. A cancelled sound, or the short delay between submit and unmount, can no longer add time to the next sound.

## Movement input lifecycle

The shared keyboard state now clears every direction on window blur, when the document becomes hidden, and on hook cleanup. This prevents a missed `keyup` during tab switching from leaving the character moving.

## Museum eligibility and sound identity

`005_functional_fixes.sql` adds `museum_annotation_counts()`, an authenticated, fixed-search-path, aggregate-only RPC. Museum entry uses this one grouped request instead of issuing a count RPC for each possible sound. Aggregation occurs in PostgreSQL, so the raw annotation row count is not subject to the PostgREST 1,000-row response limit.

Museum eligibility and prior-vote exclusion use the audio file-number identity. Legacy and current sound-ID prefixes for the same file therefore collapse into one voting candidate. If duplicated metadata rows point to the same audio file, only the first eligible metadata entry is used for the museum candidate.

The candidate-expression RPC in migration 001 was also rechecked: it randomizes in PostgreSQL before applying the limit, so the reported “first rows then shuffle” bias is not present in the reviewed migration chain.

## Validation

- User Event static/unit tests: 6 passed
- Audio lifecycle tests: 3 passed
- Input lifecycle tests: 2 passed
- Functional-fix static tests: 3 passed
- Security boundary tests: 4 passed
- Transactional integrity tests: 4 passed
- Internal-route tests: 4 passed
- Changed-file ESLint: passed after removal of the existing SoundMuseum errors
- Next.js 16.2.7 Webpack production build: passed

The build still reports the four previously known malformed generated Tailwind-variable warnings. Supabase integration tests were not run because a local Supabase test environment and `SECURITY_TEST_SUPABASE_*` credentials were not available.

## Staging apply order

After the existing preflight and staging checks, apply migrations in order: 001, registration/catalog sync, 002, 003, 004, then 005. Deploy application code requiring `museum_annotation_counts()` only after 005 is available. Production application remains a human-approved operation.
