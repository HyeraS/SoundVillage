// Local playtest switch. Development mode must match production progression by
// default; opt in explicitly only for disposable local visual checks.
export const TEMPORARILY_UNLOCK_ALL_CONTENT = process.env.NODE_ENV === 'development'
  && process.env.NEXT_PUBLIC_TEMPORARILY_UNLOCK_ALL_CONTENT === 'true'

// Explicitly injected only into disposable browser-rehearsal builds. This
// opens navigation/test entry points without enabling local-only persistence.
export const INTERNAL_BROWSER_QA = process.env.NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA === 'true'
