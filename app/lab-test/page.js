'use client'
import ZoneMap from '@/components/ZoneMap'
import soundMetadata from '@/data/sound_metadata.json'

// 격리된 Lab Zone("미지의 소리 마을") 코너 재배치 테스트 — 실제 게임 흐름(app/page.js,
// WorldMap 내비게이션)은 건드리지 않는다. urban-test/fence-test/library-test와 같은
// 패턴: 순수 시각 검증 전용 페이지. 실제 sound_metadata.json의 Lab 소리를 그대로 써서
// block 격자/스폰이 실제 게임과 동일하게 계산되도록 한다.
const labSounds = (soundMetadata.sounds || []).filter(s => s.game_zone === 'Lab')

export default function LabTestPage() {
  return (
    <ZoneMap
      zone="Lab"
      sounds={labSounds}
      onCollectSound={() => {}}
      onExit={() => {}}
      collectedIds={new Set()}
      blockNum={6}
      blockTotal={6}
    />
  )
}
