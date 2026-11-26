import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { numberBetween } from '../../lib/schema'

export const positions = ['static', 'relative', 'absolute', 'fixed', 'sticky'] as const
export const overflows = ['visible', 'hidden', 'auto', 'scroll', 'clip'] as const
export const displays = ['block', 'flex', 'grid', 'contents', 'table-cell'] as const
export const containers = ['normal', 'inline-size', 'size'] as const
export const contains = ['none', 'layout', 'paint', 'content', 'strict'] as const
export const willChanges = ['auto', 'transform', 'opacity', 'filter', 'clip-path'] as const
const int = (min: number, max: number) => v.pipe(numberBetween(min, max), v.integer())
const names = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/))
const px = v.nullable(int(-250, 250))
const styles = v.strictObject({
  position: v.picklist(positions), top: px, bottom: px, left: px, zIndex: v.nullable(int(-9999, 9999)),
  overflow: v.picklist(overflows), height: int(0, 1000), width: int(0, 500), display: v.picklist(displays),
  align: v.picklist(['stretch', 'start', 'center']), opacity: numberBetween(.1, 1),
  contain: v.picklist(contains), containerType: v.picklist(containers), willChange: v.picklist(willChanges),
  transform: v.boolean(), isolation: v.boolean(), filter: v.boolean(), perspective: v.boolean(),
  clipPath: v.boolean(), mask: v.boolean(), blend: v.boolean(),
})
const node = v.strictObject({ id: names, label: v.pipe(v.string(), v.maxLength(70)), parentId: v.nullable(names), styles })
const schema = v.pipe(v.strictObject({ nodes: v.pipe(v.array(node), v.minLength(2), v.maxLength(24)),
  selected: names, target: names, against: names }), v.check(state => {
  const ids = new Set<string>()
  for (const [index, item] of state.nodes.entries()) {
    if (ids.has(item.id) || (index === 0 ? item.parentId !== null : !item.parentId || !ids.has(item.parentId))) return false
    ids.add(item.id)
  }
  return [state.selected, state.target, state.against].every(id => ids.has(id))
}))
export type Style = v.InferOutput<typeof styles>
export type Box = v.InferOutput<typeof node>
export type Scenario = v.InferOutput<typeof schema>

const base = (): Style => ({
  position: 'static', top: null, bottom: null, left: null, zIndex: null, overflow: 'visible',
  height: 0, width: 0, display: 'block', align: 'stretch', opacity: 1, contain: 'none',
  containerType: 'normal', willChange: 'auto', transform: false, isolation: false, filter: false,
  perspective: false, clipPath: false, mask: false, blend: false,
})
const box = (id: string, label: string, parentId: string | null, update: Partial<Style> = {}): Box =>
  ({ id, label, parentId, styles: { ...base(), ...update } })
