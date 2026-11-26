import { format } from 'prettier/standalone'
import type { Language } from './completions'

export type FormatJob = { sources: Partial<Record<Language, string>>; tabWidth: number; sourceLimit: number }
export type FormatResult = { formatted: Partial<Record<Language, string>>; invalid: Language[] }
const parsers = {
  html: { parser: 'html', plugins: async () => [(await import('prettier/plugins/html')).default] },
  css: { parser: 'css', plugins: async () => [(await import('prettier/plugins/postcss')).default] },
  js: { parser: 'babel', plugins: async () => (await Promise.all([
    import('prettier/plugins/babel'), import('prettier/plugins/estree'),
  ])).map(plugin => plugin.default) },
}

self.addEventListener('message', async ({ data }: MessageEvent<FormatJob>) => {
  const formatted: FormatResult['formatted'] = {}
  const invalid: Language[] = []
  for (const language of Object.keys(data.sources) as Language[]) {
    const source = data.sources[language]
    if (!source?.trim()) continue
    try {
      const config = parsers[language]
      const result = await format(source, {
        parser: config.parser, plugins: await config.plugins(), tabWidth: data.tabWidth,
        embeddedLanguageFormatting: 'off', singleQuote: true, semi: false,
      })
      if (result.length > data.sourceLimit) invalid.push(language)
      else formatted[language] = result
    } catch {
      invalid.push(language)
    }
  }
  self.postMessage({ formatted, invalid } satisfies FormatResult)
})
