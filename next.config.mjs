/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.17.37.19'],
  // Visual QA uses pixel-normalized captures; the development badge must not
  // become part of those screenshots. Compile/runtime error overlays remain.
  devIndicators: false,
  // Local visual QA can run beside an already-open developer server without
  // sharing its .next lock/cache. Normal dev/build/start keep the default.
  ...(process.env.NEXT_NATURE_QA === '1' ? { distDir: '.next-nature-qa' }
    : process.env.NEXT_AUDIO_QA === '1' ? { distDir: '.next-audio-qa' } : {}),
  experimental: {
    // 이미 뭔가 있으면 그 아래에 추가
  },
}

export default nextConfig
