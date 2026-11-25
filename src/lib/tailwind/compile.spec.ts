import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'
import { logic as border } from '../../tools/border/logic'
import { logic as gradient } from '../../tools/gradient/logic'
import { logic as shadow } from '../../tools/shadow/logic'

const require = createRequire(import.meta.url)
const root = dirname(require.resolve('tailwindcss/package.json'))
let render: (candidates: string[]) => string
beforeAll(async () => {
  const compiler = await compile('@import "tailwindcss/theme.css"; @tailwind utilities;', {
    base: root,
    async loadStylesheet(id, base) {
      const path = resolve(base, id.replace(/^tailwindcss\//, ''))
      return { content: await readFile(path, 'utf8'), base: dirname(path), path }
    },
  })
  render = candidates => compiler.build(candidates)
})

describe('Tailwind 4.1 output', () => {
  it('compiles every candidate from the initial generators', () => {
    const examples = [
      gradient.outputs.tailwind(gradient.defaultState()),
      gradient.outputs.tailwind({ ...gradient.defaultState(), repeating: true }),
      shadow.outputs.tailwind(shadow.defaultState()),
      shadow.outputs.tailwind({ ...shadow.defaultState(), mode: 'text' }),
      border.outputs.tailwind(border.defaultState()),
    ]
    for (const value of examples) {
      for (const candidate of value.split(' ')) {
        const output = render([candidate])
        expect(output).toContain('.' + CSS.escape(candidate))
      }
    }
  })
  it('emits real declarations for text shadow, 3D and grid template areas', () => {
    const output = render(['text-shadow-sm', 'rotate-x-45', 'transform-3d', "[grid-template-areas:'a_b']"])
    expect(output).toContain('text-shadow:')
    expect(output).toContain('rotateX(45deg)')
    expect(output).toContain('transform-style: preserve-3d')
    expect(output).toMatch(/grid-template-areas: ['"]a b['"]/)
  })
})
