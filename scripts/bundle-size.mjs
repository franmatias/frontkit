import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const size = async (file) => gzipSync(await readFile('dist/' + file)).length
const seen = new Set()
async function entrySize(key) {
  if (seen.has(key)) return 0
  seen.add(key)
  const chunk = manifest[key]
  const dependencies = await Promise.all((chunk.imports ?? []).map(entrySize))
  return (await size(chunk.file)) + dependencies.reduce((total, n) => total + n, 0)
}
const initial = await entrySize('index.html')
console.log('JS inicial gzip:', initial, 'bytes')
if (initial > 150 * 1024) process.exitCode = 1
for (const [name, chunk] of Object.entries(manifest)) {
  if (!/^src\/tools\/[^/]+\/index\.vue$/.test(name)) continue
  const bytes = await size(chunk.file)
  console.log(name, bytes, 'bytes gzip')
  if (bytes > 60 * 1024) process.exitCode = 1
}
