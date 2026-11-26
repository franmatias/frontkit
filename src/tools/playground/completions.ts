import expandAbbreviation, { extract } from 'emmet'

export type Language = 'html' | 'css' | 'js'
export interface Completion {
  label: string
  kind: 'tag' | 'attribute' | 'property' | 'value' | 'script' | 'emmet'
  text: string
  start: number
  field?: { offset: number; length: number }
}

const htmlTags = 'a article aside audio button canvas details dialog div fieldset figcaption figure footer form h1 h2 h3 header img input label legend li link main meta nav ol option p picture section select small source span strong summary table tbody td textarea th thead tr ul video'.split(' ')
const attributes = 'id class style title aria-label aria-hidden role tabindex hidden type name value placeholder required disabled href target rel src alt width height loading action method for'.split(' ')
const properties = 'align-content align-items align-self animation background background-color background-image border border-color border-radius box-shadow box-sizing color cursor display filter flex flex-basis flex-direction flex-grow flex-shrink flex-wrap font-family font-size font-weight gap grid-area grid-auto-flow grid-column grid-row grid-template-areas grid-template-columns grid-template-rows height inset justify-content justify-items left line-height margin margin-bottom margin-inline margin-top max-width min-height min-width object-fit opacity overflow padding padding-inline place-items position right text-align text-decoration top transform transition width z-index'.split(' ')
const values: Record<string, string[]> = {
  display: ['block', 'flex', 'grid', 'inline', 'inline-block', 'inline-flex', 'inline-grid', 'none'],
  position: ['absolute', 'fixed', 'relative', 'static', 'sticky'],
  'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
  'justify-content': ['center', 'start', 'end', 'space-between', 'space-around', 'space-evenly'],
  'align-items': ['center', 'start', 'end', 'stretch', 'baseline'],
  overflow: ['auto', 'hidden', 'scroll', 'visible', 'clip'],
  color: ['currentColor', 'transparent', 'inherit', 'rgb()', 'oklch()', 'var()'],
}
const globals = 'addEventListener Array Boolean clearInterval clearTimeout console const Date document fetch function JSON let Map Math Number Object Promise return Set setInterval setTimeout String URL window'.split(' ')
const members: Record<string, string[]> = {
  console: ['log', 'info', 'warn', 'error', 'table', 'clear'],
  document: ['querySelector', 'querySelectorAll', 'getElementById', 'createElement', 'addEventListener', 'body', 'head', 'documentElement'],
  window: ['alert', 'addEventListener', 'location', 'matchMedia', 'requestAnimationFrame', 'setTimeout'],
  Math: ['abs', 'ceil', 'floor', 'max', 'min', 'random', 'round', 'sqrt', 'PI'],
  JSON: ['parse', 'stringify'],
}
const abbreviations = {
  html: ['!', 'a', 'btn', 'div', 'form', 'img', 'input', 'link:css', 'nav>ul>li*3', 'ol>li*3', 'section>h2+p', 'table>tr*2>td*3', 'ul>li*3'],
  css: ['bgc', 'bd', 'bdrs', 'c', 'd:f', 'd:g', 'df', 'dg', 'fxd:c', 'fz', 'gap', 'jc:c', 'm10', 'm:a', 'p10', 'pos:r', 'w100p'],
}

export function emmetCompletion(language: Language, source: string, caret: number, tabSize: number, candidate?: string): Completion | undefined {
  if (language === 'js' || caret === 0) return
  const lineStart = source.lastIndexOf('\n', caret - 1) + 1
  const line = source.slice(lineStart, caret)
  const type = language === 'css' ? 'stylesheet' : 'markup'
  const match = extract(line, line.length, { type })
  if (!match) return
  const start = lineStart + match.start
  const prefix = source.slice(0, start)
  if (language === 'html' && prefix.lastIndexOf('<') > prefix.lastIndexOf('>')) return
  const label = candidate ?? match.abbreviation
  if (label.length > 180 || /\*[1-9]\d{2,}/.test(label)) return
  let field: Completion['field']
  try {
    const text = expandAbbreviation(label, {
      type, syntax: language, maxRepeat: 60,
      options: {
        'output.indent': ' '.repeat(tabSize),
        'output.baseIndent': line.match(/^\s*/)?.[0] ?? '',
        'output.field': (_, placeholder, offset) => {
          field ??= { offset, length: placeholder.length }
          return placeholder
        },
      },
    })
    if (text === label || text.length > 16000) return
    return { label, kind: 'emmet', text, start, field }
  } catch { return }
}

export function suggestions(language: Language, source: string, caret: number, tabSize: number): Completion[] {
  const before = source.slice(0, caret)
  const after = source.slice(caret)
  if (/^[\w-]/.test(after)) return []
  const token = before.match(language === 'js' ? /[\w$]*$/ : /[\w-]*$/)?.[0] ?? ''
  const start = caret - token.length
  function options(list: string[], kind: Completion['kind'], suffix = ''): Completion[] {
    return [...new Set(list)].filter(label => label.startsWith(token) && label !== token).slice(0, 9)
      .map(label => ({ label, kind, text: label + suffix, start }))
  }
  if (language === 'js') {
    const receiver = /([\w$]+)\.$/.exec(before.slice(0, start))
    if (receiver) return options(members[receiver[1]] ?? [], 'script')
    if (!token) return []
    const symbols = [...source.matchAll(/\b(?:const|let|var|function|class)\s+([\w$]+)/g)].map(match => match[1])
    return options([...symbols, ...globals], 'script')
  }
  if (language === 'html' && before.lastIndexOf('<') > before.lastIndexOf('>')) {
    const tag = before.slice(before.lastIndexOf('<') + 1)
    if (/^\/?[\w-]*$/.test(tag)) {
      return options(htmlTags, 'tag')
    }
    if (/^\/?[\w-]+\s+[^<>]*$/.test(tag) && (tag.match(/"/g)?.length ?? 0) % 2 === 0 && (tag.match(/'/g)?.length ?? 0) % 2 === 0) {
      return options(attributes, 'attribute')
    }
    return []
  }
  if (language === 'css') {
    const declaration = before.slice(Math.max(before.lastIndexOf('{'), before.lastIndexOf(';'), before.lastIndexOf('}')) + 1)
    const property = /^\s*([\w-]+)\s*:\s*[\w-]*$/.exec(declaration)
    if (property && values[property[1]]) return options(values[property[1]], 'value')
    if (property && properties.includes(property[1])) return []
  }
  const emmet = emmetCompletion(language, source, caret, tabSize)
  const known = emmet && (language === 'css' || /[>.#*+!:[\]{}]/.test(emmet.label) || htmlTags.includes(emmet.label) || abbreviations.html.includes(emmet.label))
  const extra = token.length ? abbreviations[language].filter(label => label.startsWith(token) && label !== emmet?.label)
    .flatMap(label => emmetCompletion(language, source, caret, tabSize, label) ?? []) : []
  const normal = language === 'css' && token ? options(properties, 'property', after.startsWith(':') ? '' : ': ') : []
  return [...(known ? [emmet] : []), ...normal, ...extra].slice(0, 8)
}
