import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  T, MAP_W, MAP_H, COLLIDERS, CLEARANCE_TILES, PRIMARY_SLOTS, SPAWN, EXIT_TRIGGER,
} from '../../../lib/musicVillageConfig.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT = path.join(ROOT, 'design/2d-map-redesign/previews/music-moonlit-v3')
const PRODUCTION = path.join(OUT, 'production-overview.png')
const EMISSIVE_OFF = path.join(OUT, 'emissive-off-readability.png')
const STYLEFRAME = path.join(ROOT, 'design/concepts/music-village-cozy-2026-09-17/01-moonlit-concert-garden-v2-music.png')
const W = MAP_W * T, H = MAP_H * T
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)

async function main() {
  const collision = COLLIDERS.filter((r) => !r.tag.startsWith('map-')).map((r) => (
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#ff315f" fill-opacity=".32" stroke="#ff8aa5" stroke-width="2"/>`
  )).join('')
  const clearances = CLEARANCE_TILES.map((r) => (
    `<rect x="${r.x*T}" y="${r.y*T}" width="${r.w*T}" height="${r.h*T}" fill="#35e7a8" fill-opacity=".22" stroke="#82ffd7" stroke-width="3" stroke-dasharray="9 5"/>`
  )).join('')
  const slots = PRIMARY_SLOTS.map(({ tx, ty }) => `<circle cx="${tx*T+16}" cy="${ty*T+16}" r="6" fill="#42d5df" stroke="#07152f" stroke-width="2"/>`).join('')
  const spawn = `<rect x="${SPAWN.x-10}" y="${SPAWN.y-14}" width="20" height="14" fill="#ffe69a" stroke="#07152f" stroke-width="2"/>`
  const exit = `<rect x="${EXIT_TRIGGER.x}" y="${EXIT_TRIGGER.y}" width="${EXIT_TRIGGER.w}" height="${EXIT_TRIGGER.h}" fill="#b17bd8" fill-opacity=".5" stroke="#ead2ff" stroke-width="2"/>`
  await sharp(PRODUCTION).composite([{ input: svg(W,H,collision+clearances+slots+spawn+exit), left:0, top:0 }]).png().toFile(path.join(OUT,'collision-entrance-sound-slot-overlay.png'))

  const source = await sharp(STYLEFRAME).resize(700,525,{fit:'fill',kernel:'nearest'}).png().toBuffer()
  const result = await sharp(PRODUCTION).resize(700,525,{fit:'fill',kernel:'nearest'}).png().toBuffer()
  const comparison = svg(1480,610,'<rect width="1480" height="610" fill="#07152f"/><text x="40" y="40" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">ATTACHED STYLEFRAME</text><text x="760" y="40" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">PRODUCTION MASTER · example orbs removed</text>')
  await sharp(comparison).composite([{input:source,left:40,top:60},{input:result,left:760,top:60}]).png().toFile(path.join(OUT,'styleframe-production-comparison.png'))

  const on = await sharp(PRODUCTION).resize(700,525,{fit:'fill',kernel:'nearest'}).png().toBuffer()
  const off = await sharp(EMISSIVE_OFF).resize(700,525,{fit:'fill',kernel:'nearest'}).png().toBuffer()
  const lightBoard = svg(1480,610,'<rect width="1480" height="610" fill="#07152f"/><text x="40" y="40" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">EMISSIVE ON</text><text x="760" y="40" fill="#ffe6a0" font-family="Arial" font-size="22" font-weight="700">EMISSIVE REDUCED · path and boundaries remain readable</text>')
  await sharp(lightBoard).composite([{input:on,left:40,top:60},{input:off,left:760,top:60}]).png().toFile(path.join(OUT,'emissive-on-off-comparison.png'))
  console.log(`Moonlit v3 QA previews -> ${OUT}`)
}

main().catch((error)=>{console.error(error);process.exitCode=1})