function sticky(nodes: Partial<Style>, pin: Partial<Style> = {}) {
  return {
    selected: 'pin', target: 'pin', against: 'content',
    nodes: [box('root', 'Escenario', null, { height: 640 }), box('parent', 'Contenedor', 'root', { height: 420, ...nodes }),
      box('pin', 'Etiqueta', 'parent', { position: 'sticky', top: 0, height: 42, width: 145, ...pin }),
      box('content', 'Contenido', 'parent', { height: 260, width: 150 })],
  }
}
function overlay(update: Partial<Style>, pin: Partial<Style> = {}) {
  return {
    selected: 'floating', target: 'floating', against: 'cover',
    nodes: [box('root', 'Escenario', null, { position: 'relative', height: 450 }),
      box('parent', 'Grupo', 'root', { position: 'relative', height: 120, ...update }),
      box('floating', 'Etiqueta', 'parent', { position: 'absolute', top: 24, left: 32, zIndex: 9999, width: 165, height: 80, ...pin }),
      box('cover', 'Tarjeta', 'root', { position: 'absolute', top: 40, left: 85, zIndex: 2, width: 150, height: 78 })],
  }
}
export const scenarios: [string, () => Scenario][] = [
  ['sticky-visible', () => sticky({})],
  ['sticky-hidden', () => sticky({ overflow: 'hidden' })],
  ['sticky-no-inset', () => sticky({}, { top: null })],
  ['sticky-stretch', () => sticky({ display: 'flex' }, { height: 0 })],
  ['sticky-height', () => sticky({ height: 42 })],
  ['stack-transform', () => overlay({ transform: true })],
  ['stack-opacity', () => overlay({ opacity: .7 })],
  ['stack-isolation', () => overlay({ isolation: true })],
  ['stack-container', () => overlay({ containerType: 'inline-size' })],
  ['stack-static', () => overlay({}, { position: 'static' })],
  ['fixed-transform', () => overlay({ transform: true }, { position: 'fixed' })],
]
export const defaults = (): Scenario => overlay({ transform: true })
const itemsById = (nodes: Box[]) => new Map(nodes.map(item => [item.id, item]))
const flexGrid = (parent?: Box) => parent?.styles.display === 'flex' || parent?.styles.display === 'grid'
const positioned = (styles: Style) => styles.position !== 'static'
const containContext = (styles: Style) => styles.contain !== 'none'
export function createsStackingContext(item: Box, parent?: Box) {
  const s = item.styles
  return !item.parentId || s.position === 'sticky' || s.position === 'fixed' ||
    s.zIndex !== null && (positioned(s) || flexGrid(parent)) ||
    s.opacity < 1 || s.transform || s.isolation || s.filter || s.perspective || s.clipPath || s.mask || s.blend ||
    containContext(s) || s.willChange !== 'auto'
}
function ancestors(item: Box, lookup: Map<string, Box>) {
  const scope: Box[] = []
  const visited = new Set([item.id])
  let parent = item.parentId ? lookup.get(item.parentId) : undefined
  while (parent && !visited.has(parent.id)) {
    scope.push(parent)
    visited.add(parent.id)
    parent = parent.parentId ? lookup.get(parent.parentId) : undefined
  }
  return scope
}
export type Context = { id: string; label: string; parent: string | undefined; zIndex: number; sourceOrder: number }
export function buildStackingTree(nodes: Box[]) {
  const lookup = itemsById(nodes)
  return nodes.flatMap((item, sourceOrder): Context[] => {
    const parent = item.parentId ? lookup.get(item.parentId) : undefined
    if (!createsStackingContext(item, parent)) return []
    const nearest = ancestors(item, lookup).find(box => createsStackingContext(box, box.parentId ? lookup.get(box.parentId) : undefined))
    return [{ id: item.id, label: item.label, parent: nearest?.id, zIndex: positioned(item.styles) || flexGrid(parent) ? item.styles.zIndex ?? 0 : 0, sourceOrder }]
  })
}
const order = (a: Context, b: Context) => a.zIndex - b.zIndex || a.sourceOrder - b.sourceOrder
export function paintOrder(contexts: Context[]) {
  const sorted = (parent: string | undefined, depth: number): (Context & { depth: number })[] => contexts
    .filter(context => context.parent === parent).sort(order).flatMap(context => [{ ...context, depth }, ...sorted(context.id, depth + 1)])
  return sorted(undefined, 0)
}

export type Finding = { reason: 'noInset' | 'scrollAncestor' | 'flexStretch' | 'noRoom' | 'contents' | 'table' | 'fixedAncestor' | 'ignoredIndex' | 'isolated' | 'sourceOrder' | 'front' | 'stickyOk'; culprit: string }
export function diagnoseSticky(nodes: Box[], id: string): Finding[] {
  const lookup = itemsById(nodes), item = lookup.get(id)
  if (!item) return []
  const parentChain = ancestors(item, lookup)
  const parent = parentChain[0]
  const result: Finding[] = []
  if (item.styles.position === 'fixed') {
    const culprit = parentChain.find(box => box.styles.transform || box.styles.filter || box.styles.perspective ||
      containContext(box.styles) || ['transform', 'filter'].includes(box.styles.willChange))
    return culprit ? [{ reason: 'fixedAncestor', culprit: culprit.id }] : []
  }
  if (item.styles.position !== 'sticky') return []
  if (item.styles.top === null && item.styles.bottom === null) result.push({ reason: 'noInset', culprit: item.id })
  const scroll = parentChain.find(box => ['auto', 'scroll', 'hidden'].includes(box.styles.overflow))
  if (scroll) result.push({ reason: 'scrollAncestor', culprit: scroll.id })
  if (parent && flexGrid(parent) && parent.styles.align === 'stretch' && !item.styles.height) result.push({ reason: 'flexStretch', culprit: parent.id })
  if (parent?.styles.height && item.styles.height >= parent.styles.height) result.push({ reason: 'noRoom', culprit: parent.id })
  const special = [item, ...parentChain].find(box => box.styles.display === 'contents' || box.styles.display === 'table-cell')
  if (special) result.push({ reason: special.styles.display === 'contents' ? 'contents' : 'table', culprit: special.id })
  return result.length ? result : [{ reason: 'stickyOk', culprit: item.id }]
}
export function diagnoseZIndex(nodes: Box[], first: string, second: string): Finding[] {
  const lookup = itemsById(nodes), a = lookup.get(first), b = lookup.get(second)
  if (!a || !b || first === second) return []
  const parent = a.parentId ? lookup.get(a.parentId) : undefined
  if (!positioned(a.styles) && !flexGrid(parent) && a.styles.zIndex !== null) return [{ reason: 'ignoredIndex', culprit: a.id }]
  const contexts = new Map(buildStackingTree(nodes).map(item => [item.id, item]))
  const trail = (item: Box) => [item, ...ancestors(item, lookup)].reverse().flatMap(box => contexts.get(box.id) ?? [])
  const x = trail(a), y = trail(b)
  let i = 0
  while (x[i] && y[i] && x[i].id === y[i].id) i++
  if (x[i] && y[i]) {
    if (order(x[i], y[i]) < 0 && x[i].id !== a.id) return [{ reason: 'isolated', culprit: x[i].id }]
    if (order(x[i], y[i]) >= 0) return [{ reason: 'front', culprit: x[i].id }]
    return [{ reason: 'sourceOrder', culprit: y[i].id }]
  }
  return []
}
export function fix(state: Scenario, finding: Finding) {
  const node = state.nodes.find(box => box.id === finding.culprit)
  if (!node) return
  const s = node.styles
  switch (finding.reason) {
    case 'noInset': s.top = 0; break
    case 'scrollAncestor': s.overflow = 'visible'; break
    case 'flexStretch': s.align = 'start'; break
    case 'noRoom': s.height = Math.min(1000, s.height + 160); break
    case 'contents': s.display = 'block'; break
    case 'fixedAncestor': Object.assign(s, { transform: false, filter: false, perspective: false, contain: 'none', willChange: 'auto' }); break
    case 'ignoredIndex': s.position = 'relative'; break
    case 'isolated': {
      const other = state.nodes.find(item => item.id === state.against)
      if (s.position === 'static') s.position = 'relative'
      s.zIndex = Math.min(9999, Math.max(s.zIndex ?? 0, (other?.styles.zIndex ?? 0) + 1, 3))
      break
    }
  }
}
export const canFix = (reason: Finding['reason']) => !['front', 'sourceOrder', 'stickyOk', 'table'].includes(reason)

