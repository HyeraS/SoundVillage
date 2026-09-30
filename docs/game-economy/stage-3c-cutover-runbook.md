# Stage 3C multi-village economy cutover runbook

This is an execution plan, not authorization to touch a linked or production Supabase project. Stage 3C ships with `SOUNDVILLAGE_ECONOMY_MODE=legacy` by default. The browser never decides the mode; an authenticated `/api/economy-v1/bootstrap` response is authoritative. Missing, invalid, or incompatible mode/catalog data enters `blocked` and permits no economy write. It never falls back to the legacy writer.

## Product invariants

- Catalog ownership is the clothing design, not a palette. Stage 3C renders only the representative palette referenced by `runtimeAsset`. If more supported palettes are connected later, owners of the design may select them without purchasing the design again.
- The six wallets start at zero. Do not distribute `participant_currency` balances into them and do not copy `participant_outfits` or `participant_equipped_outfit` into the Character inventory/loadout.
- Legacy rows remain read-only audit evidence. Do not delete them during cutover or rollback.
- Removing a product from the store does not revoke ownership or loadout. Retain its runtime asset while any owner exists. If an asset is unexpectedly missing, the UI falls back to the basic outfit/no accessory without deleting ownership, loadout, or ledger rows.
- In the new mode, daily-quest progress may complete but grants neither legacy currency nor village currency. A future product contract must define any village attribution before quest rewards are introduced.

## Before the maintenance window

1. Record the proposed experiment start time as **TBD** and the audit-snapshot retention period as **TBD**. Do not invent either value.
2. Pause application writes and create a read-only legacy audit snapshot with `scripts/security/multi-village-economy-legacy-snapshot.sql`. Record row counts, hashes/export identifiers, storage location, operator, and timestamp.
3. Run the 008–010 preflight locally and against the separately authorized target inventory. Confirm 001–007 prerequisites, no negative/drifting balances, expected RPC signatures and grants, catalog version `soundvillage-launch-v1:1.1.0`, and that 008/009/010 have not been partially applied.
4. Apply `008_multi_village_economy.sql`, `009_multi_village_character_loadout.sql`, then `010_multi_village_runtime_cutover.sql` as forward migrations. Never edit 001–009 in place.
5. Configure a random server-only `MULTI_VILLAGE_ECONOMY_HMAC_SECRET` of at least 32 characters. Do not expose it through `NEXT_PUBLIC_*`, logs, browser bundles, or analytics.

## Data initialization and audit

1. Leave wallet creation to the reviewed `ensure_multi_village_wallets` path or insert the six canonical rows at balance zero under an audited service-role procedure.
2. Prove all six starting balances are zero for every participant entering the experiment.
3. Compare legacy and new stores and record that no legacy balance, outfit ownership, or equipped outfit was transferred.
4. Preserve the legacy tables and revoke no additional read access without a separate security review.

## Controlled enablement

1. Deploy with `SOUNDVILLAGE_ECONOMY_MODE=legacy`. Confirm the authenticated bootstrap reports `legacy`, new mutation routes return feature-disabled, the single-currency HUD/shop/automatic attendance remain unchanged, and no village ledger row appears.
2. Set the server-only mode to `preview`. Confirm only the development-restricted internal preview and authenticated new API are usable; the main game remains legacy.
3. Run the preview smoke matrix: six wallets including zeros, attendance GET then explicit POST, one purchase, automatic post-purchase equip, outfit/accessory equip, accessory removal, retained discontinued ownership, and missing-asset visual fallback.
4. Set the mode to `cutover`. Restart/redeploy the server so every instance uses the same value. Do not add a browser override.
5. Run the main-game smoke matrix in order: annotation (+5 to the stored sound village), vote (+2 to the stored original-sound village), explicit attendance claim, purchase, immediate equip, accessory removal, and all eight rendering locations (WorldMap, six villages, Library/Museum).
6. Replay each operation key and issue concurrent independent requests for the same canonical result. Confirm one domain result and one village ledger credit. Confirm skips and business duplicates award zero.
7. Confirm `participant_currency` and `currency_transactions` are unchanged, quest completion reports zero currency, and a second authenticated participant cannot read or mutate the first participant's wallets, inventory, loadout, attendance, or ledger.

## Ledger reconciliation

Reconcile `village_currency_ledger` to wallet balances per participant and village. For the cutover interval, group entries by `entry_type`, `related_id`, and `operation_id`; require one annotation credit of 5 or one vote credit of 2 per stored result, one attendance entry per participant/week/day, and purchase debits matching the server catalog vector. Investigate any orphan result, missing ledger row, duplicate source key, or wallet/ledger delta before resuming the experiment. Never silently discard a pending discrepancy.

## Failure, maintenance, and rollback

Before cutover, returning to `legacy` is allowed only when the audit proves that no new ledger, purchase, attendance, ownership, or loadout write exists.

After cutover, if even one new ledger, purchase, attendance, ownership, or loadout row exists:

1. Set `SOUNDVILLAGE_ECONOMY_MODE=maintenance` and restart/redeploy every server instance. Authentication and the read-only maintenance notice remain available; legacy v4 and new economy writes are both blocked.
2. Record the exact affected time window, operations, deployed revision, and reconciliation owner.
3. Reconcile wallets, ledger entries, annotation/vote result rows, attendance, purchases, ownership, and loadouts. Preserve every row as audit evidence.
4. Apply a forward fix. Do not delete or rewrite new rows, copy new balances into `participant_currency`, or convert new ownership/loadout data into legacy data.
5. Run the full local and authorized-target smoke matrix against the forward fix while writes remain paused.
6. Resume with `cutover` only after reconciliation and smoke tests pass.

Do not resume the legacy economy after a post-cutover write without explicit product and data-owner approval. `maintenance` is the safe operational stop; it is not a data rollback.

## Anonymous-session operator rebind

There is no public self-rebind endpoint. When a user sees `participant_claimed`, an operator verifies the participant through the approved study procedure, records the request and evidence, identifies exactly one participant and the old/new anonymous auth users, and performs the existing single-participant administrative rebind. The operator then asks the user to retry, verifies `get_my_study_participant`, and records completion. Never authorize rebind from `participantId + groupId` alone, never bulk-clear bindings, and never expose service-role credentials to the browser.
