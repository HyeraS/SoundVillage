'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AnnotationPanel from '@/components/AnnotationPanel'
import FeedbackPanel from '@/components/FeedbackPanel'
import InteriorDecorRoom from '@/components/InteriorDecorRoom'
import SoundMuseum from '@/components/SoundMuseum'
import soundMetadata from '@/data/sound_metadata.json'
import { restoreParticipantSession } from '@/lib/participantAuth'
import { useDuoSession } from '@/lib/duoSession'
import { getRoom, getSharedRoom, saveRoom } from '@/lib/interiorDecor'
import { canonicalAudioId } from '@/lib/soundIdentity.mjs'
import { getAnnotatedByParticipantZone, getClient, getVotedSoundIdsByParticipant } from '@/lib/supabase'
import { completeStudySession, flushEvents, setUserEventContext, startStudySession } from '@/lib/userEvents'

function DuoProbe({ token }) {
  const [selfId] = useState(() => `stage8-${crypto.randomUUID()}`)
  const { status, partnerId, partnerPos, sendPosition } = useDuoSession(token, selfId)

  useEffect(() => {
    if (status !== 'joined') return
    const timer = setInterval(() => sendPosition(12, 18, 'down', 'stage8-e2e', true), 180)
    return () => clearInterval(timer)
  }, [sendPosition, status])

  return (
    <section>
      <div data-testid="duo-status">{status}</div>
      <div data-testid="duo-presence">{partnerId ? 'present' : 'absent'}</div>
      <div data-testid="duo-broadcast">{partnerPos?.screen === 'stage8-e2e' ? 'received' : 'waiting'}</div>
    </section>
  )
}

