import postcss from 'postcss'
import { parseCss } from '../css-ast'

export type Rename = { before: string; after: string }
export function rewriteCss(source: string, changes: Rename[]) {
  const root = parseCss(source)
  const lookup = new Map(changes.map(item => [item.before, item.after]))
  const review: string[] = []
  root.walkRules(rule => {
    const names = [...rule.selector.matchAll(/\.([a-z_][\w-]*)/gi)].map(item => item[1])
    if (!names.some(name => lookup.has(name))) return
    const match = rule.selector.trim().match(/^\.([a-z_][\w-]*)$/i)
    if (match && lookup.has(match[1])) rule.selector = '.' + lookup.get(match[1])
    else {
      review.push(rule.selector)
      rule.before(postcss.comment({ text: 'revisar: selector con contexto; puede requerir actualización manual' }))
    }
  })
  return { css: root.toString(), review }
}
