import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function normalizedHostname(url) {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

function isLoopbackAddress(address) {
  if (address === '::1') return true
  if (isIP(address) === 4) return address.startsWith('127.')
  return false
}

export async function requireLoopbackSupabaseUrl(rawUrl, label = 'Supabase URL') {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`${label} must be a valid URL`)
  }

  const hostname = normalizedHostname(parsed)
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(`${label} must use localhost, 127.0.0.1, or ::1`)
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some(({ address }) => !isLoopbackAddress(address))) {
    throw new Error(`${label} resolved outside loopback`)
  }
  return parsed.toString()
}

