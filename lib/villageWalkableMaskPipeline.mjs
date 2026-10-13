import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { VILLAGE_RUNTIME_MANIFESTS } from './villageRuntimeManifest.mjs'

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const VILLAGE_ORDER = Object.freeze(['urban-v3', 'lab', 'human', 'animal', 'nature', 'music'])
const GENERATOR_BY_VILLAGE = Object.freeze({
  music: 'scripts/build-music-village-navigation-mask.mjs',
})

const MUSIC_TARGET = Object.freeze({
  villageId: 'music',
  sourceAsset: 'public/assets/world/music-village/navigation/music-walkable-mask.png',
  outputModule: 'lib/generated/musicVillageWalkableMask.mjs',
  width: 384,
  height: 288,
  baseCellSize: 4,
  baseWorldWidth: 1536,
  baseWorldHeight: 1152,
  playerFootWidth: 12,
  playerFootHeight: 8,
  generatorScript: GENERATOR_BY_VILLAGE.music,
})

const targetFromManifest = (villageId) => {
  if (villageId === 'music') return MUSIC_TARGET
  const manifest = VILLAGE_RUNTIME_MANIFESTS[villageId]
  if (!manifest) return null
  return Object.freeze({
    villageId,
    sourceAsset: `public${manifest.mask.src}`,
    outputModule: `lib/${manifest.mask.generatedModule.replace(/^\.\//, '')}`,
    width: manifest.mask.width,
    height: manifest.mask.height,
    baseCellSize: manifest.mask.baseCellSize,
    baseWorldWidth: manifest.baseWorldWidth,
    baseWorldHeight: manifest.baseWorldHeight,
    playerFootWidth: manifest.playerFootBox.w,
    playerFootHeight: manifest.playerFootBox.h,
    generatorScript: GENERATOR_BY_VILLAGE[villageId] || 'scripts/build-village-walkable-masks.mjs',
  })
}

export const VILLAGE_WALKABLE_MASK_TARGETS = Object.freeze(Object.fromEntries(
  VILLAGE_ORDER.map((villageId) => [villageId, targetFromManifest(villageId)]),
))

export class CollisionMaskApplyError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'CollisionMaskApplyError'
    this.code = code
    this.status = status
  }
}

export function getVillageWalkableMaskTarget(villageId) {
  const target = VILLAGE_WALKABLE_MASK_TARGETS[villageId]
  return target ? { ...target } : null
}

export function listVillageWalkableMaskTargets({ includeMusic = true } = {}) {
  return VILLAGE_ORDER
    .filter((villageId) => includeMusic || villageId !== 'music')
    .map((villageId) => getVillageWalkableMaskTarget(villageId))
}

function assertCanonicalBase64(value, expectedBytes) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new CollisionMaskApplyError('invalid_mask_base64', 'maskBase64 must be canonical base64')
  }
  const decoded = Buffer.from(value, 'base64')
  if (decoded.toString('base64') !== value) throw new CollisionMaskApplyError('invalid_mask_base64', 'maskBase64 is malformed')
  if (decoded.length !== expectedBytes) throw new CollisionMaskApplyError('invalid_mask_length', 'decoded mask length is invalid')
  return decoded
}

export function validateCollisionMaskApplyPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CollisionMaskApplyError('invalid_payload', 'request body must be a JSON object')
  }
  const allowedFields = new Set(['villageId', 'width', 'height', 'maskBase64'])
  const unexpectedField = Object.keys(payload).find((field) => !allowedFields.has(field))
  if (unexpectedField) {
    throw new CollisionMaskApplyError('unexpected_field', `unexpected field: ${unexpectedField}`)
  }

  const target = getVillageWalkableMaskTarget(payload.villageId)
  if (!target) throw new CollisionMaskApplyError('unsupported_village', 'villageId is not supported')
  if (!Number.isInteger(payload.width) || !Number.isInteger(payload.height)
    || payload.width !== target.width || payload.height !== target.height) {
    throw new CollisionMaskApplyError(
      'invalid_dimensions',
      `${target.villageId} mask must be exactly ${target.width}x${target.height}`,
    )
  }

  const mask = assertCanonicalBase64(payload.maskBase64, target.width * target.height)
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 0 && mask[index] !== 1) {
      throw new CollisionMaskApplyError('invalid_mask_value', `mask byte ${index} must be 0 or 1`)
    }
  }
  return { target, mask }
}

export async function createOpaqueBinaryMaskPng(mask, width, height) {
  if (!(mask instanceof Uint8Array) && !Buffer.isBuffer(mask)) {
    throw new TypeError('mask must be a Uint8Array')
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || mask.length !== width * height) {
    throw new TypeError('mask dimensions do not match its byte length')
  }
  const rgba = Buffer.alloc(mask.length * 4)
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 0 && mask[index] !== 1) throw new TypeError(`mask byte ${index} must be 0 or 1`)
    const color = mask[index] === 1 ? 255 : 0
    const offset = index * 4
    rgba[offset] = color
    rgba[offset + 1] = color
    rgba[offset + 2] = color
    rgba[offset + 3] = 255
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer()
}

