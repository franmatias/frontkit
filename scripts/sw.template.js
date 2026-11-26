const files = /* FRONTKIT_PRECACHE */ []
const base = new URL(self.registration.scope)
const cachePrefix = 'frontkit:' + base.pathname + ':'
const cacheName = cachePrefix + 'FRONTKIT_REVISION'
const shell = new URL('index.html', base).href
const staticFiles = new Set(files.map(file => new URL(file, base).href))

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...staticFiles].map(url => new Request(url, { cache: 'reload' })))))
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(cachePrefix) && name !== cacheName) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})
self.addEventListener('message', event => {
  if (event.data === 'FRONTKIT_ACTIVATE') event.waitUntil(self.skipWaiting())
})
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(cacheName)).match(shell)
      .then(response => response ?? Response.error())))
    return
  }

  const asset = url.pathname.startsWith(new URL('assets/', base).pathname)
  if (!staticFiles.has(url.href) && !asset) return
  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    const stored = await cache.match(request)
    if (stored) return stored
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone()).catch(() => {})
    return response
  })())
})
