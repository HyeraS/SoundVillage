import CollisionMaskEditor from './CollisionMaskEditor'

export const metadata = {
  title: 'Collision Mask Editor · SoundVillage',
  description: 'SoundVillage 맵용 흑백 이동 가능 영역 편집기',
}

export default function CollisionMaskEditorPage() {
  const enabled = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA === 'true'

  if (!enabled) {
    return (
      <main style={{ minHeight: '100vh', padding: 40, background: '#f4efe5', color: '#302b28' }}>
        <h1>내부 편집 도구가 비활성화되어 있습니다.</h1>
        <p>NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA=true 환경에서만 사용할 수 있습니다.</p>
      </main>
    )
  }

  return <CollisionMaskEditor />
}
