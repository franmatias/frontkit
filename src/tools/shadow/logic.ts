import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { decimal, px } from '../../lib/css'
import { hexColor, identifier, numberBetween, percentage } from '../../lib/schema'
import { arbitrary } from '../../lib/tailwind'

const layerSchema = v.strictObject({
  id: identifier, enabled: v.boolean(), inset: v.boolean(), offsetX: numberBetween(-100, 100),
  offsetY: numberBetween(-100, 100), blur: numberBetween(0, 150), spread: numberBetween(-50, 100),
  color: hexColor, opacity: percentage,
})
const schema = v.strictObject({
  mode: v.picklist(['box', 'text']),
  layers: v.pipe(v.array(layerSchema), v.minLength(1), v.maxLength(12),
    v.check(items => new Set(items.map(item => item.id)).size === items.length)),
  previewConfig: v.strictObject({
    backdrop: hexColor, element: hexColor, textColor: hexColor, radius: numberBetween(0, 100),
    sampleText: v.pipe(v.string(), v.maxLength(100)), shape: v.picklist(['square', 'card', 'circle']),
  }),
})

export type ShadowState = v.InferOutput<typeof schema>
export type Layer = ShadowState['layers'][number]
export const layer = (id: string, data: Partial<Layer> = {}): Layer => ({
  id, enabled: true, inset: false, offsetX: 0, offsetY: 7, blur: 20,
  spread: -5, opacity: 28, color: '#24382d', ...data,
})
export function initial(layers = [layer('initial')], options: Partial<ShadowState['previewConfig']> = {}): ShadowState {
  return {
    mode: 'box', layers,
    previewConfig: { backdrop: '#e8eee7', element: '#ffffff', textColor: '#183d32', radius: 20,
      sampleText: 'FrontKit', shape: 'card', ...options },
  }
}
export const cssProperty = (state: ShadowState) => state.mode + '-shadow'

function serialize(item: Layer, text: boolean) {
  const channels = [1, 3, 5].map(offset => Number.parseInt(item.color.slice(offset, offset + 2), 16))
  const color = item.opacity === 100 ? item.color : 'rgb(' + channels.join(' ') + ' / ' + decimal(item.opacity) + '%)'
  return [
    ...(!text && item.inset ? ['inset'] : []), px(item.offsetX), px(item.offsetY), px(item.blur),
    ...(!text && item.spread ? [px(item.spread)] : []),
    color,
  ].join(' ')
}
export function shadow(state: ShadowState) {
  return state.layers.filter(item => item.enabled).map(item => serialize(item, state.mode === 'text')).join(', ') || 'none'
}

type ScaleLayer = [y: number, blur: number, spread?: number]
const boxScale: [string, number, ScaleLayer[]][] = [
  ['2xs', 5, [[1, 0]]], ['xs', 5, [[1, 2]]],
  ['sm', 10, [[1, 3], [1, 2, -1]]], ['md', 10, [[4, 6, -1], [2, 4, -2]]],
  ['lg', 10, [[10, 15, -3], [4, 6, -4]]], ['xl', 10, [[20, 25, -5], [8, 10, -6]]],
  ['2xl', 25, [[25, 50, -12]]],
]
const insetScale: typeof boxScale = [
  ['2xs', 5, [[1, 0]]], ['xs', 5, [[1, 1]]], ['sm', 5, [[2, 4]]],
]
const textScale: typeof boxScale = [
  ['2xs', 15, [[1, 0]]], ['xs', 20, [[1, 1]]],
  ['sm', 7.5, [[1, 0], [1, 1], [2, 2]]], ['md', 10, [[1, 1], [1, 2], [2, 4]]],
  ['lg', 10, [[1, 2], [3, 2], [4, 8]]],
]

function tailwind(state: ShadowState) {
  const items = state.layers.filter(item => item.enabled)
  const value = shadow(state)
  const text = state.mode === 'text'
  if (!items.length) return text ? 'text-shadow-none' : 'shadow-none'
  const inset = !text && items.every(item => item.inset)
  const utility = text ? 'text-shadow' : inset ? 'inset-shadow' : 'shadow'
  const scale = text ? textScale : inset ? insetScale : boxScale
  const match = scale.find(([, opacity, layers]) => items.length === layers.length && items.every((item, index) => {
    const [offsetY, blur, spread = 0] = layers[index]
    return item.color === '#000000' && item.opacity === opacity && item.offsetX === 0
      && item.offsetY === offsetY && item.blur === blur
      && (text || (item.inset === inset && item.spread === spread))
  }))
  return match ? utility + '-' + match[0] : arbitrary(text ? 'text-shadow' : 'shadow', value)
}

const designs: [string, ShadowState][] = [
  ['soft-1', initial([layer('a', { offsetY: 2, blur: 5, spread: 0, opacity: 18 })])],
  ['soft-2', initial()],
  ['soft-3', initial([layer('a', { offsetY: 12, blur: 30, opacity: 25 })])],
  ['soft-4', initial([layer('a', { offsetY: 25, blur: 40, spread: -10, opacity: 30 })])],
  ['light', initial([layer('a', { offsetX: 10, offsetY: 10, color: '#8b9e94' }), layer('b', { offsetX: -9, offsetY: -9, color: '#ffffff', opacity: 95 })], { backdrop: '#e1ebe4', element: '#e1ebe4' })],
  ['dark', initial([layer('a', { offsetX: 10, offsetY: 10, color: '#000000', opacity: 72 }), layer('b', { offsetX: -8, offsetY: -8, color: '#66857c' })], { backdrop: '#20352d', element: '#20352d', textColor: '#ffffff' })],
  ['brutal', initial([layer('a', { offsetX: 9, offsetY: 9, blur: 0, spread: 0, opacity: 100, color: '#111713' })], { element: '#c4f263', radius: 0 })],
  ['neon', initial([layer('a', { offsetY: 0, blur: 40, spread: 7, opacity: 65, color: '#40f4bf' })], { backdrop: '#09211d', element: '#257060', textColor: '#ffffff' })],
  ['floating', initial([layer('a', { offsetY: 20, blur: 27, spread: -8 }), layer('b', { offsetY: 4, blur: 8, opacity: 18 })])],
]
export const logic = defineTool<ShadowState>({
  id: 'shadow', schema, defaultState: initial,
  outputs: { css: state => cssProperty(state) + ': ' + shadow(state).replaceAll(', ', ',\n  ') + ';', tailwind },
  presets: designs.map(([id, state]) => ({ id, state, builtin: true, nameKey: 'detail.shadow.presets.' + id })),
  random: () => initial([layer('random', {
    offsetX: Math.floor(Math.random() * 41) - 20, offsetY: Math.floor(Math.random() * 32),
    blur: Math.floor(Math.random() * 61), opacity: Math.floor(Math.random() * 51) + 20,
  })]),
})