const formatBase64 = (value, width = 120) => (
  value.match(new RegExp(`.{1,${width}}`, 'g')).map((line) => `  '${line}'`).join(' +\n')
)

function genericModuleSource(target, sourceSha256, whitePixels, blackPixels, bitset) {
  return `// Generated by ${target.generatorScript}. Do not edit by hand.\n` +
`import { createWorldTransform, worldPointToMaskCell } from '../villageWorldTransform.mjs'\n\n` +
`export const WALKABLE_MASK_METADATA = Object.freeze({\n` +
`  villageId: '${target.villageId}',\n` +
`  width: ${target.width},\n` +
`  height: ${target.height},\n` +
`  baseCellSize: ${target.baseCellSize},\n` +
`  baseWorldWidth: ${target.baseWorldWidth},\n` +
`  baseWorldHeight: ${target.baseWorldHeight},\n` +
`  playerFootWidth: ${target.playerFootWidth},\n` +
`  playerFootHeight: ${target.playerFootHeight},\n` +
`  sourceAsset: '${target.sourceAsset}',\n` +
`  sourceSha256: '${sourceSha256}',\n` +
`  formatVersion: 2,\n` +
`  encoding: '1-bit-msb-row-major-base64',\n` +
`  whitePixels: ${whitePixels},\n` +
`  blackPixels: ${blackPixels},\n` +
`  byteLength: ${bitset.length},\n` +
`})\n\n` +
`const WALKABLE_BITS_BASE64 =\n${formatBase64(bitset.toString('base64'))}\n` +
`const WALKABLE_BYTES = Uint8Array.from(globalThis.atob(WALKABLE_BITS_BASE64), (value) => value.charCodeAt(0))\n\n` +
`export function isMaskCellWalkable(column, row) {\n` +
`  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || column >= WALKABLE_MASK_METADATA.width || row >= WALKABLE_MASK_METADATA.height) return false\n` +
`  const index = row * WALKABLE_MASK_METADATA.width + column\n` +
`  return Boolean(WALKABLE_BYTES[index >> 3] & (1 << (7 - (index & 7))))\n` +
`}\n\n` +
`export function isMaskPointWalkable(worldX, worldY, currentWorldWidth = WALKABLE_MASK_METADATA.baseWorldWidth, currentWorldHeight = WALKABLE_MASK_METADATA.baseWorldHeight) {\n` +
`  const transform = createWorldTransform({ baseWorldWidth: WALKABLE_MASK_METADATA.baseWorldWidth, baseWorldHeight: WALKABLE_MASK_METADATA.baseWorldHeight, currentWorldWidth, currentWorldHeight })\n` +
`  const cell = worldPointToMaskCell(worldX, worldY, transform, WALKABLE_MASK_METADATA.width, WALKABLE_MASK_METADATA.height)\n` +
`  return cell ? isMaskCellWalkable(cell.column, cell.row) : false\n` +
`}\n`
}

function musicModuleSource(target, sourceSha256, whitePixels, blackPixels, bitset) {
  return `// Generated by ${target.generatorScript}. Do not edit by hand.\n` +
`export const MUSIC_VILLAGE_MASK_METADATA = Object.freeze({\n` +
`  width: ${target.width},\n` +
`  height: ${target.height},\n` +
`  cellSize: ${target.baseCellSize},\n` +
`  worldWidth: ${target.baseWorldWidth},\n` +
`  worldHeight: ${target.baseWorldHeight},\n` +
`  sourceAsset: '${target.sourceAsset}',\n` +
`  sha256: '${sourceSha256}',\n` +
`  encoding: '1-bit-msb-row-major-base64',\n` +
`  whiteCells: ${whitePixels},\n` +
`  blackCells: ${blackPixels},\n` +
`})\n\n` +
`const WALKABLE_BITS_BASE64 =\n${formatBase64(bitset.toString('base64'))}\n` +
`const WALKABLE_BYTES = Uint8Array.from(globalThis.atob(WALKABLE_BITS_BASE64), (value) => value.charCodeAt(0))\n\n` +
`export function isMusicVillageMaskCellWalkable(col, row) {\n` +
`  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= MUSIC_VILLAGE_MASK_METADATA.width || row >= MUSIC_VILLAGE_MASK_METADATA.height) return false\n` +
`  const index = row * MUSIC_VILLAGE_MASK_METADATA.width + col\n` +
`  return Boolean(WALKABLE_BYTES[index >> 3] & (1 << (7 - (index & 7))))\n` +
`}\n`
}

