const invisible = /[\u00ad\u200b\u2060\ufeff\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu
const detector = new RegExp(invisible.source, 'u')
export const graphemes = (text: string) => Array.from(new Intl.Segmenter().segment(text), item => item.segment)
export const invisibleCount = (text: string) => [...text.matchAll(invisible)].length
export function markedText(text: string) {
  return text.split(new RegExp('(' + invisible.source + ')','u')).filter(Boolean).map(part => ({
    text: part,
    code: detector.test(part) ? 'U+' + part.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0') : '',
  }))
}
export type CleanOptions = { stripInvisible: boolean; replaceNbsp: boolean; straightQuotes: boolean; collapse: boolean }
export function cleanText(text: string, options: CleanOptions) {
  let value = text.replace(/\r\n?/g, '\n')
  if (options.stripInvisible) value = value.replace(invisible, '')
  if (options.replaceNbsp) value = value.replace(/[\u00a0\u202f]/g, ' ')
  if (options.straightQuotes) value = value.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟«»]/g, '"')
  if (options.collapse) value = value.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return value
}
const safeTags = new Set(['p','div','section','article','br','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','b','em','i','pre','blockquote'])
const suppress = new Set(['script','style','iframe','object','embed','template','svg','math','noscript'])
// Only text and attribute-free, inert tags reach DOMParser.
function inertMarkup(html: string) {
  const tags = /<!--[\s\S]*?(?:-->|$)|<\/?[A-Za-z][\w:-]*(?:[^<>"']|"[^"]*"|'[^']*')*>|<![^<>]*>/g
  const pieces: string[] = []
  const blocked: string[] = []
  let offset = 0
  for (const match of html.matchAll(tags)) {
    const start = match.index ?? 0
    if (!blocked.length) pieces.push(html.slice(offset, start).replaceAll('<', '&lt;'))
    const raw = match[0]
    offset = start + raw.length
    const tag = /^<(\/?)([\w:-]+)/.exec(raw)
    if (!tag) continue
    const [, close, name] = tag
    const lower = name.toLowerCase()
    if (suppress.has(lower)) {
      if (close && blocked.at(-1) === lower) blocked.pop()
      else if (!close && !blocked.length && lower !== 'embed' && !raw.endsWith('/>')) blocked.push(lower)
    } else if (!blocked.length && safeTags.has(lower)) pieces.push('<' + close + lower + '>')
  }
  if (!blocked.length) pieces.push(html.slice(offset).replaceAll('<', '&lt;'))
  return pieces.join('')
}
export function pastedHtml(html: string, markdown: boolean) {
  const doc = new DOMParser().parseFromString(inertMarkup(html.slice(0, 100 * 1024)), 'text/html')
  const listIndexes = new WeakMap<Element, number>()
  function walk(node: Node, depth = 0): string {
    if (depth > 100) return ''
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    const tag = node.nodeName.toLowerCase()
    if (tag === 'br') return '\n'
    const text = [...node.childNodes].map(child => walk(child, depth + 1)).join('')
    if (tag === 'li') {
      const parent = node.parentElement
      let marker = '- '
      if (parent?.tagName === 'OL') {
        const index = (listIndexes.get(parent) ?? 0) + 1
        listIndexes.set(parent, index)
        marker = index + '. '
      }
      return (markdown ? marker : '') + text.trim() + '\n'
    }
    if (markdown && (tag === 'b' || tag === 'strong')) return '**' + text + '**'
    if (markdown && (tag === 'i' || tag === 'em')) return '*' + text + '*'
    if (/^h[1-6]$/.test(tag)) return (markdown ? '#'.repeat(Number(tag[1])) + ' ' : '') + text.trim() + '\n\n'
    if (['p','div','section','article','pre','blockquote','ol','ul'].includes(tag)) return text.trimEnd() + '\n\n'
    return text
  }
  return walk(doc.body).replace(/\n{3,}/g, '\n\n').trim()
}
