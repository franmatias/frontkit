import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { identifier, numberBetween } from '../../lib/schema'
import { property } from '../../lib/tailwind'

export const breakpoints = { base: 0, sm: 640, md: 768, lg: 1024 } as const
export type Breakpoint = keyof typeof breakpoints
const names = ['sm', 'md', 'lg'] as const
export const directions = ['row', 'row-reverse', 'column', 'column-reverse'] as const
export const wraps = ['nowrap', 'wrap', 'wrap-reverse'] as const
export const flows = ['row', 'column', 'row dense', 'column dense'] as const
export const alignment = ['normal', 'start', 'end', 'center', 'stretch', 'baseline'] as const
export const distribution = ['normal', 'start', 'end', 'center', 'stretch', 'space-between', 'space-around', 'space-evenly'] as const
export const self = ['auto', ...alignment] as const
export const units = ['fr', 'px', '%', 'auto', 'min-content', 'max-content', 'minmax', 'auto-fit', 'auto-fill', 'repeat'] as const
export const gapUnits = ['px', 'rem', '%'] as const
const dimension = v.pipe(v.string(), v.regex(/^(auto|min-content|max-content|\d{1,4}(?:\.\d{1,2})?(fr|px|%|rem))$/))
const name = v.pipe(v.string(), v.regex(/^(?:[a-zA-Z_][a-zA-Z0-9_-]{0,31}|\.)$/))
const track = v.strictObject({ unit: v.picklist(units), value: numberBetween(0, 1200), min: dimension, max: dimension, count: numberBetween(1, 12) })
const tracks = v.pipe(v.array(track), v.minLength(1), v.maxLength(12))
const container = v.strictObject({
  direction: v.picklist(directions), wrap: v.picklist(wraps), flow: v.picklist(flows), gapUnit: v.picklist(gapUnits),
  columnGap: numberBetween(0, 200), rowGap: numberBetween(0, 200),
  alignItems: v.picklist(alignment), justifyItems: v.picklist(alignment),
  alignContent: v.picklist(distribution), justifyContent: v.picklist(distribution),
  columns: tracks, rows: tracks,
  areas: v.pipe(v.array(v.pipe(v.array(name), v.maxLength(12))), v.maxLength(12)),
})
const integer = (min: number, max: number) => v.pipe(numberBetween(min, max), v.integer())
const itemSettings = v.strictObject({
  order: integer(-24, 24), grow: numberBetween(0, 20), shrink: numberBetween(0, 20),
  basis: v.pipe(v.string(), v.regex(/^(auto|content|\d{1,4}(px|%|rem))$/)),
  alignSelf: v.picklist(self), justifySelf: v.picklist(self), area: v.union([v.literal(''), name]),
  colStart: integer(0, 24), colSpan: integer(1, 24), rowStart: integer(0, 24), rowSpan: integer(1, 24),
})
const override = v.strictObject({ container: v.partial(container), items: v.record(identifier, v.partial(itemSettings)) })
const schema = v.strictObject({
  system: v.picklist(['flex', 'grid']), container,
  items: v.pipe(v.array(v.strictObject({ id: identifier, ...itemSettings.entries })), v.minLength(1), v.maxLength(24)),
  responsive: v.boolean(), overrides: v.partial(v.strictObject({ sm: override, md: override, lg: override })),
})
export type LayoutState = v.InferOutput<typeof schema>
export type Container = LayoutState['container']
export type Track = v.InferOutput<typeof track>
export type Item = LayoutState['items'][number]
export const makeTrack = (patch: Partial<Track> = {}): Track => ({ unit: 'fr', value: 1, count: 3, min: '160px', max: '1fr', ...patch })
export const makeItem = (id: string, patch: Partial<Item> = {}): Item => ({
  id, order: 0, grow: 0, shrink: 1, basis: 'auto', alignSelf: 'auto', justifySelf: 'auto',
  area: '', colStart: 0, colSpan: 1, rowStart: 0, rowSpan: 1, ...patch,
})
function initial(system: LayoutState['system'] = 'grid', patch: Partial<Container> = {}, items = Array.from({ length: 6 }, (_, i) => makeItem(String(i + 1)))): LayoutState {
  return { system, items, responsive: false, overrides: {}, container: {
    direction: 'row', wrap: 'nowrap', flow: 'row', gapUnit: 'px', columnGap: 16, rowGap: 16,
    alignItems: 'normal', justifyItems: 'normal', alignContent: 'normal', justifyContent: 'normal',
    columns: [makeTrack({ unit: 'repeat' })], rows: [makeTrack({ unit: 'auto' })], areas: [], ...patch,
  } }
}
export function resolved(state: LayoutState, bp: Breakpoint) {
  const container = { ...state.container }
  const items = state.items.map(item => ({ ...item }))
  for (const name of names) {
    if (!state.responsive || breakpoints[name] > breakpoints[bp]) break
    const override = state.overrides[name]
    if (!override) continue
    Object.assign(container, override.container)
    for (const item of items) Object.assign(item, override.items[item.id])
  }
  return { container, items }
}
function trackValue(track: Track) {
  const minmax = 'minmax(' + (track.min.endsWith('fr') ? 'auto' : track.min) + ', ' + track.max + ')'
  if (track.unit === 'auto-fit' || track.unit === 'auto-fill') return 'repeat(' + track.unit + ', ' + minmax + ')'
  if (track.unit === 'repeat') return 'repeat(' + Math.round(track.count) + ', ' + track.value + 'fr)'
  if (track.unit === 'minmax') return minmax
  return ['fr', 'px', '%'].includes(track.unit) ? track.value + track.unit : track.unit
}
export function validAreas(matrix: string[][]) {
  if (!matrix[0]?.length || matrix.some(row => row.length !== matrix[0].length)) return false
  for (const name of new Set(matrix.flat().filter(cell => cell !== '.'))) {
    const cells = matrix.flatMap((row, y) => row.flatMap((cell, x) => cell === name ? [{x,y}] : []))
    const xs = cells.map(cell => cell.x)
    const ys = cells.map(cell => cell.y)
    if ((Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1) !== cells.length) return false
  }
  return true
}
type Rules = Record<string, string>
export function containerRules(system: LayoutState['system'], c: Container): Rules {
  const common = { display: system, 'row-gap': c.rowGap + c.gapUnit, 'column-gap': c.columnGap + c.gapUnit,
    'justify-content': c.justifyContent, 'align-items': c.alignItems, 'align-content': c.alignContent }
  return system === 'flex' ? { ...common, 'flex-direction': c.direction, 'flex-wrap': c.wrap } : {
    ...common, 'justify-items': c.justifyItems, 'grid-auto-flow': c.flow,
    'grid-template-columns': c.columns.map(trackValue).join(' '), 'grid-template-rows': c.rows.map(trackValue).join(' '),
    'grid-template-areas': validAreas(c.areas) ? c.areas.map(row => '"' + row.join(' ') + '"').join(' ') : 'none',
  }
}
export function itemRules(system: LayoutState['system'], i: Item): Rules {
  const common = { order: String(i.order), 'align-self': i.alignSelf }
  if (system === 'flex') return { ...common, 'flex-grow': String(i.grow), 'flex-shrink': String(i.shrink), 'flex-basis': i.basis }
  const position = (start: number, span: number) => start || span > 1 ? (start || 'auto') + ' / span ' + span : 'auto'
  return {
    ...common, 'justify-self': i.justifySelf,
    ...(i.area && i.area !== '.' ? { 'grid-area': i.area } : {
      'grid-row': position(i.rowStart, i.rowSpan), 'grid-column': position(i.colStart, i.colSpan),
    }),
  }
}
const delta = (rules: Rules, previous: Rules) => Object.fromEntries(Object.entries(rules).filter(([key, value]) => previous[key] !== value))
function outputRules(state: LayoutState) {
  let previous = { container: {} as Rules, items: state.items.map(() => itemRules(state.system, makeItem('default'))) }
  return (state.responsive ? ['base', ...names] as const : ['base'] as const).map(bp => {
    const { container, items } = resolved(state, bp)
    const current = { container: containerRules(state.system, container), items: items.map(item => itemRules(state.system, item)) }
    const result = { bp, container: delta(current.container, previous.container), items: current.items.map((item, i) => {
      const old = previous.items[i]
      return delta(item, old['grid-area'] && !item['grid-area'] ? { ...old, 'grid-row': '', 'grid-column': '' } : old)
    }) }
    previous = current
    return result
  })
}
function block(selector: string, rules: Rules) {
  const declarations = Object.entries(rules).map(([key, value]) => '  ' + key + ': ' + value + ';')
  return declarations.length ? [selector + ' {', ...declarations, '}'].join('\n') : ''
}
function css(state: LayoutState) {
  return outputRules(state).map(({ bp, container, items }) => {
    const rules = [block('.container', container), ...items.map((item, i) => block('.item-' + (i + 1), item))].filter(Boolean).join('\n\n')
    if (!rules || bp === 'base') return rules
    return '@media (min-width: ' + breakpoints[bp] + 'px) {\n' + rules.split('\n').map(line => line ? '  ' + line : line).join('\n') + '\n}'
  }).filter(Boolean).join('\n\n')
}
function utility(key: string, value: string) {
  if (key === 'display') return value
  if (key === 'flex-direction') return 'flex-' + value.replace('column', 'col')
  if (key === 'flex-wrap') return 'flex-' + value
  const alignment: Record<string, string> = { 'align-items': 'items', 'align-content': 'content', 'justify-content': 'justify', 'justify-items': 'justify-items', 'align-self': 'self', 'justify-self': 'justify-self' }
  if (alignment[key] && (value !== 'normal' || ['justify-content', 'align-content'].includes(key))) return alignment[key] + '-' + value.replace(/^space-/, '')
  const px = /^(\d+)px$/.exec(value)
  if ((key === 'column-gap' || key === 'row-gap') && px && Number(px[1]) % 4 === 0) return (key === 'row-gap' ? 'gap-y-' : 'gap-x-') + Number(px[1]) / 4
  const repeat = /^repeat\((\d+), 1fr\)$/.exec(value)
  if (repeat && key === 'grid-template-columns') return 'grid-cols-' + repeat[1]
  const span = /^auto \/ span (\d+)$/.exec(value)
  if (span && key === 'grid-column') return 'col-span-' + span[1]
  return property(key, value.replaceAll('"', "'"))
}
function html(state: LayoutState, tailwind = false) {
  const rules = outputRules(state)
  function classes(index?: number) {
    if (!tailwind) return index === undefined ? 'container' : rules.some(rule => Object.keys(rule.items[index]).length) ? 'item-' + (index + 1) : ''
    return rules.flatMap(rule => Object.entries(index === undefined ? rule.container : rule.items[index])
      .map(([key, value]) => (rule.bp === 'base' ? '' : rule.bp + ':') + utility(key, value))).join(' ')
  }
  const attr = (value: string) => value ? ' class="' + value + '"' : ''
  return ['<div' + attr(classes()) + '>', ...state.items.map((item, i) => '  <div' + attr(classes(i)) + '>Elemento ' + item.id + '</div>'), '</div>'].join('\n')
}
const named = (names: string[]) => names.map((area, i) => makeItem(String(i + 1), { area }))
const presets: [string, LayoutState][] = [
  ['holy', initial('grid', { areas: [['header', 'header', 'header'], ['nav', 'main', 'aside'], ['footer', 'footer', 'footer']] }, named(['header', 'nav', 'main', 'aside', 'footer']))],
  ['bento', initial('grid', {}, [makeItem('1', { colSpan: 2, rowSpan: 2 }), makeItem('2'), makeItem('3'), makeItem('4', { colSpan: 3 })])],
  ['navbar', initial('flex', { justifyContent: 'space-between', alignItems: 'center' }, named(['brand', 'menu', 'actions']))],
  ['gallery', initial('grid', { columns: [makeTrack({ unit: 'auto-fit', min: '140px' })] })],
  ['sidebar', initial('grid', { columns: [makeTrack({ unit: 'px', value: 160 }), makeTrack()], areas: [['sidebar', 'main']] }, named(['sidebar', 'main']))],
  ['center', initial('flex', { justifyContent: 'center', alignItems: 'center' }, [makeItem('1')])],
]
export const logic = defineTool<LayoutState>({
  id: 'layout', schema, defaultState: initial,
  outputs: { html: state => html(state), css, tailwind: state => html(state, true) },
  presets: presets.map(([id, state]) => ({ id, state, builtin: true, nameKey: 'detail.layout.' + id })),
})
