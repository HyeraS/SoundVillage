import { resolveCharacterIdentityAssets } from './characterV2Runtime.mjs'

export function resolveWorldCharacterLayersWithBase(worldCharacter, options) {
  if (!options) return worldCharacter.layers
  const { outfitSrc, accessorySrc, loadout, strictIdentity, ...identityFields } = options
  const hasIdentity = Boolean(loadout) || ['skinId', 'eyesId', 'hairStyleId', 'hairColorId']
    .some((key) => identityFields[key] !== undefined)
  if (!hasIdentity) {
    const layers = outfitSrc
      ? worldCharacter.layers.map((layer, index) => index === 1 ? { ...layer, src:outfitSrc } : layer)
      : worldCharacter.layers
    if (!accessorySrc) return layers
    return [...layers, { src:accessorySrc, sheetW:256, sheetH:128 }]
  }

  const resolved = resolveCharacterIdentityAssets({ ...loadout, ...identityFields }, { strict:strictIdentity })
  const layers = [
    { kind:'skin', src:resolved.skinAsset, sheetW:256, sheetH:128 },
    ...(resolved.eyesAsset ? [{ kind:'eyes', src:resolved.eyesAsset, sheetW:256, sheetH:128 }] : []),
    { kind:'outfit', src:outfitSrc || worldCharacter.layers[1].src, sheetW:256, sheetH:128 },
    { kind:'hair', src:resolved.hairAsset, sheetW:256, sheetH:128 },
  ]
  if (accessorySrc) layers.push({ kind:'accessory', src:accessorySrc, sheetW:256, sheetH:128 })
  return layers
}
