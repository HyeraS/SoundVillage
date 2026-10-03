'use client'

import { useCallback, useState } from 'react'
import CharacterStudioPanel from '@/components/character-studio/CharacterStudioPanel'
import QaCharacterStudioPanel from '@/components/character-studio/QaCharacterStudioPanel'
import { CHARACTER_STUDIO_ITEMS } from '@/lib/characterStudioCatalog'
import { normalizeCharacterLoadout } from '@/lib/characterStudioState.mjs'

const BALANCES = Object.freeze({ Animal:999, Human:999, Nature:999, Urban:999, Music:999, Lab:999 })

export default function CharacterStudioTestHarness({ mode }) {
  const [savedLoadout, setSavedLoadout] = useState(() => normalizeCharacterLoadout({ outfitId:'overalls', accessoryId:'acc_glasses' }))
  const [ownedItemIds, setOwnedItemIds] = useState(() => ['overalls', 'floral', 'acc_glasses'])

  const purchase = useCallback(async (item) => {
    setOwnedItemIds((current) => [...new Set([...current, item.id])])
    setSavedLoadout((current) => ({ ...current, [item.productGroup === 'outfit' ? 'outfitId' : 'accessoryId']:item.id }))
    return { ok:true }
  }, [])
  const equip = useCallback(async (slot, itemId) => {
    setSavedLoadout((current) => ({ ...current, [slot === 'outfit' ? 'outfitId' : 'accessoryId']:itemId }))
    return { ok:true }
  }, [])

  if (mode === 'qa') return <QaCharacterStudioPanel sessionKey="stage2-browser"/>
  return <CharacterStudioPanel
    environment={mode}
    items={CHARACTER_STUDIO_ITEMS}
    balances={BALANCES}
    legacyBalance={999}
    savedLoadout={savedLoadout}
    ownedItemIds={ownedItemIds}
    onPurchaseAndEquip={purchase}
    onEquip={equip}
  />
}
