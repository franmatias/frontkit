import postcss, { type ChildNode, type Container, type Rule } from 'postcss'
import { conditional, parseCss } from '../../lib/css-ast'
import type { Rename } from '../../lib/rename'

export const categories = ['base', 'layout', 'module', 'state', 'theme'] as const
export type Category = typeof categories[number]
export type Options = { output: 'layers' | 'files'; owners: 'owner' | 'single'; split: boolean; prefix: boolean; keepInteraction: boolean }
export const defaults = (): Options => ({ output: 'layers', owners: 'owner', split: false, prefix: false, keepInteraction: true })
type Entry = { id: number; selector: string; category: Category; confidence: 'high' | 'medium' | 'low'; path: string; owner: string }
const stateClass = /(?:^|[.\s])(?:is-|has-|active\b|disabled\b|open\b)|\[(?:aria-expanded|disabled)\b/
const themeClass = /\.theme-|\[data-theme\b/
const layoutClass = /\.(?:l-|layout\b|grid\b|container\b|wrapper\b|row\b|col\b)|^(?:main|header|footer|aside)\b/
const isTheme = (prop: string) => /^(?:color|background(?:-|$)|border-color|box-shadow|font-family|fill|stroke|--)/.test(prop)
const isLayout = (prop: string, value: string) => /^(?:grid-|float$|width$|max-width$|inset(?:-|$))/.test(prop) ||
  prop === 'display' && /^(?:inline-)?(?:flex|grid)$/.test(value)
const priority = ['module', 'base', 'layout', 'state', 'theme'] as const
const ownerOf = (selector: string) => selector.match(/\.([a-z][\w-]*)/i)?.[1].toLowerCase().split(/__|--/)[0] ?? 'general'

function score(rule: Rule, options: Options): Pick<Entry, 'category' | 'confidence'> {
  const selector = rule.selector
  const props = rule.nodes.filter(node => node.type === 'decl')
  const points: Record<Category, number> = { base: 0, layout: 0, module: 1, state: 0, theme: 0 }
  if (/^(?::root|\*|[a-z][\w-]*(?:\s|$)|\[)/i.test(selector) && !/[.#]/.test(selector)) points.base += 6
  if (layoutClass.test(selector)) points.layout += 7
  if (stateClass.test(selector)) points.state += 9
  if (!options.keepInteraction && /:(?:hover|focus|focus-visible|active)\b/.test(selector)) points.state += 6
  if (themeClass.test(selector)) points.theme += 12
  if (props.length && props.every(node => isTheme(node.prop))) points.theme += 3
  if (props.some(node => isLayout(node.prop, node.value))) points.layout += 5
  if (selector.includes('.') && !layoutClass.test(selector) && !themeClass.test(selector)) points.module += 3
  const ranked = [...priority].sort((a, b) => points[b] - points[a])
  const first = points[ranked[0]], second = points[ranked[1]]
  return { category: first === second ? 'module' : ranked[0], confidence: first - second >= 6 ? 'high' : first - second >= 3 ? 'medium' : 'low' }
}

export function organize(source: string, options: Options, overrides: Record<number, Category> = {}) {
  const input = parseCss(source)
  const entries: Entry[] = []
  const warnings = new Set<string>()
  const owners = new Map<string, string>()
  const candidates = new Map<string, Set<Category>>()
  const ambiguous = new Set<string>()
  input.walkRules(rule => {
    const names = [...rule.selector.matchAll(/\.([a-z][\w-]*)/gi)].map(match => match[1])
    if (!/^\.[a-z][\w-]*$/i.test(rule.selector)) for (const name of names) ambiguous.add(name)
    for (const decl of rule.nodes) if (decl.type === 'decl' && /^animation(?:-name)?$/.test(decl.prop)) {
      for (const word of decl.value.split(/[\s,()]+/)) if (/^[\w-]+$/.test(word)) owners.set(word, ownerOf(rule.selector))
    }
  })
  input.walkAtRules(rule => {
    for (const match of rule.params.matchAll(/\.([a-z][\w-]*)/gi)) ambiguous.add(match[1])
  })
  const categorized = new Map<ChildNode, { node: ChildNode; category: Category; owner: string }[]>()
  const safety = new Map<string, Set<Category>>()
  const prelude = postcss.root()
  function visit(container: Container, path: string[]) {
    for (const node of container.nodes ?? []) {
      if (node.type === 'comment') {
        prelude.append(node.clone())
        continue
      }
      if (node.type === 'atrule' && conditional(node.name) && node.nodes) {
        visit(node, [...path, '@' + node.name + ' ' + node.params])
        continue
      }
      if (node.type !== 'rule' && !(node.type === 'atrule' && /^(?:font-face|(?:-webkit-)?keyframes)$/.test(node.name))) {
        prelude.append(wrap(node.clone(), path))
        if (node.type === 'atrule' && !/^(?:import|charset|namespace)$/.test(node.name)) warnings.add('Se conservó una regla especial fuera de las categorías: @' + node.name)
        continue
      }
      if (node.type === 'rule' && node.nodes.some(child => child.type === 'rule' || child.type === 'atrule')) {
        warnings.add('Se conservó una regla anidada completa: ' + node.selector)
      }
      const selector = node.type === 'rule' ? node.selector : '@' + node.name + (node.params ? ' ' + node.params : '')
      const owner = node.type === 'rule' ? ownerOf(selector) : owners.get(node.params) ?? 'general'
      const decision = node.type === 'rule' ? score(node, options) :
        { category: node.name === 'font-face' ? 'base' as const : 'module' as const, confidence: 'high' as const }
      const id = entries.length
      const chosen = overrides[id] && categories.includes(overrides[id]) ? overrides[id] : decision.category
      entries.push({ id, selector, category: chosen, confidence: decision.confidence, owner, path: path.join(' › ') })
      const mix = options.split && overrides[id] === undefined && node.type === 'rule' && chosen === 'module' &&
        node.nodes.every(child => child.type === 'decl') && new Set(node.nodes.map(child => child.type === 'decl' ? child.prop : '')).size === node.nodes.length
      const pieces = new Map<Category, ChildNode>()
      if (mix && node.type === 'rule') {
        for (const decl of node.nodes) if (decl.type === 'decl') {
          const category = isLayout(decl.prop, decl.value) ? 'layout' : isTheme(decl.prop) ? 'theme' : 'module'
          let section = pieces.get(category)
          if (!section) {
            section = node.clone({ nodes: [] })
            pieces.set(category, section)
          }
          if (section.type === 'rule') section.append(decl.clone())
        }
        if (pieces.size > 1) warnings.add('Separación experimental de declaraciones: ' + selector)
      }
      if (pieces.size <= 1) { pieces.clear(); pieces.set(chosen, node.clone()) }
      categorized.set(node, [...pieces].map(([category, piece]) => ({ node: piece, category, owner })))
      for (const [category, piece] of pieces) if (piece.type === 'rule') {
        const simple = piece.selector.match(/^\.([a-z][\w-]*)$/i)
        if (simple) {
          if (!candidates.has(simple[1])) candidates.set(simple[1], new Set())
          candidates.get(simple[1])?.add(category)
        }
        piece.walkDecls(decl => {
          const prop = decl.prop.startsWith('--') ? decl.prop : decl.prop.toLowerCase().split('-')[0]
          if (!safety.has(prop)) safety.set(prop, new Set())
          safety.get(prop)?.add(category)
        })
      }
    }
  }
  function wrap(node: ChildNode, path: string[]) {
    let out = node
    for (const group of [...path].reverse()) {
      const split = group.indexOf(' ')
      out = postcss.atRule({ name: group.slice(1, split), params: group.slice(split + 1), nodes: [out] })
    }
    return out
  }
  const changes: Rename[] = []
  const available = new Set<string>()
  for (const name of ambiguous) available.add(name)
  visit(input, [])
  for (const name of candidates.keys()) available.add(name)
  if (options.prefix) for (const [name, uses] of candidates) {
    if (uses.size !== 1) continue
    const category = [...uses][0]
    const value = category === 'layout' ? 'l-' : category === 'state' ? 'is-' : category === 'theme' ? 'theme-' : ''
    if (!value || /^(?:l|is|has|theme)-/.test(name)) continue
    const after = value + name
    if (ambiguous.has(name) || available.has(after)) {
      warnings.add('Prefijo omitido por selector complejo o colisión: .' + name)
      continue
    }
    changes.push({ before: name, after })
    available.add(after)
  }
  const rename = new Map(changes.map(({ before, after }) => ['.' + before, '.' + after]))
  const chunks = new Map<string, { category: Category; ast: ReturnType<typeof postcss.root> }>()
  function add(container: Container, path: string[]) {
    for (const node of container.nodes ?? []) {
      if (node.type === 'atrule' && conditional(node.name) && node.nodes) {
        add(node, [...path, '@' + node.name + ' ' + node.params])
      }
      for (const part of categorized.get(node) ?? []) {
        const key = part.category === 'module' && options.output === 'files' && options.owners === 'owner' ?
          'modules/' + part.owner + '.css' : part.category + '.css'
        if (!chunks.has(key)) chunks.set(key, { category: part.category, ast: postcss.root() })
        if (part.node.type === 'rule') part.node.selector = rename.get(part.node.selector) ?? part.node.selector
        chunks.get(key)?.ast.append(wrap(part.node, path))
      }
    }
  }
  add(input, [])
  const conflicts = [...safety].filter(([, groups]) => groups.size > 1).map(([property, groups]) => ({ property, groups: [...groups] }))
  const files: Record<string, string> = {}
  const layers = postcss.root()
  layers.append(...prelude.nodes.map(node => node.clone()))
  layers.append(postcss.atRule({ name: 'layer', params: categories.join(', ') }))
  const sequence = [...chunks].sort(([, a], [, b]) => categories.indexOf(a.category) - categories.indexOf(b.category))
  for (const [name, { category, ast }] of sequence) {
    files[name] = ast.toString()
    layers.append(postcss.atRule({ name: 'layer', params: category, nodes: ast.nodes.map(node => node.clone()) }))
  }
  const directives = prelude.nodes.filter(node => node.type === 'comment' ||
    node.type === 'atrule' && /^(?:charset|import)$/.test(node.name))
  const namespace = prelude.nodes.filter(node => node.type === 'atrule' && node.name === 'namespace')
  const special = prelude.nodes.filter(node => !directives.includes(node) && !namespace.includes(node))
  if (namespace.length) for (const [name, { ast }] of sequence) {
    files[name] = postcss.root({ nodes: [...namespace.map(node => node.clone()), ...ast.nodes.map(node => node.clone())] }).toString()
  }
  const main = [
    postcss.root({ nodes: directives.map(node => node.clone()) }).toString(),
    ...sequence.map(([name]) => '@import "./' + name + '";'),
    postcss.root({ nodes: [...namespace, ...special].map(node => node.clone()) }).toString(),
  ].filter(Boolean).join('\n')
  files['main.css'] = main
  return { entries, warnings: [...warnings], conflicts, changes, files, css: options.output === 'layers' ? layers.toString() : main }
}
