<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { decodeShare, encodeShare } from '../../composables/share'
import { useClipboard } from '../../composables/useClipboard'
import { onExternalChange, read, remove, snapshot, write } from '../../core/storage/db'
import { download } from '../../lib/download'
import { useSettingsStore } from '../../stores/settings'
import { useNotificationsStore } from '../../stores/notifications'
import { createProject, exportHtml, importProject, languages, layouts, logic, parseProject, sourceOnly, templates, type Project, type Source } from './project'
import { levels, previewDocument, type Level } from './preview'

const { t } = useI18n()
const label = (key: string) => t('detail.playground.' + key)
const store = useSettingsStore()
const notices = useNotificationsStore()
const copy = useClipboard()
const route = useRoute()
const router = useRouter()
const project = shallowRef(createProject(label('untitled'), logic.defaultState()))
const projects = shallowRef<Project[]>([])
const active = ref<(typeof languages)[number]>('html')
const template = ref('card')
const preview = ref<HTMLIFrameElement>()
const previewHtml = ref('')
const ready = ref(false)
const blocked = ref(false)
const shared = ref(false)
const large = ref(false)
const dirty = ref(false)
const ratio = ref(52)
const area = ref<HTMLElement>()
const result = ref('')
const filter = ref('')
const search = ref('')
const logs = shallowRef<{level: Level; text: string; id: number}[]>([])
const shown = computed(() => logs.value.filter(row => (!filter.value || row.level === filter.value) && row.text.toLowerCase().includes(search.value.toLowerCase())))
const small = ref(false)
const layout = computed(() => small.value ? 'tabs' : project.value.layout)
let seq = 0
let nonce = ''
let runVersion = 0
let disposed = false
let savedBeforeLink: Project | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let runTimer: ReturnType<typeof setTimeout> | undefined
let tabId = crypto.randomUUID() as string
try {
  tabId = sessionStorage.getItem('frontkit:playground-tab') || tabId
  sessionStorage.setItem('frontkit:playground-tab', tabId)
} catch { /* Storage can be disabled in private browsing. */ }
const flag = 'playground-' + tabId

function listItem(item: Project) {
  projects.value = [item, ...projects.value.filter(p => p.id !== item.id)].sort((a,b) => b.updatedAt - a.updatedAt)
}
async function persist() {
  clearTimeout(saveTimer)
  if (!ready.value || shared.value || !dirty.value) return
  const item = project.value
  await write('projects', item.id, item)
  listItem(item)
  await write('kv', 'playground-active', item.id)
  if (project.value === item) dirty.value = false
}
function saveSoon() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void persist().catch(() => {}) }, 300)
}
function forgetHash() {
  if (route.hash.startsWith('#s=')) void router.replace({ path: route.path, query: route.query, hash: '' })
}
function keep() {
  shared.value = false
  savedBeforeLink = undefined
  forgetHash()
  dirty.value = true
  saveSoon()
}
function discard() {
  if (savedBeforeLink) project.value = savedBeforeLink
  savedBeforeLink = undefined
  shared.value = false
  forgetHash()
  clearPreview()
}
function edit(patch: Partial<Source>) {
  if (shared.value) keep()
  project.value = { ...project.value, ...patch, updatedAt: Date.now() }
  dirty.value = true
  saveSoon()
  clearTimeout(runTimer)
  if (store.data.editor.autoRun && !blocked.value) runTimer = setTimeout(() => { void run() }, store.data.editor.autoRunDelayMs)
}
function clearPreview() {
  clearTimeout(runTimer)
  runVersion++
  nonce = ''
  previewHtml.value = ''
  logs.value = []
  result.value = ''
}
async function select(item: Project, save = true) {
  clearPreview()
  if (save) await persist()
  shared.value = false
  savedBeforeLink = undefined
  forgetHash()
  project.value = item
  dirty.value = true
  await persist()
}
async function fresh(duplicate = false) {
  const name = prompt(label('name'), duplicate ? project.value.name + ' (2)' : label('untitled'))?.trim()
  if (!name || name.length > 80) return
  await select(createProject(name, duplicate ? project.value : templates[template.value]))
}
async function rename() {
  const name = prompt(label('name'), project.value.name)?.trim()
  if (!name || name.length > 80) return
  if (shared.value) keep()
  project.value = { ...project.value, name, updatedAt: Date.now() }
  dirty.value = true
  await persist()
}
async function deleteCurrent() {
  if (!confirm(label('confirmDelete'))) return
  clearTimeout(saveTimer)
  const id = project.value.id
  await remove('projects', id)
  projects.value = projects.value.filter(item => item.id !== id)
  await select(projects.value[0] ?? createProject(label('untitled'), templates.blank), false)
}
async function imported(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    if (file.size > 3_000_000) throw new Error('size')
    const data = importProject(await file.text())
    await select(createProject(data.name, data))
  } catch { notices.push('settings.invalid') }
}
function exportFile(html: boolean) {
  const item = project.value
  download(item.name + (html ? '.html' : '.json'), html ? exportHtml(item) : JSON.stringify(item, null, 2), html ? 'text/html' : 'application/json')
}
async function share() {
  try {
    const url = new URL(location.href)
    url.hash = encodeShare(logic, sourceOnly(project.value))
    await copy(url.href)
  } catch { large.value = true }
}
async function loadLink(hash: string) {
  if (!hash.startsWith('#s=')) return
  try {
    const source = decodeShare(logic, hash)
    await persist()
    clearPreview()
    savedBeforeLink ??= project.value
    project.value = createProject(label('shared'), source)
    shared.value = true
  } catch { notices.push('tool.shareError') }
}
watch(() => route.hash, hash => { if (ready.value) void loadLink(hash) })

