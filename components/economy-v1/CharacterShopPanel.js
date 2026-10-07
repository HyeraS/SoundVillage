'use client'

import { useEconomyRuntime } from './EconomyRuntimeProvider'
import CharacterStudioPanel from '@/components/character-studio/CharacterStudioPanel'
import { CHARACTER_IDENTITY_CATALOG } from '@/lib/characterStudioCatalog'
import { hasCompleteCharacterLoadout } from '@/lib/characterIdentityContract.mjs'

export default function CharacterShopPanel() {
  const economy = useEconomyRuntime()
  const ready = economy.runtimeState === 'cutover'
  const identityEnabled = ready
    && economy.capabilities?.characterIdentityCustomization === true
    && economy.identityCatalogVersion === CHARACTER_IDENTITY_CATALOG.version
    && hasCompleteCharacterLoadout(economy.savedLoadout)
  const status = ready ? 'ready' : economy.runtimeState === 'unknown' ? 'loading' : 'error'
  return <CharacterStudioPanel
    environment="cutover"
    items={economy.items}
    balances={economy.balances}
    savedLoadout={economy.savedLoadout}
    ownedItemIds={economy.ownedItemIds}
    status={status}
    loadError={economy.error ? `경제 상태 확인 오류: ${economy.error}` : '경제 상태를 확인하지 못해 구매와 장착을 잠시 잠겄어요.'}
    onRetry={() => economy.load()}
    onPurchaseAndEquip={(item) => economy.purchaseAndEquip(item)}
    onEquip={(slot, itemId) => economy.equip(slot, itemId)}
    identityPreviewEnabled={identityEnabled}
    identityCatalog={identityEnabled ? CHARACTER_IDENTITY_CATALOG : null}
    onSaveIdentity={(loadout) => economy.saveIdentity(loadout)}
    showOnboarding={identityEnabled}
  />
}
