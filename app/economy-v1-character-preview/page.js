import { notFound } from 'next/navigation'
import EconomyV1CharacterPreview from './EconomyV1CharacterPreview'
import { areInternalTestRoutesEnabled } from '@/lib/internalTestRoutes.mjs'

export const dynamic = 'force-dynamic'

export default function EconomyV1CharacterPreviewPage() {
  if (!areInternalTestRoutesEnabled()) notFound()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const localDatabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(?:\/|$)/.test(supabaseUrl)
  return <EconomyV1CharacterPreview localDatabase={localDatabase} />
}
