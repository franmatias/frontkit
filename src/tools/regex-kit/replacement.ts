import { maxTransformed, type Transformation, type Transformed } from './model'

const namedReferences = /\$(\$|&|\x60|'|[0-9]{1,2}|<[^>]*>)/g
const numberedReferences = /\$(\$|&|\x60|'|[0-9]{1,2})/g

function expand(reference: string, match: RegExpExecArray, input: string) {
  switch (reference) {
    case '$': return '$'
    case '&': return match[0]
    case '\x60': return input.slice(0, match.index)
    case "'": return input.slice(match.index + match[0].length)
  }
  if (reference.startsWith('<')) {
    return match.groups ? match.groups[reference.slice(1, -1)] ?? '' : '$' + reference
  }
  const index = Number(reference)
  if (index > 0 && index < match.length) return match[index] ?? ''
  const first = Number(reference[0])
  if (reference.length === 2 && first > 0 && first < match.length) return (match[first] ?? '') + reference[1]
  return '$' + reference
}

export function createTransformation(input: string, options: Transformation) {
  const chunks: string[] = []
  let length = 0
  let cursor = 0
  let limited = false
  let references: RegExpExecArray[] | undefined

  function append(value: string) {
    length += value.length
    if (length > maxTransformed) limited = true
    if (!limited && value) chunks.push(value)
  }
  function replace(match: RegExpExecArray) {
    append(input.slice(cursor, match.index))
    if (options.mode === 'upper') append(match[0].toUpperCase())
    else if (options.mode === 'lower') append(match[0].toLowerCase())
    else if (options.mode === 'literal') append(options.template)
    else {
      let start = 0
      references ??= [...options.template.matchAll(match.groups ? namedReferences : numberedReferences)]
      for (const part of references) {
        append(options.template.slice(start, part.index))
        if (limited) break
        append(expand(part[1], match, input))
        start = part.index + part[0].length
        if (limited) break
      }
      if (!limited) append(options.template.slice(start))
    }
    cursor = match.index + match[0].length
    return !limited
  }

  function finish(): Transformed {
    if (!limited) append(input.slice(cursor))
    return limited ? { limited: true } : { text: chunks.join('') }
  }
  return { replace, finish }
}
