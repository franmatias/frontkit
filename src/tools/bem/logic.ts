import type { Rename } from '../../lib/rename'

const limit = 200_000
const className = /^[a-z_][\w-]*$/i
const blocks = new Set(['card', 'button', 'btn', 'nav', 'modal', 'dialog', 'form', 'menu', 'list', 'header', 'footer', 'article', 'aside', 'table'])
const semantic = new Set(['article', 'nav', 'header', 'footer', 'form', 'aside', 'button', 'dialog', 'main', 'section', 'ul', 'ol', 'li'])
const tags: Record<string, string> = { article: 'card', ul: 'list', ol: 'list', li: 'item', a: 'link', img: 'image', p: 'text', h1: 'title', h2: 'title', h3: 'title' }
const kebab = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^\w-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '')
const tokens = (value: string) => value.trim().split(/\s+/).filter(Boolean)
export const defaultDictionary = 'red=danger\ngreen=success\nblue=primary\nyellow=warning\nsmall=sm\nlarge=lg'
export type Options = { elementSep: string; modifierSep: string; namespace: string; keepUnknown: boolean; keepStates: boolean; semantic: boolean; mix: boolean; dictionary: string }
export type Kind = 'block' | 'element' | 'modifier' | 'ignore'
export type Proposal = { index: number; depth: number; tag: string; original: string[]; suggested: string[]; kind: Kind; enabled: boolean; owner: string; name: string; pairs: Rename[] }
export const defaults = (): Options => ({ elementSep: '__', modifierSep: '--', namespace: '', keepUnknown: true, keepStates: true, semantic: true, mix: true, dictionary: defaultDictionary })

function fragment(source: string) {
  if (new TextEncoder().encode(source).length > limit) throw new Error('El HTML supera 200 KB.')
  const template = document.createElement('template')
  template.innerHTML = source
  const nodes = Array.from(template.content.querySelectorAll('*'))
  if (nodes.length > 1800) throw new Error('El fragmento supera 1.800 elementos.')
  return { template, nodes }
}
const stateClass = (token: string) => /^(?:is|has)-/.test(token)
const utility = (token: string) => token.includes(':') || /^(?:p[xytrbl]?|m[xytrbl]?|w|h|text|bg|flex|grid)-\d/.test(token)
const tagName = (node: Element) => tags[node.localName] ?? kebab(node.getAttribute('role') ?? node.localName)
const isBlock = (value: string) => blocks.has(value) || /(?:^|-)(?:card|btn|modal|nav|form|menu)$/.test(value)
const nameFor = (token: string, prefix: string) => kebab(prefix && token.startsWith(prefix) ? token.slice(prefix.length) : token)
function modifier(token: string, dictionary: Map<string, string>) {
  const parts = token.match(/^(.+)-([a-z0-9]+)$/)
  return parts && dictionary.has(parts[2]) ? { base: parts[1], key: dictionary.get(parts[2]) ?? parts[2] } : undefined
}

export function plan(source: string, options: Options) {
  if (!/^[_-]{1,5}$/.test(options.elementSep) || !/^[_-]{1,5}$/.test(options.modifierSep) ||
    options.elementSep === options.modifierSep || !/^(?:[a-z][a-z0-9-]*-)?$/.test(options.namespace)) throw new Error('Revisa el espacio de nombres y los separadores BEM.')
  const { nodes } = fragment(source)
  const dictionary = new Map(options.dictionary.split(/\r?\n/).flatMap(line => {
    const [before, after] = line.split('=').map(value => kebab(value.trim()))
    return before && after ? [[before, after] as const] : []
  }))
  const owners = new Map<Element, string>()
  const proposals: Proposal[] = []
  for (const [index, node] of nodes.entries()) {
    const original = tokens(node.getAttribute('class') ?? '')
    const parent = node.parentElement
    let depth = 0
    for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
      if (++depth > 100) throw new Error('El HTML está demasiado anidado.')
    }
    const owner = parent ? owners.get(parent) ?? '' : ''
    const known = original.find(value => !stateClass(value) && !utility(value) &&
      !value.includes(options.elementSep) && !value.includes(options.modifierSep) && className.test(value))
    const recognized = known ? modifier(known, dictionary) : undefined
    const already = original.find(value => value.includes(options.elementSep))
    const base = known ? nameFor(recognized?.base ?? known, options.namespace) : ''
    const own = (!owner && (Boolean(base) || options.semantic && semantic.has(node.localName))) ||
      Boolean(owner && base && isBlock(base))
    const inferred = tagName(node)
    const newOwner = own ? options.namespace + (base || inferred) : owner
    owners.set(node, newOwner)
    const name = known ? nameFor(known, options.namespace) : inferred
    const element = owner && name ? owner + options.elementSep + name : ''
    const primary = own ? newOwner : already || element
    const kind: Kind = recognized && own ? 'modifier' : own ? 'block' : primary ? 'element' : 'ignore'
    const willAdd = own || Boolean(primary && (known || already || options.semantic && semantic.has(node.localName)))
    const suggested = willAdd ? [
      ...(own && owner && options.mix ? [already || owner + options.elementSep + (base === 'btn' ? 'button' : base || inferred)] : []),
      primary,
      ...(recognized && own ? [primary + options.modifierSep + recognized.key] : []),
      ...original.filter(token => token !== known && (stateClass(token) ? options.keepStates :
        token.includes(options.elementSep) || token.includes(options.modifierSep) || options.keepUnknown)),
    ].filter(Boolean) : original.filter(token => !stateClass(token) || options.keepStates)
    const unique = [...new Set(suggested)]
    if (!original.length && !unique.length) continue
    const pairs = original.flatMap(token => token === known && !unique.includes(token) && primary ? [{ before: token, after: primary }] : [])
    if (recognized && own && pairs.length) pairs[0].after = primary + options.modifierSep + recognized.key
    proposals.push({ index, depth, tag: node.localName, original, suggested: unique, kind, enabled: true, owner, name, pairs })
  }
  return proposals
}

