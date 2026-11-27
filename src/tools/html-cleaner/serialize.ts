import Turndown from 'turndown'
import { htmlText } from '../../lib/html-sandbox'
import { type Report, titleMarkup } from './pipeline'
import type { State } from './logic'

const block =
  /^(?:address|article|aside|blockquote|details|div|dl|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|thead|tfoot|tr|ul)$/
const voidTag = /^(?:br|col|hr|img|input|wbr)$/
const rowsOf = (node: Node) =>
  Array.from((node as HTMLTableElement).rows).map((row) =>
    Array.from(row.cells),
  )
function htmlNodes(node: Node, state: State, depth: number): string {
  const indent = state.minify
    ? ''
    : ' '.repeat(Math.min(depth, 80) * state.indent)
  if (node.nodeType !== 1) return htmlText(node.textContent ?? '')
  const element = node as Element
  if (depth > 70 || element.matches('pre,textarea')) return element.outerHTML
  const attributes = Array.from(element.attributes)
    .map((attr) => ' ' + attr.name + '="' + htmlText(attr.value) + '"')
    .join('')
  const open = '<' + element.localName + attributes + '>'
  if (voidTag.test(element.localName))
    return state.selfClose ? open.replace(/>$/, ' />') : open
  const closing = '</' + element.localName + '>'
  const nodes = Array.from(element.childNodes)
  const list = nodes.filter(
    (child) => child.nodeType !== 3 || child.textContent?.trim(),
  )
  if (
    !state.minify &&
    list.length &&
    list.every(
      (child) =>
        child.nodeType === 1 && block.test((child as Element).localName),
    )
  ) {
    return (
      open +
      '\n' +
      list
        .map(
          (child) =>
            indent +
            ' '.repeat(state.indent) +
            htmlNodes(child, state, depth + 1),
        )
        .join('\n') +
      '\n' +
      indent +
      closing
    )
  }
  return (
    open +
    nodes.map((child) => htmlNodes(child, state, depth + 1)).join('') +
    closing
  )
}
function markdown(
  root: HTMLElement,
  state: State,
  report: Report,
  title: string,
  source: string,
) {
  const service = new Turndown({
    headingStyle: state.headingStyle,
    bulletListMarker: state.bullet,
    emDelimiter: state.emphasis,
    codeBlockStyle: 'fenced',
    fence: state.fence === 'backtick' ? '```' : '~~~',
    linkStyle: state.links,
    hr: '---',
  })
  service.addRule('lineBreak', {
    filter: 'br',
    replacement: () => (state.hardBreak === 'slash' ? '\\' : '  ') + '\n',
  })
  service.addRule('preserveLanguage', {
    filter: (node) =>
      node.nodeName === 'PRE' &&
      !!node.querySelector('code[class^="language-"]'),
    replacement: (_, node) => {
      const code = (node as Element).querySelector('code')!
      const language = code.className.replace(/^language-/, '')
      const fence = state.fence === 'backtick' ? String.fromCharCode(96) : '~'
      const text = code.textContent ?? ''
      const length = Math.max(
        3,
        ...Array.from(
          text.matchAll(new RegExp(fence + '{3,}', 'g')),
          (match) => match[0].length + 1,
        ),
      )
      return (
        '\n\n' +
        fence.repeat(length) +
        language +
        '\n' +
        text.replace(/\n$/, '') +
        '\n' +
        fence.repeat(length) +
        '\n\n'
      )
    },
  })
  service.addRule('table', {
    filter: 'table',
    replacement: (_, node) => {
      const table = node as HTMLTableElement,
        rows = rowsOf(table)
      const complex = Array.from(table.querySelectorAll('td,th')).some(
        (cell) =>
          cell.hasAttribute('rowspan') ||
          cell.hasAttribute('colspan') ||
          cell.querySelector('p,div,ul,ol,table,pre'),
      )
      if (!state.gfm || complex || !rows.length || !rows[0]?.length) {
        if (complex)
          report.warnings.push(
            'Una tabla con celdas combinadas o contenido complejo no cabe en Markdown GFM.',
          )
        if (state.unknown === 'html') return '\n\n' + table.outerHTML + '\n\n'
        if (state.unknown === 'discard') return ''
        return (
          '\n\n' +
          rows
            .map((row) =>
              row.map((cell) => cell.textContent?.trim() ?? '').join(' | '),
            )
            .join('\n') +
          '\n\n'
        )
      }
      const width = rows[0]!.length
      const values = rows.map((row) =>
        Array.from({ length: width }, (_, i) =>
          row[i]
            ? service
                .turndown(row[i]!)
                .replace(/\s+/g, ' ')
                .replaceAll('|', '\\|')
            : '',
        ),
      )
      if (!rows[0]!.some((cell) => cell.localName === 'th'))
        values.unshift(
          Array.from({ length: width }, (_, i) => 'Columna ' + (i + 1)),
        )
      values.splice(
        1,
        0,
        Array.from({ length: width }, () => '---'),
      )
      return (
        '\n\n' +
        values.map((row) => '| ' + row.join(' | ') + ' |').join('\n') +
        '\n\n'
      )
    },
  })
  if (state.gfm) {
    service.addRule('strike', {
      filter: ['s', 'del'],
      replacement: (text) => (text ? '~~' + text + '~~' : ''),
    })
    service.addRule('task', {
      filter: (node) =>
        node.nodeName === 'INPUT' && node.getAttribute('type') === 'checkbox',
      replacement: (_, node) =>
        node.hasAttribute('checked') ? '[x] ' : '[ ] ',
    })
    service.addRule('autolink', {
      filter: (node) =>
        node.nodeName === 'A' &&
        /^https?:\/\/[^<>\s]+$/.test(node.getAttribute('href') ?? '') &&
        node.textContent === node.getAttribute('href'),
      replacement: (_, node) => '<' + node.getAttribute('href') + '>',
    })
    const tasks = root.querySelectorAll('li > input[type="checkbox"]')
    for (const input of tasks)
      input.after(input.ownerDocument.createTextNode(' '))
  }
  const unknown: (keyof HTMLElementTagNameMap)[] = [
    'details',
    'summary',
    'figure',
    'figcaption',
    'mark',
    'sub',
    'sup',
    'u',
    'abbr',
    'time',
    'ruby',
    'kbd',
  ]
  if (state.unknown === 'html') service.keep(unknown)
  if (state.unknown === 'discard') service.remove(unknown)
  if (root.querySelector('img:not([alt])'))
    report.warnings.push('Hay imágenes sin texto alternativo.')
  const converted = service.turndown(root)
  const metadata = [
    title ? 'title: ' + JSON.stringify(title) : '',
    source ? 'source: ' + JSON.stringify(source) : '',
  ].filter(Boolean)
  return state.frontmatter && metadata.length
    ? '---\n' + metadata.join('\n') + '\n---\n\n' + converted
    : converted
}
function plain(root: HTMLElement, state: State) {
  const notes: string[] = []
  const preserved: string[] = []
  function visit(node: Node, depth = 0): string {
    if (node.nodeType !== 1) return node.textContent ?? ''
    const element = node as Element,
      tag = element.localName
    if (tag === 'img')
      return state.textImages ? (element.getAttribute('alt') ?? '') : ''
    if (tag === 'br') return '\n'
    if (tag === 'hr') return '\n\n---\n\n'
    if (tag === 'pre') {
      preserved.push(element.textContent ?? '')
      return '\n\n\u0000' + (preserved.length - 1) + '\u0000\n\n'
    }
    if (tag === 'table') {
      const rows = rowsOf(element).map((row) =>
        row.map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      )
      if (state.textTable === 'tsv')
        return '\n\n' + rows.map((row) => row.join('\t')).join('\n') + '\n\n'
      const width = Math.max(0, ...rows.map((row) => row.length))
      const columns = Array.from({ length: width }, (_, i) =>
        Math.max(0, ...rows.map((row) => row[i]?.length ?? 0)),
      )
      return (
        '\n\n' +
        rows
          .map((row) =>
            columns
              .map((length, i) => (row[i] ?? '').padEnd(length))
              .join(' | '),
          )
          .join('\n') +
        '\n\n'
      )
    }
    if (depth > 70) return element.textContent ?? ''
    if (tag === 'ol' || tag === 'ul') {
      const items = Array.from(element.children).filter(
        (item) => item.localName === 'li',
      )
      const start = Number(
        element.getAttribute('start') ??
          (element.hasAttribute('reversed') ? items.length : 1),
      )
      const sign = element.hasAttribute('reversed') ? -1 : 1
      return (
        '\n' +
        items
          .map((item, i) => {
            const marker =
              tag === 'ol' ? start + i * sign + '. ' : state.bullet + ' '
            const children = Array.from(item.childNodes)
              .map((child) => visit(child, depth + 1))
              .join('')
              .trimEnd()
            return '  '.repeat(depth) + marker + children.trimStart()
          })
          .join('\n') +
        '\n'
      )
    }
    const text = Array.from(element.childNodes)
      .map((child) => visit(child, depth))
      .join('')
    if (tag === 'a' && element.hasAttribute('href')) {
      const href = element.getAttribute('href')!
      if (state.textLinks === 'inline') return text + ' (' + href + ')'
      if (state.textLinks === 'notes') {
        if (!notes.includes(href)) notes.push(href)
        return text + ' [' + (notes.indexOf(href) + 1) + ']'
      }
    }
    if (tag === 'blockquote' && state.textQuotes)
      return (
        '\n\n' +
        text
          .trim()
          .split('\n')
          .map((line) => '> ' + line)
          .join('\n') +
        '\n\n'
      )
    if (/^h[1-6]$/.test(tag)) {
      const title = text.trim()
      return (
        '\n\n' +
        (state.textHeading === 'uppercase'
          ? title.toLocaleUpperCase('es')
          : title +
            (state.textHeading === 'underline'
              ? '\n' + (tag === 'h1' ? '=' : '-').repeat(title.length)
              : '')) +
        '\n\n'
      )
    }
    return block.test(tag) ? '\n\n' + text.trim() + '\n\n' : text
  }
  let result = Array.from(root.childNodes)
    .map((child) => visit(child))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (notes.length)
    result +=
      '\n\n' + notes.map((url, i) => '[' + (i + 1) + '] ' + url).join('\n')
  if (state.wrap)
    result = result
      .split('\n')
      .map((line) => {
        if (
          line.length <= state.wrap ||
          line.includes('\t') ||
          line.includes(' | ')
        )
          return line
        const lines: string[] = []
        let row = ''
        for (const word of line.split(/ +/)) {
          if (row && row.length + word.length + 1 > state.wrap) {
            lines.push(row)
            row = word
          } else row += (row ? ' ' : '') + word
        }
        return [...lines, row].join('\n')
      })
      .join('\n')
  return result.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Null delimiters preserve code blocks during text wrapping.
    /\u0000(\d+)\u0000/g,
    (_, index: string) => preserved[Number(index)] ?? '',
  )
}
export function serialize(
  root: HTMLElement,
  state: State,
  report: Report,
  title: string,
  source: string,
) {
  const children = Array.from(root.childNodes)
  const onlyBlocks = children.every((node) =>
    node.nodeType === 3
      ? !node.textContent?.trim()
      : node.nodeType === 1 && block.test((node as Element).localName),
  )
  const html = children
    .filter(
      (node) =>
        state.minify ||
        !onlyBlocks ||
        !!node.textContent?.trim() ||
        node.nodeType === 1,
    )
    .map((node) => htmlNodes(node, state, 0))
    .join(onlyBlocks && !state.minify ? '\n' : '')
  const clean = state.document
    ? '<!doctype html>\n<html lang="es">\n<head><meta charset="utf-8">' +
      titleMarkup(title) +
      '</head>\n<body>\n' +
      html +
      '\n</body>\n</html>'
    : html
  const normalize = (value: string) =>
    state.eol === 'crlf'
      ? value.replace(/\r?\n/g, '\r\n')
      : value.replace(/\r\n/g, '\n')
  if (state.phase !== 'serialize')
    return { html: normalize(clean), md: '', text: '' }
  return {
    html: normalize(clean),
    md: normalize(
      markdown(
        root.cloneNode(true) as HTMLElement,
        state,
        report,
        title,
        source,
      ),
    ),
    text: normalize(plain(root, state)),
  }
}
