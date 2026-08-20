'use client'

import dynamic from 'next/dynamic'

const SoundVillage3D = dynamic(() => import('./SoundVillage3D'), {
  ssr: false,
  loading: () => <main className="prototypeLoading">3D 마을을 준비하고 있어요…</main>,
})

export default function PrototypeEntry() {
  return <SoundVillage3D />
}
