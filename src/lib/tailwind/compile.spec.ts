import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'
import { logic as border } from '../../tools/border/logic'
import { convert, defaults } from '../../tools/css-converter/logic'
import { defaults as queries, tailwind as queryClasses } from '../../tools/container-queries/logic'
import { defaults as transitions, tailwind as motionClasses } from '../../tools/transitions/logic'
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

it('compiles the converter output against the installed Tailwind theme', async () => {
  const converted = convert('.example{display:flex;padding:1rem;letter-spacing:.2em!important}', {
    ...defaults(), target: 'tailwind-apply',
  })
  const compiler = await compile('@import "tailwindcss/theme.css"; ' + converted.css, {
    base: root,
    async loadStylesheet(id, base) {
      const path = resolve(base, id.replace(/^tailwindcss\//, ''))
      return { content: await readFile(path, 'utf8'), base: dirname(path), path }
    },
  })
  const css = compiler.build([])
  expect(css).toContain('display: flex')
  expect(css).toContain('padding: calc(var(--spacing) * 4)')
  expect(css).toMatch(/letter-spacing: \.2em !important/)
})
it('compiles generated transition and named container classes', () => {
  const motion = motionClasses(transitions()).split(/\s+/)
  const query = queryClasses(queries()).split(/\s+/).filter(candidate => candidate.startsWith('@'))
  for (const candidate of [...motion, ...query]) expect(render([candidate])).toContain('.' + CSS.escape(candidate))
})