export function apply(source: string, proposals: Proposal[], options: Options) {
  const { template, nodes } = fragment(source)
  const targets = new Map<string, Set<string>>()
  const classes = new Set<string>()
  for (const item of proposals) {
    const enabled = item.enabled && item.kind !== 'ignore'
    const chosen = enabled ? item.suggested : item.original
    if (enabled && chosen.some(name => !className.test(name) && !item.original.includes(name))) throw new Error('Usa nombres de clase válidos y separados por espacios.')
    if (chosen.length) nodes[item.index].setAttribute('class', chosen.join(' '))
    else if (enabled) nodes[item.index].removeAttribute('class')
    for (const name of chosen) if (className.test(name)) classes.add(name)
    for (const previous of item.original) {
      if (!targets.has(previous)) targets.set(previous, new Set())
      const proposed = item.pairs.find(pair => pair.before === previous)?.after
      const next = !enabled || chosen.includes(previous) ? previous
        : proposed && chosen.includes(proposed) ? proposed : proposed && item.pairs.length === 1 ? chosen[0] ?? '' : ''
      targets.get(previous)?.add(next)
    }
  }
  const changes: Rename[] = []
  const conflicts: string[] = []
  const assigned = new Map<string, string[]>()
  for (const [before, next] of targets) {
    if (next.size > 1) { conflicts.push(before); continue }
    const after = [...next][0]
    if (after && after !== before) {
      changes.push({ before, after })
      assigned.set(after, [...(assigned.get(after) ?? []), before])
    }
  }
  for (const [after, names] of assigned) {
    if (names.length > 1 || targets.get(after)?.has(after)) conflicts.push(after)
  }
  const ambiguous = new Set(conflicts)
  const blocksByName = new Map<string, Set<string>>()
  for (const name of classes) {
    if (stateClass(name) || utility(name)) continue
    const element = name.indexOf(options.elementSep)
    const modifier = name.indexOf(options.modifierSep)
    const cut = Math.min(element < 0 ? name.length : element, modifier < 0 ? name.length : modifier)
    const owner = name.slice(0, cut)
    if (!blocksByName.has(owner)) blocksByName.set(owner, new Set())
    if (cut < name.length) blocksByName.get(owner)?.add(name.slice(cut))
  }
  const css = [...classes].map(name => '.' + name + ' {}').join('\n')
  const dialect = [...blocksByName].map(([owner, descendants]) => '.' + owner + ' {\n' +
    [...descendants].map(name => '  &' + name + ' {}').join('\n') + '\n}').join('\n')
  const csv = 'original,nueva\n' + changes.map(item => [item.before, item.after].map(value =>
    '"' + (/^[=+@\t\r-]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"').join(',')).join('\n')
  return { html: template.innerHTML, css, scss: dialect, csv, json: JSON.stringify(changes, null, 2), changes,
    safeChanges: changes.filter(item => !ambiguous.has(item.before) && !ambiguous.has(item.after)), conflicts }
}