export default function Stage8E2ETestPage() {
  const [runRequested, setRunRequested] = useState(false)
  const [identity, setIdentity] = useState(null)
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [feedback, setFeedback] = useState(false)

  const params = useMemo(() => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search), [])
  const mode = params.get('mode') || 'annotation'
  const soundId = params.get('sound') || 'MUS_13433'
  const sound = useMemo(() => soundMetadata.sounds.find((row) => row.sound_id === soundId), [soundId])

  useEffect(() => {
    if (!runRequested) return
    let cancelled = false
    Promise.resolve().then(async () => {
      setStatus('restoring')
      const participant = await restoreParticipantSession()
      if (!participant) throw new Error('authenticated_participant_required')
      const activeSession = await startStudySession('stage8-e2e')
      if (!activeSession) throw new Error('study_session_required')
      if (mode === 'duo' && params.get('role') === 'visitor') {
        const shared = await getSharedRoom(params.get('token'))
        if (!shared?.room) throw new Error('shared_room_required')
      }
      const screen = mode.startsWith('room') ? 'interior' : 'stage8-e2e'
      setUserEventContext({ screen, zone: sound?.game_zone || null })
      if (!cancelled) {
        setIdentity(participant)
        setStatus('ready')
      }
    }).catch(() => { if (!cancelled) setStatus('setup_failed') })
    return () => { cancelled = true }
  }, [mode, params, runRequested, sound?.game_zone])

  const finishAnnotation = useCallback(async ({ persistence } = {}) => {
    setResult({
      kind: 'annotation',
      alreadyCompleted: Boolean(persistence?.alreadyCompleted),
      isComplete: Boolean(persistence?.progress?.isComplete),
    })
    if (persistence?.progress?.isComplete) {
      await completeStudySession('all_assigned_annotations_completed', {
        operationType: 'annotation_submit',
        idempotencyKey: persistence?.operationIdempotencyKey,
        annotationId: persistence?.annotationId,
      })
    } else {
      setFeedback(true)
    }
    await flushEvents()
    setStatus('done')
  }, [])

  const runIsolationProbe = useCallback(async () => {
    const target = params.get('target') || 'missing-target'
    const read = await getClient().from('annotations').select('id').eq('participant_id', target)
    const write = await getClient().from('annotations').update({ expression_text: 'blocked' }).eq('participant_id', target)
    setResult({
      kind: 'isolation',
      crossReadRows: read.data?.length ?? -1,
      crossWriteRows: write.data?.length ?? 0,
      readError: Boolean(read.error),
      writeError: Boolean(write.error),
    })
    setStatus('done')
  }, [params])

  const runProgressProbe = useCallback(async () => {
    const canonical = canonicalAudioId(sound)
    const completed = mode === 'vote-progress'
      ? await getVotedSoundIdsByParticipant(identity.participantId)
      : await getAnnotatedByParticipantZone(identity.participantId, sound.game_zone)
    setResult({ kind: mode, excluded: completed.includes(canonical) })
    setStatus('done')
  }, [identity, mode, sound])

  const runRoomBoundaryProbe = useCallback(async () => {
    const target = params.get('target') || 'missing-target'
    const operationKey = params.get('operationKey')
    if (!operationKey) throw new Error('room_operation_key_required')
    const client = getClient()
    const directInsert = await client.from('participant_room').insert({
      participant_id: identity.participantId, room: { marker: 'forbidden-insert', items: [] },
    })
    const directUpdate = await client.from('participant_room').update({
      room: { marker: 'forbidden-update', items: [] },
    }).eq('participant_id', identity.participantId)
    const directDelete = await client.from('participant_room').delete().eq('participant_id', identity.participantId)
    const crossRead = await client.from('participant_room').select('room').eq('participant_id', target)
    const crossUpdate = await client.from('participant_room').update({
      room: { marker: 'forbidden-cross-update', items: [] },
    }).eq('participant_id', target)
    const first = await saveRoom({
      room: { wallpaper: 'boundary-probe', items: [], participant_id_like: target },
      idempotencyKey: operationKey,
    })
    const replay = await saveRoom({
      room: { wallpaper: 'must-not-replace', items: [] },
      idempotencyKey: operationKey,
    })
    const ownRoom = await getRoom(identity.participantId)
    setResult({
      kind: 'room-boundary',
      directInsertBlocked: Boolean(directInsert.error),
      directUpdateBlocked: Boolean(directUpdate.error),
      directDeleteBlocked: Boolean(directDelete.error),
      crossReadRows: crossRead.data?.length ?? -1,
      crossUpdateBlocked: Boolean(crossUpdate.error) || (crossUpdate.data?.length ?? 0) === 0,
      rpcSaved: first.ok,
      replayStable: first.ok && replay.ok && first.data?.savedAt === replay.data?.savedAt,
      payloadStayedOnCaller: ownRoom?.wallpaper === 'boundary-probe',
    })
    await flushEvents()
    setStatus('done')
  }, [identity, params])

  if (!runRequested) {
    return <main style={{padding: 32}}><button onClick={() => setRunRequested(true)}>Run Stage 8B E2E</button></main>
  }
  if (status !== 'ready' && status !== 'done') return <main data-testid="stage8-status" style={{padding: 32}}>{status}</main>
  if (!sound && !['isolation', 'duo', 'room', 'room-boundary'].includes(mode)) return <main data-testid="stage8-status">sound_not_found</main>

  return (
    <main style={{minHeight: '100vh', background: '#243038', color: '#fff', padding: 24}}>
      <div data-testid="stage8-status">{status}</div>
      <div data-testid="stage8-result">{result ? JSON.stringify(result) : ''}</div>
      {status === 'ready' && mode === 'annotation' && (
        <AnnotationPanel
          sound={sound}
          zone={sound.game_zone}
          participantId={identity.participantId}
          sessionId={identity.groupId}
          onClose={(reason) => setResult({kind: 'annotation-close', reason})}
          onComplete={finishAnnotation}
        />
      )}
      {status === 'ready' && mode === 'museum' && (
        <div style={{height: '88vh'}}>
          <SoundMuseum
            sound={sound}
            zone={sound.game_zone}
            participantId={identity.participantId}
            sessionId={identity.groupId}
            zoneCounts={{}}
            onDone={async () => {
              setResult({kind: 'vote', done: true})
              await flushEvents()
              setStatus('done')
            }}
            onExit={() => setResult({kind: 'museum-close'})}
          />
        </div>
      )}
      {status === 'ready' && mode === 'isolation' && <button onClick={runIsolationProbe}>Run isolation probe</button>}
      {status === 'ready' && ['progress', 'vote-progress'].includes(mode) && <button onClick={runProgressProbe}>Check canonical exclusion</button>}
      {status === 'ready' && mode === 'duo' && <DuoProbe token={params.get('token')} />}
      {status === 'ready' && mode === 'room' && <InteriorDecorRoom participantId={identity.participantId} />}
      {status === 'ready' && mode === 'room-boundary' && <button onClick={runRoomBoundaryProbe}>Run room boundary probe</button>}
      {feedback && <FeedbackPanel zone={sound.game_zone} onClose={() => setFeedback(false)} />}
    </main>
  )
}
