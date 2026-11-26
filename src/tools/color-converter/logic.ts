import * as v from 'valibot'
import { colorsNamed, converter, displayable, formatCss, formatHex, formatHex8, formatHsl, formatRgb, interpolate, parse, toGamut, wcagContrast } from 'culori'
import swatches from './tailwind-colors.json'
import { defineTool } from '../../core/tool'
import { numberBetween } from '../../lib/schema'
import { apca } from '../../lib/color/vision'

const bounded = v.pipe(v.string(), v.maxLength(180))
const spaces = ['rgb', 'oklab', 'oklch'] as const
const schema = v.strictObject({ first: bounded, second: bounded, ratio: numberBetween(0, 100), space: v.picklist(spaces) })
export type State = v.InferOutput<typeof schema>
const map = toGamut('rgb', 'oklch')
const rgb = converter('rgb')
const lab = converter('oklab')
const lch = converter('oklch')
const cssValue = (value: string) => parse(value.trim())
const hex = (value: string) => {
  const c = cssValue(value)
  if (c) return c.alpha !== undefined && c.alpha < 1 ? formatHex8(map(c)) : formatHex(map(c))
  return ''
}
const named = Object.keys(colorsNamed).map(key => [key, lab(key)] as const)
const palette = swatches.map(([key, val]) => [key, lab(val)] as const)
function nearest(list: typeof named, value: string) {
  const target = lab(value)
  if (!target) return ''
  let best = Infinity, label = ''
  for (const [key, item] of list) if (item) {
    const delta = (target.l - item.l) ** 2 + (target.a - item.a) ** 2 + (target.b - item.b) ** 2
    if (delta < best) { best = delta; label = key }
  }
  return label
}
export function values(value: string) {
  const c = cssValue(value)
  if (!c) return {}
  return { HEX: hex(value), RGB: formatRgb(map(c)), HSL: formatHsl(map(c)),
    HWB: formatCss(converter('hwb')(c)), Lab: formatCss(converter('lab')(c)),
    LCH: formatCss(converter('lch')(c)), OKLab: formatCss(lab(c)), OKLCH: formatCss(lch(c)), 'Display P3': formatCss(converter('p3')(c)) }
}
export function description(value: string) {
  const parsed = cssValue(value)
  return parsed ? { hex: hex(value), srgb: displayable(parsed), name: nearest(named, value), tailwind: nearest(palette, value) } : undefined
}
function composited(front: string, back: string) {
  const a = rgb(front), source = rgb(back)
  if (!a || !source) return
  const b = [source.r, source.g, source.b].map(channel => channel * (source.alpha ?? 1) + 1 - (source.alpha ?? 1))
  const f = [a.r, a.g, a.b].map((channel, index) => channel * (a.alpha ?? 1) + b[index] * (1 - (a.alpha ?? 1)))
  const asHex = ([r,g,b]: number[]) => formatHex({ mode: 'rgb',r,g,b })
  return [asHex(f), asHex(b)] as const
}
export function contrast(front: string, back: string) {
  const pair = composited(front, back)
  return pair ? { ratio: wcagContrast(...pair), lc: apca(...pair) } : undefined
}
export function adjust(front: string, back: string) {
  const color = lch(front)
  if (!color || !cssValue(back)) return
  let closest: { delta: number; css: string } | undefined
  for (let i = 0; i <= 200; i++) {
    const l = i / 200
    const css = formatCss({ ...color, l })
    const pair = contrast(css, back)
    const delta = Math.abs(l - color.l)
    if (pair && pair.ratio >= 4.5 && (!closest || closest.delta > delta)) closest = { delta, css }
  }
  return closest?.css
}
export function mix(state: State) {
  if (!cssValue(state.first) || !cssValue(state.second)) return
  const color = interpolate([state.second, state.first], state.space)(state.ratio / 100)
  const space = state.space === 'rgb' ? 'srgb' : state.space
  return { code: 'color-mix(in ' + space + ', ' + state.first + ' ' + state.ratio + '%, ' + state.second + ')', value: formatCss(color) }
}
export function variations(value: string) {
  if (!cssValue(value)) return []
  return ['#000', '#fff'].flatMap(end => [.15,.3,.5].map(amount => formatCss(interpolate([value, end], 'oklch')(amount))))
}
export const logic = defineTool<State>({ id: 'color-converter', schema, defaultState: () => ({ first: 'oklch(62% .2 253)', second: '#ffffff', ratio: 40, space: 'oklch' }),
  outputs: { css: state => Object.entries(values(state.first)).map(([name, value]) => '/* ' + name + ' */\n' + value).join('\n\n') + (mix(state) ? '\n\n' + mix(state)?.code : '') }, presets: [] })
