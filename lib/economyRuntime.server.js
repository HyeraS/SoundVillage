import 'server-only'

export const ECONOMY_RUNTIME_MODES = Object.freeze(['legacy', 'preview', 'cutover', 'maintenance'])

export function getEconomyRuntimeMode() {
  const configured = process.env.SOUNDVILLAGE_ECONOMY_MODE?.trim().toLowerCase()
  if (!configured) return 'legacy'
  return ECONOMY_RUNTIME_MODES.includes(configured) ? configured : null
}

export function isEconomyApiEnabled() {
  const mode = getEconomyRuntimeMode()
  return mode === 'preview' || mode === 'cutover'
}