async function run() {
  if (!ready.value) return
  clearPreview()
  const revision = runVersion
  blocked.value = false
  const token = crypto.randomUUID()
  const doc = previewDocument(sourceOnly(project.value), token, store.data.editor.loopProtection, label('loop'))
  try { await write('meta', flag, true) } catch { return }
  if (disposed || revision !== runVersion) return
  nonce = token
  result.value = doc.parsed ? '' : label('parse')
  previewHtml.value = doc.html
}
function receive(event: MessageEvent) {
  const msg = event.data
  if (!nonce || event.source !== preview.value?.contentWindow || !msg || msg.nonce !== nonce || typeof msg.text !== 'string') return
  if (msg.level === 'ready') { void remove('meta', flag).catch(() => {}); return }
  if (!levels.includes(msg.level)) return
  if (msg.level === 'clear') { logs.value = []; return }
  logs.value = [...logs.value.slice(-999), { id: ++seq, level: msg.level, text: msg.text.slice(0,4000) }]
}
function resize(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (!target.hasPointerCapture(event.pointerId) || !area.value) return
  const box = area.value.getBoundingClientRect()
  ratio.value = Math.max(25, Math.min(75, Math.round(100 * (event.clientX - box.left) / box.width)))
}
function paletteAction(event: Event) {
  if (!(event instanceof CustomEvent) || !ready.value) return
  if (event.detail === 'share') void share()
  if (event.detail === 'copy') void copy(project.value[active.value])
  if (event.detail === 'reset' && confirm(t('tool.confirmReset'))) edit(logic.defaultState())
}
function shortcut(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  if (event.key === 'Enter') { event.preventDefault(); void run() }
  if (event.key.toLowerCase() === 's') { event.preventDefault(); if (shared.value) keep(); dirty.value = true; void persist().catch(() => {}) }
}
function visibility() { if (document.hidden) void persist().catch(() => {}) }
const media = window.matchMedia('(max-width: 700px)')
function setSmall() { small.value = media.matches }
async function refresh() {
  const records = Object.values((await snapshot()).projects)
  const valid: Project[] = []
  for (const record of records) {
    try { valid.push(parseProject(record.state)) } catch { /* Ignore incompatible records. */ }
  }
  projects.value = valid.sort((a,b) => b.updatedAt - a.updatedAt)
  const newer = valid.find(p => p.id === project.value.id && p.updatedAt > project.value.updatedAt)
  if (newer && !shared.value) {
    if (dirty.value) result.value = label('conflict')
    else project.value = newer
  }
}
const stop = onExternalChange(() => { void refresh().catch(() => {}) })
onMounted(async () => {
  window.addEventListener('message', receive)
  window.addEventListener('keydown', shortcut)
  window.addEventListener('frontkit:tool-action', paletteAction)
  document.addEventListener('visibilitychange', visibility)
  media.addEventListener('change', setSmall)
  setSmall()
  await refresh()
  const last = await read('kv', 'playground-active')
  project.value = projects.value.find(item => item.id === last?.state) ?? projects.value[0] ?? project.value
  blocked.value = (await read('meta', flag))?.state === true
  if (disposed) return
  ready.value = true
  await loadLink(route.hash)
  if (!disposed && store.data.editor.autoRun && !shared.value && !blocked.value && !route.hash) void run()
})
onUnmounted(() => {
  disposed = true
  clearPreview()
  void persist().catch(() => {})
  stop()
  media.removeEventListener('change', setSmall)
  window.removeEventListener('message', receive)
  window.removeEventListener('keydown', shortcut)
  window.removeEventListener('frontkit:tool-action', paletteAction)
  document.removeEventListener('visibilitychange', visibility)
})
</script>
<template>
  <div class="workspace">
    <h1>{{ t('tools.playground.name') }}</h1>
    <p v-if="small" class="notice">{{ label('mobile') }}</p>
    <p v-if="blocked" class="notice">{{ label('guard') }}</p>
    <div v-if="shared" class="notice actions">{{ t('tool.shareLoaded') }}
      <button class="btn" type="button" @click="keep">{{ t('tool.keep') }}</button>
      <button class="btn" type="button" @click="discard">{{ t('tool.discard') }}</button>
    </div>
    <fieldset :disabled="!ready" class="panel workspace">
      <div class="panel-top"><h2>{{ project.name }}</h2>
        <button class="btn primary" type="button" @click="run">{{ label('run') }}</button></div>
      <details>
        <summary>{{ label('projects') }}</summary>
        <div class="actions project-actions">
          <label>{{ label('projects') }}<select :value="project.id" @change="select(projects.find(p => p.id === ($event.target as HTMLSelectElement).value)!)">
            <option v-if="!projects.some(p => p.id === project.id)" :value="project.id">{{ project.name }}</option>
            <option v-for="item in projects" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select></label>
          <label>{{ label('template') }}<select v-model="template"><option v-for="(_, key) in templates" :key="key" :value="key">{{ label(key) }}</option></select></label>
          <button class="btn" type="button" @click="fresh()">{{ label('new') }}</button>
          <button class="btn" type="button" @click="fresh(true)">{{ t('app.duplicate') }}</button>
          <button class="btn" type="button" @click="rename">{{ t('app.rename') }}</button>
          <button class="btn" type="button" :disabled="shared" @click="deleteCurrent">{{ t('app.remove') }}</button>
          <label>{{ label('import') }} <input type="file" accept=".json" @change="imported" /></label>
        </div>
      </details>
      <div class="actions">
        <label v-if="!small">{{ label('layout') }}<select :value="project.layout" @change="edit({layout: ($event.target as HTMLSelectElement).value as Source['layout']})">
          <option v-for="option in layouts" :key="option" :value="option">{{ label(option) }}</option>
        </select></label>
        <button type="button" class="btn" @click="share">{{ t('tool.share') }}</button>
        <button type="button" class="btn" @click="exportFile(true)">{{ label('exportHtml') }}</button>
        <button type="button" class="btn" @click="exportFile(false)">{{ label('exportJson') }}</button>
      </div>
      <p v-if="large" class="notice" role="status">{{ label('large') }}</p>
      <div ref="area" class="play-area" :class="'play-' + layout" :style="{'--split':ratio+'%'}">
        <div class="editors">
          <div v-if="layout === 'tabs'" class="actions"><button v-for="lang in languages" :key="lang" type="button" class="btn" :aria-pressed="lang === active" @click="active = lang">{{ lang.toUpperCase() }}</button></div>
          <label v-for="lang in languages" v-show="layout !== 'tabs' || active === lang" :key="lang" class="editor">{{ lang.toUpperCase() }}
            <textarea spellcheck="false" maxlength="120000" :value="project[lang]" :wrap="store.data.editor.wordWrap ? 'soft' : 'off'" :style="{fontSize:store.data.editor.fontSize+'px',tabSize:store.data.editor.tabSize}" @input="edit({[lang]:($event.target as HTMLTextAreaElement).value})" />
          </label>
        </div>
        <div v-if="layout === 'side'" class="divider" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="label('split')" aria-valuemin="25" aria-valuemax="75" :aria-valuenow="ratio"
          @pointerdown="($event.currentTarget as HTMLElement).setPointerCapture($event.pointerId)" @pointermove="resize"
          @keydown.left.prevent="ratio = Math.max(25,ratio-5)" @keydown.right.prevent="ratio = Math.min(75,ratio+5)" />
        <section class="result"><h3>{{ t('tool.preview') }}</h3>
          <iframe ref="preview" :key="previewHtml ? nonce : 'empty'" sandbox="allow-scripts allow-modals allow-forms" :title="t('tool.preview')" :srcdoc="previewHtml" />
        </section>
      </div>
      <p v-if="result" class="notice" role="status">{{ result }}</p>
      <details open><summary>{{ label('console') }} · {{ logs.filter(l => l.level === 'error').length }} {{ label('errors') }} · {{ logs.filter(l => l.level === 'warn').length }} {{ label('warnings') }}</summary>
        <div class="actions project-actions"><label>{{ label('level') }}<select v-model="filter"><option value="">{{ t('app.all') }}</option><option v-for="level in levels.filter(l => l !== 'clear')" :key="level">{{ level }}</option></select></label>
          <input v-model="search" type="search" :placeholder="label('search')" :aria-label="label('search')" />
          <button class="btn" type="button" @click="logs = []">{{ label('clear') }}</button></div>
        <ol class="console-output"><li v-for="row in shown" :key="row.id"><strong>{{ row.level }}</strong> {{ row.text }}</li></ol>
        <span class="sr-only" aria-live="polite">{{ logs.filter(l => l.level === 'error').at(-1)?.text }}</span>
      </details>
    </fieldset>
  </div>
</template>
<style scoped>
.project-actions { margin: .6rem 0; }
.play-area, .editors, .editor, .result { display: grid; gap: .5rem; min-width: 0; }
.play-columns .editors { grid-template-columns: repeat(3, minmax(0,1fr)); }
.play-side { grid-template-columns: minmax(0,var(--split)) 12px minmax(0,1fr); gap: 0; }
.divider { cursor: ew-resize; touch-action: none; background: linear-gradient(to right, transparent 4px,var(--line) 4px 8px,transparent 8px); }
.editor { font-weight: 600; }
.editor textarea { width: 100%; min-height: 10rem; resize: vertical; background: var(--page); color: var(--text); border: 1px solid var(--line); padding: .7rem; border-radius: 8px; font: normal 14px/1.5 ui-monospace, monospace; }
.result { align-content: start; }
.result iframe { background: white; width: 100%; height: 20rem; border-radius: 8px; border: 1px solid var(--line); }
.console-output { max-height: 12rem; overflow: auto; font: .85rem/1.5 ui-monospace, monospace; overflow-wrap: anywhere; white-space: pre-wrap; }
</style>
