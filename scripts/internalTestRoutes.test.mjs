import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import nextServerTesting from 'next/experimental/testing/server.js'
import { INTERNAL_TEST_ROUTES, areInternalTestRoutesEnabled } from '../lib/internalTestRoutes.mjs'
import { config, proxy } from '../proxy.js'

const { unstable_doesMiddlewareMatch } = nextServerTesting

const INTERNAL_ROUTE_PATTERN = /(^|[-_/])(test|debug|dev|preview)([-_/]|$)/i

test('internal routes are denied by default and in every production build', () => {
  assert.equal(areInternalTestRoutesEnabled({ nodeEnv: 'development' }), false)
  assert.equal(areInternalTestRoutesEnabled({ nodeEnv: 'development', enableInternalTestRoutes: 'TRUE' }), false)
  assert.equal(areInternalTestRoutesEnabled({ nodeEnv: 'production', enableInternalTestRoutes: 'true' }), false)
  assert.equal(areInternalTestRoutesEnabled({ nodeEnv: 'development', enableInternalTestRoutes: 'true' }), true)
})

test('the route inventory and proxy matcher cover every internal app route', async () => {
  const entries = await readdir(new URL('../app/', import.meta.url), { withFileTypes: true })
  const discovered = entries
    .filter((entry) => entry.isDirectory() && INTERNAL_ROUTE_PATTERN.test(entry.name))
    .map((entry) => `/${entry.name}`)
    .sort()

  assert.deepEqual([...INTERNAL_TEST_ROUTES].sort(), discovered)
  for (const route of discovered) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: route }), true, route)
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `${route}/nested` }), true, `${route}/nested`)
  }
  assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/' }), false)
  assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/nature-village' }), false)
  assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/_next/static/chunk.js' }), false)
})

test('blocked proxy response is a non-indexable 404 before page code runs', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousFlag = process.env.ENABLE_INTERNAL_TEST_ROUTES
  try {
    process.env.NODE_ENV = 'production'
    process.env.ENABLE_INTERNAL_TEST_ROUTES = 'true'
    const response = proxy()
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
    if (previousFlag === undefined) delete process.env.ENABLE_INTERNAL_TEST_ROUTES
    else process.env.ENABLE_INTERNAL_TEST_ROUTES = previousFlag
  }
})

test('write-capable E2E pages require an explicit run button', async () => {
  for (const path of ['../app/attendance-test/page.js', '../app/daily-quest-test/page.js']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /if \(!runRequested\) return/)
    assert.match(source, /onClick=\{\(\) => setRunRequested\(true\)\}/)
  }
})
