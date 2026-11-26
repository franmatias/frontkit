import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'

const template = await readFile('scripts/sw.template.js', 'utf8')
const assets = await readdir('dist/assets')
const names = assets.filter(name => !/(?:\.wasm$|audit-engine|(?:^|-)avif|(?:^|-)mozjpeg|squoosh|(?:^|-)encode-|(?:^|-)optimise-|monaco|\.worker|emmet|(?:^|-)worker(?:-|\.))/i.test(name))
const files = ['index.html', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'licenses.json', ...names.map(name => 'assets/' + name)]
const revision = createHash('sha256')
revision.update(template)
for (const file of files) revision.update(await readFile('dist/' + file))
const output = template.replace('FRONTKIT_REVISION', revision.digest('hex').slice(0, 16))
  .replace('/* FRONTKIT_PRECACHE */ []', JSON.stringify(files))
await writeFile('dist/sw.js', output)
