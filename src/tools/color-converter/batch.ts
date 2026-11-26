import { parseCss } from '../../lib/css-ast'
import { values } from './logic'

export function replaceColors(source: string, format: 'HEX' | 'OKLCH') {
  const sheet = parseCss(source)
  const unresolved = new Set<string>()
  let total = 0
  sheet.walkDecls(decl => {
    if (!/(?:color|background|shadow|border|outline|fill|stroke|--)/i.test(decl.prop)) return
    decl.value = decl.value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[a-z][\w-]*\((?:[^()]|\([^()]*\))*\)|#[\da-f]{3,8}\b|\b[a-z][\w-]*\b/gi, token => {
      const converted = values(token)[format as keyof ReturnType<typeof values>]
      if (!converted) {
        if (/^#|^(?:var|color-mix|rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(/i.test(token) || token === 'currentColor') unresolved.add(token)
        return token
      }
      total++
      return converted
    })
  })
  return { css: sheet.toString(), total, unresolved: [...unresolved] }
}
