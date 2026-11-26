import { issue } from '../../lib/css-ast'
import { rewriteCss, type Rename } from '../../lib/rename'
export type Job = { css: string; changes: Rename[] }
export type Result = ReturnType<typeof rewriteCss> | { error: ReturnType<typeof issue> }
self.addEventListener('message', (event: MessageEvent<Job>) => {
  try { self.postMessage(rewriteCss(event.data.css, event.data.changes)) }
  catch (error) { self.postMessage({ error: issue(error) }) }
})
