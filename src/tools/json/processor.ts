import { jsonPatch, structuralDiff, type Change } from '../../lib/json/diff'
import { inferTypes, inspectTree, type TreeRow } from '../../lib/json/inspect'
import { JsonInputError, parseJson, serialize, type Edit } from '../../lib/json/parse'
import { maxInput, type Options } from './logic'

export type Request = { left: string; right: string; options: Options }
type Side = 'left' | 'right'
export type Result =
  | { kind: 'error'; side: Side; code: string; line?: number; column?: number; fragment?: string }
  | { kind: 'repair'; side: Side; edits: Edit[]; preview: string }
  | { kind: 'format'; formatted: string; compact: string; types: string; rows: TreeRow[]; unsafe: number }
  | { kind: 'diff'; structural: ReturnType<typeof structuralDiff>; patch: string; report: string; before: string; after: string; unsafe: number }

const encoder = new TextEncoder()
export const repairText = (source: string, edits: Edit[]) => {
  let offset = 0
  const pieces: string[] = []
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    pieces.push(source.slice(offset, edit.start), edit.text)
    offset = edit.end
  }
  pieces.push(source.slice(offset))
  return pieces.join('')
}

export function processJson(request: Request): Result {
  const { left, right, options } = request
  const indent = options.indent === 'tab' ? '\t' : ' '.repeat(Number(options.indent))
  function parse(source: string, side: Side) {
    if (encoder.encode(source).length > maxInput) return { kind: 'error', side, code: 'tooLarge' } as const
    try { return parseJson(source, options) }
    catch (err) {
      if (!(err instanceof JsonInputError)) throw err
      if (options.tolerant) {
        try {
          const { edits } = parseJson(source, { ...options, repair: true })
          if (edits.length) {
            const preview = repairText(source, edits).slice(0, 20000)
            return { kind: 'repair', side, edits, preview } as const
          }
        } catch { /* Show the original strict diagnostic. */ }
      }
      const { code, line, column, fragment } = err
      return { kind: 'error', side, code, line, column, fragment } as const
    }
  }
  const a = parse(left, 'left')
  if ('kind' in a) return a
  if (options.mode === 'format') {
    return {
      kind: 'format', formatted: serialize(a.root, indent, options.sortKeys),
      compact: serialize(a.root, '', options.sortKeys), types: inferTypes(a.root), rows: inspectTree(a.root), unsafe: a.unsafeNumbers,
    }
  }
  const b = parse(right, 'right')
  if ('kind' in b) return b
  const structural = structuralDiff(a.root, b.root, options)
  const report = ['# Comparación JSON', '', ...structural.changes.map((c: Change) => '- ' + c.kind + ' — ' + JSON.stringify(c.path || '/')),
    ...(Object.values(structural.counts).reduce((sum, n) => sum + n, 0) > structural.changes.length ? ['- Se omiten cambios adicionales.'] : [])].join('\n')
  return { kind: 'diff', structural, patch: jsonPatch(a.root, b.root), report, before: left.slice(0, 100000), after: right.slice(0, 100000),
    unsafe: a.unsafeNumbers + b.unsafeNumbers }
}
