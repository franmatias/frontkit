import { processJson, type Request, type Result } from './processor'

self.addEventListener('message', (event: MessageEvent<Request>) => {
  try { self.postMessage(processJson(event.data)) }
  catch { self.postMessage({ kind: 'error', side: 'left', code: 'complexity' } satisfies Result) }
})
