import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { decimal } from '../../lib/css'

export const fonts = {
  sans: 'system-ui, sans-serif', serif: 'Georgia, serif', mono: 'ui-monospace, monospace',
} as const
const range = (min: number, max: number) => v.pipe(v.number(), v.minValue(min), v.maxValue(max))
const schema = v.strictObject({
  font: v.picklist(['sans','serif','mono']), size: range(12, 32), height: range(1, 3),
  letter: range(0, .3), word: range(0, .5), paragraph: range(0, 4), width: range(25, 105),
  sharedText: v.optional(v.pipe(v.string(), v.maxLength(1000))),
})
export type State = v.InferOutput<typeof schema>
export const minimums = { height: 1.5, paragraph: 2, letter: .12, word: .16 } as const
export const options = { size: [12,32,1], height: [1,3,.05], letter: [0,.3,.01], word: [0,.5,.01], paragraph: [0,4,.05], width: [25,105,1] } as const
const em = (amount: number) => decimal(amount) + 'em'
export function style(state: State, simulate = false) {
  const n = (key: keyof typeof minimums) => simulate ? Math.max(state[key], minimums[key]) : state[key]
  return {
    fontFamily: fonts[state.font], fontSize: decimal(state.size) + 'px', lineHeight: n('height'),
    letterSpacing: em(n('letter')), wordSpacing: em(n('word')), maxWidth: decimal(state.width) + 'ch',
    '--paragraph-gap': em(n('paragraph')),
  }
}
export const logic = defineTool<State>({
  id: 'readability', schema, transient: ['sharedText'], defaultState: () => ({
    font: 'sans', size: 18, height: 1.5, letter: 0, word: 0, paragraph: 1, width: 66,
  }),
  outputs: {
    css: s => '.prose {\n  font-family: ' + fonts[s.font] + ';\n  font-size: ' + s.size + 'px;\n  max-width: ' + s.width +
      'ch;\n  line-height: ' + s.height + ';\n  letter-spacing: ' + em(s.letter) + ';\n  word-spacing: ' + em(s.word) +
      ';\n}\n\n.prose p + p { margin-block-start: ' + em(s.paragraph) + '; }',
    tailwind: s => 'font-' + s.font + ' max-w-[' + s.width + 'ch] ' +
      ({ '12': 'text-xs', '14': 'text-sm', '16': 'text-base', '18': 'text-lg', '20': 'text-xl', '24': 'text-2xl' }[s.size] ?? 'text-[' + s.size + 'px]') +
      ' ' + (s.height === 1.625 ? 'leading-relaxed' : s.height === 1.5 ? 'leading-normal' : 'leading-[' + s.height + ']') +
      ' ' + (s.letter === 0 ? 'tracking-normal' : 'tracking-[' + em(s.letter) + ']') +
      (s.word ? ' [word-spacing:' + em(s.word) + ']' : '') + ' [&_p+p]:mt-[' + em(s.paragraph) + ']',
  },
  presets: [],
})
