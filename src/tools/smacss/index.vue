<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RefactorPane from '../../components/shared/RefactorPane.vue'
import RefactorWorkspace from '../../components/shared/RefactorWorkspace.vue'
import { useWorker } from '../../composables/useWorker'
import { zip } from './archive'
import { categories, defaults, type Category } from './logic'
import type { Job, Result } from './worker'

type Draft = Exclude<Result, { error: unknown }>
const css = ref(':root { --ink: #182b25; }\n.wrapper { display: grid; gap: 1rem; }\n.card { padding: 1rem; color: var(--ink); }\n.card:hover { color: green; }\n.is-open { display: block; }\n[data-theme="dark"] { color: white; }')
const html = ref('')
const options = reactive(defaults())
const overrides = ref<Record<number, Category>>({})
const review = ref<Draft>()
const output = ref<Draft>()
const applyJob = ref(false)
const { result, busy, failed, send, cancel } = useWorker<Job, Result>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }))
const labels = { base: 'Base', layout: 'Layout', module: 'Módulo', state: 'Estado', theme: 'Tema' }
const confidence = { high: 'Alta', medium: 'Media', low: 'Baja' }
watch([css, options], () => { cancel(); review.value = undefined; output.value = undefined; overrides.value = {}; result.value = undefined })
watch(html, () => { output.value = undefined })
watch(result, data => {
  if (!data || 'error' in data) return
  if (applyJob.value) output.value = data
  else review.value = data
})
function run(confirm: boolean) {
  applyJob.value = confirm
  output.value = undefined
  send({ css: css.value, options: { ...options }, overrides: confirm ? { ...overrides.value } : {} })
}
function classify(id: number, event: Event) {
  overrides.value[id] = (event.target as HTMLSelectElement).value as Category
  output.value = undefined
}
const revisedHtml = computed(() => {
  if (!html.value.trim() || !output.value?.changes.length) return ''
  const template = document.createElement('template')
  template.innerHTML = html.value
  const map = new Map(output.value.changes.map(item => [item.before, item.after]))
  for (const node of template.content.querySelectorAll('[class]')) {
    const names = (node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    node.setAttribute('class', names.map(name => map.get(name) ?? name).join(' '))
  }
  return template.innerHTML
})
const outputs = computed(() => !output.value ? undefined : {
  css: output.value.css,
  ...(revisedHtml.value ? { html: revisedHtml.value } : {}),
  ...(output.value.changes.length ? { json: JSON.stringify(output.value.changes, null, 2) } : {}),
})
function download() {
  if (!output.value) return
  const files = { ...output.value.files, ...(revisedHtml.value ? { 'index.html': revisedHtml.value } : {}) }
  const next = URL.createObjectURL(new Blob([zip(files)], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = next
  link.download = 'frontkit-smacss.zip'
  link.click()
  setTimeout(() => URL.revokeObjectURL(next), 1000)
}
const { t } = useI18n()
const label = (id: string) => t('detail.smacss.' + id)
</script>
<template>
  <RefactorWorkspace id="smacss" :outputs="outputs">
    <template #editors>
      <RefactorPane kind="css" :title="label('source')">
        <textarea v-model="css" :aria-label="label('source')" maxlength="200000" spellcheck="false" autocapitalize="off" />
      </RefactorPane>
      <RefactorPane v-if="options.prefix" kind="html" :title="label('optionalHtml')">
        <textarea v-model="html" :aria-label="label('optionalHtml')" maxlength="200000" spellcheck="false" autocapitalize="off" />
      </RefactorPane>
    </template>
    <label>{{ label('output') }}<select v-model="options.output"><option value="layers">Archivo con @layer</option><option value="files">Archivos separados (ZIP)</option></select></label>
    <label v-if="options.output === 'files'">{{ label('group') }}<select v-model="options.owners"><option value="owner">Por componente</option><option value="single">Un solo archivo</option></select></label>
    <div class="option-flags"><label class="check"><input v-model="options.keepInteraction" type="checkbox" />{{ label('keep') }}</label>
    <label class="check"><input v-model="options.split" type="checkbox" />{{ label('split') }}</label>
    <label class="check"><input v-model="options.prefix" type="checkbox" />{{ label('prefix') }}</label></div>
    <template #action>
      <button type="button" class="btn primary" :disabled="busy || !css.trim()" @click="run(false)">{{ label('analyze') }}</button>
    </template>
    <template #status>
      <p v-if="busy" role="status">{{ label('working') }}</p>
      <p v-if="failed || result && 'error' in result" role="alert">{{ result && 'error' in result ? result.error.message : 'No se pudo iniciar el análisis.' }}</p>
    </template>
    <template #review>
      <RefactorPane v-if="review" kind="review" :title="label('review')">
        <div class="tool-controls review-content">
          <div class="review-scroll">
            <table><caption>Reglas y confianza</caption>
              <thead><tr><th scope="col">Regla</th><th scope="col">Categoría</th><th scope="col">Confianza</th></tr></thead>
              <tbody><tr v-for="entry in review.entries" :key="entry.id">
                <th scope="row"><code>{{ entry.selector }}</code><small v-if="entry.path">{{ entry.path }}</small></th>
                <td><select :aria-label="'Categoría para ' + entry.selector" :value="overrides[entry.id] ?? entry.category" @change="classify(entry.id, $event)">
                  <option v-for="category in categories" :key="category" :value="category">{{ labels[category] }}</option>
                </select></td>
                <td>{{ confidence[entry.confidence] }}</td>
              </tr></tbody>
            </table>
          </div>
          <p>Las capas cambian la prioridad. Las reglas normales fuera de capas prevalecen sobre las reglas normales en capas.</p>
          <ul v-if="(output ?? review).conflicts.length">
            <li v-for="item in (output ?? review).conflicts" :key="item.property">{{ item.property }} · {{ item.groups.map(group => labels[group]).join(', ') }}</li>
          </ul>
          <ul v-if="(output ?? review).warnings.length"><li v-for="item in (output ?? review).warnings" :key="item">{{ item }}</li></ul>
          <p v-if="(output ?? review).changes.length">Actualiza las clases del HTML según el mapa de renombrado.</p>
          <div class="actions">
            <button type="button" class="btn" :disabled="busy" @click="run(true)">{{ label('confirm') }}</button>
            <button v-if="output && options.output === 'files'" type="button" class="btn" @click="download">{{ label('zip') }}</button>
          </div>
        </div>
      </RefactorPane>
    </template>
  </RefactorWorkspace>
</template>
<style scoped>
.review-content { padding:.8rem 1rem; min-width:0; }
.review-scroll { overflow: auto; max-height: 28rem; }
table { border-spacing: .5rem; width: 100%; text-align: start; }
caption { text-align: start; }
th { text-align: start; overflow-wrap: anywhere; min-width: 6rem; }
small { display: block; }
</style>
