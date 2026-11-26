<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeOutputPanel from '../../components/shared/CodeOutputPanel.vue'
import { useClipboard } from '../../composables/useClipboard'
import { useToolState } from '../../composables/useToolState'
import { read, remove, writeRememberedInput } from '../../core/storage/db'
import { useNotificationsStore } from '../../stores/notifications'
import { useSettingsStore } from '../../stores/settings'
import { useWorker } from '../../composables/useWorker'
import { kinds } from '../../lib/json/diff'
import { logic, maxInput, type Options } from './logic'
import { repairText, type Request, type Result } from './processor'

const { t } = useI18n()
const label = (key: string) => t('detail.json.' + key)
const { state, update, ready, url, shared, persist, discard } = useToolState(logic)
const copy = useClipboard()
const settings = useSettingsStore()
const notices = useNotificationsStore()
const left = ref('')
const right = ref('')
const leftInput = ref<HTMLTextAreaElement>()
const rightInput = ref<HTMLTextAreaElement>()
const collapsed = ref(new Set<string>())
const filter = ref('all')
const view = ref<'structural' | 'text'>('structural')
const worker = useWorker<Request, Result>(() => new Worker(new URL('./json-worker.ts', import.meta.url), { type: 'module' }))
const { result, busy, failed, cancel, send } = worker
const flags = ['sortKeys', 'allowComments', 'tolerant'] as const
const compareFlags = ['ignoreKeyOrder', 'ignoreArrayOrder', 'numericEquality'] as const
const value = (event: Event) => (event.target as HTMLInputElement).value
const lengths = new TextEncoder()
const inputKey = 'json:input'
const maxRemembered = 100 * 1024
let restore = true
let dirty = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
function remember() {
  clearTimeout(saveTimer)
  if (!dirty || !settings.data.preferences.rememberInput || restore) return
  const payload = { left: left.value, right: right.value }
  const size = lengths.encode(payload.left).length + lengths.encode(payload.right).length
  if (size > maxRemembered) void remove('kv', inputKey).catch(() => {})
  else void writeRememberedInput(inputKey, payload).catch(() => {})
}
watch([left, right], () => {
  if (restore) return
  dirty = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(remember, 300)
}, { flush: 'sync' })
onMounted(async () => {
  restore = false
  if (!settings.data.preferences.rememberInput) return
  const record = await read('kv', inputKey).catch(() => undefined)
  const data = record?.state
  if (dirty || !settings.data.preferences.rememberInput || !data || typeof data !== 'object' ||
    !('left' in data) || !('right' in data) || typeof data.left !== 'string' || typeof data.right !== 'string' ||
    lengths.encode(data.left).length + lengths.encode(data.right).length > maxRemembered) return
  restore = true
  left.value = data.left
  right.value = data.right
  restore = false
})
onUnmounted(remember)
async function shareOptions() {
  try { await copy(url()) } catch { notices.push('tool.shareError') }
}
watch([left, right, state, ready], (_, __, cleanup) => {
  cancel()
  result.value = undefined
  failed.value = false
  if (!ready.value || (left.value === '' && (state.value.mode === 'format' || right.value === ''))) return
  const id = setTimeout(() => {
    if (lengths.encode(left.value).length > maxInput || (state.value.mode === 'diff' && lengths.encode(right.value).length > maxInput)) {
      result.value = { kind: 'error', side: lengths.encode(left.value).length > maxInput ? 'left' : 'right', code: 'tooLarge' }
      return
    }
    send({ left: left.value, right: state.value.mode === 'diff' ? right.value : '', options: state.value })
  }, 250)
  cleanup(() => clearTimeout(id))
})
const rows = computed(() => {
  if (result.value?.kind !== 'format') return []
  const all = result.value.rows
  let hiddenDepth: number | undefined
  return all.filter(row => {
    if (hiddenDepth !== undefined && row.depth > hiddenDepth) return false
    hiddenDepth = collapsed.value.has(row.path) ? row.depth : undefined
    return true
  })
})
const changes = computed(() => result.value?.kind === 'diff' ? result.value.structural.changes.filter(c => filter.value === 'all' || c.kind === filter.value) : [])
const outputs = computed((): Record<string, string> => {
  const r = result.value
  if (r?.kind === 'format') return { json: r.formatted, jsonCompact: r.compact, typescript: r.types }
  if (r?.kind === 'diff') return { jsonPatch: r.patch, markdown: r.report }
  return {}
})
const textDiff = computed(() => {
  const r = result.value
  if (r?.kind !== 'diff' || view.value !== 'text') return []
  const a = r.before.split(/\r?\n/).slice(0, 800)
  const b = r.after.split(/\r?\n/).slice(0, 800)
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => ({
    left: a[i] ?? '', right: b[i] ?? '', different: a[i] !== b[i],
  }))
})
function repair() {
  const r = result.value
  if (r?.kind !== 'repair') return
  const field = r.side === 'left' ? left : right
  field.value = repairText(field.value, r.edits)
}
function jump() {
  const r = result.value
  if (r?.kind !== 'error' || !r.line) return
  const editor = r.side === 'left' ? leftInput.value : rightInput.value
  if (!editor) return
  let offset = 0
  for (let i = 1; i < r.line; i++) offset = editor.value.indexOf('\n', offset) + 1
  offset += (r.column ?? 1) - 1
  editor.focus()
  editor.setSelectionRange(offset, offset + 1)
}
function toggle(path: string) {
  if (collapsed.value.has(path)) collapsed.value.delete(path)
  else collapsed.value.add(path)
}
</script>

