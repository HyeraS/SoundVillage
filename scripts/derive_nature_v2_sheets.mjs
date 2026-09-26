import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
const source = join(root, 'design/concepts/nature-farm-2026-09-01/generated-source-v2/grass-path-clean-v2.png')
const treeSource = join(root, 'design/concepts/nature-farm-2026-09-01/generated-source-v2/trees-clean-v2.png')
const runtime = join(root, 'public/assets/world/nature-farm-v2')
const work = mkdtempSync(join(tmpdir(), 'nature-v2-sheet-'))

const run = (...args) => execFileSync('magick', args, { encoding: 'utf8' })

try {
  const components = run(
    source, '-alpha', 'extract', '-threshold', '1',
    '-define', 'connected-components:verbose=true', '-connected-components', '4', 'null:',
  )
    .split('\n')
    .map((line) => line.match(/^\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+).*?\s(\d+)\s+srgb\(255,255,255\)$/))
    .filter(Boolean)
    .map((match) => ({
      w: Number(match[1]), h: Number(match[2]), x: Number(match[3]), y: Number(match[4]), area: Number(match[5]),
    }))
    .filter((box) => box.area > 20000 && box.w < 200 && box.h < 200)
    .sort((a, b) => a.y - b.y || a.x - b.x)

  if (components.length !== 33) throw new Error(`Expected 33 generated cells, found ${components.length}`)

  const cells = components.map((box, index) => {
    const path = join(work, `cell-${String(index).padStart(2, '0')}.png`)
    run(
      source, '-crop', `${box.w}x${box.h}+${box.x}+${box.y}`, '+repage', '-shave', '2x2',
      '-fuzz', '6%', '-transparent', 'white',
      '-filter', 'point', '-resize', '32x32!',
      '-background', '#B4CC26', '-alpha', 'remove', '-alpha', 'off', path,
    )
    return path
  })

  const joinSheet = (inputCells, columns, output) => {
    const rows = []
    for (let index = 0; index < inputCells.length; index += columns) {
      const rowCells = inputCells.slice(index, index + columns)
      while (rowCells.length < columns) {
        const blank = join(work, `blank-${rows.length}-${rowCells.length}.png`)
        run('-size', '32x32', 'xc:none', blank)
        rowCells.push(blank)
      }
      const row = join(work, `row-${rows.length}.png`)
      run(...rowCells, '+append', '+repage', row)
      rows.push(row)
    }
    run(...rows, '-append', '+repage', output)
  }

  joinSheet(cells.slice(0, 16), 8, join(runtime, 'grass-v2.png'))
  joinSheet(cells.slice(16), 8, join(runtime, 'path-v2.png'))
  console.log('Derived grass-v2.png (8×2 cells) and path-v2.png (8×3 cells) from 33 connected generated cells.')

  const treeComponents = run(
    treeSource, '-alpha', 'extract', '-threshold', '1',
    '-define', 'connected-components:verbose=true', '-connected-components', '4', 'null:',
  )
    .split('\n')
    .map((line) => line.match(/^\s*\d+:\s+(\d+)x(\d+)\+(\d+)\+(\d+).*?\s(\d+)\s+srgb\(255,255,255\)$/))
    .filter(Boolean)
    .map((match) => ({
      w: Number(match[1]), h: Number(match[2]), x: Number(match[3]), y: Number(match[4]), area: Number(match[5]),
    }))
    .filter((box) => box.area > 20000)

  const extractTrees = (boxes, name) => {
    const paths = boxes.sort((a, b) => a.x - b.x).map((box, index) => {
      const path = join(work, `${name}-${index}.png`)
      run(
        treeSource, '-crop', `${box.w}x${box.h}+${box.x}+${box.y}`, '+repage',
        '-filter', 'point', '-resize', '112x128>', '-gravity', 'south', '-background', 'none', '-extent', '112x128', path,
      )
      return path
    })
    run(...paths, '+append', '+repage', join(runtime, `${name}-v2.png`))
  }

  extractTrees(treeComponents.filter((box) => box.y < 300), 'trees')
  const forestPairs = [
    [{ x: 100, y: 403, w: 179, h: 172 }, { x: 145, y: 592, w: 110, h: 65 }],
    [{ x: 330, y: 403, w: 175, h: 174 }, { x: 376, y: 592, w: 109, h: 65 }],
  ]
  const forestCells = forestPairs.map(([crown, trunk], index) => {
    const crownPath = join(work, `forest-crown-${index}.png`)
    const trunkPath = join(work, `forest-trunk-${index}.png`)
    const output = join(work, `forest-${index}.png`)
    run(treeSource, '-crop', `${crown.w}x${crown.h}+${crown.x}+${crown.y}`, '+repage', '-filter', 'point', '-resize', '112x96!', crownPath)
    run(treeSource, '-crop', `${trunk.w}x${trunk.h}+${trunk.x}+${trunk.y}`, '+repage', '-filter', 'point', '-resize', '56x34!', trunkPath)
    run('-size', '112x128', 'xc:none', crownPath, '-geometry', '+0+0', '-composite', trunkPath, '-geometry', '+28+94', '-composite', output)
    return output
  })
  run(...forestCells, '+append', '+repage', join(runtime, 'forest-trees-v2.png'))
  extractTrees(treeComponents.filter((box) => box.y >= 650), 'apple-trees')
  console.log('Derived trees-v2.png (6), forest-trees-v2.png (2), and apple-trees-v2.png (3) at 112×128 per cell.')
} finally {
  rmSync(work, { recursive: true, force: true })
}
