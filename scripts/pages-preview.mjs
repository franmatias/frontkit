import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const base = '/frontkit/'
const root = resolve('dist')
const types = { '.wasm': 'application/wasm', '.jpg': 'image/jpeg', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  if (!path.startsWith(base)) {
    response.writeHead(404).end()
    return
  }
  const file = resolve(root, path.slice(base.length) || 'index.html')
  if (!file.startsWith(root + sep)) {
    response.writeHead(404).end()
    return
  }
  try {
    const bytes = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(bytes)
  } catch {
    const fallback = await readFile(resolve(root, '404.html')).catch(() => '')
    response.writeHead(404, { 'Content-Type': 'text/html' }).end(fallback)
  }
}).listen(4173, '127.0.0.1', () => console.log('FrontKit preview ready'))
