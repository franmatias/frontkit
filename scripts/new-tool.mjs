import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const [, , id] = process.argv
if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || id.length < 2 || id.length > 48) {
  throw new Error('Uso: pnpm new:tool <id-kebab-case>')
}
const folder = 'src/tools/' + id
const registryPath = 'src/core/registry.ts'
const localePath = 'src/i18n/locales/es-ES/common.json'
const registry = (await readFile(registryPath, 'utf8')).replaceAll('\r\n', '\n')
const locale = JSON.parse(await readFile(localePath, 'utf8'))
if (existsSync(folder) || locale.tools[id] || registry.includes("id: '" + id + "'")) throw new Error('La herramienta ya existe: ' + id)
const title = id.replaceAll('-', ' ')
const entry = "  {\n    id: '" + id + "', category: 'code', icon: Code2, phase: 4,\n" +
  "    status: 'beta', featured: false, supportsTailwind: false, supportsShareUrl: true,\n" +
  "    minViewport: 'mobile', tags: ['tools." + id + ".tags.main'],\n" +
  "    component: () => import('../tools/" + id + "/index.vue').then(module => module.default),\n  },\n"
const marker = 'export const tools: ToolDefinition[] = [\n'
if (!registry.includes(marker)) throw new Error('No se encontró el registro de herramientas.')
await mkdir(folder + '/locales', { recursive: true })
const files = {
  'schema.ts': "import * as v from 'valibot'\n\nexport const schema = v.strictObject({ enabled: v.boolean() })\nexport type State = v.InferOutput<typeof schema>\n",
  'logic.ts': "import { defineTool } from '../../core/tool'\nimport { schema, type State } from './schema'\n\nexport const logic = defineTool<State>({\n" +
    "  id: '" + id + "', schema, defaultState: () => ({ enabled: true }), presets: [],\n" +
    "  outputs: { css: state => 'display: ' + (state.enabled ? 'block' : 'none') + ';' },\n})\n",
  'index.vue': "<script setup lang=\"ts\">\nimport { useI18n } from 'vue-i18n'\nimport ToolWorkspace from '../../components/shared/ToolWorkspace.vue'\n" +
    "import { logic } from './logic'\n\nconst { t } = useI18n()\n</script>\n<template>\n  <ToolWorkspace :logic=\"logic\">\n" +
    "    <template #controls=\"{ state, update }\">\n      <label class=\"check\"><input type=\"checkbox\" :checked=\"state.enabled\" @change=\"update(d => { d.enabled = !d.enabled })\" />{{ t('detail." + id + ".enabled') }}</label>\n" +
    "    </template>\n    <template #preview=\"{ state }\">\n      <p v-show=\"state.enabled\">{{ t('tools." + id + ".name') }}</p>\n    </template>\n  </ToolWorkspace>\n</template>\n",
  'logic.spec.ts': "import { expect, it } from 'vitest'\nimport { logic } from './logic'\n\nit('genera CSS con el estado inicial', () => {\n  expect(logic.outputs.css(logic.defaultState())).toBe('display: block;')\n})\n",
  'locales/es-ES.json': JSON.stringify({ enabled: 'Mostrar muestra' }, null, 2) + '\n',
}
await Promise.all(Object.entries(files).map(([name, text]) => writeFile(folder + '/' + name, text)))
locale.tools[id] = { name: title, description: title, tags: { main: title } }
await Promise.all([
  writeFile(registryPath, registry.replace(marker, marker + entry)),
  writeFile(localePath, JSON.stringify(locale, null, 2) + '\n'),
])
console.log('Herramienta creada en ' + folder)
