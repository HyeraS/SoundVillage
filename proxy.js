import { NextResponse } from 'next/server.js'
import { areInternalTestRoutesEnabled } from './lib/internalTestRoutes.mjs'

export function proxy() {
  if (areInternalTestRoutesEnabled()) return NextResponse.next()

  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}

// Keep this matcher explicit and limited to internal routes. Next.js statically
// analyzes proxy config, so imported or computed matcher values are unsupported.
export const config = {
  matcher: [
    '/animal-test/:path*',
    '/attendance-test/:path*',
    '/daily-quest-test/:path*',
    '/fence-test/:path*',
    '/house-decor-test/:path*',
    '/human-village-test/:path*',
    '/interior-test/:path*',
    '/lab-observatory-art-preview/:path*',
    '/lab-observatory-cohesion-preview/:path*',
    '/lab-observatory-identity-preview/:path*',
    '/lab-observatory-pixel-preview/:path*',
    '/lab-test/:path*',
    '/lab-whitebox-preview/:path*',
    '/library-test/:path*',
    '/music-responsive-test/:path*',
    '/music-test/:path*',
    '/music-whitebox-preview/:path*',
    '/nature-test/:path*',
    '/stage8-e2e-test/:path*',
    '/urban-art-preview/:path*',
    '/urban-sprite-test/:path*',
    '/urban-test/:path*',
  ],
}
