import { parse, type ChildNode } from 'postcss'

export const maxInput = 2 * 1024 * 1024
export interface Options {
  mode: 'minify' | 'clean'
  removeComments: boolean
  removeEmptyRules: boolean
  restructure: boolean
  indentSize: 2 | 4
}
export interface Request { source: string; options: Options }

export function processCss(source: string, options: Options) {
  const root = parse(source, { from: undefined })
  if (options.removeComments) root.walkComments(comment => {
    if (!comment.text.startsWith('!')) comment.remove()
  })
  if (options.restructure) root.walkDecls(node => {
    const next = node.next()
    if (next?.type === 'decl' && next.prop === node.prop && next.value === node.value &&
      next.important === node.important && !node.prop.startsWith('--')) node.remove()
  })
  if (options.removeEmptyRules) {
    const emptyCandidates: ChildNode[] = []
    root.walkRules(rule => { emptyCandidates.push(rule) })
    for (const node of emptyCandidates.reverse()) {
      if (node.type === 'rule' && !node.nodes.length) node.remove()
    }
  }
  const clean = options.mode === 'clean'
  function print(nodes: ChildNode[], level = 0): string {
    const indent = clean ? ' '.repeat(level * options.indentSize) : ''
    const nextLine = clean ? '\n' : ''
    return nodes.map((node, index) => {
      if (node.type === 'comment') return indent + '/*' + (node.raws.left ?? '') + node.text + (node.raws.right ?? '') + '*/'
      if (node.type === 'decl') {
        const value = node.raws.value?.value === node.value ? node.raws.value.raw : node.value
        // Whitespace after the colon can be significant in substituted custom property values.
        const between = node.prop.startsWith('--') ? node.raws.between ?? ':' : clean ? ': ' : ':'
        const separator = clean || index !== nodes.length - 1 || level === 0 ? ';' : ''
        return indent + node.prop + between + value + (node.important ? clean ? ' !important' : '!important' : '') + separator
      }
      const head = node.type === 'rule' ? node.selector : '@' + node.name + (node.params ? ' ' + node.params : '')
      if (!node.nodes) return indent + head + ';'
      const body = print(node.nodes, level + 1)
      return indent + head + (clean ? ' ' : '') + '{' + (body ? nextLine + body + nextLine + indent : '') + '}'
    }).join(nextLine)
  }
  return print(root.nodes)
}
