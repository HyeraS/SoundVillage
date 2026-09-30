'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  claimEconomyAttendance,
  equipCharacterItem,
  getEconomyBootstrap,
  newEconomyOperationKey,
  purchaseCharacterItem,
} from '@/lib/economyV1.client'
import {
  ECONOMY_CATALOG_VERSION,
  EMPTY_ECONOMY_RUNTIME,
  purchaseFailureAction,
  resolveEconomyBootstrap,
} from '@/lib/economyRuntimeState.mjs'

export const SUPPORTED_ECONOMY_CATALOG_VERSION = ECONOMY_CATALOG_VERSION

const EconomyRuntimeContext = createContext(null)

export function EconomyRuntimeProvider({ children }) {
  const [state, setState] = useState(EMPTY_ECONOMY_RUNTIME)
  const [previewLoadout, setPreviewLoadout] = useState(null)
  const loadSequence = useRef(0)
  const purchaseKeys = useRef(new Map())
  const equipKeys = useRef(new Map())
  const attendanceKey = useRef(null)
  const stateRef = useRef(state)

  useEffect(() => { stateRef.current = state }, [state])

  const reset = useCallback(() => {
    loadSequence.current += 1
    purchaseKeys.current.clear()
    equipKeys.current.clear()
    attendanceKey.current = null
    setPreviewLoadout(null)
    stateRef.current = EMPTY_ECONOMY_RUNTIME
    setState(EMPTY_ECONOMY_RUNTIME)
  }, [])

  const load = useCallback(async ({ blocking = true } = {}) => {
    const sequence = ++loadSequence.current
    if (blocking) {
      setState((current) => {
        const next = { ...current, runtimeState: 'unknown', effectiveMainMode: null, error: null }
        stateRef.current = next
        return next
      })
    }
    const result = await getEconomyBootstrap()
    if (sequence !== loadSequence.current) return result
    const next = resolveEconomyBootstrap(result)
    stateRef.current = next
    setPreviewLoadout(null)
    setState(next)
    return result
  }, [])

  const setProfile = useCallback((update) => {
    setState((current) => ({
      ...current,
      profile: typeof update === 'function' ? update(current.profile) : update,
    }))
  }, [])

  const applyActivityResult = useCallback((result) => {
    if (!result?.reward?.balances) return
    setProfile((profile) => profile ? { ...profile, balances: result.reward.balances } : profile)
  }, [setProfile])

  const clearPreview = useCallback(() => setPreviewLoadout(null), [])
  const previewItem = useCallback((slot, itemId) => {
    if (stateRef.current.runtimeState !== 'cutover') return false
    const saved = stateRef.current.profile?.loadout || { outfitId: 'basic', accessoryId: null }
    setPreviewLoadout((current) => ({
      ...saved,
      ...(current || {}),
      [slot === 'outfit' ? 'outfitId' : 'accessoryId']: itemId,
    }))
    return true
  }, [])

  const purchaseAndEquip = useCallback(async (item) => {
    if (stateRef.current.runtimeState !== 'cutover') {
      return { ok: false, code: 'economy_runtime_blocked', retryable: false }
    }
    const purchaseKey = purchaseKeys.current.get(item.id) || newEconomyOperationKey()
    purchaseKeys.current.set(item.id, purchaseKey)
    const purchase = await purchaseCharacterItem(item.id, purchaseKey)
    if (!purchase.ok) {
      const action = purchaseFailureAction(purchase)
      if (action !== 'keep-key') purchaseKeys.current.delete(item.id)
      if (purchase.balances) setProfile((profile) => profile ? { ...profile, balances: purchase.balances } : profile)
      if (action === 'discard-key-and-resync') await load()
      return { ...purchase, purchaseKey, retrySameRequest: action === 'keep-key', resynced: action === 'discard-key-and-resync' }
    }
    purchaseKeys.current.delete(item.id)
    setProfile((profile) => profile ? {
      ...profile,
      balances: purchase.balances,
      ownedItemIds: [...new Set([...(profile.ownedItemIds || []), ...(purchase.grantedItemIds || [item.id])])],
    } : profile)
    const equipMapKey = `${item.productGroup}:${item.id}`
    const equipKey = equipKeys.current.get(equipMapKey) || newEconomyOperationKey()
    equipKeys.current.set(equipMapKey, equipKey)
    const equip = await equipCharacterItem(item.productGroup, item.id, equipKey)
    if (equip.ok || !equip.retryable) equipKeys.current.delete(equipMapKey)
    if (equip.ok) {
      setPreviewLoadout(null)
      setProfile((profile) => profile ? { ...profile, loadout: equip.loadout } : profile)
    }
    return { ...purchase, equip, purchaseKey, equipKey }
  }, [load, setProfile])

  const equip = useCallback(async (slot, itemId) => {
    if (stateRef.current.runtimeState !== 'cutover') {
      return { ok: false, code: 'economy_runtime_blocked', retryable: false }
    }
    const equipMapKey = `${slot}:${itemId || 'none'}`
    const idempotencyKey = equipKeys.current.get(equipMapKey) || newEconomyOperationKey()
    equipKeys.current.set(equipMapKey, idempotencyKey)
    const result = await equipCharacterItem(slot, itemId, idempotencyKey)
    if (result.ok || !result.retryable) equipKeys.current.delete(equipMapKey)
    if (result.ok) {
      setPreviewLoadout(null)
      setProfile((profile) => profile ? { ...profile, loadout: result.loadout } : profile)
    }
    return { ...result, idempotencyKey }
  }, [setProfile])

  const claimAttendance = useCallback(async () => {
    if (stateRef.current.runtimeState !== 'cutover') {
      return { ok: false, code: 'economy_runtime_blocked', retryable: false }
    }
    const idempotencyKey = attendanceKey.current || newEconomyOperationKey()
    attendanceKey.current = idempotencyKey
    const result = await claimEconomyAttendance(idempotencyKey)
    if (!result.ok) {
      if (!result.retryable) attendanceKey.current = null
      return { ...result, idempotencyKey }
    }
    attendanceKey.current = null
    await load({ blocking:false })
    return { ...result, idempotencyKey }
  }, [load])

  const savedLoadout = useMemo(
    () => state.profile?.loadout || { outfitId: 'basic', accessoryId: null },
    [state.profile?.loadout],
  )
  const effectiveLoadout = previewLoadout || savedLoadout
  const value = useMemo(() => ({
    ...state,
    status: state.runtimeState,
    isCutover: state.runtimeState === 'cutover',
    isPreview: state.runtimeState === 'preview',
    isBlocked: ['unknown', 'blocked', 'maintenance'].includes(state.runtimeState),
    balances: state.profile?.balances || {},
    loadout: effectiveLoadout,
    savedLoadout,
    previewLoadout,
    ownedItemIds: state.profile?.ownedItemIds || [],
    load,
    reset,
    setProfile,
    applyActivityResult,
    previewItem,
    clearPreview,
    purchaseAndEquip,
    equip,
    claimAttendance,
  }), [applyActivityResult, claimAttendance, clearPreview, effectiveLoadout, equip, load, previewItem, previewLoadout, purchaseAndEquip, reset, savedLoadout, setProfile, state])

  return <EconomyRuntimeContext.Provider value={value}>{children}</EconomyRuntimeContext.Provider>
}

export function useEconomyRuntime() {
  const context = useContext(EconomyRuntimeContext)
  if (!context) throw new Error('useEconomyRuntime must be used inside EconomyRuntimeProvider')
  return context
}
