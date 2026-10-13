import {
  listVillageWalkableMaskTargets,
  writeWalkableMaskModules,
} from '../lib/villageWalkableMaskPipeline.mjs'

const check = process.argv.includes('--check')
const results = await writeWalkableMaskModules(
  listVillageWalkableMaskTargets({ includeMusic: false }),
  { check },
)

console.log(JSON.stringify({ ok: true, mode: check ? 'check' : 'write', masks: results }, null, 2))
