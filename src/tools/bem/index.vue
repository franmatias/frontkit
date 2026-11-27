<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RefactorPane from '../../components/shared/RefactorPane.vue'
import RefactorWorkspace from '../../components/shared/RefactorWorkspace.vue'
import { receiveCleaned } from '../../core/storage/html-cleaner-handoff'
import { useWorker } from '../../composables/useWorker'
import { apply, defaults, plan, type Proposal } from './logic'
import type { Job, Result } from './worker'

const html = ref(receiveCleaned('bem') ?? '<article class="card">\n  <h2 class="title">Ficha</h2>\n  <button class="btn-red is-active">Aceptar</button>\n</article>')
const css = ref('')
const options = reactive(defaults())
const proposals = ref<Proposal[]>()
const output = ref<ReturnType<typeof apply>>()
const error = ref('')
const { result, busy, failed, send, cancel } = useWorker<Job, Result>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }))
const flagLabels = { keepUnknown: 'Conservar clases auxiliares', keepStates: 'Conservar estados is-* y has-*', semantic: 'Inferir clases para etiquetas semánticas', mix: 'Mezclar bloque y elemento en bloques anidados' }
const flags = ['keepUnknown', 'keepStates', 'semantic', 'mix'] as const
const outputs = computed(() => {
  if (!output.value) return
  const data = output.value
  return { html: data.html, css: data.css, scss: data.scss, json: data.json, csv: data.csv,
    ...(result.value && 'css' in result.value ? { rewritten: result.value.css } : {}) }
})
watch([html, css, options], () => { proposals.value = undefined; output.value = undefined; error.value = ''; cancel(); result.value = undefined })
function analyze() {
  try { error.value = ''; output.value = undefined; proposals.value = plan(html.value, options) }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
}
const conflicts = computed(() => {
  if (!proposals.value) return []
  const names = new Map<string, Set<string>>()
  for (const row of proposals.value) for (const item of row.pairs) {
    if (!names.has(item.before)) names.set(item.before, new Set())
    names.get(item.before)?.add(item.after)
  }
  return [...names].filter(([, items]) => items.size > 1).map(([name]) => name)
})
function setKind(row: Proposal, event: Event) {
  row.kind = (event.target as HTMLSelectElement).value as Proposal['kind']
  if (row.kind === 'block') row.suggested = [options.namespace + row.name]
  if (row.kind === 'element' && row.owner) row.suggested = [row.owner + options.elementSep + row.name]
  if (row.kind === 'modifier' && row.owner) row.suggested = [row.owner, row.owner + options.modifierSep + row.name]
  output.value = undefined
}
function confirm() {
  if (!proposals.value) return
  try {
    error.value = ''
    output.value = apply(html.value, proposals.value, options)
    result.value = undefined
    if (css.value.trim()) send({ css: css.value, changes: output.value.safeChanges.map(({ before, after }) => ({ before, after })) })
  } catch (e) { error.value = e instanceof Error ? e.message : String(e) }
}
const { t } = useI18n()
const label = (id: string) => t('detail.bem.' + id)
</script>

<template>
  <RefactorWorkspace id="bem" :outputs="outputs" :extensions="{ rewritten: 'css' }">
    <template #editors>
      <RefactorPane kind="html" :title="label('html')">
        <textarea v-model="html" :aria-label="label('html')" maxlength="200000" spellcheck="false" autocapitalize="off" />
      </RefactorPane>
      <RefactorPane kind="css" :title="label('optionalCss')">
        <textarea v-model="css" :aria-label="label('optionalCss')" maxlength="200000" spellcheck="false" autocapitalize="off" />
      </RefactorPane>
    </template>
    <label>{{ label('prefix') }}<input v-model.trim="options.namespace" maxlength="24" placeholder="c-" /></label>
    <label>{{ label('elementSep') }}<input v-model="options.elementSep" maxlength="5" /></label>
    <label>{{ label('modifierSep') }}<input v-model="options.modifierSep" maxlength="5" /></label>
    <div class="option-flags"><label v-for="flag in flags" :key="flag" class="check"><input v-model="options[flag]" type="checkbox" />{{ flagLabels[flag] }}</label></div>
    <details><summary>{{ label('dictionary') }}</summary><textarea v-model="options.dictionary" :aria-label="label('dictionary')" rows="5" maxlength="4000" /></details>
    <template #action>
      <button type="button" class="btn primary" :disabled="!html.trim()" @click="analyze">{{ label('analyze') }}</button>
    </template>
    <template #status>
      <p v-if="error" role="alert">{{ error }}</p>
    </template>
    <template #review>
      <RefactorPane v-if="proposals" kind="review" :title="label('review')">
        <div class="tool-controls review-content">
          <p v-if="conflicts.length" role="status">Clases ambiguas que requieren revisión: {{ conflicts.join(', ') }}.</p>
          <p v-if="!proposals.length">No hay clases ni etiquetas candidatas.</p>
          <ul class="proposals">
            <li v-for="row in proposals" :key="row.index" :style="{ marginInlineStart: Math.min(5, row.depth) * .45 + 'rem' }">
              <label class="check"><input v-model="row.enabled" type="checkbox" @change="output = undefined" />{{ row.tag }} · {{ row.original.join(' ') || 'sin clase' }}</label>
              <label>{{ label('types') }}<select :value="row.kind" @change="setKind(row, $event)">
                <option value="block">Bloque</option><option value="element">Elemento</option><option value="modifier">Modificador</option><option value="ignore">Conservar</option>
              </select></label>
              <label>{{ label('suggestion') }}<input :value="row.suggested.join(' ')" @change="row.suggested = ($event.target as HTMLInputElement).value.trim().split(/\s+/).filter(Boolean); output = undefined" /></label>
            </li>
          </ul>
          <button type="button" class="btn" @click="confirm">{{ label('confirm') }}</button>
          <p v-if="output?.conflicts.length" role="status">Revisa las colisiones: {{ output.conflicts.join(', ') }}.</p>
          <p v-if="busy" role="status">Reescribiendo selectores…</p>
          <p v-if="failed || result && 'error' in result" role="alert">{{ result && 'error' in result ? result.error.message : 'No se pudo analizar el CSS.' }}</p>
          <p v-if="result && 'review' in result && result.review.length" role="status">Selectores complejos pendientes de revisión: {{ result.review.join(', ') }}.</p>
        </div>
      </RefactorPane>
    </template>
  </RefactorWorkspace>
</template>
<style scoped>
.review-content { padding:.8rem 1rem; min-width:0; }

.proposals { list-style: none; padding: 0; margin: 0; display: grid; gap: .45rem; max-height: 34rem; overflow: auto; }
.proposals li { display: grid; gap: .35rem; padding: .45rem; border: 1px solid var(--line); border-radius: .45rem; overflow-wrap: anywhere; }
.proposals label { display: grid; gap: .25rem; }
.proposals .check { display: flex; }
</style>
