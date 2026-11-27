import DOMPurify from 'dompurify'
import { htmlText } from '../../lib/html-sandbox'
import { inertFragment, rasterData, safeUrl } from '../../lib/html/inert'
import {
  allowedAttributes,
  bump,
  isRemoteImage,
  removeComments,
  renameTag,
  safeSrcset,
  sanitizeNode,
  tags,
  unwrap,
  type Count,
} from '../../lib/html/sanitize'
import type { State } from './logic'
import { maxBytes, sizeOf } from './source'

export type Report = {
  safety: Count
  normal: Count
  before: Count
  after: Count
  warnings: string[]
  sourceBytes: number
  cleanBytes: number
}
type Meta = { style: string; className: string; hidden: boolean }
type Context = {
  report: Report
  meta: WeakMap<Element, Meta>
  signal: AbortSignal
  base?: URL
}
const tally = (root: Element) =>
  Array.from(root.querySelectorAll('*')).reduce<Count>((map, el) => {
    bump(map, el.localName)
    return map
  }, {})
const wrappers = 'span,b,strong,i,em,u,a,s,sub,sup'
const blank = 'p,div,li,h1,h2,h3,h4,h5,h6,' + wrappers
const blocks = new Set(
  'address article aside blockquote details div dl figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td th thead tr ul'.split(
    ' ',
  ),
)
const tracking =
  /^(?:utm_|mc_cid$|mc_eid$|fbclid$|gclid$|dclid$|msclkid$|igshid$)/i
const hidden = /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i
const pixels =
  /(?:doubleclick\.net|google-analytics\.com|tracking\.|pixel\.|\/pixel(?:[.?/]|$))/i
const markdownUnsafe = /[\u200b-\u200d\u2060\ufeff]/g

