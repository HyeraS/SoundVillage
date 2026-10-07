// Local playtest switch. This must never grant or persist ownership in a
// production build; it only relaxes client-side gates while running `next dev`.
export const TEMPORARILY_UNLOCK_ALL_CONTENT = process.env.NODE_ENV === 'development'

// Explicitly injected only into disposable browser-rehearsal builds. This
// opens navigation/test entry points without enabling local-only persistence.
export const INTERNAL_BROWSER_QA = process.env.NEXT_PUBLIC_ENABLE_INTERNAL_BROWSER_QA === 'true'
