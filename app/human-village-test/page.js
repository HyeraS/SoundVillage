'use client'
import { useEffect, useMemo, useState } from 'react'
import HumanZoneMap from '@/components/HumanZoneMap'
import AnnotationPanel from '@/components/AnnotationPanel'
import soundMetadata from '@/data/sound_metadata.json'
import { WALK_ANIMATION_QA_CHARACTER } from '@/lib/walkAnimationQa.mjs'

// Permanent, write-free QA route. It uses the exact production Group A Human
// sound objects; no mock sound IDs or hard-coded marker count.
const humanSounds = (soundMetadata.sounds || []).filter((sound) => sound.game_zone === 'Human' && sound.group === 'A')

export default function HumanVillageTestPage() {
  const [options, setOptions] = useState({ block: 6, overview: false, collision: false, spawns: false, staticArt: false, start: null, worldScale: 1, firstItem: false })
  const [activeSound, setActiveSound] = useState(null)
  const [collectedIds, setCollectedIds] = useState(new Set())
  const [walkAnimationQa, setWalkAnimationQa] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search)
      setWalkAnimationQa(query.get('walkAnimationQa') === '1')
      const [tx, ty] = (query.get('start') || '').split(',').map(Number)
      const startX = Number(query.get('startX'))
      const startY = Number(query.get('startY'))
      setOptions({
        block: Math.max(1, Math.min(6, Number(query.get('block')) || 6)),
        overview: query.get('overview') === '1',
        collision: query.get('collision') === '1',
        spawns: query.get('spawns') === '1',
        staticArt: query.get('static') === '1',
        start: query.has('startX') && query.has('startY') && Number.isFinite(startX) && Number.isFinite(startY)
          ? { x: startX, y: startY }
          : Number.isFinite(tx) && Number.isFinite(ty) ? { tx, ty } : null,
        worldScale: Math.max(0.25, Number(query.get('worldScale')) || 1),
        firstItem: query.get('firstItem') === '1',
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const completed = useMemo(() => {
    if (!options.block || typeof window === 'undefined') return collectedIds
    const query = new URLSearchParams(window.location.search)
    if (query.get('collected') !== '1') return collectedIds
    return new Set(humanSounds.filter((sound) => sound.block === 1).map((sound) => sound.sound_id))
  }, [collectedIds, options.block])

  const finishAnnotation = () => {
    if (activeSound) setCollectedIds((current) => new Set(current).add(activeSound.sound_id))
    setActiveSound(null)
  }

  return (
    <>
      <HumanZoneMap
        {...(walkAnimationQa ? WALK_ANIMATION_QA_CHARACTER : {})}
        sounds={humanSounds}
        onCollectSound={setActiveSound}
        onExit={() => {}}
        collectedIds={completed}
        isAnnotating={!!activeSound}
        blockNum={options.block}
        blockTotal={6}
        debugOverview={options.overview}
        debugCollision={options.collision}
        debugSpawns={options.spawns}
        debugStart={options.start}
        staticArt={options.staticArt}
        debugFirstItem={options.firstItem}
        currentWorldWidth={1536 * options.worldScale}
        currentWorldHeight={1152 * options.worldScale}
      />
      {activeSound && (
        <AnnotationPanel
          sound={activeSound}
          zone="Human"
          participantId="HUMAN_QA_LOCAL"
          sessionId="A"
          dryRun
          onClose={() => setActiveSound(null)}
          onComplete={finishAnnotation}
        />
      )}
    </>
  )
}
