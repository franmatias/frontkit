import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const walk = async path => (await Promise.all((await readdir(path, { withFileTypes: true })).map(item => {
  const child = join(path, item.name)
  return item.isDirectory() ? walk(child) : child
}))).flat()
const flatten = (data, prefix = '') => Object.entries(data).flatMap(([key, value]) => typeof value === 'object'
  ? flatten(value, prefix + key + '.') : [prefix + key])
const registry = await readFile('src/core/registry.ts', 'utf8')
const ids = [...registry.matchAll(/id: '([a-z][a-z0-9-]+)', category:/g)].map(match => match[1])
if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Identificadores de herramienta inválidos')
const locales = await readdir('src/i18n/locales')
const reference = await read('src/i18n/locales/es-ES/common.json')
const sourceFiles = (await walk('src')).filter(path => /\.(?:vue|ts)$/.test(path))
for (const locale of locales) {
  const common = await read('src/i18n/locales/' + locale + '/common.json')
  const referenceKeys = flatten(reference).sort()
  const keys = new Set(flatten(common))
  if (referenceKeys.join() !== [...keys].sort().join()) throw new Error('Claves incoherentes: ' + locale)
  for (const id of ids) {
    for (const suffix of ['name', 'description', 'tags.main']) {
      const key = 'tools.' + id + '.' + suffix
      if (!keys.has(key)) throw new Error('Falta clave: ' + key)
    }
    if (await readFile('src/tools/' + id + '/index.vue', 'utf8').catch(() => '')) {
      const base = 'src/tools/' + id + '/locales/'
      const details = flatten(await read(base + locale + '.json')).sort()
      const expected = flatten(await read(base + 'es-ES.json')).sort()
      if (details.join() !== expected.join()) throw new Error('Claves incoherentes: ' + id + ' / ' + locale)
      for (const key of details) keys.add('detail.' + id + '.' + key)
    }
  }
  for (const source of sourceFiles) {
    const content = await readFile(source, 'utf8')
    for (const match of content.matchAll(/\bt\(\s*['"]([a-z][\w.-]+\.[\w-]+)['"]\s*\)/g)) {
      if (!keys.has(match[1])) throw new Error(source + ': clave desconocida ' + match[1])
    }
  }
  console.log(locale + ': ' + keys.size + ' claves y ' + ids.length + ' herramientas')
}
