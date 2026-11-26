import { orderedEntries, serialize, type Node } from './parse'

export const pointer = (path: string, part: string | number) => path + '/' + String(part).replaceAll('~', '~0').replaceAll('/', '~1')
export const kinds = ['added', 'removed', 'changed', 'typeChanged', 'moved'] as const
export interface DiffOptions {
  ignoreKeyOrder: boolean
  ignoreArrayOrder: boolean
  arrayKey: string
  ignorePaths: string[]
  numericEquality: boolean
}
export type Change = { kind: (typeof kinds)[number]; path: string; from?: string; before?: string; after?: string }
type Patch = { op: 'add' | 'replace' | 'remove'; path: string; value?: Node }

function canonicalNumber(raw: string) {
  const [significand, exp = '0'] = raw.toLowerCase().split('e')
  if (exp.length > 64) return raw
  const [whole, fraction = ''] = significand.replace(/^-/, '').split('.')
  const digits = (whole + fraction).replace(/^0+/, '')
  if (!digits) return '0'
  const trimmed = digits.replace(/0+$/, '')
  const power = BigInt(exp) - BigInt(fraction.length) + BigInt(digits.length - trimmed.length)
  return (raw.startsWith('-') ? '-' : '') + trimmed + 'e' + power
}
function signature(node: Node, opts: DiffOptions): string {
  if (node.type === 'number' && opts.numericEquality) return canonicalNumber(node.raw)
  if (node.type === 'array') {
    const items = node.items.map(child => signature(child, opts))
    if (opts.ignoreArrayOrder) items.sort()
    return '[' + items.join(',') + ']'
  }
  if (node.type === 'object') {
    return '{' + orderedEntries(node, opts.ignoreKeyOrder).map(([key, child]) => JSON.stringify(key) + ':' + signature(child, opts)).join(',') + '}'
  }
  return serialize(node)
}
function keyed(nodes: Node[], name: string) {
  const output = new Map<string, { node: Node; index: number }>()
  for (const [index, node] of nodes.entries()) {
    const value = node.type === 'object' ? node.entries.find(([key]) => key === name)?.[1] : undefined
    if (!value || (value.type !== 'string' && value.type !== 'number')) return undefined
    const key = value.type === 'string' ? JSON.stringify(value.value) : canonicalNumber(value.raw)
    if (output.has(key)) return undefined
    output.set(key, { node, index })
  }
  return output
}
const describe = (node: Node) => node.type === 'object' ? '{…}' : node.type === 'array' ? '[…]' :
  node.type === 'number' ? node.raw.slice(0, 180) : serialize(node).slice(0, 180)

export function structuralDiff(left: Node, right: Node, opts: DiffOptions) {
  const changes: Change[] = []
  const counts = { added: 0, removed: 0, changed: 0, typeChanged: 0, moved: 0 }
  const ignored = new Set(opts.ignorePaths)
  function record(kind: Change['kind'], path: string, before?: Node, after?: Node, from?: string) {
    counts[kind]++
    if (changes.length < 3000) changes.push({ kind, path, from, before: before && describe(before), after: after && describe(after) })
  }
  function walk(a: Node | undefined, b: Node | undefined, path: string) {
    if (ignored.has(path)) return
    if (!a && b) { record('added', path, undefined, b); return }
    if (!b && a) { record('removed', path, a); return }
    if (!a || !b) return
    if (a.type !== b.type) { record('typeChanged', path, a, b); return }
    if (a.type === 'object' && b.type === 'object') {
      const before = new Map(a.entries)
      const after = new Map(b.entries)
      if (!opts.ignoreKeyOrder && before.size === after.size && [...before.keys()].every(key => after.has(key)) &&
        b.entries.some(([key], i) => key !== a.entries[i][0])) record('changed', path, a, b)
      for (const key of new Set([...before.keys(), ...after.keys()])) walk(before.get(key), after.get(key), pointer(path, key))
      return
    }
    if (a.type === 'array' && b.type === 'array') {
      const from = opts.arrayKey ? keyed(a.items, opts.arrayKey) : undefined
      const to = opts.arrayKey ? keyed(b.items, opts.arrayKey) : undefined
      if (from && to) {
        for (const key of new Set([...from.keys(), ...to.keys()])) {
          const first = from.get(key)
          const last = to.get(key)
          const location = pointer(path, last?.index ?? first!.index)
          if (first && last && first.index !== last.index && !opts.ignoreArrayOrder && !ignored.has(location)) {
            record('moved', location, first.node, last.node, pointer(path, first.index))
          }
          walk(first?.node, last?.node, location)
        }
        return
      }
      if (opts.ignoreArrayOrder) {
        const pool = new Map<string, number[]>()
        const consumed = new Set<number>()
        for (const [i, node] of b.items.entries()) {
          const key = signature(node, opts)
          let bucket = pool.get(key)
          if (!bucket) { bucket = []; pool.set(key, bucket) }
          bucket.push(i)
        }
        for (const [i, node] of a.items.entries()) {
          const index = pool.get(signature(node, opts))?.pop()
          if (index === undefined) walk(node, undefined, pointer(path, i))
          else consumed.add(index)
        }
        for (const [i, node] of b.items.entries()) if (!consumed.has(i)) walk(undefined, node, pointer(path, i))
      } else {
        for (let i = 0; i < Math.max(a.items.length, b.items.length); i++) walk(a.items[i], b.items[i], pointer(path, i))
      }
      return
    }
    if (signature(a, opts) !== signature(b, opts)) record('changed', path, a, b)
  }
  walk(left, right, '')
  return { changes, counts }
}

export function jsonPatch(left: Node, right: Node) {
  const ops: Patch[] = []
  function walk(a: Node, b: Node, path: string) {
    if (a.type === 'object' && b.type === 'object') {
      const before = new Map(a.entries)
      const after = new Map(b.entries)
      for (const key of before.keys()) if (!after.has(key)) ops.push({ op: 'remove', path: pointer(path, key) })
      for (const [key, value] of after) {
        const previous = before.get(key)
        if (previous) walk(previous, value, pointer(path, key))
        else ops.push({ op: 'add', path: pointer(path, key), value })
      }
    } else if (serialize(a) !== serialize(b)) ops.push({ op: 'replace', path, value: b })
  }
  walk(left, right, '')
  return '[\n' + ops.map(op => '  {"op":' + JSON.stringify(op.op) + ',"path":' +
    JSON.stringify(op.path) + (op.value ? ',"value":' + serialize(op.value) : '') + '}').join(',\n') + '\n]'
}
