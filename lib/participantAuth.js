'use client'

import { getClient } from '@/lib/supabase'
import { newOperationKey, persistenceFailure, persistenceSuccess } from '@/lib/persistenceResult'

const MASTER_PARTICIPANT_ID = 'MASTER'
const MASTER_AUTH_EMAIL = 'master@new-soundvillage.local'

export class ParticipantAuthError extends Error {
  constructor(code, message = code) {
    super(message)
    this.name = 'ParticipantAuthError'
    this.code = code
  }
}

function normalizeParticipant(row) {
  if (!row) return null
  return {
    participantId: row.participant_id,
    groupId: row.group_id,
    status: row.status,
  }
}

export async function restoreParticipantSession() {
  const client = getClient()
  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw new ParticipantAuthError('session_restore_failed')
  if (!sessionData.session) return null

  const { data, error } = await client.rpc('get_my_study_participant')
  if (error) throw new ParticipantAuthError('session_restore_failed')
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  if (row.status !== 'active') throw new ParticipantAuthError('participant_inactive')
  return normalizeParticipant(row)
}

export async function signInMasterSession(password) {
  const client = getClient()
  const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({
    email: MASTER_AUTH_EMAIL,
    password,
  })
  if (signInError || !sessionData.session) throw new ParticipantAuthError('master_sign_in_failed')

  const { data, error } = await client.rpc('get_my_study_participant')
  const row = Array.isArray(data) ? data[0] : data
  const participant = normalizeParticipant(row)
  if (error || participant?.participantId !== MASTER_PARTICIPANT_ID) {
    await client.auth.signOut().catch(() => {})
    throw new ParticipantAuthError('master_account_mismatch')
  }
  if (participant.status !== 'active') throw new ParticipantAuthError('participant_inactive')
  return participant
}

export async function claimParticipantSession(participantId, groupId) {
  const client = getClient()
  let { data: sessionData, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw new ParticipantAuthError('auth_unavailable')

  if (!sessionData.session) {
    const signIn = await client.auth.signInAnonymously()
    if (signIn.error || !signIn.data.session) throw new ParticipantAuthError('anonymous_sign_in_failed')
    sessionData = signIn.data
  }

  const response = await fetch('/api/participant-session/claim', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ participantId, groupId }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new ParticipantAuthError(result.code || 'claim_failed')
  return normalizeParticipant(result.participant)
}

export async function authorizedPost(path, body, idempotencyKey) {
  const operationType = body?.kind ? `purchase:${body.kind}` : 'authorized_post'
  const operationKey = idempotencyKey || newOperationKey()
  const { data, error } = await getClient().auth.getSession()
  if (error || !data.session) return persistenceFailure(new ParticipantAuthError('session_required'), operationType, operationKey)

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, idempotencyKey: operationKey }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result?.ok) {
      const failure = persistenceFailure(new ParticipantAuthError(result.code || result.reason || 'request_failed'), operationType, operationKey)
      return { ...failure, ...result, ok: false }
    }
    return { ...persistenceSuccess(result, operationType, operationKey), ...result, ok: true }
  } catch (requestError) {
    return persistenceFailure(requestError, operationType, operationKey)
  }
}
