<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, useId, watch } from 'vue'
import RefactorPane from '../../components/shared/RefactorPane.vue'
import { useClipboard } from '../../composables/useClipboard'
import { captureHue, highlights, type Span } from './highlights'
import { changeFlag, flagOptions, maxPattern, maxText, presets, presetState, type Match, type RegexResult, type RegexRequest, type RegexState, type Transformation, type Transformed } from './model'
import RegexEditor from './RegexEditor.vue'
import RegexGuide from './RegexGuide.vue'
import RegexTemplates from './RegexTemplates.vue'
import RegexTokens from './RegexTokens.vue'
import RegexTransformation from './RegexTransformation.vue'
import { tokenize } from './tokens'

const model = defineModel<RegexState>({ required: true })
const emit = defineEmits<{ match: [matches: Match[]]; error: [message: string] }>()
const copy = useClipboard()
const exampleId = useId()
const matches = shallowRef<Match[]>([])
const error = ref('')
const pending = ref(false)
const limited = ref(false)
const transformEnabled = ref(false)
const transformation = shallowRef<Transformation>({ mode: 'replace', template: '' })
const transformed = shallowRef<Transformed>()
const request = computed<RegexRequest>(() => ({
  pattern: model.value.pattern, flags: model.value.flags, text: model.value.text,
  transformation: transformEnabled.value ? transformation.value : undefined,
}))
const pattern = computed({
  get: () => model.value.pattern,
  set: value => { model.value = { ...model.value, pattern: value } },
})
const text = computed({
  get: () => model.value.text,
  set: value => { model.value = { ...model.value, text: value } },
})
const preset = computed(() => presets.find(item => item.pattern === model.value.pattern &&
  item.flags === model.value.flags && item.text === model.value.text)?.id ?? '')
const tokens = computed(() => tokenize(pattern.value, model.value.flags.includes('v')))
const patternParts = computed(() => tokens.value.flatMap<Span>(token => {
  if (token.kind === 'class' && token.text.startsWith('[')) {
    return token.text.split(/(\\[\s\S])/).filter(Boolean).map(text => ({ text, kind: text.startsWith('\\') ? 'escape' : 'set' }))
  }
  const kind = { class: 'set', reference: 'escape', anchor: 'operator' }
  return [{ text: token.text, kind: kind[token.kind as keyof typeof kind] ?? token.kind }]
}))
const testParts = computed(() => highlights(text.value, matches.value))
const javascript = computed(() => 'const regex = new RegExp(' +
  JSON.stringify(model.value.pattern) + ', ' + JSON.stringify(model.value.flags) + ');')

function toggle(flag: string, checked: boolean) {
  model.value = { ...model.value, flags: changeFlag(model.value.flags, flag, checked) }
}
function loadPreset(event: Event) {
  const next = presets.find(item => item.id === (event.target as HTMLSelectElement).value)
  if (next) model.value = presetState(next)
}

let debounce: ReturnType<typeof setTimeout> | undefined
let deadline: ReturnType<typeof setTimeout> | undefined
let worker: Worker | undefined

function cancel() {
  clearTimeout(debounce)
  clearTimeout(deadline)
  worker?.terminate()
  worker = undefined
}
function finish(result: RegexResult) {
  cancel()
  pending.value = false
  if ('error' in result) {
    error.value = result.error
    emit('error', result.error)
  } else {
    matches.value = result.matches
    limited.value = result.limited
    transformed.value = result.transformed
    emit('match', result.matches)
  }
}
function evaluate(input: RegexRequest) {
  try {
    const current = new Worker(new URL('./regex-engine.ts', import.meta.url), { type: 'module' })
    worker = current
    current.onmessage = ({ data }: MessageEvent<RegexResult>) => {
      if (worker === current) finish(data)
    }
    current.onerror = () => {
      if (worker === current) finish({ error: 'No se pudo iniciar el motor de expresiones regulares.' })
    }
    deadline = setTimeout(() => {
      if (worker === current) finish({ error: 'Tiempo límite superado. Simplifica el patrón o prueba con un texto más corto.' })
    }, 1000)
    current.postMessage(input)
  } catch {
    finish({ error: 'El navegador no pudo ejecutar el motor en segundo plano.' })
  }
}
watch(request, input => {
  cancel()
  matches.value = []
  limited.value = false
  error.value = ''
  transformed.value = undefined
  pending.value = Boolean(input.pattern)
  if (input.pattern) debounce = setTimeout(() => evaluate(input), 180)
}, { immediate: true })
onScopeDispose(cancel)
</script>

