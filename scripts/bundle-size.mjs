import { readFile, readdir } from 'node:fs/promises'
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

const assets = await readdir('dist/assets')
const codecAssets = assets.filter(name => /^(?:avif_enc|mozjpeg_enc|squoosh_oxipng_bg)[-_].*\.wasm$/.test(name))
const auditEngine = manifest['src/tools/a11y-audit/audit-engine.ts']?.file
const serviceWorker = await readFile('dist/sw.js', 'utf8')
if (!codecAssets.length || !auditEngine) throw new Error('Faltan activos diferidos de imagen o auditoría')
for (const [file, budget] of [...codecAssets.map(name => ['assets/' + name, 1_000_000]), [auditEngine, 200_000]]) {
  const bytes = await size(file)
  console.log(file, bytes, 'bytes gzip')
  if (bytes > budget || serviceWorker.includes(JSON.stringify(file))) process.exitCode = 1
}
