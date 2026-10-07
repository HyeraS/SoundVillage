import { uniqueSoundsByCanonicalAudio } from './soundIdentity.mjs'

export const MUSEUM_ZONES = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']

function normalizeGroupLabel(groupId) {
  const value = String(groupId || '').trim().toUpperCase().replace(/^G/i, '')
  if (value === '1') return 'A'
  if (value === '2') return 'B'
  return value
}

export function buildCatalogExhibitCounts(sounds = [], { groupId, bypassGroupFilter = false } = {}) {
  const groupLabel = normalizeGroupLabel(groupId)

  return Object.fromEntries(MUSEUM_ZONES.map((zone) => {
    const matching = sounds.filter((sound) => (
      sound.game_zone === zone
      && (bypassGroupFilter || !groupLabel || !sound.group || sound.group === groupLabel)
    ))
    // Lab 진척도는 실제 sound_id 단위다. 같은 원본 음원을 가리키더라도
    // 서로 다른 실험 항목이면 각각 전시 슬롯으로 유지한다.
    const assigned = zone === 'Lab' ? matching : uniqueSoundsByCanonicalAudio(matching)
    return [zone, { collected: 0, total: assigned.length }]
  }))
}

export function mergeExhibitCounts(catalogCounts = {}, progressCounts = {}) {
  return Object.fromEntries(MUSEUM_ZONES.map((zone) => {
    const fallback = catalogCounts[zone] || { collected: 0, total: 0 }
    const progress = progressCounts[zone]
    const progressTotal = Number(progress?.total)
    if (!Number.isFinite(progressTotal) || progressTotal <= 0) return [zone, fallback]

    return [zone, {
      collected: Math.min(Math.max(Number(progress?.collected) || 0, 0), progressTotal),
      total: progressTotal,
    }]
  }))
}