<template>
  <div class="regex-kit">
    <div class="panel regex-setup">
      <div class="examples">
        <label :for="exampleId">Plantillas</label>
        <select :id="exampleId" :value="preset" @change="loadPreset">
          <option value="" disabled>Elige una plantilla</option>
          <option v-for="item in presets" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>
      <RegexTemplates :current="model" @load="model = $event" />
      <div class="regex-analysis">
        <RefactorPane class="pattern-pane" kind="html" title="Patrón">
          <div class="pattern-controls">
            <RegexEditor v-model="pattern" label="Patrón" :max-length="maxPattern" :parts="patternParts" pattern hide-label />
            <fieldset class="flags">
              <legend>Banderas</legend>
              <label v-for="[flag, meaning] in flagOptions" :key="flag" :title="meaning">
                <input type="checkbox" :checked="model.flags.includes(flag)" :aria-label="flag + ' · ' + meaning"
                  @change="toggle(flag, ($event.target as HTMLInputElement).checked)" />
                <code>{{ flag }}</code>
              </label>
            </fieldset>
            <div class="actions">
              <button type="button" class="btn" :disabled="!pattern" @click="copy(pattern)">Copiar patrón</button>
              <button type="button" class="btn" :disabled="!pattern || !!error || pending" @click="copy(javascript)">Copiar JavaScript / TypeScript</button>
            </div>
          </div>
        </RefactorPane>
        <RefactorPane class="tokens-pane" kind="review" title="Desglose léxico de tokens en tiempo real" compact-title="Tokens">
          <RegexTokens :tokens="tokens" />
        </RefactorPane>
      </div>
    </div>
    <div class="regex-results">
      <section class="panel test-panel">
        <RegexEditor v-model="text" label="Texto de prueba" :max-length="maxText" :parts="testParts" />
        <p v-if="error" class="regex-error" role="alert">{{ error }}</p>
        <p v-else role="status">
          {{ pending ? 'Evaluando…' : !pattern ? 'Escribe un patrón o elige una plantilla.' :
            matches.length + (matches.length === 1 ? ' coincidencia' : ' coincidencias') }}
          <span v-if="limited"> · Se muestra un resultado parcial por el límite de visualización.</span>
        </p>
      </section>
      <section class="panel inspector">
        <h2>Inspector de coincidencias</h2>
        <p>Índices UTF-16. El índice final es exclusivo.</p>
        <ol v-if="matches.length" class="matches">
          <li v-for="(match, i) in matches" :key="i">
            <details :open="i === 0 || undefined">
              <summary><code>[{{ match.range.join(', ') }})</code> <code>{{ match.value || 'Coincidencia vacía' }}</code></summary>
              <dl v-if="match.captures.length">
                <template v-for="(capture, index) in match.captures" :key="index">
                  <dt><span class="key" :style="{ '--capture-hue': captureHue(index + 1) }"></span>Grupo {{ index + 1 }}</dt>
                  <dd><code v-if="capture.range">[{{ capture.range.join(', ') }}) {{ JSON.stringify(capture.value) }}</code>
                    <span v-else>Sin captura</span></dd>
                </template>
                <template v-for="(capture, name) in match.named" :key="name">
                  <dt>Grupo «{{ name }}»</dt>
                  <dd><code v-if="capture.range">[{{ capture.range.join(', ') }}) {{ JSON.stringify(capture.value) }}</code>
                    <span v-else>Sin captura</span></dd>
                </template>
              </dl>
              <p v-else>Sin grupos de captura</p>
            </details>
          </li>
        </ol>
      </section>
    </div>
    <RegexGuide @load="model = $event" />
    <RegexTransformation v-model="transformation" v-model:enabled="transformEnabled" :has-pattern="!!pattern"
      :pending="pending" :error="error" :result="transformed" @copy="copy" @apply="text = $event" />
  </div>
