import { converter, formatHex, toGamut } from 'culori'
import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { hexColor, identifier, numberBetween } from '../../lib/schema'
import { formatOklch } from '../../lib/color'
import { visionModes } from '../../lib/color/vision'

export const harmonies = ['complementary', 'analogous', 'triadic', 'tetradic', 'split-complementary', 'monochromatic'] as const
export const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
export const tokenName = /^[a-z][a-z0-9-]{0,31}$/
const swatch = v.strictObject({
  id: identifier, name: v.pipe(v.string(), v.regex(tokenName)), color: hexColor, locked: v.boolean(),
})
const schema = v.strictObject({
  mode: v.picklist(['harmony', 'scale']), baseColor: hexColor, harmonyType: v.picklist(harmonies),
  count: v.pipe(numberBetween(3, 10), v.integer()), spread: numberBetween(0, 100),
  swatches: v.pipe(v.array(swatch), v.minLength(3), v.maxLength(11),
    v.check(colors => new Set(colors.map(c => c.id)).size === colors.length && new Set(colors.map(c => c.name)).size === colors.length)),
  colorBlindnessPreview: v.picklist(visionModes), contrastMethod: v.picklist(['wcag', 'apca']), format: v.picklist(['hex', 'oklch']),
})
export type PaletteState = v.InferOutput<typeof schema>
export type Swatch = v.InferOutput<typeof swatch>
const oklch = converter('oklch')
const gamut = toGamut('rgb', 'oklch')
export const colorOf = (l: number, c: number, h: number) => formatHex(gamut({ mode: 'oklch', l: Math.min(1, Math.max(0, l)), c: Math.max(0, c), h }))
export const channels = (color: string) => {
  const c = oklch(color)
  return { l: (c?.l ?? 0) * 100, c: c?.c ?? 0, h: c?.h ?? 0 }
}
const offsets: Record<(typeof harmonies)[number], number[]> = {
  complementary: [0, 180], analogous: [0, -30, 30], triadic: [0, 120, 240],
  tetradic: [0, 60, 180, 240], 'split-complementary': [0, 150, 210], monochromatic: [0],
}
export function regenerate(state: PaletteState) {
  const base = channels(state.baseColor)
  const lockedCount = state.swatches.filter(color => color.locked).length
  if (state.mode === 'harmony') state.count = Math.min(10, Math.max(state.count, lockedCount))
  const total = state.mode === 'scale' ? steps.length : state.count
  const width = state.spread / 100
  const hues = offsets[state.harmonyType]
  const preserved = [
    ...state.swatches.slice(0, total),
    ...state.swatches.slice(total).filter(color => color.locked),
  ]
  const names = new Set(preserved.map(color => color.name))
  const ids = new Set(preserved.map(color => color.id))
  const previous = preserved.slice(0, total)
  for (const locked of preserved.slice(total)) {
    const index = previous.length - 1 - [...previous].reverse().findIndex(color => !color.locked)
    if (index < previous.length) previous[index] = locked
  }
  state.swatches = Array.from({ length: total }, (_, i) => {
    const old = previous[i]
    if (old?.locked) return old
    const defaultName = state.mode === 'scale' ? 'brand-' + steps[i] : 'color-' + (i + 1)
    const automaticName = old?.name && (state.mode === 'scale' ? /^color-\d+$/.test(old.name) : /^brand-\d+$/.test(old.name))
    const retainedName = automaticName ? undefined : old?.name
    let name = retainedName ?? defaultName
    for (let suffix = 2; !retainedName && names.has(name); suffix++) name = defaultName + '-' + suffix
    names.add(name)
    let id = old?.id ?? defaultName
    for (let suffix = 2; !old && ids.has(id); suffix++) id = defaultName + '-' + suffix
    ids.add(id)
    const lightness = base.l / 100
    const offset = state.mode === 'scale' ? (5 - i) / 5 : i === 0 ? 0 : (Math.floor(i / hues.length) % 2 === 0 ? 1 : -1) * Math.ceil(Math.floor(i / hues.length) / 2) / 3
    const l = lightness + offset * (offset > 0 ? 0.99 - lightness : lightness - 0.04) * width
    const h = base.h + (state.mode === 'scale' ? 0 : hues[i % hues.length])
    const color = colorOf(l, base.c * (state.mode === 'scale' ? 1 - Math.abs(offset) * 0.45 : 1), h)
    return { id, name, color, locked: false }
  })
}
export function shuffleColors(state: PaletteState) {
  state.baseColor = colorOf(0.30 + Math.random() * 0.48, 0.11 + Math.random() * 0.13, Math.random() * 360)
  regenerate(state)
}
function initial(mode: PaletteState['mode'] = 'harmony', baseColor = '#2b755a', harmonyType: PaletteState['harmonyType'] = 'analogous'): PaletteState {
  const state: PaletteState = { mode, baseColor, harmonyType, count: 5, spread: 85, swatches: [],
    colorBlindnessPreview: 'normal', contrastMethod: 'wcag', format: 'hex' }
  regenerate(state)
  return state
}
export const outputColor = (state: PaletteState, color: string) => state.format === 'oklch' ? formatOklch(color) : color
function variables(state: PaletteState, headline: string) {
  return headline + ' {\n' + state.swatches.map(c => '  --color-' + c.name + ': ' + outputColor(state, c.color) + ';').join('\n') + '\n}'
}
export const logic = defineTool<PaletteState>({
  id: 'palette', schema, defaultState: () => initial(),
  outputs: {
    css: state => variables(state, ':root'),
    tailwind: state => variables(state, '@theme'),
    json: state => JSON.stringify(Object.fromEntries(state.swatches.map(c => [c.name, outputColor(state, c.color)])), null, 2),
    scss: state => state.swatches.map(c => '$color-' + c.name + ': ' + outputColor(state, c.color) + ';').join('\n'),
  },
  presets: [
    { id: 'forest', builtin: true, nameKey: 'detail.palette.forest', state: initial() },
    { id: 'sunset', builtin: true, nameKey: 'detail.palette.sunset', state: initial('harmony', '#d45443', 'split-complementary') },
    { id: 'ocean', builtin: true, nameKey: 'detail.palette.ocean', state: initial('scale', '#2563eb') },
  ],
})
