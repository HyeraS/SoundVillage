import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DRAFT_DIRECTORY = path.join(process.cwd(), 'tmp', 'collision-mask-editor')
const DRAFT_TARGETS = Object.freeze({
  animal: Object.freeze({ filename: 'animal-mask-draft.json', columns: 384, rows: 256 }),
  human: Object.freeze({ filename: 'human-mask-draft.json', columns: 384, rows: 288 }),
  lab: Object.freeze({ filename: 'lab-mask-draft.json', columns: 384, rows: 288 }),
  nature: Object.freeze({ filename: 'nature-mask-draft.json', columns: 384, rows: 288 }),
  music: Object.freeze({ filename: 'music-mask-draft.json', columns: 384, rows: 288 }),
  urban: Object.freeze({ filename: 'urban-mask-draft.json', columns: 724, rows: 543 }),
})

function enabled() {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA === 'true'
}

function unavailable() {
  return Response.json({ ok: false, code: 'not_found' }, { status: 404 })
}

function targetFromRequest(request) {
  const village = new URL(request.url).searchParams.get('village') || 'music'
  const target = DRAFT_TARGETS[village]
  return target ? { ...target, village } : null
}

function draftPaths(target) {
  return {
    draft: path.join(DRAFT_DIRECTORY, target.filename),
    temporary: path.join(DRAFT_DIRECTORY, `${target.filename}.tmp`),
  }
}

function validDraft(value, target) {
  if (!value || value.version !== 1 || value.columns !== target.columns || value.rows !== target.rows) return false
  const expectedBytes = target.columns * target.rows
  const maximumBase64Length = Math.ceil(expectedBytes / 3) * 4
  if (typeof value.maskBase64 !== 'string' || value.maskBase64.length > maximumBase64Length) return false
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value.maskBase64)) return false
  try {
    return Buffer.from(value.maskBase64, 'base64').byteLength === expectedBytes
  } catch {
    return false
  }
}

export async function GET(request) {
  if (!enabled()) return unavailable()
  const target = targetFromRequest(request)
  if (!target) return Response.json({ ok: false, code: 'unknown_village' }, { status: 400 })
  const paths = draftPaths(target)
  try {
    const draft = JSON.parse(await readFile(paths.draft, 'utf8'))
    if (!validDraft(draft, target)) return Response.json({ ok: false, code: 'invalid_draft' }, { status: 500 })
    return Response.json({ ok: true, draft }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error?.code === 'ENOENT') return Response.json({ ok: true, draft: null }, { headers: { 'Cache-Control': 'no-store' } })
    return Response.json({ ok: false, code: 'draft_read_failed' }, { status: 500 })
  }
}

export async function PUT(request) {
  if (!enabled()) return unavailable()
  const target = targetFromRequest(request)
  if (!target) return Response.json({ ok: false, code: 'unknown_village' }, { status: 400 })
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, code: 'invalid_json' }, { status: 400 })
  }

  const draft = {
    version: 1,
    village: target.village,
    columns: body?.columns,
    rows: body?.rows,
    maskBase64: body?.maskBase64,
    updatedAt: new Date().toISOString(),
  }
  if (!validDraft(draft, target)) return Response.json({ ok: false, code: 'invalid_draft' }, { status: 400 })

  try {
    const paths = draftPaths(target)
    await mkdir(DRAFT_DIRECTORY, { recursive: true })
    await writeFile(paths.temporary, `${JSON.stringify(draft)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(paths.temporary, paths.draft)
    return Response.json({ ok: true, updatedAt: draft.updatedAt })
  } catch {
    return Response.json({ ok: false, code: 'draft_write_failed' }, { status: 500 })
  }
}