<template>
  <div class="workspace json-workbench">
    <header class="tool-heading">
      <div><p class="kicker">{{ t('category.data') }}</p><h1>{{ t('tools.json.name') }}</h1><p>{{ t('tools.json.description') }}</p></div>
    </header>
    <div v-if="shared" class="notice actions">
      {{ t('tool.shareLoaded') }}<button class="btn" type="button" @click="persist">{{ t('tool.keep') }}</button>
      <button class="btn" type="button" @click="discard">{{ t('tool.discard') }}</button>
    </div>
    <section class="panel settings">
      <div class="actions">
        <label>{{ label('mode') }}
          <select :value="state.mode" @change="update(d => { d.mode = value($event) as Options['mode'] })">
            <option value="format">{{ label('format') }}</option><option value="diff">{{ label('diff') }}</option>
          </select>
        </label>
        <label v-if="state.mode === 'format'">{{ label('indent') }}
          <select :value="state.indent" @change="update(d => { d.indent = value($event) as Options['indent'] })">
            <option value="2">2</option><option value="4">4</option><option value="tab">{{ label('tab') }}</option>
          </select>
        </label>
        <button class="btn" type="button" :disabled="!ready" @click="shareOptions">{{ label('shareOptions') }}</button>
        <label v-for="flag in flags" :key="flag" class="check"><input type="checkbox" :checked="state[flag]"
          @change="update(d => { d[flag] = !d[flag] })" />{{ label(flag) }}</label>
      </div>
      <div v-if="state.mode === 'diff'" class="actions">
        <label v-for="flag in compareFlags" :key="flag" class="check"><input type="checkbox" :checked="state[flag]"
          @change="update(d => { d[flag] = !d[flag] })" />{{ label(flag) }}</label>
        <label>{{ label('arrayKey') }}<input :value="state.arrayKey" placeholder="id" maxlength="100" @change="update(d => { d.arrayKey = value($event).trim() })" /></label>
        <label>{{ label('ignorePaths') }}<input :value="state.ignorePaths.join(', ')" placeholder="/data/id" maxlength="20000"
          @change="update(d => { d.ignorePaths = value($event).split(',').map(path => path.trim()).filter(path => path.startsWith('/') && path.length <= 200).slice(0, 100) })" /></label>
      </div>
    </section>
    <div class="sources" :class="{ two: state.mode === 'diff' }">
      <label class="panel">{{ label(state.mode === 'format' ? 'source' : 'left') }}
        <textarea ref="leftInput" v-model="left" :maxlength="maxInput" spellcheck="false" autocomplete="off" />
      </label>
      <label v-if="state.mode === 'diff'" class="panel">{{ label('right') }}
        <textarea ref="rightInput" v-model="right" :maxlength="maxInput" spellcheck="false" autocomplete="off" />
      </label>
    </div>
    <div v-if="busy || failed" role="status" class="notice">
      {{ label(failed ? 'workerError' : 'working') }}
      <button v-if="busy" type="button" class="btn" @click="cancel">{{ label('cancel') }}</button>
    </div>
    <div v-if="result?.kind === 'error'" role="alert" class="notice">
      <strong>{{ label(state.mode === 'format' ? 'source' : result.side) }}</strong> · {{ label('errors.' + result.code) }}
      <button v-if="result.line" class="btn" type="button" @click="jump">{{ label('jump') }} {{ result.line }}:{{ result.column }}</button>
      <pre v-if="result.fragment">{{ result.fragment }}</pre>
    </div>
    <section v-if="result?.kind === 'repair'" class="notice repairs">
      <p>{{ label('repairPreview') }} · {{ label(state.mode === 'format' ? 'source' : result.side) }} · {{ result.edits.length }}</p>
      <ul><li v-for="kind in new Set(result.edits.map(e => e.kind))" :key="kind">{{ label('errors.' + kind) }}</li></ul>
      <pre>{{ result.preview }}</pre>
      <div class="actions">
        <button class="btn primary" type="button" @click="repair">{{ label('apply') }}</button>
        <button class="btn" type="button" @click="result = undefined">{{ t('tool.discard') }}</button>
      </div>
    </section>
    <p v-if="result && 'unsafe' in result && result.unsafe" class="notice" role="status">{{ label('precision') }} · {{ result.unsafe }}</p>
    <details v-if="result?.kind === 'format'" class="panel tree">
      <summary>{{ label('tree') }} · {{ result.rows.length }}</summary>
      <ul>
        <li v-for="row in rows" :key="row.path" :style="{ paddingInlineStart: Math.min(12, row.depth) * .7 + 'rem' }">
          <button v-if="row.count" class="btn" type="button" :aria-expanded="!collapsed.has(row.path)" @click="toggle(row.path)">{{ row.label }} ({{ row.count }})</button>
          <strong v-else>{{ row.label }}</strong>
          <small>{{ label('types.' + row.type) }}</small>
          <code v-if="row.value">{{ row.value }}</code>
          <button class="btn" type="button" :aria-label="label('copyPath') + ' ' + row.path" @click="copy(row.path)">{{ label('copyPath') }}</button>
        </li>
      </ul>
      <p v-if="result.rows.length === 1500">{{ label('treeLimit') }}</p>
    </details>
    <section v-if="result?.kind === 'diff'" class="panel comparison">
      <h2>{{ label('diff') }}</h2>
      <div class="actions">
        <button v-for="item in ['structural','text'] as const" :key="item" class="btn" type="button" :aria-pressed="view === item" @click="view = item">{{ label(item) }}</button>
      </div>
      <div v-if="view === 'structural'">
        <div class="actions counts"><span v-for="kind in kinds" :key="kind" class="badge">{{ label('kinds.' + kind) }} {{ result.structural.counts[kind] }}</span></div>
        <label>{{ label('filter') }}<select v-model="filter">
          <option value="all">{{ t('app.all') }}</option><option v-for="kind in kinds" :key="kind" :value="kind">{{ label('kinds.' + kind) }}</option>
        </select></label>
        <ul v-if="changes.length" class="change-list">
          <li v-for="(item, index) in changes" :key="index">
            <strong>{{ label('kinds.' + item.kind) }}</strong> <code>{{ item.path || '$' }}</code>
            <span v-if="item.from"> · {{ item.from }}</span>
            <span v-if="item.before !== undefined || item.after !== undefined"> · {{ item.before ?? '∅' }} → {{ item.after ?? '∅' }}</span>
          </li>
        </ul>
        <p v-else>{{ label('noChanges') }}</p>
        <p v-if="result.structural.changes.length === 3000">{{ label('diffLimit') }}</p>
        <p>{{ label('patchNote') }}</p>
      </div>
      <div v-else class="text-diff" role="region" tabindex="0" :aria-label="label('text')">
        <div v-for="(row, index) in textDiff" :key="index" :class="{ different: row.different }">
          <span>{{ index + 1 }}</span><code>{{ row.left }}</code><code>{{ row.right }}</code>
        </div>
      </div>
    </section>
    <CodeOutputPanel v-if="Object.keys(outputs).length" name="frontkit" :outputs="outputs"
      :extensions="{ jsonCompact: '.min.json', typescript: '.ts', jsonPatch: '.patch.json', markdown: '.md' }" />
  </div>
</template>
<style scoped>
.settings .actions { align-items:end; }
.sources { display:grid;gap:.7rem; }
.sources.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
.sources label { min-width:0; }
textarea { display:block;width:100%;min-height:14rem;margin-top:.3rem;padding:.6rem;border:1px solid var(--line);border-radius:8px;resize:vertical;font:.87rem/1.5 ui-monospace,monospace; }
.repairs pre,.notice pre,.tree,.change-list,.text-diff { max-height:26rem;overflow:auto; }
.tree li { display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;margin:.2rem 0;overflow-wrap:anywhere; }
.change-list li { padding:.3rem;border-bottom:1px solid var(--line);overflow-wrap:anywhere; }
.counts { margin:.35rem 0; }
.text-diff div { display:grid;grid-template-columns:3rem repeat(2,minmax(0,1fr));padding:.2rem; }
.text-diff code { white-space:pre-wrap;overflow-wrap:anywhere; }
.text-diff .different { box-shadow:inset 3px 0 var(--accent);background:var(--surface-alt,var(--surface));font-weight:700; }
@media(max-width:760px){.sources.two { grid-template-columns:minmax(0,1fr); }}
</style>
