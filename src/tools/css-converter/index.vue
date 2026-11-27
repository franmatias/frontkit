<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RefactorPane from '../../components/shared/RefactorPane.vue'
import RefactorWorkspace from '../../components/shared/RefactorWorkspace.vue'
import { useWorker } from '../../composables/useWorker'
import { cssLimit } from '../../lib/css-ast'
import { defaults } from './logic'
import type { Job, Result } from './worker'

const source = ref('.card { padding: 1rem; }\n.card:hover { color: white; }\n.card > h2 { font-weight: 700; }\n@media (min-width: 768px) { .card { display: grid; } }')
const options = reactive(defaults())
const { result, busy, failed, send, cancel } = useWorker<Job, Result>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }))
const accepted = ref(false)
const draft = computed(() => result.value && 'css' in result.value ? result.value : undefined)
const failure = computed(() => result.value && 'error' in result.value ? result.value.error : undefined)
const labels: Record<string, string> = {
  selector: 'Selector complejo o BEM conservado', order: 'Regla base conservada en su posición',
  depth: 'Límite de profundidad', nested: 'Regla anidada sin moverla por encima de otras',
  specificity: 'La especificidad aumenta por el selector descendiente',
}
const status = { converted: 'Convertida', review: 'Revisar', kept: 'Conservada' }
watch([source, options], () => { cancel(); result.value = undefined; accepted.value = false })
function analyze() {
  accepted.value = false
  send({ source: source.value, options: { ...options } })
}
const { t } = useI18n()
const label = (id: string) => t('detail.css-converter.' + id)
</script>

<template>
  <RefactorWorkspace id="css-converter" :outputs="accepted && draft ? { css: draft.css } : undefined"
    :extensions="{ css: options.target === 'scss' ? 'scss' : 'css' }">
    <template #editors>
      <RefactorPane kind="css" :title="label('source')">
        <textarea v-model="source" :aria-label="label('source')" :maxlength="cssLimit" spellcheck="false" autocapitalize="off" />
      </RefactorPane>
    </template>
    <label>{{ label('format') }}<select v-model="options.target">
      <option value="native-nesting">CSS Nesting nativo</option><option value="scss">SCSS</option><option value="tailwind-apply">Tailwind v4 con @apply</option>
    </select></label>
    <label v-if="options.target !== 'tailwind-apply'">{{ label('strategy') }}<select v-model="options.bem">
      <option value="keep-flat">Conservar selectores planos</option><option value="nest-descendant">Anidar como descendientes</option><option v-if="options.target === 'scss'" value="scss">Concatenar nombres en SCSS</option>
    </select></label>
    <label v-if="options.target !== 'tailwind-apply'">{{ label('depth') }}
      <select v-model.number="options.maxDepth"><option :value="1">1</option><option :value="2">2</option><option :value="3">3</option></select>
    </label>
    <template v-else>
      <label>{{ label('unknown') }}<select v-model="options.unknown">
        <option value="arbitrary">Usar valores arbitrarios</option><option value="keep">Conservar CSS</option>
      </select></label>
      <label class="check"><input v-model="options.variants" type="checkbox" :disabled="options.preserveSpecificity" />{{ label('themeVariants') }}</label>
    </template>
    <label class="check"><input v-model="options.preserveSpecificity" type="checkbox" />{{ label('specificity') }}</label>
    <a v-if="options.target === 'native-nesting'" href="https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Nesting_selector#browser_compatibility" target="_blank" rel="noopener noreferrer">{{ label('compatibility') }}</a>
    <template #action>
      <button type="button" class="btn primary" :disabled="busy || !source.trim()" @click="analyze">{{ label('analyze') }}</button>
    </template>
    <template #status>
      <p v-if="busy" role="status">{{ label('working') }}</p>
      <p v-if="failure || failed" role="alert">{{ failure?.message ?? label('workerError') }} <span v-if="failure?.line">Línea {{ failure.line }}, columna {{ failure.column }}</span></p>
    </template>
    <template #review>
      <RefactorPane v-if="draft" kind="review" :title="label('review')">
        <div class="tool-controls review-content">
          <p>{{ draft.report.length }} cambios o decisiones registradas.</p>
          <ul class="review-list">
            <li v-for="(entry, index) in draft.report" :key="index"><strong>{{ status[entry.status] }}</strong> · <code>{{ entry.selector }}</code> · {{ labels[entry.detail] ?? entry.detail }}</li>
          </ul>
          <button type="button" class="btn" :disabled="accepted" @click="accepted = true">{{ label('confirm') }}</button>
        </div>
      </RefactorPane>
    </template>
  </RefactorWorkspace>
</template>
<style scoped>
.review-content { padding:.8rem 1rem; min-width:0; }
.review-list { max-height: 22rem; overflow: auto; padding-inline-start: 1.2rem; overflow-wrap: anywhere; }
</style>
