import postcss, { type AtRule, type Container, type Rule, type Node } from 'postcss'
import { conditional, parseCss } from '../../lib/css-ast'
import { utility } from '../../lib/tailwind/mappings'

export interface ConverterOptions {
  target: 'native-nesting' | 'scss' | 'tailwind-apply'
  bem: 'keep-flat' | 'nest-descendant' | 'scss'
  preserveSpecificity: boolean
  maxDepth: number
  unknown: 'arbitrary' | 'keep'
  variants: boolean
}
export type Report = { selector: string; status: 'converted' | 'review' | 'kept'; detail: string }
export const defaults = (): ConverterOptions => ({
  target: 'native-nesting', bem: 'keep-flat', preserveSpecificity: true, maxDepth: 2, unknown: 'arbitrary', variants: false,
})
function relation(selector: string, options: ConverterOptions) {
  if (selector.includes(',') || selector.includes('&')) return
  const bem = selector.match(/^(\.[\w-]+?)(__|--)([\w-]+)$/)
  if (bem) {
    if (options.target === 'scss' && options.bem === 'scss') return { parent: bem[1], child: '&' + bem[2] + bem[3], review: false }
    if (options.bem === 'nest-descendant' && !options.preserveSpecificity) return { parent: bem[1], child: '& ' + selector, review: true }
    return
  }
  const match = selector.match(/^(\.[a-z_][\w-]*|#[a-z_][\w-]*|[a-z][\w-]*)(?=[.:#\s>+~\[]|$)([\s\S]*)$/i)
  if (!match) return
  return { parent: match[1], child: '&' + match[2], review: false }
}
function simple(rule: Rule) { return rule.nodes.every(node => node.type === 'decl' || node.type === 'comment') }

function nest(container: Container, options: ConverterOptions, report: Report[], depth = 0) {
  if (depth >= options.maxDepth) return
  let group: Rule | undefined
  for (const node of [...(container.nodes ?? [])]) {
    const wrapper = node.type === 'atrule' && conditional(node.name) ? node : undefined
    const child = wrapper?.nodes?.length === 1 ? wrapper.nodes[0] : undefined
    const candidate = node.type === 'rule' ? node : child?.type === 'rule' ? child : undefined
    const split = candidate && simple(candidate) ? relation(candidate.selector, options) : undefined
    if (!split || !candidate) {
      group = undefined
      if (wrapper?.nodes?.length) nest(wrapper, options, report, depth + 1)
      if (candidate) report.push({ selector: candidate.selector, status: 'kept', detail: 'selector' })
      continue
    }
    if (!wrapper && split.child === '&') {
      group = candidate
      report.push({ selector: candidate.selector, status: 'kept', detail: 'order' })
      continue
    }
    if (wrapper && depth + 2 > options.maxDepth) {
      group = undefined
      report.push({ selector: candidate.selector, status: 'kept', detail: 'depth' })
      continue
    }
    if (!group || group.selector !== split.parent) {
      group = postcss.rule({ selector: split.parent })
      node.replaceWith(group)
    } else node.remove()
    const original = candidate.selector
    candidate.selector = split.child
    group.append(node)
    report.push({ selector: original, status: split.review ? 'review' : 'converted', detail: split.review ? 'specificity' : 'nested' })
  }
}

const breakpointVariants: Record<string, string> = { '640px': 'sm', '40rem': 'sm', '768px': 'md', '48rem': 'md', '1024px': 'lg', '64rem': 'lg' }
function apply(root: Container, options: ConverterOptions, report: Report[]) {
  root.walkRules(rule => {
    if (!simple(rule)) return
    for (let parent: Node | undefined = rule.parent; parent; parent = parent.parent) {
      if (parent.type === 'atrule' && /keyframes$/i.test((parent as AtRule).name)) return
    }
    const original = rule.selector
    const pseudo = original.match(/^(\.[\w-]+):(hover|focus|focus-visible|disabled)$/)
    const media = rule.parent?.type === 'atrule' ? rule.parent as AtRule : undefined
    const query = media?.name === 'media' && media.nodes?.length === 1 ?
      media.params.trim().match(/^\(\s*min-width\s*:\s*([\w.]+)\s*\)$/) : null
    const bp = query ? breakpointVariants[query[1]] : media?.name === 'media' && media.nodes?.length === 1 &&
      media.params.trim() === '(prefers-color-scheme: dark)' ? 'dark' : undefined
    const generated = rule.nodes.map(node => node.type === 'decl' ? utility(node.prop, node.value, options.unknown === 'arbitrary') : undefined)
    const variants = options.variants && !options.preserveSpecificity && generated.length > 0 && generated.every(Boolean)
    const prefix = variants ? [bp, pseudo?.[2]].filter(Boolean).map(item => item + ':').join('') : ''
    if (prefix && pseudo) rule.selector = pseudo[1]
    if (prefix && bp && media) media.replaceWith(rule)
    for (const [i, node] of [...rule.nodes].entries()) {
      if (node.type !== 'decl') continue
      const name = generated[i]
      if (!name) {
        report.push({ selector: original, status: 'kept', detail: node.prop })
        continue
      }
      const candidate = prefix + name + (node.important ? '!' : '')
      node.replaceWith(postcss.atRule({ name: 'apply', params: candidate }))
      report.push({ selector: original, status: prefix ? 'review' : 'converted', detail: candidate })
    }
  })
}
export function convert(source: string, options: ConverterOptions) {
  const root = parseCss(source)
  const report: Report[] = []
  if (options.target === 'tailwind-apply') apply(root, options, report)
  else nest(root, options, report)
  return { css: root.toString(), report }
}
