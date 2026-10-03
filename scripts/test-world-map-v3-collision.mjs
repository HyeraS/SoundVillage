import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { WORLD_WALKABLE_MASK_META } from '../lib/worldMapGeometry.mjs'

// Kept for CI callers that still use the historical command name. Production
// collision is V4, so this wrapper must not mix V3 authored paths with a V4 mask.
const generator = await readFile(new URL('./build-world-map-v4-collision.mjs', import.meta.url), 'utf8')
const sourceLiteral = `source: '${WORLD_WALKABLE_MASK_META.source}'`
assert.ok(generator.includes(sourceLiteral), 'production mask metadata and V4 generator source must agree')

console.warn('test:world-v3-collision is deprecated; running the V4 production collision gate')
await import('./test-world-map-hd-collision.mjs')
