import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { decimal } from '../../lib/css'
import { hexColor, numberBetween } from '../../lib/schema'
import { arbitrary } from '../../lib/tailwind'

export const filters = {
  blur: [0, 30, 0, 'px'], brightness: [0, 250, 100, '%'], contrast: [0, 250, 100, '%'],
  grayscale: [0, 100, 0, '%'], hueRotate: [-360, 360, 0, 'deg'], invert: [0, 100, 0, '%'],
  opacity: [0, 100, 100, '%'], saturate: [0, 300, 100, '%'], sepia: [0, 100, 0, '%'],
} as const
export const filterKeys = Object.keys(filters) as (keyof typeof filters)[]
export const samples = ['landscape', 'portrait', 'transparent'] as const
const schema = v.strictObject({
  target: v.picklist(['filter', 'backdrop-filter']), sample: v.picklist(samples),
  blur: numberBetween(0, 30), brightness: numberBetween(0, 250), contrast: numberBetween(0, 250),
  grayscale: numberBetween(0, 100), hueRotate: numberBetween(-360, 360), invert: numberBetween(0, 100),
  opacity: numberBetween(0, 100), saturate: numberBetween(0, 300), sepia: numberBetween(0, 100),
  dropShadow: v.strictObject({ enabled: v.boolean(), x: numberBetween(-40, 40), y: numberBetween(-40, 40),
    blur: numberBetween(0, 40), color: hexColor }),
})
export type FilterState = v.InferOutput<typeof schema>
function initial(patch: Partial<FilterState> = {}): FilterState {
  return { target: 'filter', sample: 'landscape', blur: 0, brightness: 100, contrast: 100, grayscale: 0,
    hueRotate: 0, invert: 0, opacity: 100, saturate: 100, sepia: 0,
    dropShadow: { enabled: false, x: 5, y: 8, blur: 12, color: '#1b4034' }, ...patch }
}
function parts(state: FilterState) {
  const list = filterKeys.filter(key => state[key] !== filters[key][2]).map(key => {
    const name = key === 'hueRotate' ? 'hue-rotate' : key
    return name + '(' + decimal(state[key]) + filters[key][3] + ')'
  })
  const d = state.dropShadow
  if (d.enabled && state.target === 'filter') list.push('drop-shadow(' + d.x + 'px ' + d.y + 'px ' + d.blur + 'px ' + d.color + ')')
  return list
}
export const effect = (state: FilterState) => parts(state).join(' ') || 'none'
function tailwind(state: FilterState) {
  const prefix = state.target === 'backdrop-filter' ? 'backdrop-' : ''
  const list = parts(state)
  if (!list.length) return prefix + 'filter-none'
  if (list.length === 1) {
    const key = filterKeys.find(key => state[key] !== filters[key][2])
    if (key) {
      const utility = key === 'hueRotate' ? 'hue-rotate' : key
      return arbitrary(prefix + utility, decimal(state[key]) + filters[key][3])
    }
  }
  return arbitrary(state.target, list.join(' '))
}
export const logic = defineTool<FilterState>({
  id: 'filter', schema, defaultState: initial,
  outputs: { css: state => state.target + ': ' + effect(state) + ';', tailwind },
  presets: [
    { id: 'vintage', name: 'Vintage', builtin: true, state: initial({ sepia: 60, contrast: 89, saturate: 80 }) },
    { id: 'noir', name: 'Noir B/N', builtin: true, state: initial({ grayscale: 100, contrast: 145 }) },
    { id: 'cyberpunk', name: 'Cyberpunk', builtin: true, state: initial({ hueRotate: 120, saturate: 185, contrast: 122 }) },
    { id: 'warm', name: 'Cálido', builtin: true, state: initial({ sepia: 25, saturate: 140, brightness: 108 }) },
    { id: 'glass', name: 'Cristal esmerilado', builtin: true, state: initial({ target: 'backdrop-filter', blur: 14, saturate: 130 }) },
  ],
})
