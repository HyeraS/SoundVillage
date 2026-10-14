export const INTERNAL_TEST_ROUTES = Object.freeze([
  '/animal-test',
  '/audio-reliability-test',
  '/attendance-test',
  '/character-studio-test',
  '/daily-quest-test',
  '/economy-v1-character-preview',
  '/fence-test',
  '/house-decor-test',
  '/human-village-test',
  '/interior-test',
  '/lab-observatory-art-preview',
  '/lab-observatory-cohesion-preview',
  '/lab-observatory-identity-preview',
  '/lab-observatory-pixel-preview',
  '/lab-test',
  '/lab-whitebox-preview',
  '/library-test',
  '/music-responsive-test',
  '/music-test',
  '/music-whitebox-preview',
  '/nature-test',
  '/stage8-e2e-test',
  '/urban-art-preview',
  '/urban-sprite-test',
  '/urban-test',
])

export function areInternalTestRoutesEnabled({
  nodeEnv = process.env.NODE_ENV,
  enableInternalTestRoutes = process.env.ENABLE_INTERNAL_TEST_ROUTES,
} = {}) {
  return nodeEnv === 'development' && enableInternalTestRoutes === 'true'
}
