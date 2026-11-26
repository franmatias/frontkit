<script setup lang="ts">
import * as v from 'valibot'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeOutputPanel from '../../components/shared/CodeOutputPanel.vue'
import { useToolState } from '../../composables/useToolState'
import { defineTool } from '../../core/tool'
import type { Options } from './processor'

const limit = 2 * 1024 * 1024
const logic = defineTool<Options>({
  id: 'css-minifier',
  schema: v.strictObject({ mode: v.picklist(['minify', 'clean']), indentSize: v.union([v.literal(2), v.literal(4)]),
    removeComments: v.boolean(), removeEmptyRules: v.boolean(), restructure: v.boolean() }),
  defaultState: () => ({ mode: 'minify', indentSize: 2, removeComments: true, removeEmptyRules: true, restructure: false }),
  outputs: {}, presets: [],
})
const { t } = useI18n()
const label = (key: string) => t('detail.css-minifier.' + key)
const { state, update, ready } = useToolState(logic)
const input = ref<HTMLTextAreaElement>()
const text = ref('')
const fileError = ref('')
const running = ref(false)
type Failure = { reason: string; line?: number; column?: number }
type Result = { css: string; before: number; after: number; ms: number }
const error = ref<Failure>()
const result = ref<Result>()
const output = computed(() => ({ css: result.value?.css ?? '' }))
const keys = ['removeComments', 'removeEmptyRules', 'restructure'] as const
let worker: Worker | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let fileVersion = 0
function cancel() {
  clearTimeout(timer)
  worker?.terminate()
  worker = undefined
  running.value = false
}
function run() {
  cancel()
  result.value = undefined
  error.value = undefined
  if (!text.value.trim()) return
  if (text.value.length > limit || new TextEncoder().encode(text.value).length > limit) {
    error.value = { reason: 'tooLarge' }
    return
  }
  try {
    const current = new Worker(new URL('./css-worker.ts', import.meta.url), { type: 'module' })
    worker = current
    running.value = true
    current.onmessage = ({ data }: MessageEvent<Result | { error: Failure }>) => {
      if (worker !== current) return
      if ('error' in data) error.value = data.error
      else result.value = data
      cancel()
    }
    current.onerror = () => {
      if (worker !== current) return
      error.value = { reason: 'workerError' }
      cancel()
    }
    current.postMessage({ source: text.value, options: { ...state.value } })
  } catch {
    error.value = { reason: 'workerError' }
    cancel()
  }
}
watch([text, state], () => {
  cancel()
  error.value = undefined
  result.value = undefined
  timer = setTimeout(run, 240)
})
onUnmounted(cancel)
async function load(file?: File) {
  if (!file) return
  const version = ++fileVersion
  fileError.value = ''
  if (!file.name.toLowerCase().endsWith('.css') || file.size > limit) {
    fileError.value = label(file.size > limit ? 'tooLarge' : 'invalidFile')
    return
  }
  try {
    const data = await file.text()
    if (version === fileVersion) text.value = data
  } catch {
    if (version === fileVersion) fileError.value = label('invalidFile')
  }
}
function choose(event: Event) {
  const field = event.target as HTMLInputElement
  void load(field.files?.[0])
  field.value = ''
}
function goToError() {
  if (!error.value?.line || !input.value) return
  const cursor = text.value.split('\n').slice(0, error.value.line - 1).reduce((sum, line) => sum + line.length + 1, 0) + (error.value.column ?? 1) - 1
  input.value.focus()
  input.value.setSelectionRange(cursor, cursor + 1)
}
const value = (event: Event) => (event.target as HTMLSelectElement).value
</script>
<template>
  <div class="workspace">
    <header class="tool-heading">
      <div><p class="kicker">{{ t('category.optimization') }}</p><h1>{{ t('tools.css-minifier.name') }}</h1><p>{{ t('tools.css-minifier.description') }}</p></div>
    </header>
    <div class="workspace-grid">
      <section v-if="ready" class="panel tool-controls">
        <h2>{{ t('tool.controls') }}</h2>
        <label>{{ label('mode') }}<select :value="state.mode" @change="update(d => { d.mode = value($event) === 'clean' ? 'clean' : 'minify' })">
          <option value="minify">{{ label('minify') }}</option><option value="clean">{{ label('clean') }}</option>
        </select></label>
        <label v-if="state.mode === 'clean'">{{ label('indentSize') }}<select :value="state.indentSize" @change="update(d => { d.indentSize = value($event) === '4' ? 4 : 2 })">
          <option :value="2">2</option><option :value="4">4</option>
        </select></label>
        <label v-for="key in keys" :key="key" class="check"><input :checked="state[key]" type="checkbox" @change="update(d => { d[key] = !d[key] })" />{{ label(key) }}</label>
        <p>{{ label('limit') }}</p>
      </section>
      <div class="preview-column">
        <section class="panel source-panel" @dragover.prevent @drop.prevent="load($event.dataTransfer?.files[0])">
          <h2>{{ label('input') }}</h2>
          <label>{{ label('pick') }}<input type="file" accept=".css,text/css" @change="choose" /></label>
          <textarea ref="input" v-model="text" :aria-label="label('input')" :maxlength="limit" spellcheck="false" @input="fileVersion++" />
          <div class="actions">
            <button class="btn" type="button" :disabled="running || !text.trim()" @click="run">{{ label('process') }}</button>
            <button class="btn" type="button" :disabled="!running" @click="cancel">{{ label('cancel') }}</button>
            <span v-if="running" role="status">{{ label('running') }}</span>
          </div>
          <p v-if="fileError" role="status">{{ fileError }}</p>
          <div v-if="error" class="notice" role="alert">
            {{ ['tooLarge','workerError'].includes(error.reason) ? label(error.reason) : error.reason }}
            <button v-if="error.line" class="btn" type="button" @click="goToError">{{ label('goTo') }} {{ error.line }}:{{ error.column }}</button>
          </div>
          <p v-if="result" role="status">{{ result.before }} B → {{ result.after }} B · {{ label('saving') }} {{ ((1 - result.after / result.before) * 100).toFixed(1) }} % · {{ result.ms.toFixed(1) }} ms</p>
        </section>
        <CodeOutputPanel :name="logic.id" :outputs="output" />
      </div>
    </div>
  </div>
</template>
<style scoped>
.source-panel { display:grid;gap:.65rem;min-width:0; }
textarea { width:100%;min-height:16rem;padding:.65rem;border:1px solid var(--line);border-radius:8px;resize:vertical;font:.9rem/1.55 ui-monospace,monospace; }
</style>
