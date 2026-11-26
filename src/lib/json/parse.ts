export type Node =
  | { type: 'object'; entries: [string, Node][] }
  | { type: 'array'; items: Node[] }
  | { type: 'number'; raw: string }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }

export class JsonInputError extends Error {
  readonly line: number
  readonly column: number
  readonly fragment: string
  constructor(readonly code: string, source: string, index: number) {
    super(code)
    const rows = source.slice(0, index).split(/\r\n|\r|\n/)
    this.line = rows.length
    this.column = rows.at(-1)!.length + 1
    const start = Math.max(index - this.column + 1, index - 50)
    const end = Math.min(source.length, index + 50)
    this.fragment = source.slice(start, index) + '▸' + source.slice(index, end).split(/\r|\n/)[0]
  }
}

interface ParseOptions { allowComments?: boolean; repair?: boolean }
const numberToken = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
const bareKey = /[A-Za-z_$][A-Za-z0-9_$-]*/y
const whitespace = /[ \t\r\n]*/y
export interface Edit { start: number; end: number; text: string; kind: string }

export function parseJson(source: string, opts: ParseOptions = {}) {
  let cursor = 0
  const edits: Edit[] = []
  let unsafeNumbers = 0
  let complexity = 0
  const error = (code: string, at = cursor): never => { throw new JsonInputError(code, source, at) }
  function match(regex: RegExp) {
    regex.lastIndex = cursor
    const raw = regex.exec(source)?.[0]
    if (raw !== undefined) cursor += raw.length
    return raw
  }
  function skip() {
    while (true) {
      match(whitespace)
      const start = cursor
      if (!source.startsWith('//', cursor) && !source.startsWith('/*', cursor)) return
      if (!opts.allowComments && !opts.repair) error('comments')
      if (source.startsWith('//', cursor)) {
        cursor += 2
        while (cursor < source.length && !/[\r\n]/.test(source[cursor])) cursor++
      } else {
        const end = source.indexOf('*/', cursor + 2)
        if (end < 0) error('unfinishedComment')
        cursor = end + 2
      }
      if (opts.repair && !opts.allowComments) edits.push({ start, end: cursor, text: ' ', kind: 'comments' })
    }
  }
  function scanString(quote: '"' | "'") {
    if (source[cursor] !== quote) return undefined
    const start = cursor
    for (let i = start + 1; i < source.length; i++) {
      const ch = source[i]
      if (ch === quote) {
        cursor = i + 1
        return source.slice(start, cursor)
      }
      if (source.charCodeAt(i) < 32) error('string', i)
      if (ch !== '\\') continue
      const escaped = source[++i]
      if (escaped === 'u') {
        if (!/^[\da-fA-F]{4}$/.test(source.slice(i + 1, i + 5))) error('string', i)
        i += 4
      } else if (escaped === undefined || (!'"\\/bfnrt'.includes(escaped) && !(quote === "'" && escaped === "'"))) {
        error('string', i)
      }
    }
    return error('string', source.length)
  }
  function quoted(key: boolean) {
    const start = cursor
    const standard = scanString('"')
    if (standard) return JSON.parse(standard) as string
    if (opts.repair) {
      const single = scanString("\x27")
      if (single) {
        const escaped = single.slice(1, -1).replace(/\\'|\\.|"/gs, token => token === "\\'" ? "'" : token === '"' ? '\\"' : token)
        const text = '"' + escaped + '"'
        edits.push({ start, end: cursor, text, kind: 'singleQuotes' })
        return JSON.parse(text) as string
      }
      if (key) {
        const bare = match(bareKey)
        if (bare) {
          edits.push({ start, end: cursor, text: JSON.stringify(bare), kind: 'bareKey' })
          return bare
        }
      }
    }
    return error(key ? 'key' : 'string')
  }
  function container(depth: number, object: boolean): Node {
    cursor++
    const delimiter = object ? '}' : ']'
    const entries: [string, Node][] = []
    const items: Node[] = []
    const keys = new Set<string>()
    skip()
    if (source[cursor] !== delimiter) {
      while (true) {
        if (object) {
          const begin = cursor
          const key = quoted(true)
          if (keys.has(key)) error('duplicate', begin)
          keys.add(key)
          skip()
          if (source[cursor] !== ':') error('colon')
          cursor++
          entries.push([key, value(depth + 1)])
        } else items.push(value(depth + 1))
        skip()
        if (source[cursor] === delimiter) break
        if (source[cursor] !== ',') error('separator')
        const comma = cursor++
        skip()
        if (source[cursor] === delimiter) {
          if (!opts.repair) error('trailingComma', comma)
          edits.push({ start: comma, end: comma + 1, text: '', kind: 'trailingComma' })
          break
        }
      }
    }
    cursor++
    return object ? { type: 'object', entries } : { type: 'array', items }
  }
  function value(depth: number): Node {
    complexity += 22 + depth * 4
    if (depth > 128) error('depth')
    if (complexity > 15000000) error('complexity')
    skip()
    const ch = source[cursor]
    if (ch === '{' || ch === '[') return container(depth, ch === '{')
    if (ch === '"' || ch === "'") return { type: 'string', value: quoted(false) }
    for (const raw of ['true', 'false', 'null']) {
      if (!source.startsWith(raw, cursor)) continue
      cursor += raw.length
      return raw === 'null' ? { type: 'null' } : { type: 'boolean', value: raw === 'true' }
    }
    const raw = match(numberToken)
    if (raw) {
      const n = Number(raw)
      if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n))) unsafeNumbers++
      return { type: 'number', raw }
    }
    if (opts.repair) {
      const token = ['undefined', 'NaN'].find(token => source.startsWith(token, cursor))
      if (token) {
        edits.push({ start: cursor, end: cursor + token.length, text: 'null', kind: 'nullValue' })
        cursor += token.length
        return { type: 'null' }
      }
    }
    return error('value')
  }
  const root = value(0)
  skip()
  if (cursor !== source.length) error('extra')
  return { root, edits, unsafeNumbers }
}

export function orderedEntries(node: Extract<Node, { type: 'object' }>, sorted: boolean) {
  return sorted ? [...node.entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0) : node.entries
}

export function serialize(node: Node, indent = '', sorted = false, depth = 0): string {
  const pad = indent ? '\n' + indent.repeat(depth + 1) : ''
  const close = indent ? '\n' + indent.repeat(depth) : ''
  function group(left: string, parts: string[], right: string) {
    return left + (parts.length ? pad + parts.join(',' + pad) + close : '') + right
  }
  if (node.type === 'object') return group('{', orderedEntries(node, sorted).map(([key, child]) =>
    JSON.stringify(key) + (indent ? ': ' : ':') + serialize(child, indent, sorted, depth + 1)), '}')
  if (node.type === 'array') return group('[', node.items.map(child => serialize(child, indent, sorted, depth + 1)), ']')
  if (node.type === 'number') return node.raw
  return node.type === 'null' ? 'null' : JSON.stringify(node.value)
}