export async function generateWalkableMaskModule(target, pngBuffer) {
  const source = Buffer.from(pngBuffer)
  const sourceSha256 = crypto.createHash('sha256').update(source).digest('hex')
  const image = sharp(source, { failOn: 'error', limitInputPixels: target.width * target.height })
  const metadata = await image.metadata()
  if (metadata.format !== 'png' || metadata.width !== target.width || metadata.height !== target.height) {
    throw new Error(`${target.villageId}: expected ${target.width}x${target.height} PNG, received ${metadata.width}x${metadata.height} ${metadata.format}`)
  }
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 4) throw new Error(`${target.villageId}: expected RGBA decode`)

  const pixelCount = target.width * target.height
  const bitset = Buffer.alloc(Math.ceil(pixelCount / 8))
  let whitePixels = 0
  let blackPixels = 0
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const alpha = data[offset + 3]
    const white = red === 255 && green === 255 && blue === 255 && alpha === 255
    const black = red === 0 && green === 0 && blue === 0 && alpha === 255
    if (!white && !black) {
      const column = index % target.width
      const row = Math.floor(index / target.width)
      throw new Error(`${target.villageId}: non-binary pixel at (${column}, ${row}): rgba(${red}, ${green}, ${blue}, ${alpha})`)
    }
    if (white) {
      bitset[index >> 3] |= 1 << (7 - (index & 7))
      whitePixels += 1
    } else {
      blackPixels += 1
    }
  }

  const moduleSource = target.villageId === 'music'
    ? musicModuleSource(target, sourceSha256, whitePixels, blackPixels, bitset)
    : genericModuleSource(target, sourceSha256, whitePixels, blackPixels, bitset)
  return {
    ...target,
    sourceSha256,
    whitePixels,
    blackPixels,
    byteLength: bitset.length,
    moduleSource,
  }
}

export async function buildWalkableMaskTarget(target, { root = PROJECT_ROOT } = {}) {
  const pngBuffer = await fs.readFile(path.join(root, target.sourceAsset))
  return generateWalkableMaskModule(target, pngBuffer)
}

export async function writeWalkableMaskModules(targets, { check = false, root = PROJECT_ROOT } = {}) {
  const results = []
  for (const target of targets) {
    const result = await buildWalkableMaskTarget(target, { root })
    const outputPath = path.join(root, target.outputModule)
    if (check) {
      const existing = await fs.readFile(outputPath, 'utf8').catch(() => '')
      if (existing !== result.moduleSource) throw new Error(`${target.outputModule} is missing or stale`)
    } else {
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      const temporaryPath = `${outputPath}.tmp-${process.pid}-${crypto.randomUUID()}`
      await fs.writeFile(temporaryPath, result.moduleSource, 'utf8')
      await fs.rename(temporaryPath, outputPath)
    }
    results.push({
      villageId: result.villageId,
      sourceAsset: result.sourceAsset,
      outputModule: result.outputModule,
      sourceSha256: result.sourceSha256,
      whitePixels: result.whitePixels,
      blackPixels: result.blackPixels,
      byteLength: result.byteLength,
    })
  }
  return results
}

async function restoreFileAtomically(filePath, contents) {
  const temporaryPath = `${filePath}.rollback-${process.pid}-${crypto.randomUUID()}`
  await fs.writeFile(temporaryPath, contents)
  await fs.rename(temporaryPath, filePath)
}

let applyQueue = Promise.resolve()

async function applyValidatedCollisionMask({ target, mask }, { root = PROJECT_ROOT, now = () => new Date() } = {}) {
  const pngBuffer = await createOpaqueBinaryMaskPng(mask, target.width, target.height)
  const generated = await generateWalkableMaskModule(target, pngBuffer)
  const pngPath = path.join(root, target.sourceAsset)
  const modulePath = path.join(root, target.outputModule)
  const suffix = `${process.pid}-${crypto.randomUUID()}`
  const pngTemporaryPath = `${pngPath}.tmp-${suffix}`
  const moduleTemporaryPath = `${modulePath}.tmp-${suffix}`
  const [previousPng, previousModule] = await Promise.all([
    fs.readFile(pngPath),
    fs.readFile(modulePath),
  ])
  let pngCommitted = false

  try {
    await Promise.all([
      fs.mkdir(path.dirname(pngPath), { recursive: true }),
      fs.mkdir(path.dirname(modulePath), { recursive: true }),
    ])
    await Promise.all([
      fs.writeFile(pngTemporaryPath, pngBuffer),
      fs.writeFile(moduleTemporaryPath, generated.moduleSource, 'utf8'),
    ])
    await fs.rename(pngTemporaryPath, pngPath)
    pngCommitted = true
    await fs.rename(moduleTemporaryPath, modulePath)
  } catch (error) {
    if (pngCommitted) {
      await Promise.allSettled([
        restoreFileAtomically(pngPath, previousPng),
        restoreFileAtomically(modulePath, previousModule),
      ])
    }
    throw error
  } finally {
    await Promise.allSettled([
      fs.unlink(pngTemporaryPath),
      fs.unlink(moduleTemporaryPath),
    ])
  }

  return {
    villageId: target.villageId,
    width: target.width,
    height: target.height,
    hash: generated.sourceSha256,
    walkablePixels: generated.whitePixels,
    blockedPixels: generated.blackPixels,
    appliedAt: now().toISOString(),
  }
}

export function applyCollisionMaskPayload(payload, options = {}) {
  const validated = validateCollisionMaskApplyPayload(payload)
  const queued = applyQueue.then(() => applyValidatedCollisionMask(validated, options))
  applyQueue = queued.catch(() => undefined)
  return queued
}
