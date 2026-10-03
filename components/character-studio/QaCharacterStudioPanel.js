'use client'

import { useCallback, useEffect, useState } from 'react'
import CharacterStudioPanel from './CharacterStudioPanel'
import { CHARACTER_IDENTITY_CATALOG, CHARACTER_STUDIO_ITEMS } from '@/lib/characterStudioCatalog'
import { applyQaCharacterEquip, applyQaCharacterIdentity, applyQaCharacterPurchase } from '@/lib/characterStudioState.mjs'

const QA_BALANCES = Object.freeze({ Animal:50, Human:50, Nature:50, Urban:50, Music:50, Lab:50 })
const qaSessions = new Map()

function freshQaState() {
  return {
    balances:{ ...QA_BALANCES },
    ownedItemIds:['overalls', 'floral', 'acc_glasses'],
    savedLoadout:{ outfitId:'overalls', accessoryId:'acc_glasses' },
  }
}

function readSession(key) {
  if (!qaSessions.has(key)) qaSessions.set(key, freshQaState())
  return qaSessions.get(key)
}

function storageKey(key) {
  return `soundvillage-character-studio-qa:${key}`
}

export default function QaCharacterStudioPanel({ sessionKey = 'nature-qa' }) {
  const [state, setState] = useState(() => readSession(sessionKey))
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.sessionStorage.getItem(storageKey(sessionKey))
        if (stored) {
          const parsed = JSON.parse(stored)
          qaSessions.set(sessionKey, parsed)
          setState(parsed)
        }
      } catch {}
      const simulateError = new URLSearchParams(window.location.search).get('characterStudioLoadError') === '1'
      setStatus(simulateError ? 'error' : 'ready')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [sessionKey])

  const commit = useCallback((next) => {
    qaSessions.set(sessionKey, next)
    try { window.sessionStorage.setItem(storageKey(sessionKey), JSON.stringify(next)) } catch {}
    setState(next)
  }, [sessionKey])

  const purchaseAndEquip = useCallback(async (item) => {
    const current = readSession(sessionKey)
    const result = applyQaCharacterPurchase(current, item)
    if (result.ok) commit(result.state)
    return result
  }, [commit, sessionKey])

  const equip = useCallback(async (slot, itemId) => {
    const current = readSession(sessionKey)
    const result = applyQaCharacterEquip(current, slot, itemId)
    if (result.ok) commit(result.state)
    return result
  }, [commit, sessionKey])

  const saveIdentity = useCallback(async (loadout) => {
    const current = readSession(sessionKey)
    const result = applyQaCharacterIdentity(current, loadout)
    if (result.ok) commit(result.state)
    return result
  }, [commit, sessionKey])

  return <CharacterStudioPanel
    environment="qa"
    items={CHARACTER_STUDIO_ITEMS}
    balances={state.balances}
    savedLoadout={state.savedLoadout}
    ownedItemIds={state.ownedItemIds}
    status={status}
    loadError="QA 로드 오류를 재현했어요. 다시 시도하면 로컬 fixture가 즉시 복구됩니다."
    onRetry={() => setStatus('ready')}
    onPurchaseAndEquip={purchaseAndEquip}
    onEquip={equip}
    identityPreviewEnabled
    identityCatalog={CHARACTER_IDENTITY_CATALOG}
    onSaveIdentity={saveIdentity}
  />
}
