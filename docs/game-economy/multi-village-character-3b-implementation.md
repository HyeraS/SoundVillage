# Stage 3B multi-village Character preview

## Scope

Stage 3B keeps the production game on the legacy scalar economy and adds an internal-only,
authenticated preview at `/economy-v1-character-preview`. The page is available only when
Next.js runs in development with `ENABLE_INTERNAL_TEST_ROUTES=true`; the explicit proxy matcher
returns a non-indexable 404 in every production build.

The preview uses the real `/api/economy-v1/*` boundary and a disposable loopback Supabase. It
contains Character shopping and weekly attendance only. It has no developer funding control,
interior shop, daily deal, discount, palette purchase, or direct browser database mutation.

## API and storage boundary

- `GET /api/economy-v1/character-shop` is intentionally public because it returns only the
  non-user-specific, approved storefront projection needed before any purchase. The complete
  top-level response fields are `ok`, `code`, `economyVersion`, and `items`; the complete public
  item field allow-list is `id`, `name`, `type`, `productGroup`, `runtimeAsset`,
  `previewAsset`, `rarity`, `priceTier`, `cost`, `requiredVillageCount`,
  `estimatedAnnotationCount`, `minimumFreshAnnotationCount`, and `currencyCombination`.
  `runtimeAsset` and `previewAsset` are public web paths for shipped assets, not source/original
  asset paths. The projection omits source and planned paths, secrets, internal status and review
  fields, cost-basis data, participant data, and ownership. Purchase prices are resolved again by
  the authenticated server purchase adapter. Profile, wallet, purchase, equip, and attendance
  APIs remain authenticated; this public catalog decision does not relax those boundaries.
- `GET /api/economy-v1/character-profile` returns all six balances in canonical order, approved
  Character ownership IDs, the new loadout, `basic`, and `catalogId:schemaVersion`.
- `POST /api/economy-v1/equip` accepts only `slot`, `itemId`, and a UUID idempotency key. The
  server catalog validates existence, approval, and item type before calling the service-only RPC.

Migration `009_multi_village_character_loadout.sql` creates
`participant_multi_village_character_loadouts` and `multi_village_character_equip_results`.
The loadout has one row per participant, defaults to `basic`, allows a null accessory, exposes only
owner SELECT through RLS, and grants no browser INSERT/UPDATE/DELETE. Paid selections require an
owned `participant_catalog_items` row. The legacy `participant_equipped_outfit` is neither read nor
changed.

## Retry and event behavior

Purchase and equip operations retain a UUID only after a network/storage-uncertain result.
Confirmed product outcomes create a new UUID on a later user action. An
`idempotency_key_reused` purchase is terminal: the stored key is discarded, Character profile and
six wallets are re-read, and the next click creates a new UUID. Per-card pending state blocks
double-clicks without serializing unrelated products. Preview load records
`attendance_panel_opened`; `attendance_check_attempted/succeeded/failed` are reserved for the
attendance POST claim path. The existing event RPC allow-list and security boundary remain strict.

## Verification

`npm run test:multi-village-economy-local` creates a disposable loopback stack, applies 001-009,
checks the legacy fingerprint, DB concurrency/RLS, real HTTP calls, and a Chromium browser flow,
then removes the stack. Browser review images are written to
`_review/economy-v1-character-shop/`.

The 2026-09-30 Stage 3B.1 local pass covered default profile, real purchase and wallet deduction,
outfit equip, accessory equip/unequip, non-owned and wrong-slot rejection, idempotent replay,
forced reused-key recovery with a fresh next UUID, retryable-error same-key reuse, concurrent equip
integrity, preview-load versus attendance-claim event separation, attendance wallet credit, browser
write rejection, 18/8 filtering, public-field projection, keyboard modal/tab/card behavior, asset
HTTP success, and desktop plus 844×390 and 390×844 layouts. Security-boundary,
transactional-integrity, RLS, event, catalog, currency-icon, Character-asset, changed-file ESLint,
diff-check, and production-build checks passed. The disposable stack and QA user were removed and
the pre-run stopped Colima state was restored.

## Stage 3C call sites and open product decisions

The main-runtime transition should deliberately replace these call sites, not reuse preview state:

1. session restore: load `/api/economy-v1/character-profile` and the six-wallet HUD;
2. SoundMuseum Character shop: read `/character-shop`, purchase through `/purchase`, and equip
   through `/equip`;
3. world/player rendering: map the saved IDs to the registered runtime assets and pass them to
   `resolveWorldCharacterLayers`, preserving body → clothes → hair → accessories;
4. main attendance panel: move to `/api/economy-v1/attendance` and refresh the six-wallet state;
5. verified annotation/vote reward completion: invoke the already prepared trusted village-credit
   hook only when the Stage 3C rollout is approved.

Before 3C, product owners still need to decide palette ownership semantics, the production rollout
and migration window, anonymous-session recovery, handling of catalog items retired while equipped,
and whether Character ownership from the legacy economy is ever migrated. No automatic merge is
implemented in 3B.
