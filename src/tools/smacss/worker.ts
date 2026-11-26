import { issue } from '../../lib/css-ast'
import { organize, type Category, type Options } from './logic'
export type Job = { css: string; options: Options; overrides: Record<number, Category> }
export type Result = ReturnType<typeof organize> | { error: ReturnType<typeof issue> }
self.addEventListener('message', (event: MessageEvent<Job>) => {
  try { self.postMessage(organize(event.data.css, event.data.options, event.data.overrides)) }
  catch (error) { self.postMessage({ error: issue(error) }) }
})
