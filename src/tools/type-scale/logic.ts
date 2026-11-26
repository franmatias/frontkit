import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { fluidClamp, fluidValue, rounded } from '../../lib/css/fluid'
import { fonts } from '../readability/logic'

export const ratios = [
  ['Minor Second', 1.067], ['Major Second', 1.125], ['Minor Third', 1.2],
  ['Major Third', 1.25], ['Perfect Fourth', 1.333], ['Augmented Fourth', 1.414],
  ['Perfect Fifth', 1.5], ['Golden Ratio', 1.618],
] as const
const range = (min: number, max: number) => v.pipe(v.number(), v.minValue(min), v.maxValue(max))
const integer = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max))
const schema = v.strictObject({
  base: range(8,40), ratio: range(1,2), down: integer(0,3), up: integer(0,10),
  naming: v.picklist(['tailwind','steps']), roundTo: v.union([v.literal(1),v.literal(4)]),
  lineHeight: range(1,2.5), compact: v.boolean(), font: v.picklist(['sans','serif','mono']),
  fluid: v.boolean(), upperBase: range(8,40), upperRatio: range(1,2),
  minViewport: range(160, 3840), maxViewport: range(160, 3840),
})
export type State = v.InferOutput<typeof schema>
export const valid = (state: State) => !state.fluid || state.maxViewport > state.minViewport
export function scaleName(step: number, naming: State['naming']) {
  if (naming === 'steps') return 'step-' + step
  if (step < 0) return step === -1 ? 'xs' : -step + 'xs'
  if (step === 0) return 'base'
  if (step === 1) return 'lg'
  return step === 2 ? 'xl' : step - 1 + 'xl'
}
export const size = (base: number, ratio: number, step: number, roundTo: number) =>
  Math.max(roundTo, Math.round(base * ratio ** step / roundTo) * roundTo)
export function steps(state: State) {
  return Array.from({ length: state.down + state.up + 1 }, (_, i) => {
    const step = i - state.down
    const start = size(state.base, state.ratio, step, state.roundTo)
    const end = size(state.upperBase, state.upperRatio, step, state.roundTo)
    const range = { start, end, minViewport: state.minViewport, maxViewport: state.maxViewport, root: 16, unit: 'rem' as const }
    return { step, name: scaleName(step,state.naming), start, end, range,
      value: state.fluid && valid(state) ? fluidClamp(range) : rounded(start / 16) + 'rem',
      lineHeight: state.compact ? rounded(Math.max(1.02, Math.min(2.5, state.lineHeight - step * .065))) : state.lineHeight }
  })
}
export function previewSize(state: State, step: ReturnType<typeof steps>[number], width: number) {
  return state.fluid && valid(state) ? fluidValue(step.range,width) : step.start
}
const entries = (state: State, prefix: string) => steps(state).flatMap(step => [
  prefix + step.name + ': ' + step.value + ';',
  prefix + step.name + '--line-height: ' + step.lineHeight + ';',
])
export const logic = defineTool<State>({
  id: 'type-scale', schema, defaultState: () => ({
    base:16, ratio:1.25, down:2, up:6, naming:'tailwind', roundTo:1,
    lineHeight:1.55, compact:true, font:'sans', fluid:false, upperBase:19, upperRatio:1.333, minViewport:320, maxViewport:1280,
  }),
  outputs: {
    css: state => valid(state) ? ':root {\n  --font-scale: ' + fonts[state.font] + ';\n  ' + entries(state, '--').join('\n  ') + '\n}' : '',
    tailwind: state => valid(state) ? '@theme {\n  --font-scale: ' + fonts[state.font] + ';\n  ' + entries(state,'--text-').join('\n  ') + '\n}' : '',
    scss: state => valid(state) ? entries(state,'$text-').join('\n') : '',
    json: state => valid(state) ? JSON.stringify({
      font: { $value: fonts[state.font].split(', '), $type: 'fontFamily', $description: 'Pila tipográfica' },
      scale: Object.fromEntries(steps(state).map(step => [step.name, {
        size: { $value: { value: step.start, unit: 'px' }, $type: 'dimension', $description: 'Tamaño al inicio del intervalo',
          ...(state.fluid ? { $extensions: { 'frontkit.css': { fluid: step.value } } } : {}) },
        lineHeight: { $value: step.lineHeight, $type: 'number', $description: 'Interlineado unitario' },
      }])),
    }, null, 2) : '',
  },
  presets: [],
})
