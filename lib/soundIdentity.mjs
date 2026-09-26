export function normalizeAudioIdentityPart(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}

// This identifier is only a client/catalog synchronization aid. Persistence RPCs
// resolve the authoritative identity from the service-managed catalog.
export function canonicalAudioId(sound) {
  const dataset = normalizeAudioIdentityPart(sound?.source_dataset)
  const original = normalizeAudioIdentityPart(sound?.original_fname)
  if (dataset && original) return `${dataset}:${original}`

  const path = normalizeAudioIdentityPart(sound?.file_path)
  if (path) return `path:${path}`
  throw new Error(`Sound ${String(sound?.sound_id || '(missing)')} has no canonical audio source`)
}

export function uniqueSoundsByCanonicalAudio(sounds = []) {
  const unique = new Map()
  for (const sound of sounds) {
    const identity = canonicalAudioId(sound)
    if (!unique.has(identity)) unique.set(identity, sound)
  }
  return [...unique.values()]
}
