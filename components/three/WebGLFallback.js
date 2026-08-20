'use client'

import Link from 'next/link'

export default function WebGLFallback({ reason = '이 브라우저에서 WebGL을 시작할 수 없습니다.' }) {
  return (
    <main className="fallbackScreen" data-testid="webgl-fallback">
      <div className="fallbackCard">
        <div className="fallbackIcon">🎧</div>
        <h1>3D 마을을 열 수 없어요</h1>
        <p>{reason}</p>
        <p>그래픽 가속을 켜거나 최신 브라우저에서 다시 시도해 주세요. 기존 2D 게임은 계속 이용할 수 있습니다.</p>
        <Link href="/">2D SoundVillage로 돌아가기</Link>
      </div>
    </main>
  )
}
