import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { requireLoopbackSupabaseUrl } from './security/local-supabase-guard.mjs'

const baseUrl = process.env.ANIMAL_AUDIO_BASE_URL || 'http://127.0.0.1:3107'
await requireLoopbackSupabaseUrl(baseUrl, 'ANIMAL_AUDIO_BASE_URL')

let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const browserErrors = []
  const audioResponses = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (/\.(mp3|wav|ogg)(?:\?|$)/i.test(response.url())) audioResponses.push(response.status())
  })

  await page.goto(`${baseUrl}/animal-test?walkAnimationQa=1`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="animal-player"]').waitFor({ timeout: 20_000 })
  await page.waitForTimeout(400)

  await page.keyboard.down('ArrowUp')
  try {
    await page.getByText(/소리 전사하기/).last().waitFor({ timeout: 5_000 })
  } finally {
    await page.keyboard.up('ArrowUp')
  }

  await page.keyboard.press('Enter')
  const audioToggle = page.getByTestId('annotation-audio-toggle')
  await audioToggle.waitFor({ timeout: 5_000 })
  await audioToggle.click()
  await page.getByRole('button', { name: '소리 정지' }).waitFor({ timeout: 15_000 })

  assert.equal(await audioToggle.getAttribute('aria-label'), '소리 정지')
  assert.ok(audioResponses.some((status) => status >= 200 && status < 400), 'an audio file response succeeds')
  assert.deepEqual(browserErrors, [])
  console.log(JSON.stringify({ ok: true, flow: 'Animal icon -> Enter -> real audio playing', audioResponses }))
} finally {
  await browser?.close().catch(() => {})
}
