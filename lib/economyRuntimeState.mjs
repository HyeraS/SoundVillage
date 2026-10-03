export const ECONOMY_CATALOG_VERSION = 'soundvillage-launch-v1:1.1.0'
export const ECONOMY_SERVER_MODES = Object.freeze(['legacy', 'preview', 'cutover', 'maintenance'])
export const ECONOMY_RUNTIME_STATES = Object.freeze([
  'unknown',
  ...ECONOMY_SERVER_MODES,
  'blocked',
])

export const EMPTY_ECONOMY_RUNTIME = Object.freeze({
  runtimeState: 'unknown',
  mode: null,
  effectiveMainMode: null,
  catalogVersion: null,
  items: [],
  runtimeItems: [],
  interiorItems: [],
  interiorSets: [],
  interiorStarters: [],
  profile: null,
  attendance: null,
  capabilities: {},
  identityCatalogVersion: null,
  error: null,
})

function blocked(error, result = {}) {
  return {
    ...EMPTY_ECONOMY_RUNTIME,
    runtimeState: 'blocked',
    catalogVersion: typeof result.catalogVersion === 'string' ? result.catalogVersion : null,
    error,
  }
}

function hasCutoverPayload(result) {
  return Array.isArray(result.items)
    && Array.isArray(result.runtimeItems)
    && Array.isArray(result.interiorItems)
    && Array.isArray(result.interiorSets)
    && Array.isArray(result.interiorStarters)
    && result.profile !== null
    && typeof result.profile === 'object'
    && result.attendance !== null
    && typeof result.attendance === 'object'
}

export function resolveEconomyBootstrap(result) {
  if (!result?.ok) return blocked(result?.code || 'bootstrap_failed', result)
  if (!ECONOMY_SERVER_MODES.includes(result.economyMode)) {
    return blocked('invalid_economy_mode', result)
  }
  if (result.catalogVersion !== ECONOMY_CATALOG_VERSION) {
    return blocked('catalog_version_mismatch', result)
  }
  if (result.economyMode === 'cutover' && !hasCutoverPayload(result)) {
    return blocked('bootstrap_payload_incomplete', result)
  }

  const mainMode = result.economyMode === 'cutover'
    ? 'cutover'
    : ['legacy', 'preview'].includes(result.economyMode) ? 'legacy' : null
  return {
    runtimeState: result.economyMode,
    mode: result.economyMode,
    effectiveMainMode: mainMode,
    catalogVersion: result.catalogVersion,
    items: result.economyMode === 'cutover' ? result.items : [],
    runtimeItems: result.economyMode === 'cutover' ? result.runtimeItems : [],
    interiorItems: result.economyMode === 'cutover' ? result.interiorItems : [],
    interiorSets: result.economyMode === 'cutover' ? result.interiorSets : [],
    interiorStarters: result.economyMode === 'cutover' ? result.interiorStarters : [],
    profile: result.economyMode === 'cutover' ? result.profile : null,
    attendance: result.economyMode === 'cutover' ? result.attendance : null,
    capabilities: result.economyMode === 'cutover' && result.capabilities && typeof result.capabilities === 'object'
      ? { ...result.capabilities }
      : {},
    identityCatalogVersion: Number.isInteger(result.identityCatalogVersion) ? result.identityCatalogVersion : null,
    error: null,
  }
}

export function economyWriteAllowed(runtimeState, writeKind) {
  if (runtimeState === 'cutover') return true
  if (['legacy', 'preview'].includes(runtimeState)) {
    return writeKind === 'legacy-annotation'
      || writeKind === 'legacy-vote'
      || writeKind === 'legacy-attendance'
  }
  return false
}

export function purchaseFailureAction(result) {
  if (result?.code === 'idempotency_key_reused') return 'discard-key-and-resync'
  if (result?.retryable || result?.code === 'storage_retryable') return 'keep-key'
  if (['already_owned', 'bundle_partially_owned', 'official_store_unapproved', 'insufficient_funds'].includes(result?.code)) {
    return 'discard-key-and-resync'
  }
  return 'discard-key'
}

export function normalizeEconomyReward(result) {
  const reward = result?.reward
  if (!reward || !Object.hasOwn(reward, 'ledgerOperationId')) return result
  const { ledgerOperationId, ...rest } = reward
  return { ...result, reward: { ...rest, transactionId: ledgerOperationId } }
}

export function rewardEventFields(result) {
  return {
    zone: result?.reward?.village,
    metadata: {
      transaction_id: result?.reward?.transactionId,
      reward_amount: result?.reward?.awarded,
    },
  }
}
