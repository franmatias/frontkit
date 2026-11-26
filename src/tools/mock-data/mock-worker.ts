import { generate } from './generator'
import { logic, type State } from './logic'

self.addEventListener('message', (event: MessageEvent<State>) => {
  try {
    const state = logic.migrate(event.data, 1)
    self.postMessage(generate(state, progress => self.postMessage({ kind: 'progress', progress })))
  } catch { self.postMessage({ kind: 'error', code: 'complexity', field: '' }) }
})
