import { notFound } from 'next/navigation'
import CharacterStudioTestHarness from './CharacterStudioTestHarness'
import { areInternalTestRoutesEnabled } from '@/lib/internalTestRoutes.mjs'

export const dynamic = 'force-dynamic'

export default async function CharacterStudioTestPage({ searchParams }) {
  if (!areInternalTestRoutesEnabled()) notFound()
  const requested = (await searchParams).mode
  const mode = ['qa', 'legacy', 'cutover'].includes(requested) ? requested : 'qa'
  return <main style={{ width:'100vw', height:'100dvh', overflow:'hidden', padding:12, background:'#332215' }}>
    <CharacterStudioTestHarness mode={mode}/>
  </main>
}
