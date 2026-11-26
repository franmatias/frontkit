import postcss, { type Root, type Node } from 'postcss'

export const cssLimit = 200_000
export function parseCss(source: string): Root {
  if (new TextEncoder().encode(source).length > cssLimit) throw new Error('limit')
  const root = postcss.parse(source, { from: undefined })
  let count = 0
  root.walk(node => {
    if (++count > 8000) throw new Error('complexity')
    let depth = 0
    for (let parent: Node | undefined = node.parent; parent; parent = parent.parent) {
      if (++depth > 24) throw new Error('complexity')
    }
  })
  return root
}
export function issue(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) }
  const info = error as Error & { reason?: string; line?: number; column?: number }
  return { message: info.reason ?? info.message, line: info.line, column: info.column }
}
export const conditional = (name: string) => ['media', 'supports', 'container'].includes(name.toLowerCase())
