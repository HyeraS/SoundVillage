import 'server-only'

import { createClient } from '@supabase/supabase-js'

let adminClient = null

export function getSupabaseAdmin() {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase server credentials are not configured')

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
  return adminClient
}

export async function requireSupabaseUser(request) {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) return { user: null, error: 'missing_token' }

  const { data, error } = await getSupabaseAdmin().auth.getUser(match[1])
  if (error || !data?.user) return { user: null, error: 'invalid_token' }
  return { user: data.user, error: null }
}
