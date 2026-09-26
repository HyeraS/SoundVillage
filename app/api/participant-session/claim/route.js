import { getSupabaseAdmin, requireSupabaseUser } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const PARTICIPANT_ID_PATTERN = /^[A-Z0-9_-]{1,64}$/
const GROUP_IDS = new Set(['A', 'B'])

const STATUS_HTTP = {
  participant_not_registered: 404,
  participant_claimed: 409,
  participant_inactive: 403,
  group_mismatch: 409,
}

export async function POST(request) {
  const { user, error: authError } = await requireSupabaseUser(request)
  if (authError) return Response.json({ code: authError }, { status: 401 })

  const body = await request.json().catch(() => null)
  const participantId = String(body?.participantId || '').trim().toUpperCase()
  const groupId = String(body?.groupId || '').trim().toUpperCase()
  if (!PARTICIPANT_ID_PATTERN.test(participantId) || !GROUP_IDS.has(groupId)) {
    return Response.json({ code: 'invalid_claim_input' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin().rpc('claim_study_participant_admin', {
    p_auth_user_id: user.id,
    p_group_id: groupId,
    p_participant_id: participantId,
  })
  if (error) return Response.json({ code: 'claim_unavailable' }, { status: 503 })

  if (data?.status !== 'ok') {
    const code = data?.status || 'claim_failed'
    return Response.json({ code }, { status: STATUS_HTTP[code] || 400 })
  }

  return Response.json({
    participant: {
      participant_id: data.participant_id,
      group_id: data.group_id,
      status: 'active',
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
