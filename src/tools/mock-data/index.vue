<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useClipboard } from '../../composables/useClipboard'
import { sendTableDraft } from '../../core/storage/table-handoff'
import { useNotificationsStore } from '../../stores/notifications'
import CodeOutputPanel from '../../components/shared/CodeOutputPanel.vue'
import { useToolState } from '../../composables/useToolState'
import { useWorker } from '../../composables/useWorker'
import FieldEditor from './FieldEditor.vue'
import { logic, type State } from './logic'
import type { Generation, Value } from './generator'

const { t } = useI18n()
const label = (key: string) => t('detail.mock-data.' + key)
const router = useRouter()
const notices = useNotificationsStore()
const copy = useClipboard()
const { state, ready, replace, update, url, shared, persist, discard } = useToolState(logic)
const { result, busy, failed, progress, send, cancel } = useWorker<State, Generation>(
  () => new Worker(new URL('./mock-worker.ts', import.meta.url), { type: 'module' }),
)
const preview = computed(() => result.value?.kind === 'result' ? result.value.preview : [])
const outputs = computed<Record<string, string>>(() => result.value?.kind === 'result' ? { [state.value.format]: result.value.output } : {})
const value = (event: Event) => (event.target as HTMLInputElement).value
const seedPreset = ref('')
function preset(event: Event) {
  seedPreset.value = value(event)
  const found = logic.presets.find(item => item.id === seedPreset.value)
  if (found) replace(found.state)
}
async function share() {
  try { await copy(url()) } catch { notices.push('tool.shareError') }
}
async function sendTable() {
  try {
    const handoff = await sendTableDraft({ count: state.value.count, columns: state.value.fields.map(field => field.name), recipe: state.value })
    await router.push({ name: 'table-builder', query: { handoff } })
  } catch { notices.push('tool.storageError') }
}
function generate() {
  if (ready.value) send(state.value)
}
watch(state, () => {
  cancel()
  result.value = undefined
  failed.value = false
})
function count(event: Event) {
  const parsed = Number.parseInt(value(event), 10)
  if (Number.isFinite(parsed)) update(d => { d.count = Math.max(1, Math.min(1000, parsed)) })
}
function show(value: Value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 180 ? text.slice(0, 179) + '…' : text
}
</script>

<template>
  <div class="workspace">
    <header class="tool-heading"><div><p class="kicker">{{ t('category.data') }}</p><h1>{{ t('tools.mock-data.name') }}</h1><p>{{ t('tools.mock-data.description') }}</p></div></header>
    <div v-if="shared" class="notice actions">
      {{ t('tool.shareLoaded') }}<button type="button" class="btn" @click="persist">{{ t('tool.keep') }}</button>
      <button type="button" class="btn" @click="discard">{{ t('tool.discard') }}</button>
    </div>
    <div class="workspace-grid">
      <section v-if="ready" class="panel">
        <h2>{{ label('schema') }}</h2>
        <label>{{ label('preset') }}<select :value="seedPreset" @change="preset">
          <option value="">{{ label('custom') }}</option>
          <option v-for="item in logic.presets" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select></label>
        <FieldEditor :fields="state.fields" :depth="1" @edit="update(d => { d.fields = $event }); seedPreset = ''" />
        <label>{{ label('locale') }}<select :value="state.locale" @change="update(d => { d.locale = value($event) as State['locale'] })">
          <option value="es-ES">{{ label('es') }}</option><option value="en-US">{{ label('en') }}</option>
        </select></label>
        <label>{{ label('seed') }}<input :value="state.seed" maxlength="80" @change="update(d => { d.seed = value($event) })" /></label>
        <label>{{ label('count') }}<input type="number" min="1" max="1000" :value="state.count" @change="count" /></label>
        <div class="actions">
          <button v-for="n in [10,50,100,500]" :key="n" type="button" class="btn" :aria-pressed="state.count === n" @click="update(d => { d.count = n })">{{ n }}</button>
        </div>
        <label>{{ label('format') }}<select :value="state.format" @change="update(d => { d.format = value($event) as State['format'] })">
          <option v-for="format in ['json','ndjson','csv','typescript']" :key="format" :value="format">{{ t('tool.' + format) }}</option>
        </select></label>
        <label v-if="state.format === 'typescript'" class="check"><input type="checkbox" :checked="state.constant" @change="update(d => { d.constant = !d.constant })" />as const</label>
        <div class="actions">
          <button type="button" class="btn primary" :disabled="busy" @click="generate">{{ label('generate') }}</button>
          <button v-if="busy" type="button" class="btn" @click="cancel">{{ label('cancel') }}</button>
          <button type="button" class="btn" @click="share">{{ label('share') }}</button>
        </div>
      </section>
      <div class="preview-column">
        <section class="panel">
          <h2>{{ label('preview') }}</h2>
          <div v-if="busy" class="progress"><progress :value="progress" max="100" :aria-label="label('generating')" /><span>{{ progress }} %</span></div>
          <p v-if="failed" role="alert" class="notice">{{ label('errors.complexity') }}</p>
          <p v-if="result?.kind === 'error'" role="alert" class="notice">
            {{ label('errors.' + result.code) }} <code v-if="result.field">{{ result.field }}</code>
          </p>
          <button v-if="preview.length" type="button" class="btn" @click="sendTable">{{ label('table') }}</button>
          <div v-if="preview.length" class="table-scroll" role="region" tabindex="0" :aria-label="label('preview')">
            <table>
              <thead><tr><th scope="col">#</th><th v-for="field in state.fields" :key="field.id" scope="col">{{ field.name }}</th></tr></thead>
              <tbody><tr v-for="(row, index) in preview" :key="index">
                <th scope="row">{{ index + 1 }}</th>
                <td v-for="field in state.fields" :key="field.id"><code>{{ show(row[field.name]) }}</code></td>
              </tr></tbody>
            </table>
          </div>
          <p v-else-if="!busy && !failed && !result">{{ label('empty') }}</p>
        </section>
        <CodeOutputPanel v-if="result?.kind === 'result'" name="frontkit-datos" :extensions="{ typescript: '.ts' }" :outputs="outputs" />
      </div>
    </div>
  </div>
</template>
<style scoped>
.workspace label { margin:.5rem 0; }
.progress { display:flex;align-items:center;gap:.6rem; }
.table-scroll { overflow:auto;max-height:34rem; }
table { border-collapse:collapse;width:100%; }
th,td { border:1px solid var(--line);text-align:left;min-width:5rem;padding:.42rem;overflow-wrap:anywhere; }
</style>
