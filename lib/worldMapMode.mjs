export const WORLD_MAP_RENDER_MODES = Object.freeze({
  FLAT_V2: 'flat-v2',
  MODULAR_V4: 'modular-v4',
})

export function resolveWorldMapRenderMode(value = process.env.NEXT_PUBLIC_WORLD_MAP_RENDER_MODE) {
  return value === WORLD_MAP_RENDER_MODES.MODULAR_V4
    ? WORLD_MAP_RENDER_MODES.MODULAR_V4
    : WORLD_MAP_RENDER_MODES.FLAT_V2
}

// Production defaults to the approved flat map. Rollback is an environment
// setting, not a URL query, so end users cannot switch renderers themselves.
export const WORLD_MAP_RENDER_MODE = resolveWorldMapRenderMode()

