import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const DEMO_PARTICIPANT_ID = 'USER1'
const DEMO_GROUP_ID = 'A'
const DEMO_AUTH_EMAIL = 'user1@new-soundvillage.local'

function noStoreJson(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...init.headers, 'Cache-Control': 'no-store' },
  })
}

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const participantId = String(body?.participantId || '').trim().toUpperCase()
  const groupId = String(body?.groupId || '').trim().toUpperCase()
  if (participantId !== DEMO_PARTICIPANT_ID || groupId !== DEMO_GROUP_ID) {
    return noStoreJson({ code: 'participant_not_registered' }, { status: 404 })
  }

  const password = process.env.SHARED_DEMO_USER_PASSWORD
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!password || !url || !anonKey) {
    return noStoreJson({ code: 'shared_demo_unavailable' }, { status: 503 })
  }

  const { data: participant, error: participantError } = await getSupabaseAdmin()
    .from('study_participants')
    .select('participant_id,group_id,status,auth_user_id')
    .eq('participant_id', DEMO_PARTICIPANT_ID)
    .maybeSingle()
  if (participantError) return noStoreJson({ code: 'shared_demo_unavailable' }, { status: 503 })
  if (!participant || participant.group_id !== DEMO_GROUP_ID || participant.status !== 'active' || !participant.auth_user_id) {
    return noStoreJson({ code: 'participant_inactive' }, { status: 403 })
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const { data, error } = await authClient.auth.signInWithPassword({
    email: DEMO_AUTH_EMAIL,
    password,
  })
  if (error || !data.session || data.user?.id !== participant.auth_user_id) {
    return noStoreJson({ code: 'shared_demo_sign_in_failed' }, { status: 503 })
  }

  return noStoreJson({
    participant: {
      participant_id: participant.participant_id,
      group_id: participant.group_id,
      status: participant.status,
    },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  })
}
