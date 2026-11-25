import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { hexWithAlpha } from '../../lib/color'
import { decimal, px, shorthand } from '../../lib/css'
import { hexColor, numberBetween, percentage } from '../../lib/schema'
import { arbitrary, property } from '../../lib/tailwind'

export const sides = ['top', 'right', 'bottom', 'left'] as const
export const units = ['px', '%', 'rem'] as const
export const styles = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'none'] as const
const side = v.strictObject({
  width: numberBetween(0, 32), style: v.picklist(styles), color: hexColor, opacity: percentage,
})
const corners = v.tuple([numberBetween(0, 200), numberBetween(0, 200), numberBetween(0, 200), numberBetween(0, 200)])
const schema = v.strictObject({
  border: v.strictObject({ linked: v.boolean(), top: side, right: side, bottom: side, left: side }),
  radius: v.strictObject({ mode: v.picklist(['simple', 'organic']), unit: v.picklist(units), horizontal: corners, vertical: corners }),
  outline: v.strictObject({
    enabled: v.boolean(), width: numberBetween(0, 32), style: v.picklist(styles),
    color: hexColor, offset: numberBetween(-20, 40),
  }),
})

export type BorderState = v.InferOutput<typeof schema>
export type Side = v.InferOutput<typeof side>
const baseSide = (config: Partial<Side> = {}): Side => ({ width: 2, style: 'solid', color: '#236049', opacity: 100, ...config })
function initial(config: Partial<Side> = {}, radius: Partial<BorderState['radius']> = {}): BorderState {
  return {
    border: { linked: true, top: baseSide(config), right: baseSide(config), bottom: baseSide(config), left: baseSide(config) },
    radius: { mode: 'simple', unit: 'px', horizontal: [20, 20, 20, 20], vertical: [20, 20, 20, 20], ...radius },
    outline: { enabled: false, width: 2, style: 'dashed', color: '#236049', offset: 5 },
  }
}
export function sideValue(side: Side) {
  return px(side.width) + ' ' + side.style + ' ' + hexWithAlpha(side.color, side.opacity)
}
export function radiusValue(state: BorderState) {
  const radius = state.radius
  const dimension = (values: typeof radius.horizontal) => shorthand(values.map(n => decimal(n) + radius.unit) as [string, string, string, string])
  const horizontal = dimension(radius.horizontal)
  const vertical = dimension(radius.vertical)
  return radius.mode === 'simple' || horizontal === vertical ? horizontal : horizontal + ' / ' + vertical
}
export function declarations(state: BorderState): Record<string, string> {
  const top = sideValue(state.border.top)
  const output: Record<string, string> = {}
  if (state.border.linked || sides.every(side => sideValue(state.border[side]) === top)) output.border = top
  else for (const side of sides) output['border-' + side] = sideValue(state.border[side])
  output['border-radius'] = radiusValue(state)
  if (state.outline.enabled) {
    output.outline = px(state.outline.width) + ' ' + state.outline.style + ' ' + state.outline.color
    output['outline-offset'] = px(state.outline.offset)
  }
  return output
}
function tailwind(state: BorderState) {
  const output = declarations(state)
  const radius = output['border-radius']
  delete output['border-radius']
  const standardRadius: Record<string, string> = {
    '0px': 'rounded-none', '0rem': 'rounded-none', '0%': 'rounded-none',
    '0.125rem': 'rounded-xs', '0.25rem': 'rounded-sm', '0.375rem': 'rounded-md',
    '0.5rem': 'rounded-lg', '0.75rem': 'rounded-xl', '1rem': 'rounded-2xl',
    '1.5rem': 'rounded-3xl', '2rem': 'rounded-4xl',
  }
  const edge = state.border.top
  const edges = ['solid', 'dashed', 'dotted', 'double', 'none']
  const border = output.border && edges.includes(edge.style) && Number.isInteger(edge.width)
    ? ['border-' + edge.width, 'border-' + edge.style, arbitrary('border', hexWithAlpha(edge.color, edge.opacity))]
    : []
  if (border.length) delete output.border
  if (state.outline.enabled && Number.isInteger(state.outline.offset)) {
    const offset = state.outline.offset
    border.push((offset < 0 ? '-' : '') + 'outline-offset-' + Math.abs(offset))
    delete output['outline-offset']
  }
  return [
    ...border,
    ...Object.entries(output).map(([name, value]) => property(name, value)),
    standardRadius[radius] ?? arbitrary('rounded', radius),
  ].join(' ')
}
const designs: [string, BorderState][] = [
  ['pill', initial({}, { horizontal: [200, 200, 200, 200] })],
  ['card', initial()],
  ['circle', initial({ width: 3 }, { unit: '%', horizontal: [50, 50, 50, 50] })],
  ['blob', initial({}, { mode: 'organic', unit: '%', horizontal: [63, 37, 68, 32], vertical: [44, 65, 35, 56] })],
  ['retro', initial({ width: 10, style: 'double', color: '#794323' }, { horizontal: [4, 4, 4, 4] })],
]
export const logic = defineTool<BorderState>({
  id: 'border', schema,
  defaultState: () => initial(),
  outputs: { css: state => Object.entries(declarations(state)).map(([name, value]) => name + ': ' + value + ';').join('\n'), tailwind },
  presets: designs.map(([id, state]) => ({ id, state, builtin: true, nameKey: 'detail.border.presets.' + id })),
  random: () => initial({ width: Math.floor(Math.random() * 10) + 1 }, {
    horizontal: [Math.random(), Math.random(), Math.random(), Math.random()].map(n => Math.round(n * 70)) as BorderState['radius']['horizontal'],
    unit: '%',
  }),
})
