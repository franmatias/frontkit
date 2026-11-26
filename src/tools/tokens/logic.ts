import { converter } from 'culori'
import * as v from 'valibot'
import { tokenSteps } from '../../core/storage/typography-handoff'
import { defineTool } from '../../core/tool'
import { decimal } from '../../lib/css'
import { colorOf } from '../palette/logic'
import { hexColor, numberBetween } from '../../lib/schema'

export const roles = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'text-muted', 'border', 'success', 'warning', 'error', 'info']
const slug = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/))
const safeCss = v.pipe(v.string(), v.maxLength(2400), v.regex(/^[\w\s.,#%/'"()+-]+$/))
const schema = v.strictObject({
  prefix: v.union([v.literal(''), slug]),
  colors: v.pipe(v.array(v.strictObject({ name: slug, light: hexColor, dark: hexColor })), v.minLength(12), v.maxLength(48),
    v.check(colors => roles.every(role => colors.some(c => c.name === role)) && new Set(colors.map(c => c.name)).size === colors.length)),
  typography: v.strictObject({
    fontSans: safeCss, fontMono: safeCss, baseSizePx: numberBetween(8, 40), scaleRatio: numberBetween(1, 2),
    lineHeightBody: numberBetween(1, 3), lineHeightHeading: numberBetween(1, 3), scale: v.optional(tokenSteps),
    fluid: v.strictObject({ enabled: v.boolean(), minViewportPx: numberBetween(200, 1000), maxViewportPx: numberBetween(600, 3000),
      minScaleRatio: numberBetween(1, 2), maxScaleRatio: numberBetween(1, 2) }),
  }),
  spacing: v.strictObject({ basePx: numberBetween(1, 32), steps: v.pipe(v.array(numberBetween(0, 64)), v.minLength(1), v.maxLength(20)) }),
  radii: v.strictObject({ sm: safeCss, md: safeCss, lg: safeCss, full: safeCss }),
  shadows: v.strictObject({ sm: safeCss, md: safeCss, lg: safeCss }),
  systemDark: v.boolean(),
})
export type TokenState = v.InferOutput<typeof schema>
export const radiusKeys = ['sm', 'md', 'lg', 'full'] as const
export const shadowKeys = ['sm', 'md', 'lg'] as const
const convert = converter('oklch')
const rgb = converter('rgb')
export function darkFor(hex: string) {
  const color = convert(hex)!
  return colorOf(color.l < 0.58 ? Math.max(0.64, color.l + 0.23) : Math.max(0.16, color.l - 0.53), color.c, color.h ?? 0)
}
function theme(primary = '#31566f', fonts = 'system-ui, sans-serif'): TokenState {
  const light = [primary, '#435563', '#146b52', '#f2f5f7', '#ffffff', '#162635', '#4a5d6c', '#adbfc9', '#14634a', '#815014', '#a63032', '#1b6094']
  const dark = ['#a5d2f1', '#a5afb9', '#82dab9', '#111c25', '#1c2a36', '#ecf4f8', '#becbd5', '#506572', '#82dab9', '#f0c076', '#ffaaaa', '#a5d2f1']
  return {
    prefix: '', colors: roles.map((name, i) => ({ name, light: light[i], dark: i === 0 ? darkFor(primary) : dark[i] })),
    typography: { fontSans: fonts, fontMono: 'ui-monospace, monospace', baseSizePx: 16, scaleRatio: 1.2,
      lineHeightBody: 1.55, lineHeightHeading: 1.15,
      fluid: { enabled: false, minViewportPx: 320, maxViewportPx: 1440, minScaleRatio: 1.12, maxScaleRatio: 1.28 } },
    spacing: { basePx: 4, steps: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8] },
    radii: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
    shadows: { sm: '0 1px 3px #18263022', md: '0 4px 12px #18263030', lg: '0 10px 25px #18263044' }, systemDark: false,
  }
}
const sizes = { xs: -1, base: 0, lg: 1, xl: 2, '2xl': 3, '3xl': 4 }
function fontSize(t: TokenState['typography'], step: number) {
  if (!t.fluid.enabled || step === 0) return decimal(t.baseSizePx * t.scaleRatio ** step) + 'px'
  const { minViewportPx, maxViewportPx, minScaleRatio, maxScaleRatio } = t.fluid
  const low = t.baseSizePx * minScaleRatio ** step
  const high = t.baseSizePx * maxScaleRatio ** step
  const slope = (high - low) / Math.max(1, maxViewportPx - minViewportPx)
  const intercept = low - slope * minViewportPx
  return 'clamp(' + decimal(Math.min(low, high)) + 'px, calc(' + decimal(intercept) + 'px ' +
    (slope < 0 ? '- ' : '+ ') + decimal(Math.abs(slope) * 100) + 'vw), ' + decimal(Math.max(low, high)) + 'px)'
}
export function declarations(state: TokenState, mode: 'light' | 'dark', namespace = true) {
  const prefix = namespace && state.prefix ? state.prefix + '-' : ''
  const values: Record<string, string> = {}
  const add = (name: string, value: string) => { values['--' + prefix + name] = value }
  for (const color of state.colors) add('color-' + color.name, color[mode])
  if (mode === 'dark') return values
  const type = state.typography
  add('font-sans', type.fontSans)
  add('font-mono', type.fontMono)
  add('leading-body', String(type.lineHeightBody))
  add('leading-heading', String(type.lineHeightHeading))
  for (const [name, step] of Object.entries(sizes)) add('text-' + name, fontSize(type, step))
  for (const step of type.scale ?? []) {
    add('text-' + step.name, step.value)
    add('text-' + step.name + '--line-height', String(step.lineHeight))
  }
  add('spacing', state.spacing.basePx + 'px')
  for (const step of state.spacing.steps) add('spacing-' + String(step).replace('.', '\\.'), decimal(step * state.spacing.basePx) + 'px')
  for (const name of radiusKeys) add('radius-' + name, state.radii[name])
  for (const name of shadowKeys) add('shadow-' + name, state.shadows[name])
  return values
}
const rule = (selector: string, values: Record<string, string>) => selector + ' {\n' +
  Object.entries(values).map(([key, value]) => '  ' + key + ': ' + value + ';').join('\n') + '\n}'
function css(state: TokenState) {
  const dark = declarations(state, 'dark')
  return [rule(':root', declarations(state, 'light')), rule("[data-theme='dark']", dark),
    state.systemDark ? '@media (prefers-color-scheme: dark) {\n' + rule(':root:not([data-theme])', dark).split('\n').map(line => '  ' + line).join('\n') + '\n}' : '',
  ].filter(Boolean).join('\n\n')
}
function dtcg(state: TokenState) {
  const leaf = (value: unknown, type: string, description: string) => ({ $value: value, $type: type, $description: description })
  const srgb = (value: string) => {
    const c = rgb(value)
    return c && { colorSpace: 'srgb', components: [c.r, c.g, c.b], alpha: c.alpha ?? 1 }
  }
  const extension = (value: string, description: string) => ({ $description: description, $extensions: { 'frontkit.css': { value } } })
  const color = (hex: string, name: string) => leaf(srgb(hex), 'color', name)
  function shadow(value: string, name: string) {
    const layers = value.match(/(?:\([^)]*\)|[^,])+/g) ?? []
    const result = layers.map(layer => {
      const match = /^(inset\s+)?(-?[\d.]+(?:px|rem)?)\s+(-?[\d.]+(?:px|rem)?)(?:\s+(-?[\d.]+(?:px|rem)?))?(?:\s+(-?[\d.]+(?:px|rem)?))?\s+(.+)$/.exec(layer.trim())
      if (!match) return undefined
      const color = srgb(match[6])
      const length = (input = '0') => ({ value: Number.parseFloat(input), unit: input.endsWith('rem') ? 'rem' : 'px' })
      if (color) return { color, offsetX: length(match[2]), offsetY: length(match[3]), blur: length(match[4]), spread: length(match[5]), inset: Boolean(match[1]) }
      return undefined
    })
    return result.length && result.every(Boolean) ? leaf(result, 'shadow', name) : extension(value, name)
  }
  const dimension = (value: string, name: string) => {
    const parts = /^([\d.]+)(px|rem)$/.exec(value)
    return parts ? leaf({ value: Number(parts[1]), unit: parts[2] }, 'dimension', name)
      : extension(value, name)
  }
  const group = {
    color: Object.fromEntries(state.colors.map(c => [c.name, { light: color(c.light, c.name + ' light'), dark: color(c.dark, c.name + ' dark') }])),
    typography: Object.fromEntries(Object.entries(declarations(state, 'light', false)).filter(([key]) => /^--(font|text|leading)-/.test(key))
      .map(([key, value]) => [key.slice(2), key.startsWith('--text') && !key.endsWith('--line-height') ? dimension(value, key) : key.startsWith('--leading') || key.endsWith('--line-height') ? leaf(Number(value), 'number', key)
        : leaf(value.split(',').map(font => font.trim()), 'fontFamily', key)])),
    spacing: Object.fromEntries(state.spacing.steps.map(step => [String(step).replace('.', '-'), dimension(step * state.spacing.basePx + 'px', 'Spacing ' + step)])),
    radius: Object.fromEntries(radiusKeys.map(name => [name, dimension(state.radii[name], 'Radius ' + name)])),
    shadow: Object.fromEntries(shadowKeys.map(name => [name, shadow(state.shadows[name], 'CSS shadow ' + name)])),
  }
  return JSON.stringify(state.prefix ? { [state.prefix]: group } : group, null, 2)
}
function scss(state: TokenState) {
  const light = declarations(state, 'light')
  const dark = declarations(state, 'dark')
  const lines = Object.entries(light).map(([key, value]) => '$' + key.slice(2).replace('\\.', '-') + ': ' + value + ';')
  const map = (mode: string, values: Record<string, string>) => '$colors-' + mode + ': (\n' +
    Object.entries(values).filter(([key]) => key.includes('color-')).map(([key, value]) => '  "' + key.slice(2) + '": ' + value + ',').join('\n') + '\n);'
  return [...lines, '', map('light', light), '', map('dark', dark)].join('\n')
}
export const logic = defineTool<TokenState>({
  id: 'tokens', schema, defaultState: () => theme(),
  outputs: {
    css, json: dtcg, scss,
    tailwind: state => rule('@theme', declarations(state, 'light', false)) + '\n\n' + rule('.dark', declarations(state, 'dark', false)),
  },
  presets: [
    ['slate', 'Minimal Slate', theme()], ['vibrant', 'Vibrant SaaS', theme('#603ae1')],
    ['editorial', 'Editorial Serif', theme('#83451e', 'Georgia, serif')],
    ['contrast', 'High Contrast', { ...theme('#192a4e'), colors: theme('#192a4e').colors.map(c => c.name === 'text' ? { ...c, light: '#000000', dark: '#ffffff' } : c) }],
  ].map(([id, name, state]) => ({ id: String(id), name: String(name), state: state as TokenState, builtin: true })),
})