const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export function scene(state: Scenario) {
  function render(parent: string | null): string {
    return state.nodes.filter(item => item.parentId === parent).map(item =>
      '<div class="demo-box" data-box="' + item.id + '"><span>' + escapeHtml(item.label) + '</span>' + render(item.id) + '</div>').join('')
  }
  return '<div id="viewport" tabindex="0" aria-label="Escenario desplazable">' + render(null) + '</div>'
}
export function sceneCss(state: Scenario) {
  const rules = state.nodes.map(({ id, styles: s }) => {
    const attrs = {
      position: s.position, top: s.top === null ? 'auto' : s.top + 'px', bottom: s.bottom === null ? 'auto' : s.bottom + 'px',
      left: s.left === null ? 'auto' : s.left + 'px', 'z-index': s.zIndex ?? 'auto', overflow: s.overflow,
      height: s.height ? s.height + 'px' : 'auto', width: s.width ? s.width + 'px' : 'auto',
      display: s.display, 'align-items': s.align, opacity: s.opacity, contain: s.contain, 'container-type': s.containerType,
      'will-change': s.willChange, transform: s.transform ? 'translateZ(0)' : 'none', isolation: s.isolation ? 'isolate' : 'auto',
      filter: s.filter ? 'grayscale(.12)' : 'none', perspective: s.perspective ? '600px' : 'none',
      'clip-path': s.clipPath ? 'inset(0)' : 'none', 'mask-image': s.mask ? 'linear-gradient(black,black)' : 'none',
      'mix-blend-mode': s.blend ? 'multiply' : 'normal',
    }
    return '[data-box="' + id + '"] {' + Object.entries(attrs).map(([prop, value]) => prop + ':' + value + ';').join('') + '}'
  })
  return 'body{margin:0;font:14px system-ui;background:#fff}.demo-box{box-sizing:border-box;outline:1px dashed #688c7c;padding:4px;color:#172b23}.demo-box>span{pointer-events:none}#viewport{height:222px;overflow:auto;isolation:isolate}[data-box="root"]{background:#eef4f0}[data-box="parent"]{background:#dde9e4}[data-box="pin"],[data-box="floating"]{background:#84dbac}[data-box="cover"]{background:#f3b4ad}[data-box="content"]{background:repeating-linear-gradient(#e9f2ed 0 27px,#d1e2d9 27px 28px)}\n' + rules.join('\n')
}
export const documentFor = (state: Scenario) => '<!doctype html><html lang="es"><meta charset="utf-8"><title>Escenario CSS</title><style>'
  + sceneCss(state) + '</style><body>' + scene(state) + '</body></html>'
export const logic = defineTool<Scenario>({
  id: 'stacking', schema, defaultState: defaults, outputs: { html: documentFor, css: sceneCss },
  presets: scenarios.map(([id, state]) => ({ id, state: state(), builtin: true, nameKey: 'detail.stacking.scenarios.' + id })),
})