async function batches<T>(
  nodes: Iterable<T>,
  signal: AbortSignal,
  callback: (node: T) => void,
) {
  let tick = 0
  for (const clone of nodes) {
    callback(clone)
    if (++tick % 350 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      signal.throwIfAborted()
    }
  }
  signal.throwIfAborted()
}
function selector(root: Element, query: string) {
  try {
    return [...root.querySelectorAll(query)]
  } catch {
    throw new Error('El selector CSS no es válido: ' + query)
  }
}
function mainContent(root: Element) {
  const articles = Array.from(root.querySelectorAll('article'))
  const preferred = articles.find(article => article.querySelector('h1'))
    ?? root.querySelector('main, [role="main"]') ?? articles[0]
  if (preferred) return preferred
  let best: Element | undefined,
    score = 200
  for (const node of root.querySelectorAll('section,div')) {
    const text = node.textContent.length
    if (text < score) continue
    const links = Array.from(node.querySelectorAll('a')).reduce(
      (n, a) => n + a.textContent.length,
      0,
    )
    const quality = text - links * 2.7
    if (quality > score) {
      score = quality
      best = node
    }
  }
  return best
}
function validBase(input: string) {
  if (!input) return
  try {
    const value = new URL(input)
    if (
      ['http:', 'https:'].includes(value.protocol) &&
      !value.username &&
      !value.password
    )
      return value
  } catch {
    /* Report invalid URLs at the call site. */
  }
  throw new Error('La URL base debe ser HTTP o HTTPS absoluta.')
}
async function sanitize(root: HTMLElement, state: State, ctx: Context) {
  const { safety, warnings } = ctx.report
  if (state.keep.trim()) {
    const candidates = selector(root, state.keep.trim())
    const top = new Set(candidates)
    const nodes = candidates.filter((item) => {
      for (
        let parent = item.parentElement;
        parent && parent !== root;
        parent = parent.parentElement
      )
        if (top.has(parent)) return false
      return true
    })
    if (nodes.length) {
      const selected = root.ownerDocument.createDocumentFragment()
      for (const node of nodes) selected.append(node)
      root.replaceChildren(selected)
      bump(safety, 'keepMatches', nodes.length)
    } else warnings.push('El selector «mantener solo» no encontró elementos.')
  }
  if (state.remove.trim()) {
    const matches = selector(root, state.remove.trim())
    for (const node of matches) node.remove()
    bump(safety, 'selectorMatches', matches.length)
  }
  if (state.main && !state.keep.trim()) {
    const inner = mainContent(root)
    if (inner) {
      root.replaceChildren(inner)
      warnings.push(
        'Contenido principal extraído de <' + inner.localName + '>.',
      )
    } else
      warnings.push(
        'No se encontró un bloque principal claramente identificable.',
      )
  }
  removeComments(root, safety)
  await batches(root.querySelectorAll('*'), ctx.signal, (node) => {
    if (!root.contains(node)) return
    const style = node.getAttribute('style') ?? '',
      className = node.getAttribute('class') ?? ''
    const invisible = node.hasAttribute('hidden') || hidden.test(style)
    ctx.meta.set(node, { style, className, hidden: invisible })
    if (state.hidden && invisible) {
      bump(safety, 'hidden')
      node.remove()
      return
    }
    if (
      state.chrome &&
      (node.matches(
        'nav,aside,[role="banner"],[role="navigation"],header:not(article header,main header),footer:not(article footer)',
      ) ||
        /(?:^|\s)(?:advertisement|advert|comments)(?:\s|$)/i.test(className))
    ) {
      bump(safety, 'chrome')
      node.remove()
      return
    }
    if (state.quotes && /(?:^|\s)gmail_quote(?:\s|$)/.test(className)) {
      bump(safety, 'quotes')
      node.remove()
      return
    }
    if (
      state.forms &&
      node.matches('form,button,input,select,textarea') &&
      !(state.gfm && node.matches('li > input[type=checkbox]'))
    ) {
      node.localName === 'form' ? unwrap(node) : node.remove()
      bump(safety, 'forms')
      return
    }
    if (state.tracking && node.localName === 'img') {
      const dim = ['width', 'height'].map((n) =>
        node.hasAttribute(n) ? Number(node.getAttribute(n)) : Number.NaN,
      )
      if (
        dim.some((n) => n === 0) ||
        dim.every((n) => n === 1) ||
        pixels.test(node.getAttribute('src') ?? '')
      ) {
        node.remove()
        bump(safety, 'pixels')
        return
      }
    }
    sanitizeNode(node, safety)
  })
}
function normalizeLink(node: Element, state: State, ctx: Context) {
  for (const name of ['src', 'href', 'cite']) {
    const raw = node.getAttribute(name)
    if (!raw) continue
    if (rasterData.test(raw)) {
      if (state.dropDataImages) {
        node.removeAttribute(name)
        bump(ctx.report.normal, 'images')
      } else if (raw.length > state.dataLimit * 1024)
        ctx.report.warnings.push(
          'Se conservó una imagen incrustada que supera ' +
            state.dataLimit +
            ' kB.',
        )
      continue
    }
    try {
      const address = new URL(raw, ctx.base ?? 'https://frontkit.invalid/')
      let url = address
      if (name === 'href' && state.unwrapRedirects) {
        const wrapped =
          /(?:^|\.)google\.[a-z.]+$/i.test(address.hostname) &&
          address.pathname === '/url'
            ? (address.searchParams.get('q') ?? address.searchParams.get('url'))
            : /(?:^|\.)safelinks\.protection\.outlook\.com$/i.test(
                  address.hostname,
                )
              ? address.searchParams.get('url')
              : null
        if (wrapped && /^https?:\/\//i.test(wrapped) && safeUrl(wrapped)) {
          url = new URL(wrapped)
          bump(ctx.report.normal, 'redirects')
        }
      }
      const absolute =
        !!ctx.base ||
        /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw) ||
        address !== url
      const before = url.search
      if (state.stripParams)
        for (const key of [...url.searchParams.keys()])
          if (tracking.test(key)) {
            url.searchParams.delete(key)
            bump(ctx.report.normal, 'parameters')
          }
      if (absolute && !raw.startsWith('#')) node.setAttribute(name, url.href)
      else if (before !== url.search) {
        const index = raw.search(/[?#]/)
        node.setAttribute(
          name,
          raw.slice(0, index < 0 ? raw.length : index) + url.search + url.hash,
        )
      }
    } catch {
      /* Already screened by the security pass. */
    }
  }
  if (ctx.base && node.hasAttribute('srcset'))
    node.setAttribute(
      'srcset',
      safeSrcset(node.getAttribute('srcset')!, ctx.base),
    )
}
function wordLists(root: Element, ctx: Context) {
  let stack: { list: Element; last?: Element; numbered: boolean }[] = []
  let previous: Element | undefined
  for (const node of Array.from(root.querySelectorAll('p'))) {
    const source = ctx.meta.get(node)
    const marker = node.textContent.match(
      /^\s*(?:([•·●▪◦])|([0-9]{1,3})[.)])\s*/u,
    )
    const marked =
      source &&
      /msolistparagraph|mso-list\s*:/i.test(
        source.className + ' ' + source.style,
      )
    if (!node.parentElement || (!marker && !marked)) {
      stack = []
      previous = undefined
      continue
    }
    if (!previous || node.previousElementSibling !== previous) {
      stack = []
    }
    const depth = Math.min(
      stack.length,
      Math.max(0, Number(source?.style.match(/\blevel(\d+)/i)?.[1] ?? 1) - 1),
    )
    const numbered = Boolean(marker?.[2])
    if (!stack[depth] || stack[depth]!.numbered !== numbered) {
      const list = root.ownerDocument.createElement(numbered ? 'ol' : 'ul')
      if (numbered && Number(marker?.[2]) > 1)
        list.setAttribute('start', marker![2]!)
      if (depth && stack[depth - 1]?.last) stack[depth - 1]!.last!.append(list)
      else node.before(list)
      stack[depth] = { list, numbered }
    }
    stack.length = depth + 1
    const item = root.ownerDocument.createElement('li')
    if (marker) {
      const walker = root.ownerDocument.createTreeWalker(node, 4)
      let remaining = marker[0].length
      while (remaining && walker.nextNode()) {
        const text = walker.currentNode as Text,
          remove = Math.min(remaining, text.data.length)
        text.deleteData(0, remove)
        remaining -= remove
      }
    }
    item.append(...node.childNodes)
    stack[depth]!.list.append(item)
    stack[depth]!.last = item
    previous = stack[0]!.list
    node.remove()
    bump(ctx.report.normal, 'lists')
  }
}
function semantic(
  node: Element,
  source: Meta | undefined,
  state: State,
  count: Count,
) {
  if (
    node.matches('b') &&
    /docs-internal-guid-/i.test(node.id) &&
    /font-weight\s*:\s*normal/i.test(source?.style ?? '')
  ) {
    unwrap(node)
    return node
  }
  if (node.matches('b,i')) {
    bump(count, 'styles')
    return renameTag(node, node.localName === 'b' ? 'strong' : 'em')
  }
  if (!node.matches('span,p,div') || !source?.style) return node
  const map: [RegExp, string][] = [
    [/font-weight\s*:\s*(?:bold|[7-9]00)\b/i, 'strong'],
    [/font-style\s*:\s*italic\b/i, 'em'],
    [/text-decoration(?:-line)?\s*:[^;]*line-through/i, 's'],
    [/vertical-align\s*:\s*super\b/i, 'sup'],
    [/vertical-align\s*:\s*sub\b/i, 'sub'],
  ]
  if (state.underline)
    map.push([/text-decoration(?:-line)?\s*:[^;]*underline/i, 'u'])
  let current = node
  for (const [regex, tag] of map)
    if (regex.test(source.style)) {
      const inner = node.ownerDocument.createElement(tag)
      inner.append(...current.childNodes)
      current.append(inner)
      current = inner
      bump(count, 'styles')
    }
  return node
}
function ownTableRows(table: Element) {
  return Array.from((table as HTMLTableElement).rows).map((row) =>
    Array.from(row.cells),
  )
}
function flattenTable(table: Element) {
  const rows = ownTableRows(table)
  const fallback = table.ownerDocument.createDocumentFragment()
  for (const row of rows) {
    const div = table.ownerDocument.createElement('div')
    for (const cell of row) {
      const part = table.ownerDocument.createElement('div')
      part.append(...cell.childNodes)
      div.append(part)
    }
    fallback.append(div)
  }
  table.replaceWith(fallback)
}
async function normalize(root: HTMLElement, state: State, ctx: Context) {
  const n = ctx.report.normal
  if (state.wordLists) wordLists(root, ctx)
  await batches(root.querySelectorAll('*'), ctx.signal, (node) => {
    if (!root.contains(node)) return
    const original = ctx.meta.get(node)
    normalizeLink(node, state, ctx)
    if (node.matches('a') && !node.getAttribute('href')) {
      unwrap(node)
      bump(n, 'elements')
      return
    }
    if (state.semantic) node = semantic(node, original, state, n)
    if (!root.contains(node)) return
    if (
      state.emailTables &&
      node.matches('table') &&
      (node.getAttribute('role') === 'presentation' ||
        !node.querySelector('th'))
    ) {
      flattenTable(node)
      bump(n, 'tables')
      return
    }
    if (!state.keepId && node.hasAttribute('id')) {
      node.removeAttribute('id')
      bump(n, 'attributes')
    }
    if (
      node.hasAttribute('class') &&
      !(node.localName === 'code' && /^language-[\w+-]+$/.test(node.className))
    ) {
      if (state.classes === 'none') {
        node.removeAttribute('class')
        bump(n, 'attributes')
      }
      if (state.classes === 'office') {
        const clean = node.className
          .split(/\s+/)
          .filter((token) => !/^mso/i.test(token))
          .join(' ')
        if (clean !== node.className) {
          if (clean) node.setAttribute('class', clean)
          else node.removeAttribute('class')
          bump(n, 'attributes')
        }
      }
    }
    for (const attr of Array.from(node.attributes))
      if (
        (!state.keepData && attr.name.startsWith('data-')) ||
        (!state.keepAria &&
          (attr.name.startsWith('aria-') || attr.name === 'role'))
      ) {
        node.removeAttribute(attr.name)
        bump(n, 'attributes')
      }
    if (node.matches('span') && !node.attributes.length) {
      unwrap(node)
      bump(n, 'elements')
      return
    }
    if (node.matches('li') && node.querySelector(':scope > p')) {
      const pars = node.querySelectorAll(':scope > p')
      if (pars.length === 1 && node.firstElementChild === pars[0])
        unwrap(pars[0]!)
    }
    if (
      state.headings &&
      node.matches('p') &&
      ((node.children.length === 1 &&
        node.firstElementChild?.matches('strong,b') &&
        node.textContent.trim() ===
          node.firstElementChild.textContent.trim()) ||
        /font-size\s*:\s*(?:[3-9]\d)px/i.test(original?.style ?? ''))
    ) {
      renameTag(node, 'h2')
      bump(n, 'headings')
      return
    }
    if (node.matches('div')) {
      if (state.divs === 'unwrap') {
        unwrap(node)
        bump(n, 'elements')
      } else if (
        state.divs === 'paragraph' &&
        Array.from(node.children).every((child) => !blocks.has(child.localName))
      ) {
        renameTag(node, 'p')
        bump(n, 'elements')
      }
    }
  })
  const walk = root.ownerDocument.createTreeWalker(root, 4),
    texts: Text[] = []
  while (walk.nextNode()) texts.push(walk.currentNode as Text)
  await batches(texts, ctx.signal, (text) => {
    if (text.parentElement?.closest('pre,code,textarea')) return
    const original = text.data
    if (state.invisibles) text.data = text.data.replace(markdownUnsafe, '')
    if (state.straight)
      text.data = text.data.replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'")
    if (state.spaces) text.data = text.data.replace(/[\s\u00a0]+/g, ' ')
    if (original !== text.data) bump(n, 'text')
  })
  if (state.paragraphs) {
    for (const p of root.querySelectorAll('p')) {
      let part = p
      for (const br of Array.from(p.querySelectorAll(':scope > br + br'))) {
        if (br.parentElement !== part) continue
        const previous = br.previousSibling
        if (
          !(previous instanceof HTMLBRElement) &&
          (previous as Element | undefined)?.localName !== 'br'
        )
          continue
        const next = root.ownerDocument.createElement('p')
        while (br.nextSibling) next.append(br.nextSibling)
        previous?.remove()
        br.remove()
        part.after(next)
        part = next
        bump(n, 'paragraphs')
      }
    }
  }
  if (state.empty)
    await batches(
      Array.from(root.querySelectorAll(blank)).reverse(),
      ctx.signal,
      (node) => {
        if (
          root.contains(node) &&
          !node.textContent.trim() &&
          !node.querySelector('img,br,hr,input,td,th')
        ) {
          node.remove()
          bump(n, 'empty')
        }
      },
    )
  await batches(root.querySelectorAll(wrappers), ctx.signal, (node) => {
    let next = node.nextSibling
    while (
      next?.nodeType === 1 &&
      (next as Element).localName === node.localName &&
      !node.attributes.length &&
      !(next as Element).attributes.length
    ) {
      while (next.firstChild) node.append(next.firstChild)
      next.parentNode?.removeChild(next)
      bump(n, 'merged')
      next = node.nextSibling
    }
  })
  let previous = 0
  for (const node of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const level = Number(node.localName[1]),
      shift = Math.max(1, Math.min(6, level + state.shift))
    const target =
      state.hierarchy && previous && shift > previous + 1 ? previous + 1 : shift
    if (target !== level) {
      renameTag(node, 'h' + target)
      bump(n, 'headings')
    }
    previous = target
  }
}
function verified(root: HTMLElement, report: Report) {
  const config = {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['style', 'template', 'script', 'svg', 'math'],
    FORBID_ATTR: ['style', 'srcdoc'],
    RETURN_DOM_FRAGMENT: true as const,
  }
  const clean = DOMPurify.sanitize(root.innerHTML, config)
  if (
    DOMPurify.removed.length &&
    !report.warnings.includes(
      'DOMPurify aplicó correcciones adicionales de seguridad.',
    )
  )
    report.warnings.push(
      'DOMPurify aplicó correcciones adicionales de seguridad.',
    )
  const safe = root.ownerDocument.createElement('div')
  safe.append(clean)
  for (const node of safe.querySelectorAll('*')) {
    const sorted = Array.from(node.attributes)
      .map((a) => [a.name, a.value] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    for (const [name] of sorted) node.removeAttribute(name)
    for (const [name, value] of sorted) node.setAttribute(name, value)
  }
  const serialized = safe.innerHTML
  const reparsed = inertFragment(serialized)
  if (reparsed.innerHTML !== serialized) {
    report.warnings.push(
      'La serialización cambió al volver a analizarla y se saneó de nuevo.',
    )
    const stable = DOMPurify.sanitize(serialized, {
      ...config,
      RETURN_DOM_FRAGMENT: false,
    })
    return inertFragment(stable)
  }
  return safe
}
export function looksLikeSource(value: string) {
  const source = value.trimStart().replace(/^(?:<!--[\s\S]*?-->\s*)+/, '')
  if (/^<!doctype\s+html\b/i.test(source)) return true
  const tag = source.match(/^<([a-z][\w-]*)\b[^>]*>/i)
  if (!tag) return false
  return /^(?:area|base|br|col|hr|img|input|link|meta|source|wbr)$/i.test(tag[1]!)
    || /<\/[a-z][\w-]*\s*>/i.test(source)
}
export function clipboardMarkup(plain: string, rich: string) {
  if (looksLikeSource(plain) || !rich) return plain
  if (/^\s*&(?:lt|#60|#x3c);/i.test(plain)) {
    const decoded = inertFragment(plain)
    if (!decoded.children.length && looksLikeSource(decoded.textContent)) return decoded.textContent
  }
  if (!plain && rich) {
    const root = inertFragment(rich)
    if (looksLikeSource(root.textContent)) return root.textContent
  }
  return rich
}

export async function pipeline(
  input: string,
  state: State,
  baseUrl: string,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const sourceBytes = sizeOf(input)
  if (sourceBytes > maxBytes) throw new Error('El límite de entrada es 2 MB.')
  let source = input
  let root = inertFragment(source)
  // Source copied from a code viewer can arrive as one layer of HTML entities.
  if (!root.children.length && looksLikeSource(root.textContent) && root.textContent !== input) {
    source = root.textContent
    root = inertFragment(source)
  }
  if (state.articlePage && !state.keep && root.querySelector('article h1') &&
      /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(source.replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim()) ) {
    state = { ...state, main: true, chrome: true }
  }
  const base = validBase(baseUrl)
  const title = root.querySelector('title')?.textContent.trim() ?? ''
  const report: Report = {
    safety: {},
    normal: {},
    before: tally(root),
    after: {},
    warnings: [],
    sourceBytes,
    cleanBytes: 0,
  }
  if (root.innerHTML !== input.trim())
    report.warnings.push(
      'El navegador ha interpretado y normalizado el HTML de entrada.',
    )
  const ctx: Context = { report, meta: new WeakMap(), signal, base }
  progress(15)
  await sanitize(root, state, ctx)
  const sanitized = verified(root, report).innerHTML
  progress(48)
  if (state.phase !== 'sanitize') await normalize(root, state, ctx)
  const cleaned =
    state.phase === 'sanitize'
      ? inertFragment(sanitized)
      : verified(root, report)
  report.after = tally(cleaned)
  report.cleanBytes = sizeOf(cleaned.innerHTML)
  progress(76)
  return {
    root: cleaned,
    sanitized,
    report,
    title: title || cleaned.querySelector('h1')?.textContent.trim() || '',
  }
}
export function previewDocument(root: Element, remote: boolean) {
  const copy = root.cloneNode(true) as Element
  for (const node of copy.querySelectorAll('a')) node.removeAttribute('href')
  for (const node of copy.querySelectorAll('img')) {
    if (!remote) {
      if (isRemoteImage(node.getAttribute('src') ?? ''))
        node.removeAttribute('src')
      node.removeAttribute('srcset')
    }
    node.setAttribute('referrerpolicy', 'no-referrer')
  }
  return (
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:' +
    (remote ? ' https: http:' : '') +
    "; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'\"><style>body{margin:1rem;font:1rem/1.5 system-ui;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #879791;padding:.3em}</style><body>" +
    copy.innerHTML +
    '</body></html>'
  )
}
export function extractTable(root: Element) {
  const table = root.querySelector('table')
  if (!table) return
  const all = ownTableRows(table)
  if (!all.length) return
  const width = Math.min(16, Math.max(...all.map((row) => row.length)))
  const header = all[0]!.some((cell) => cell.localName === 'th')
    ? all.shift()
    : undefined
  const headers = Array.from(
    { length: width },
    (_, i) =>
      header?.[i]?.textContent?.trim().slice(0, 80) || 'Columna ' + (i + 1),
  )
  return {
    headers,
    values: all
      .slice(0, 1000)
      .map((row) =>
        Array.from(
          { length: width },
          (_, i) => row[i]?.textContent?.trim().slice(0, 300) || '',
        ),
      ),
  }
}
export const titleMarkup = (title: string) =>
  title ? '<title>' + htmlText(title) + '</title>' : ''
