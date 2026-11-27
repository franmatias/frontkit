import { maxCaptures, maxMatches, maxPattern, maxReplacement, maxResultChars, maxText, type Match, type RegexResult, type RegexRequest } from './model'
import { createTransformation } from './replacement'

self.onmessage = ({ data }: MessageEvent<RegexRequest>) => {
  self.postMessage(evaluate(data))
}

function evaluate({ pattern, flags, text, transformation }: RegexRequest): RegexResult {
  if (pattern.length > maxPattern || text.length > maxText) return { error: 'La entrada supera el límite del editor.' }
  if (transformation && transformation.template.length > maxReplacement) return { error: 'La sustitución supera el límite del editor.' }
  try {
    const regex = new RegExp(pattern, flags.includes('d') ? flags : flags + 'd')
    const matches: Match[] = []
    let captureCount = 0
    let resultChars = 0
    let limited = false
    const output = transformation && createTransformation(text, transformation)
    let transforming = Boolean(output)
    for (let result = regex.exec(text); result; result = regex.exec(text)) {
      if (!limited) {
        captureCount += result.length - 1
        for (const value of result) resultChars += value?.length ?? 0
        limited = matches.length >= maxMatches || captureCount > maxCaptures || resultChars > maxResultChars
        if (!limited) matches.push(collectMatch(result))
      }
      if (transforming) transforming = output!.replace(result)
      if (limited && !transforming) break
      if (!regex.global) break
      if (!result[0].length) {
        // exec deja lastIndex en el mismo índice para las coincidencias vacías.
        const point = text.codePointAt(regex.lastIndex)
        regex.lastIndex += (regex.unicode || flags.includes('v')) && point !== undefined && point > 0xffff ? 2 : 1
      }
    }
    return { matches, limited, transformed: output?.finish() }
  } catch (error) {
    return { error: error instanceof Error ? 'Expresión no válida. ' + error.message : 'No se pudo evaluar la expresión.' }
  }
}

function collectMatch(result: RegExpExecArray): Match {
  const indices = result.indices!
  return {
    value: result[0],
    range: indices[0],
    captures: result.slice(1).map((value, i) => ({ value, range: indices[i + 1] })),
    named: Object.fromEntries(Object.entries(result.groups ?? {}).map(([name, value]) => [
      name, { value, range: indices.groups?.[name] },
    ])),
  }
}