</template>

<style scoped>
.regex-kit { display:grid;gap:1rem;container-type:inline-size;
  --regex-mark:color-mix(in srgb,var(--accent) 24%,var(--surface));
  --regex-escape:light-dark(#7740aa,#e2aaf8);
  --regex-set:light-dark(#1b615c,#90ddcb);
  --regex-quantifier:light-dark(#8d4509,#ffcc84) }
.regex-setup,.test-panel,.inspector { display:grid;gap:.8rem;padding:1rem;min-width:0 }
.examples { display:flex;flex-wrap:wrap;align-items:center;gap:.55rem }
.examples select { max-width:100% }
.pattern-controls { display:grid;gap:.75rem;min-width:0 }
.pattern-controls { padding:1rem }
.flags { display:flex;gap:.4rem;flex-wrap:wrap;border:1px solid var(--line);border-radius:.65rem;padding:.45rem .65rem .65rem }
.flags legend { padding-inline:.3rem }
.flags label { display:flex;align-items:center;gap:.35rem;padding:.25rem .45rem;border:1px solid var(--line);border-radius:.4rem;cursor:pointer }
.flags label:has(:checked) { border-color:var(--accent);background:var(--accent-soft) }
.regex-results { display:grid;gap:1rem;align-items:start }
@container (min-width:46rem) { .regex-results { grid-template-columns:minmax(0,3fr) minmax(0,2fr) } }
.inspector h2,.inspector p,.test-panel p { margin:0 }
.inspector h2 { font-size:1rem }
.inspector > p { color:var(--muted);font-size:.85rem }
.matches { display:grid;gap:.55rem;margin:0;padding-inline-start:1.5rem;max-height:34rem;overflow:auto }
.matches details { padding:.4rem .5rem;border:1px solid var(--line);border-radius:.45rem;overflow-wrap:anywhere }
.matches summary { color:var(--accent);white-space:pre-wrap }
.matches dl { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:.35rem;margin:.5rem 0 0;font-size:.86rem }
.matches dd { margin:0;white-space:pre-wrap }
.key { display:inline-block;width:.8rem;height:.8rem;margin-inline-end:.25rem;border-radius:.18rem;background:color-mix(in srgb,hsl(var(--capture-hue) 75% 64%) 30%,var(--surface)) }
.regex-error { overflow-wrap:anywhere }
</style>
<style>
.regex-analysis { display:grid;gap:.75rem;min-width:0 }
@container (min-width:44rem) {
  .regex-analysis { display:flex }
  .regex-analysis > .refactor-pane { flex:1 1 0 }
  .regex-analysis:has(> :not(.folded)) > .folded { flex:0 0 2.75rem }
  .regex-analysis:has(> :not(.folded)) > .folded .pane-bar { height:100%;padding:.35rem }
  .regex-analysis:has(> :not(.folded)) > .folded .pane-toggle {
    writing-mode:vertical-rl;transform:rotate(180deg);margin:auto;width:auto;padding:.25rem 0
  }
  .regex-analysis:has(> :not(.folded)) > .folded .chevron { margin:0 }
  .regex-analysis:has(> :not(.folded)) > .tokens-pane.folded .pane-title { display:none }
  .regex-analysis:has(> :not(.folded)) > .tokens-pane.folded .pane-compact-title { display:inline }
}
</style>
