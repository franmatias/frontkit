import { inertFragment, rasterData, safeUrl, unsafeElements } from './inert'
export const tags =
  'a abbr address article aside b bdi bdo blockquote br button caption cite code col colgroup dd del details dfn div dl dt em figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i img input ins kbd label li main mark nav ol option p picture pre q rp rt ruby s samp section select small span strong sub summary sup table tbody td textarea tfoot th thead time tr u ul var wbr'.split(
    ' ',
  )
const allow = new Set(tags)
const attributes: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes'],
  th: ['colspan', 'rowspan', 'scope', 'headers'],
  td: ['colspan', 'rowspan', 'headers'],
  ol: ['start', 'reversed', 'type'],
  li: ['value'],
  time: ['datetime'],
  blockquote: ['cite'],
  q: ['cite'],
  col: ['span'],
  colgroup: ['span'],
  input: ['type', 'checked', 'disabled'],
  button: ['type', 'disabled'],
  textarea: ['disabled'],
  select: ['disabled', 'multiple'],
  option: ['selected', 'disabled'],
  details: ['open'],
}
export type Count = Record<string, number>
export const bump = (count: Count, key: string, amount = 1) => {
  count[key] = (count[key] ?? 0) + amount
}
export function unwrap(node: Element) {
  const fragment = node.ownerDocument.createDocumentFragment()
  while (node.firstChild) fragment.append(node.firstChild)
  node.replaceWith(fragment)
}
export const renameTag = (node: Element, tag: string) => {
  const replacement = node.ownerDocument.createElement(tag)
  for (const attr of Array.from(node.attributes))
    replacement.setAttribute(attr.name, attr.value)
  while (node.firstChild) replacement.append(node.firstChild)
  node.replaceWith(replacement)
  return replacement
}
const global = ['lang', 'dir', 'title', 'id', 'class', 'role']
export const allowedAttributes = [
  ...new Set([...global, ...Object.values(attributes).flat()]),
]
export function linkTarget(node: Element) {
  if (node.localName !== 'a' || node.getAttribute('target') !== '_blank') {
    node.removeAttribute('target')
    node.removeAttribute('rel')
  } else node.setAttribute('rel', 'noopener noreferrer')
}
export function safeSrcset(value: string, base?: URL) {
  if (/data:/i.test(value)) return ''
  return value
    .split(',')
    .flatMap((candidate) => {
      const parts = candidate.trim().split(/\s+/)
      if (
        parts.length > 2 ||
        !safeUrl(parts[0] ?? '') ||
        (parts[1] && !/^(?:\d+w|(?:\d+(?:\.\d+)?)x)$/.test(parts[1]))
      )
        return []
      return [
        (base ? new URL(parts[0]!, base).href : parts[0]) +
          (parts[1] ? ' ' + parts[1] : ''),
      ]
    })
    .join(', ')
}
export function sanitizeNode(node: Element, report: Count) {
  if (
    node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
    node.matches(unsafeElements + ',head,title,meta,xml')
  ) {
    node.remove()
    bump(
      report,
      node.localName === 'script'
        ? 'scripts'
        : node.localName === 'style'
          ? 'styles'
          : 'elements',
    )
    return
  }
  if (!allow.has(node.localName)) {
    unwrap(node)
    bump(report, 'elements')
    return
  }
  for (const attr of Array.from(node.attributes)) {
    const { name, value } = attr
    const present =
      global.includes(name) ||
      /^(aria|data)-[a-z][\w.-]*$/.test(name) ||
      attributes[node.localName]?.includes(name)
    const isUrl = ['href', 'src', 'cite'].includes(name)
    if (
      !present ||
      (isUrl &&
        !safeUrl(
          value,
          name === 'href',
          node.localName === 'img' && name === 'src',
        ))
    ) {
      node.removeAttribute(name)
      bump(report, isUrl ? 'urls' : 'attributes')
      continue
    }
    if (name === 'srcset') {
      const srcset = safeSrcset(value)
      if (srcset) node.setAttribute(name, srcset)
      else node.removeAttribute(name)
      if (srcset !== value) bump(report, 'urls')
    }
  }
  if (node.localName === 'input' && node.getAttribute('type') !== 'checkbox') {
    node.remove()
    bump(report, 'elements')
  }
  if (node.localName === 'button') node.setAttribute('type', 'button')
  if (node.localName === 'a') linkTarget(node)
}
export function removeComments(root: Element, count: Count) {
  const cursor = root.ownerDocument.createTreeWalker(root, 128)
  const comments: ChildNode[] = []
  while (cursor.nextNode()) comments.push(cursor.currentNode as ChildNode)
  for (const comment of comments) comment.remove()
  if (comments.length) bump(count, 'comments', comments.length)
}
export function minimalFragment(html: string) {
  const root = inertFragment(html),
    count = {}
  for (const node of Array.from(root.querySelectorAll('*')))
    if (root.contains(node)) sanitizeNode(node, count)
  removeComments(root, count)
  return root
}
export function isRemoteImage(value: string) {
  return value && !rasterData.test(value)
}
