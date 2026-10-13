import {
  CollisionMaskApplyError,
  applyCollisionMaskPayload,
  validateCollisionMaskApplyPayload,
} from '../../../../lib/villageWalkableMaskPipeline.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function isCollisionMaskApplyEnabled({ nodeEnv = process.env.NODE_ENV } = {}) {
  return nodeEnv === 'development'
}

function jsonError(code, status) {
  return Response.json({ ok: false, code }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function handleCollisionMaskApply(
  request,
  {
    nodeEnv = process.env.NODE_ENV,
    apply = applyCollisionMaskPayload,
  } = {},
) {
  if (nodeEnv === 'production') return jsonError('production_disabled', 403)
  if (!isCollisionMaskApplyEnabled({ nodeEnv })) return jsonError('development_only', 403)

  let payload
  try {
    payload = await request.json()
  } catch {
    return jsonError('invalid_json', 400)
  }

  try {
    validateCollisionMaskApplyPayload(payload)
    const result = await apply(payload)
    return Response.json(
      { ok: true, ...result, reloadRequired: true },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof CollisionMaskApplyError) return jsonError(error.code, error.status)
    console.error('collision mask apply failed', error)
    return jsonError('apply_failed', 500)
  }
}

export async function POST(request) {
  return handleCollisionMaskApply(request)
}
