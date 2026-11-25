import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const lock = await readFile('pnpm-lock.yaml', 'utf8')
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const licenses = []
for (const [name, version] of Object.entries(manifest.dependencies)) {
  if (!lock.includes(name + '@' + version)) throw new Error('Dependencia ausente del lockfile: ' + name)
  const directory = join('node_modules', name)
  const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  if (metadata.version !== version) throw new Error('Versión instalada distinta de la declarada: ' + name)
  const licenseFiles = (await readdir(directory)).filter(file => /^(licen[sc]e|copying|notice)([.-]|$)/i.test(file))
  const notices = await Promise.all(licenseFiles.map(file => readFile(join(directory, file), 'utf8')))
  licenses.push({ name, version, license: metadata.license ?? 'Consultar proyecto', notices })
}
await writeFile('public/licenses.json', JSON.stringify(licenses))
