export function createListeningTimer(now = () => Date.now()) {
  let startedAt = null
  let accumulatedMs = 0

  return {
    start() {
      if (startedAt !== null) {
        accumulatedMs += Math.max(0, now() - startedAt)
      }
      startedAt = now()
    },

    pause() {
      if (startedAt === null) return
      accumulatedMs += Math.max(0, now() - startedAt)
      startedAt = null
    },

    seconds() {
      const activeMs = startedAt === null ? 0 : Math.max(0, now() - startedAt)
      return Number(((accumulatedMs + activeMs) / 1000).toFixed(2))
    },

    reset() {
      startedAt = null
      accumulatedMs = 0
    },
  }
}
