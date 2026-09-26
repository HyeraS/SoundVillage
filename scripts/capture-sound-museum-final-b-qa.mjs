import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const outputRoot = path.join(root, 'design/2d-map-redesign/previews/sound-museum-final-b')
const origin = process.env.MUSEUM_QA_ORIGIN || 'http://127.0.0.1:3002'
const viewports = [
  { name:'1280x720', width:1280, height:720, dpr:1 },
  { name:'1440x900', width:1440, height:900, dpr:1 },
  { name:'1920x1080', width:1920, height:1080, dpr:1 },
  { name:'2560x1440', width:1280, height:720, dpr:2 },
  { name:'844x390', width:844, height:390, dpr:1 },
]
const states = [
  ['01-entrance-clean', 'qa=clean&state=partial'],
  ['02-left-listening-access', 'qa=clean&state=partial&walk=up:800,left:1500'],
  ['03-vote-card', 'qa=clean&state=partial&open=vote'],
  ['04-center-owl-ledger-access', 'qa=clean&state=partial&walk=up:1000'],
  ['05-exhibits-card', 'qa=clean&state=partial&open=exhibits'],
  ['06-right-shop-access', 'qa=clean&state=partial&walk=up:800,right:1500'],
  ['07-shop-card', 'qa=clean&state=partial&open=shop'],
  ['08-collision-overlay', 'qa=collision&state=partial'],
  ['09-foreground-depth', 'qa=depth&state=partial&walk=up:500'],
]

const browser = await chromium.launch({ headless:true })
const report = []
try {
  for (const viewport of viewports) {
    const directory = path.join(outputRoot, viewport.name)
    await mkdir(directory, { recursive:true })
    const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, deviceScaleFactor:viewport.dpr })
    const page = await context.newPage()
    const errors = []
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('pageerror', error => errors.push(error.message))
    for (const [name, query] of states) {
      await page.goto(`${origin}/library-test?${query}`, { waitUntil:'networkidle' })
      await page.waitForSelector('[data-museum-qa]')
      await page.waitForTimeout(650)
      const file = path.join(directory, `${name}.png`)
      await page.screenshot({ path:file, fullPage:false })
      report.push({ viewport:viewport.name, cssViewport:`${viewport.width}x${viewport.height}`, dpr:viewport.dpr, state:name, file:path.relative(root, file) })
    }
    if (errors.length) report.push({ viewport:viewport.name, errors:[...new Set(errors)] })
    await context.close()
  }
} finally {
  await browser.close()
}

await writeFile(path.join(outputRoot, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(`Captured ${report.filter(item => item.file).length} Sound Museum QA screenshots.`)
