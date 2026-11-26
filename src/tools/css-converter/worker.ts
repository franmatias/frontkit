import { issue } from '../../lib/css-ast'
import { convert, type ConverterOptions } from './logic'

export type Job = { source: string; options: ConverterOptions }
export type Result = ReturnType<typeof convert> | { error: ReturnType<typeof issue> }
self.addEventListener('message', (event: MessageEvent<Job>) => {
  try { self.postMessage(convert(event.data.source, event.data.options)) }
  catch (error) { self.postMessage({ error: issue(error) }) }
})
