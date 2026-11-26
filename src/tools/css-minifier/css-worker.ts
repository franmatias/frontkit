import { maxInput, processCss, type Request } from './processor'

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const { source, options } = event.data
  const bytes = (text: string) => new TextEncoder().encode(text).byteLength
  const before = bytes(source)
  if (before > maxInput) {
    self.postMessage({ error: { reason: 'tooLarge' } })
    return
  }
  const start = performance.now()
  try {
    const css = processCss(source, options)
    self.postMessage({ css, before, after: bytes(css), ms: performance.now() - start })
  } catch (error) {
    const info = error as { reason?: string; line?: number; column?: number }
    self.postMessage({ error: { reason: info.reason ?? String(error), line: info.line, column: info.column } })
  }
})
