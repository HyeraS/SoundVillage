'use client'
import ZoneMap from '@/components/ZoneMap'
import soundMetadata from '@/data/sound_metadata.json'

// 격리된 Urban Zone 리스킨 테스트 — 실제 게임 흐름(app/page.js, WorldMap 내비게이션)은
// 건드리지 않는다. fence-test/library-test와 같은 패턴: 순수 시각 검증 전용 페이지.
// 실제 sound_metadata.json의 Urban 소리를 그대로 써서(mock 아님) block 격자/스폰이
// 실제 게임과 동일하게 계산되도록 한다.
const urbanSounds = (soundMetadata.sounds || []).filter(s => s.game_zone === 'Urban')

export default function UrbanTestPage() {
  return (
    <ZoneMap
      zone="Urban"
      sounds={urbanSounds}
      onCollectSound={() => {}}
      onExit={() => {}}
      collectedIds={new Set()}
      blockNum={1}
      blockTotal={1}
    />
  )
}
