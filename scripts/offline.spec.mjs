import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

test('precaches the shell, falls back on navigation, and caches workers on first use', async () => {
  const source = await readFile('dist/sw.js', 'utf8')
  const handlers = new Map()
  const storage = new Map()
  const base = 'https://frontkit.test/frontkit/'
  let online = true
  let activated = false
  const url = request => typeof request === 'string' ? request : request.url
  const cache = {
    async addAll(requests) { for (const request of requests) storage.set(url(request), new Response('precached ' + url(request))) },
    async match(request) { return storage.get(url(request))?.clone() },
    async put(request, response) { storage.set(url(request), response) },
  }
  runInNewContext(source, {
    URL, Request, Response,
    self: {
      registration: { scope: base },
      addEventListener(type, handler) { handlers.set(type, handler) },
      skipWaiting() { activated = true },
    },
    caches: { open: async () => cache },
    fetch: async request => {
      if (!online) throw new Error('Offline')
      return new Response('network ' + url(request))
    },
  })
  let response
  const call = (type, event = {}) => {
    response = undefined
    handlers.get(type)({ ...event, waitUntil: result => { response = result }, respondWith: result => { response = result } })
    return response
  }
  await call('install')
  assert.ok(storage.has(base + 'index.html'))
  const worker = 'assets/css-worker-sample.js'
  assert.ok([...storage.keys()].every(key => !key.includes('worker-') && !key.includes('/emmet-')))
  await call('fetch', { request: { url: base + worker, method: 'GET' } })
  online = false
  const offlineWorker = await call('fetch', { request: { url: base + worker, method: 'GET' } })
  assert.equal(await offlineWorker.text(), 'network ' + base + worker)
  const navigation = await call('fetch', { request: { url: base + 'tools/tokens', method: 'GET', mode: 'navigate' } })
  assert.equal(await navigation.text(), 'precached ' + base + 'index.html')
  assert.equal(call('fetch', { request: { url: 'https://another.test/frontkit/index.html', method: 'GET' } }), undefined)
  call('message', { data: 'FRONTKIT_ACTIVATE' })
  assert.ok(activated)
})
