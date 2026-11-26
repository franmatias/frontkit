import { serialize, type Node } from './parse'

export interface TreeRow { path: string; label: string; depth: number; type: Node['type']; value: string; count: number }
export function inspectTree(root: Node, max = 1500) {
  const rows: TreeRow[] = []
  function walk(node: Node, label: string, path: string, depth: number) {
    if (rows.length >= max) return
    const count = node.type === 'object' ? node.entries.length : node.type === 'array' ? node.items.length : 0
    rows.push({ path, label, depth, type: node.type, count, value: node.type === 'array' || node.type === 'object' ? '' : serialize(node).slice(0, 260) })
    if (node.type === 'object') {
      for (const [key, child] of node.entries) {
        if (rows.length >= max) break
        const component = /^[A-Za-z_$][\w$]*$/.test(key) ? '.' + key : '[' + JSON.stringify(key) + ']'
        walk(child, key, path + component, depth + 1)
      }
    } else if (node.type === 'array') {
      for (const [i, child] of node.items.entries()) {
        if (rows.length >= max) break
        walk(child, '[' + i + ']', path + '[' + i + ']', depth + 1)
      }
    }
  }
  walk(root, '$', '$', 0)
  return rows
}
export function inferTypes(root: Node): string {
  let remaining = 1200
  function type(node: Node, depth: number): string {
    if (--remaining < 0 || depth > 14) return 'unknown'
    if (node.type === 'array') {
      const unique = [...new Set(node.items.slice(0, 80).map(child => type(child, depth + 1)))]
      return 'Array<' + (unique.join(' | ') || 'unknown') + '>'
    }
    if (node.type === 'object') {
      const entries = node.entries.slice(0, Math.max(0, remaining))
      return '{ ' + entries.map(([key, child]) => JSON.stringify(key) + ': ' + type(child, depth + 1)).join('; ') +
        (entries.length < node.entries.length ? '; [key: string]: unknown' : '') + ' }'
    }
    return node.type === 'number' && !Number.isSafeInteger(Number(node.raw)) && Number.isInteger(Number(node.raw)) ? 'number /* posible pérdida de precisión */' : node.type
  }
  return 'export type Root = ' + type(root, 0) + ';\n'
}
