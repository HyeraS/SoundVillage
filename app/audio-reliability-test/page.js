'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import AnnotationPanel from '@/components/AnnotationPanel'
import SoundMuseum from '@/components/SoundMuseum'
import soundMetadata from '@/data/sound_metadata.json'

const ZONES = ['Animal', 'Human', 'Nature', 'Urban', 'Music', 'Lab']

function AudioReliabilityHarness() {
  const [hydrated, setHydrated] = useState(false)
  const [soundOffset, setSoundOffset] = useState(0)
  const searchParams = useSearchParams()
  const requestedZone = searchParams.get('zone')
  const zone = ZONES.includes(requestedZone) ? requestedZone : 'Animal'
  const group = searchParams.get('group') === 'B' ? 'B' : 'A'
  const mode = searchParams.get('mode') === 'museum' ? 'museum' : 'annotation'
  const sounds = useMemo(() => soundMetadata.sounds.filter(candidate => (
    candidate.game_zone === zone && candidate.group === group
  )), [group, zone])
  const sound = sounds[soundOffset % sounds.length]
  const candidateLoader = useCallback(async () => [
    { id: 'qa-candidate-1', expression_text: '테스트 후보 표현' },
    { id: 'qa-candidate-2', expression_text: '다른 후보 표현' },
  ], [])
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHydrated(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  if (!sound) return <main data-testid="audio-harness-missing">No matching audio fixture</main>

  return (
    <main data-testid="audio-reliability-harness" data-hydrated={hydrated} data-zone={zone} data-group={group} data-sound-id={sound.sound_id}>
      <button type="button" data-testid="audio-fixture-switch" onClick={() => setSoundOffset(offset => offset + 1)}>
        Switch audio fixture
      </button>
      {mode === 'museum' ? (
        <SoundMuseum
          sound={sound}
          zone={zone}
          myExpression="테스트 표현"
          participantId="AUDIO_QA_LOCAL"
          sessionId="AUDIO_QA_SESSION"
          zoneCounts={{}}
          economyMode="legacy"
          dryRun
          candidateLoader={candidateLoader}
          onDone={() => {}}
          onExit={() => {}}
        />
      ) : (
        <AnnotationPanel
          sound={sound}
          zone={zone}
          participantId="AUDIO_QA_LOCAL"
          sessionId="AUDIO_QA_SESSION"
          economyMode="legacy"
          dryRun
          onClose={() => {}}
          onComplete={() => {}}
        />
      )}
    </main>
  )
}

export default function AudioReliabilityTestPage() {
  return <Suspense fallback={null}><AudioReliabilityHarness /></Suspense>
}
