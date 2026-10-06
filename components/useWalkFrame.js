'use client'

import { useEffect, useState } from 'react'

export const WALK_FRAME_COUNT = 8
export const WALK_FRAME_INTERVAL_MS = 100

export function useWalkFrame(moving) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    if (!moving) return undefined

    const reset = window.setTimeout(() => setFrameIndex(0), 0)

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % WALK_FRAME_COUNT)
    }, WALK_FRAME_INTERVAL_MS)

    return () => {
      window.clearTimeout(reset)
      window.clearInterval(interval)
    }
  }, [moving])

  return moving ? frameIndex : 0
}
