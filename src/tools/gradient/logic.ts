import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { between, harmony, hexWithAlpha } from '../../lib/color'
import { decimal, pct } from '../../lib/css'
import { hexColor, identifier, numberBetween, percentage } from '../../lib/schema'
import { arbitrary } from '../../lib/tailwind'

export const gradientTypes = ['linear', 'radial', 'conic'] as const
export const spaces = ['default', 'srgb', 'oklab', 'oklch', 'hsl', 'lab', 'lch'] as const
export const hueModes = ['shorter', 'longer', 'increasing', 'decreasing'] as const
export const radialSizes = ['closest-side', 'closest-corner', 'farthest-side', 'farthest-corner'] as const
const stop = v.strictObject({
  id: identifier, color: hexColor, opacity: percentage, position: percentage,
  position2: v.optional(percentage),
})
const schema = v.strictObject({
  type: v.picklist(gradientTypes), repeating: v.boolean(), interpolation: v.picklist(spaces),
  hueMethod: v.picklist(hueModes), angle: numberBetween(0, 360),
  radialShape: v.picklist(['circle', 'ellipse']), radialSize: v.picklist(radialSizes),
  position: v.strictObject({ x: percentage, y: percentage }),
  stops: v.pipe(v.array(stop), v.minLength(2), v.maxLength(20),
    v.check(items => new Set(items.map(item => item.id)).size === items.length)),
  hints: v.pipe(v.array(v.strictObject({ after: identifier, position: percentage })), v.maxLength(19)),
  text: v.boolean(),
})

export type GradientState = v.InferOutput<typeof schema>
export type Stop = GradientState['stops'][number]
export const sortedStops = (state: GradientState) => [...state.stops].sort((a, b) => a.position - b.position)
export const polar = (value: string) => ['oklch', 'hsl', 'lch'].includes(value)
export const newStop = (color: string, position: number, id = crypto.randomUUID()): Stop => ({ id, color, position, opacity: 100 })

function make(colors: string[], angle = 135): GradientState {
  return {
    type: 'linear', repeating: false, interpolation: 'oklab', hueMethod: 'shorter', angle,
    radialShape: 'ellipse', radialSize: 'farthest-corner', position: { x: 50, y: 50 },
    stops: colors.map((color, i) => newStop(color, 100 * i / (colors.length - 1), 'stop-' + i)),
    hints: [], text: false,
  }
}

export function addStop(state: GradientState, position: number) {
  if (state.stops.length >= 20) return
  const sorted = sortedStops(state)
  const right = sorted.findIndex(stop => stop.position >= position)
  const first = right > 0 ? sorted[right - 1] : right === 0 ? sorted[0] : sorted[sorted.length - 1]
  const second = right > 0 ? sorted[right] : first
  const ratio = first.position === second.position ? 0 : (position - first.position) / (second.position - first.position)
  const added = newStop(between(first.color, second.color, ratio), position)
  state.stops.push(added)
  return added.id
}

export function image(state: GradientState) {
  const center = 'at ' + pct(state.position.x) + ' ' + pct(state.position.y)
  const config = {
    linear: decimal(state.angle) + 'deg',
    radial: state.radialShape + ' ' + state.radialSize + ' ' + center,
    conic: 'from ' + decimal(state.angle) + 'deg ' + center,
  }[state.type]
  const interpolation = state.interpolation === 'default' ? '' : ' in ' + state.interpolation
    + (polar(state.interpolation) && state.hueMethod !== 'shorter' ? ' ' + state.hueMethod + ' hue' : '')
  const stops = sortedStops(state)
  const values = stops.flatMap((item, i) => {
    const end = Math.max(item.position, item.position2 ?? item.position)
    const value = hexWithAlpha(item.color, item.opacity) + ' ' + pct(item.position)
      + (item.position2 === undefined ? '' : ' ' + pct(end))
    const hint = state.hints.find(h => h.after === item.id)
    return hint && hint.position > end && hint.position < (stops[i + 1]?.position ?? 0)
      ? [value, pct(hint.position)] : [value]
  })
  return (state.repeating ? 'repeating-' : '') + state.type + '-gradient(' + config + interpolation + ', ' + values.join(', ') + ')'
}

function tailwind(state: GradientState) {
  const stops = sortedStops(state)
  const simple = !state.repeating && state.interpolation === 'oklab' && stops.length <= 3
    && state.hints.length === 0 && stops.every(stop => stop.opacity === 100 && stop.position2 === undefined)
  let classes = [arbitrary('bg', image(state))]
  let utility: string | undefined
  if (simple && state.type === 'linear' && Number.isInteger(state.angle) && state.angle < 360) {
    utility = ({ 0: 'bg-linear-to-t', 90: 'bg-linear-to-r', 180: 'bg-linear-to-b', 270: 'bg-linear-to-l' } as Record<number, string>)[state.angle]
      ?? 'bg-linear-' + state.angle
  }
  if (simple && state.type === 'radial' && state.radialShape === 'ellipse' && state.radialSize === 'farthest-corner' && state.position.x === 50 && state.position.y === 50) utility = 'bg-radial'
  if (simple && state.type === 'conic' && Number.isInteger(state.angle) && state.angle < 360 && state.position.x === 50 && state.position.y === 50) utility = 'bg-conic-' + state.angle
  if (utility) classes = [utility + '/oklab', ...stops.flatMap((stop, index) => {
    const prefix = index === 0 ? 'from' : index === stops.length - 1 ? 'to' : 'via'
    return [arbitrary(prefix, stop.color), arbitrary(prefix, pct(stop.position))]
  })]
  if (state.text) classes.push('bg-clip-text', 'text-transparent')
  return classes.join(' ')
}

const design = [
  ['sunset', ['#5a235f', '#dd516e', '#f8b25d']],
  ['ocean', ['#082449', '#176d9c', '#60d9c5']],
  ['aurora', ['#171344', '#5867cb', '#84ebad']],
  ['neon', ['#391280', '#e220a0', '#64f6dd']],
  ['pastel', ['#f2bddb', '#ded5f7', '#bdebdc']],
  ['dark-mesh', ['#0b1627', '#293044', '#58636a']],
] as const

export const logic = defineTool<GradientState>({
  id: 'gradient', schema, defaultState: () => make([...design[0][1]]),
  outputs: {
    css: state => 'background: ' + image(state) + ';' + (state.text ? '\nbackground-clip: text;\ncolor: transparent;' : ''),
    tailwind,
  },
  presets: design.map(([id, colors]) => ({
    id, nameKey: 'detail.gradient.presets.' + id, state: make([...colors]), builtin: true,
  })),
  random: () => {
    const hue = Math.random() * 360
    return make([harmony(hue, 0.48), harmony(hue + 45, 0.65), harmony(hue + 110, 0.84, 0.14)], Math.floor(Math.random() * 360))
  },
})
