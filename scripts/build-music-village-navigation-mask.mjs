import {
  getVillageWalkableMaskTarget,
  writeWalkableMaskModules,
} from '../lib/villageWalkableMaskPipeline.mjs'

const check = process.argv.includes('--check')
const [result] = await writeWalkableMaskModules(
  [getVillageWalkableMaskTarget('music')],
  { check },
)

console.log(JSON.stringify({ ok: true, mode: check ? 'check' : 'write', ...result }, null, 2))
