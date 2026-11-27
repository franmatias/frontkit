<script setup lang="ts">
import CodeEditor from './CodeEditor.vue'
import { ChevronDown, Columns2, LayoutGrid, Maximize2, Minimize2, PanelLeft, PanelRight, Rows2, PanelsTopLeft, Terminal, Upload, WandSparkles } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { decodeShare, encodeShare } from '../../composables/share'
import { useClipboard } from '../../composables/useClipboard'
import { useWorker } from '../../composables/useWorker'
import { onExternalChange, read, remove, snapshot, write } from '../../core/storage/db'
import { download } from '../../lib/download'
import { useSettingsStore } from '../../stores/settings'
import { useNotificationsStore } from '../../stores/notifications'
import { createProject, exportHtml, importProject, languages, layouts, logic, parseProject, sourceOnly, sourceLimit, templates, type Project, type Source } from './project'
import type { FormatJob, FormatResult } from './formatter-worker'
import { consoleScript, levels, previewDocument, type Level } from './preview'

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
const projectFile = ref<HTMLInputElement>()
const studio = ref<HTMLDivElement>()
const nativeFullscreen = ref(false)
const immersive = ref(false)
const fullscreen = computed(() => nativeFullscreen.value || immersive.value)
const formatNotice = ref('')
const formatter = useWorker<FormatJob, FormatResult>(() => new Worker(new URL('./formatter-worker.ts', import.meta.url), { type: 'module' }))
let formatRequest: { id: string; sources: FormatJob['sources'] } | undefined
const folded = ref({ html: false, css: false, js: false })
const layoutIcons = { quad: LayoutGrid, side: PanelRight, left: PanelLeft, columns: Rows2, bottom: PanelsTopLeft, tabs: Columns2 }
const consoleOpen = ref(true)
const consoleReady = ref(false)
const preserveLogs = ref(false)
const command = ref('')
const commandInput = ref<HTMLTextAreaElement>()
const queued = ref('')
function commandKey(event:KeyboardEvent) {
  if(event.isComposing)return
  if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();executeCommand();return}
  const field=commandInput.value
  if(field && command.value.includes('\n')){
    if(event.key==='ArrowUp' && command.value.slice(0,field.selectionStart).includes('\n'))return
    if(event.key==='ArrowDown' && command.value.slice(field.selectionEnd).includes('\n'))return
  }
  historyKey(event)
}
const history = ref<string[]>([])
let historyIndex = -1
let commandDraft = ''
const consoleExamples = ["document.title", "document.querySelector('h1')?.textContent", "console.log('Hola', 42)"]
function historyKey(event: KeyboardEvent) {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !history.value.length) return
  if (!['ArrowUp','ArrowDown'].includes(event.key)) return
  if (historyIndex < 0 && event.key === 'ArrowDown') return
  if (historyIndex < 0) commandDraft = command.value
  historyIndex = Math.max(-1, Math.min(history.value.length - 1, historyIndex + (event.key === 'ArrowUp' ? 1 : -1)))
  command.value = historyIndex < 0 ? commandDraft : history.value[historyIndex]!
  event.preventDefault()
}
function chooseCommand(example:string) {
  command.value=example
  historyIndex=-1
  commandInput.value?.focus()
}
const consoleOutput = ref<HTMLOListElement>()
const errors = computed(() => logs.value.filter(row => row.level === 'error'))
const warnings = computed(() => logs.value.filter(row => row.level === 'warn'))
const preview = ref<HTMLIFrameElement>()
const previewHtml = ref('')
const ready = ref(false)
const blocked = ref(false)
const shared = ref(false)
const large = ref(false)
const dirty = ref(false)
const ratio = ref(52)
const area = ref<HTMLElement>()
const editorRow = ref<HTMLElement>()
const editorWidths = ref([100 / 3, 100 / 3, 100 / 3])
const quadWidths = ref([50, 50])
const horizontalEditors = computed(() => layout.value === 'columns' || layout.value === 'bottom')
const panelWidths = computed(() => layout.value === 'quad' ? quadWidths.value : editorWidths.value)
const allFolded = computed(() => languages.every(lang => folded.value[lang]))
const splitPeers = computed(() => languages.map((lang, index) => {
  if (layout.value === 'quad') return index === 0 ? 1 : -1
  if (!horizontalEditors.value || folded.value[lang]) return -1
  return languages.findIndex((next, at) => at > index && !folded.value[next])
}))
const columns = computed(() => {
  if (layout.value === 'quad') return panelWidths.value.map(width => 'minmax(0,' + width + 'fr)').join(' 10px ')
  return languages.flatMap((lang, index) => {
    const size = allFolded.value ? 'minmax(0,1fr)' : folded.value[lang] ? '2.6rem' : 'minmax(0,' + editorWidths.value[index] + 'fr)'
    return index === languages.length - 1 ? [size] : [size, splitPeers.value[index] < 0 ? '4px' : '10px']
  }).join(' ')
})
let editorDrag: { origin: number; width: number; left: number; total: number } | undefined
const result = ref('')
const filter = ref('')
const search = ref('')
const logs = shallowRef<{level: Level | 'command'; text: string; id: number}[]>([])
const shown = computed(() => logs.value.filter(row => (!filter.value || row.level === filter.value) && row.text.toLowerCase().includes(search.value.toLowerCase())))
const small = ref(false)
const layout = computed(() => small.value ? 'tabs' : project.value.layout)
let seq = 0
let nonce = ''
let runVersion = 0
let disposed = false
let savedBeforeLink: Project | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let refreshingPreview = false
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
}
function formatCode(language?: typeof languages[number]) {
  if (!ready.value || formatter.busy.value) return
  formatNotice.value = ''
  const sources = Object.fromEntries((language ? [language] : languages).map(lang => [lang, project.value[lang]]))
  formatRequest = { id: project.value.id, sources }
  formatter.send({ sources, tabWidth: store.data.editor.tabSize, sourceLimit })
}
watch(() => project.value.id, () => {
  formatter.cancel()
  formatRequest = undefined
  formatNotice.value = ''
})
watch(formatter.failed, failed => {
  if (failed && formatRequest) {
    formatRequest = undefined
    formatNotice.value = label('formatFailed')
  }
})
watch(formatter.result, outcome => {
  if (!outcome) return
  const job = formatRequest
  formatRequest = undefined
  if (!job || job.id !== project.value.id) return
  const patch: Partial<Source> = {}
  for (const lang of languages) {
    const formatted = outcome.formatted[lang]
    if (formatted !== undefined && job.sources[lang] === project.value[lang] && formatted !== project.value[lang]) patch[lang] = formatted
  }
  const changed = Object.keys(patch).length > 0
  if (changed) edit(patch)
  const invalid = outcome.invalid.filter(lang => job.sources[lang] === project.value[lang])
  formatNotice.value = invalid.length
    ? t('detail.playground.formatInvalid', { languages: invalid.map(lang => lang.toUpperCase()).join(', ') })
    : label(changed ? 'formatDone' : 'formatUnchanged')
})

function syncFullscreen() {
  nativeFullscreen.value = document.fullscreenElement === studio.value
}
async function toggleFullscreen() {
  if (immersive.value) { immersive.value = false; return }
  if (nativeFullscreen.value) { await document.exitFullscreen().catch(() => {}); return }
  const target = studio.value
  if (!target) return
  if (document.fullscreenEnabled && target.requestFullscreen) {
    try { await target.requestFullscreen(); return }
    catch { /* A browser or an embedding frame may restrict native fullscreen. */ }
  }
  if (!disposed) immersive.value = true
}

function clearPreview() {
  queued.value = ''
  clearTimeout(runTimer)
  runVersion++
  consoleReady.value = false
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
  const revision = ++runVersion
  const token = crypto.randomUUID()
  const doc = previewDocument(sourceOnly(project.value), token, store.data.editor.loopProtection, label('loop'))
  try { await write('meta', flag, true) } catch { return }
  if (disposed || revision !== runVersion) return
  if (!preserveLogs.value) logs.value = []
  consoleReady.value = false
  refreshingPreview = false
  nonce = token
  result.value = doc.parsed ? '' : label('parse')
  previewHtml.value = doc.html
}
// Changing the layout or folding an editor must preserve the running preview.
watch([ready, blocked, shared, () => project.value.id, () => project.value.html, () => project.value.css, () => project.value.js], () => {
  clearTimeout(runTimer)
  runVersion++
  if (ready.value && !blocked.value && !shared.value) {
    refreshingPreview = true
    consoleReady.value = false
    runTimer = setTimeout(() => { runTimer=undefined;void run() }, store.data.editor.autoRunDelayMs)
  }
})
function receive(event: MessageEvent) {
  const msg = event.data
  if (!nonce || event.source !== preview.value?.contentWindow || !msg || msg.nonce !== nonce || typeof msg.text !== 'string') return
  if (msg.level === 'ready') {
    if (refreshingPreview) return
    consoleReady.value = true
    if(queued.value){const source=queued.value;queued.value='';dispatchCommand(source)}
    void remove('meta', flag).catch(() => {})
    return
  }
  if (!levels.includes(msg.level)) return
  if (msg.level === 'clear') { logs.value = []; return }
  appendLog(msg.level, msg.text)
}
function appendLog(level: Level | 'command', text: string) {
  logs.value = [...logs.value.slice(-999), { id: ++seq, level, text: text.slice(0, 4000) }]
  void nextTick(() => {
    if (consoleOutput.value) consoleOutput.value.scrollTop = consoleOutput.value.scrollHeight
  })
}
function executeCommand() {
  const source = command.value.trim()
  if (!source || queued.value || (!consoleReady.value && (blocked.value || shared.value))) return
  if(!consoleReady.value) queued.value=source
  else dispatchCommand(source)
  if (history.value[0] !== source) history.value = [source,...history.value].slice(0,50)
  historyIndex = -1
  command.value = ''
  void nextTick(()=>commandInput.value?.focus())
}
function dispatchCommand(source:string){
  const frame=preview.value?.contentWindow
  if(!frame)return
  appendLog('command',source)
  try {
    const script = consoleScript(source, nonce, store.data.editor.loopProtection)
    frame.postMessage({ nonce, command: script }, '*')
  } catch (error) {
    appendLog('error', error instanceof Error ? error.message : String(error))
  }
}
function splitEditors(index: number, left: number, total: number) {
  const peer = splitPeers.value[index]
  if (peer < 0) return
  const width = Math.min(total - 12, Math.max(12, left))
  panelWidths.value[index] = width
  panelWidths.value[peer] = total - width
}
function startEditorDrag(event: PointerEvent, index: number) {
  const target = event.currentTarget as HTMLElement
  const width = (layout.value === 'quad' ? area.value : editorRow.value)?.clientWidth
  if (event.button !== 0 || !width) return
  const left = panelWidths.value[index]
  const right = splitPeers.value[index]
  if (right < 0) return
  editorDrag = { origin: event.clientX, width, left, total: left + panelWidths.value[right] }
  target.setPointerCapture(event.pointerId)
}
function moveEditorDrag(event: PointerEvent, index: number) {
  const target = event.currentTarget as HTMLElement
  if (!editorDrag || !target.hasPointerCapture(event.pointerId)) return
  const { origin, width, left, total } = editorDrag
  splitEditors(index, left + (event.clientX - origin) * 100 / width, total)
}
function nudgeEditors(index: number, delta: number) {
  const left = panelWidths.value[index]
  const right = splitPeers.value[index]
  if (right >= 0) splitEditors(index, left + delta, left + panelWidths.value[right])
}
function resize(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (!target.hasPointerCapture(event.pointerId) || !area.value) return
  const box = area.value.getBoundingClientRect()
  const fromLeft = 100 * (event.clientX - box.left) / box.width
  ratio.value = Math.max(25, Math.min(75, Math.round(layout.value === 'left' ? 100 - fromLeft : fromLeft)))
}
function paletteAction(event: Event) {
  if (!(event instanceof CustomEvent) || !ready.value) return
  if (event.detail === 'share') void share()
  if (event.detail === 'copy') void copy(project.value[active.value])
  if (event.detail === 'reset' && confirm(t('tool.confirmReset'))) edit(logic.defaultState())
}
function shortcut(event: KeyboardEvent) {
  if (immersive.value && event.key === 'Escape' && !event.defaultPrevented) {
    immersive.value = false
    studio.value?.querySelector<HTMLElement>('.fullscreen-toggle')?.focus()
  }
  if (immersive.value && event.key === 'Tab' && !event.defaultPrevented && studio.value) {
    const focusable = Array.from(studio.value.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, [tabindex="0"]'))
      .filter(element => element.getClientRects().length && !element.matches(':disabled'))
    const first = focusable[0]
    const last = focusable.at(-1)
    const current = document.activeElement
    if (first && last && (!studio.value.contains(current) || (event.shiftKey ? current === first : current === last))) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
    }
  }
  if (!(event.ctrlKey || event.metaKey)) return
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
  document.addEventListener('fullscreenchange', syncFullscreen)
  media.addEventListener('change', setSmall)
  setSmall()
  await refresh()
  const last = await read('kv', 'playground-active')
  project.value = projects.value.find(item => item.id === last?.state) ?? projects.value[0] ?? project.value
  blocked.value = (await read('meta', flag))?.state === true
  if (disposed) return
  ready.value = true
  await loadLink(route.hash)
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
  document.removeEventListener('fullscreenchange', syncFullscreen)
})
</script>
<template>
  <div class="workspace">
    <h1>{{ t('tools.playground.name') }}</h1>

    <div v-if="blocked" class="notice actions">{{ label('guard') }} <button class="btn" type="button" @click="blocked = false">{{ label('resume') }}</button></div>
    <div v-if="shared" class="notice actions">{{ t('tool.shareLoaded') }}
      <button class="btn" type="button" @click="keep">{{ t('tool.keep') }}</button>
      <button class="btn" type="button" @click="discard">{{ t('tool.discard') }}</button>
    </div>
    <div ref="studio" :inert="!ready" class="studio" :class="{ 'is-immersive': immersive }" :data-code-theme="store.data.editor.syntaxTheme"
      :role="immersive ? 'dialog' : 'group'" :aria-modal="immersive || undefined" :aria-label="t('tools.playground.name')">
      <div class="studio-toolbar">
        <h2>{{ project.name }}</h2>
        <div class="actions">
          <button class="btn" type="button" :disabled="formatter.busy.value" @click="formatCode()"><WandSparkles :size="16" aria-hidden="true" />{{ label('formatAll') }}</button>
          <button class="btn fullscreen-toggle" type="button" :aria-pressed="fullscreen" @click="toggleFullscreen">
            <component :is="fullscreen ? Minimize2 : Maximize2" :size="16" aria-hidden="true" />{{ label(fullscreen ? 'exitFullscreen' : 'fullscreen') }}
          </button>
          <button class="btn" type="button" @click="share">{{ t('tool.share') }}</button>
          <button class="btn" type="button" @click="exportFile(true)">{{ label('exportHtml') }}</button>
          <button class="btn" type="button" @click="exportFile(false)">{{ label('exportJson') }}</button>
        </div>
      </div>
      <details class="projects-panel">
        <summary>{{ label('projects') }}</summary>
        <div class="project-grid">
          <div class="project-group">
            <label>{{ label('activeProject') }}
              <select :value="project.id" @change="select(projects.find(p => p.id === ($event.target as HTMLSelectElement).value)!)">
                <option v-if="!projects.some(p => p.id === project.id)" :value="project.id">{{ project.name }}</option>
                <option v-for="item in projects" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
            </label>
            <div class="project-buttons">
              <button class="btn" type="button" @click="fresh(true)">{{ t('app.duplicate') }}</button>
              <button class="btn" type="button" @click="rename">{{ t('app.rename') }}</button>
              <button class="btn" type="button" :disabled="shared" @click="deleteCurrent">{{ t('app.remove') }}</button>
            </div>
          </div>
          <div class="project-group">
            <label>{{ label('template') }}<select v-model="template"><option v-for="(_, key) in templates" :key="key" :value="key">{{ label(key) }}</option></select></label>
            <button class="btn" type="button" @click="fresh()">{{ label('new') }}</button>
          </div>
          <button class="btn" type="button" @click="projectFile?.click()"><Upload :size="16" aria-hidden="true" />{{ label('import') }}</button>
          <input ref="projectFile" type="file" accept=".json,application/json" hidden @change="imported" />
        </div>
      </details>
      <p v-if="formatter.busy.value || formatNotice" class="format-status" role="status">{{ formatter.busy.value ? label('formatting') : formatNotice }}</p>
      <p v-if="large" class="notice" role="status">{{ label('large') }}</p>
      <div v-if="!small" class="layout-picker" role="group" :aria-label="label('layout')">
        <strong>{{ label('layout') }}</strong>
        <button v-for="option in layouts" :key="option" class="btn" type="button" :aria-pressed="layout === option" @click="edit({layout:option})">
          <component :is="layoutIcons[option]" :size="16" />{{ label('layoutNames.' + option) }}
        </button>
      </div>
      <div v-if="layout === 'tabs'" class="actions language-tabs">
        <button v-for="lang in languages" :key="lang" class="btn" type="button" :aria-pressed="active === lang" @click="active = lang">{{ lang.toUpperCase() }}</button>
      </div>
      <div ref="area" class="play-area" :class="['play-' + layout, { 'active-folded':folded[active], 'first-folded':folded.html && folded.css, 'all-folded':allFolded }]" :style="{'--split':ratio+'%', '--editor-widths':columns}">
        <div ref="editorRow" class="editors">
          <template v-for="(lang, index) in languages" :key="lang">
          <section v-show="layout !== 'tabs' || active === lang" class="code-pane" :data-language="lang" :class="{'is-folded':folded[lang]}" @focusin="active = lang">
            <div class="pane-bar">
              <button type="button" class="pane-heading" :aria-expanded="!folded[lang]" :aria-controls="'source-'+lang"
                :aria-label="label(folded[lang] ? 'expand' : 'fold') + ' ' + lang.toUpperCase()" @click="folded[lang] = !folded[lang]">
                <span class="language-dot" :class="'dot-'+lang" /><span class="pane-label">{{ lang.toUpperCase() }}</span><ChevronDown :size="16" />
              </button>
              <button v-if="!folded[lang]" class="pane-format" type="button" :disabled="formatter.busy.value" :aria-label="t('detail.playground.formatPanel', { language: lang.toUpperCase() })" :title="t('detail.playground.formatPanel', { language: lang.toUpperCase() }) + ' (Mayús+Alt+F)'" @click="formatCode(lang)"><WandSparkles :size="15" aria-hidden="true" /></button>
            </div>
            <CodeEditor v-show="!folded[lang]" :id="'source-'+lang" :language="lang" :value="project[lang]" :wrap="store.data.editor.wordWrap" :font-size="store.data.editor.fontSize" :tab-size="store.data.editor.tabSize" :disabled="!ready" :line-numbers="store.data.editor.lineNumbers" :font-family="store.data.editor.fontFamily" @change="edit({[lang]:$event})" @format="formatCode(lang)" />
          </section>
          <div v-if="splitPeers[index] >= 0"
            class="divider editor-divider" role="separator" tabindex="0" aria-orientation="vertical"
            :aria-label="t('detail.playground.resizeEditors', { left: lang.toUpperCase(), right: languages[splitPeers[index]].toUpperCase() })"
            :aria-valuemin="12" :aria-valuemax="Math.round(panelWidths[index] + panelWidths[splitPeers[index]] - 12)" :aria-valuenow="Math.round(panelWidths[index])"
            @pointerdown="startEditorDrag($event, index)" @pointermove="moveEditorDrag($event, index)"
            @lostpointercapture="editorDrag = undefined" @keydown.left.prevent="nudgeEditors(index, -3)" @keydown.right.prevent="nudgeEditors(index, 3)" />
          <div v-else-if="horizontalEditors && index < 2" aria-hidden="true" />
          </template>
        </div>
        <div v-if="layout === 'side' || layout === 'left'" class="divider" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="label('split')" aria-valuemin="25" aria-valuemax="75" :aria-valuenow="ratio"
          @pointerdown="($event.currentTarget as HTMLElement).setPointerCapture($event.pointerId)" @pointermove="resize"
          @keydown.left.prevent="ratio = Math.max(25,Math.min(75,ratio+(layout === 'left' ? 5 : -5)))" @keydown.right.prevent="ratio = Math.max(25,Math.min(75,ratio+(layout === 'left' ? -5 : 5)))" />
        <section class="result"><h3>{{ t('tool.preview') }}</h3>
          <iframe ref="preview" :key="previewHtml ? nonce : 'empty'" sandbox="allow-scripts allow-modals allow-forms" :title="t('tool.preview')" :srcdoc="previewHtml" />
        </section>
      </div>
      <p v-if="result" class="notice" role="status">{{ result }}</p>
      <section class="console-pane"><button class="console-title" type="button" :aria-expanded="consoleOpen" aria-controls="play-console" @click="consoleOpen = !consoleOpen"><Terminal :size="17" />{{ label('console') }}<span class="console-state" :class="{connected:consoleReady}">{{ label(consoleReady ? 'consoleReady' : 'consoleWaiting') }}</span><small>{{ errors.length }} {{ label('errors') }} · {{ warnings.length }} {{ label('warnings') }}</small><ChevronDown :size="16" /></button>
        <div v-show="consoleOpen" id="play-console">
        <div class="actions console-tools"><label>{{ label('level') }}<select v-model="filter"><option value="">{{ t('app.all') }}</option><option v-for="level in levels.filter(l => l !== 'clear')" :key="level">{{ level }}</option></select></label>
          <input v-model="search" type="search" :placeholder="label('search')" :aria-label="label('search')" />
          <label class="check"><input type="checkbox" v-model="preserveLogs" />{{label('preserveLogs')}}</label>
          <button class="btn" type="button" @click="logs = []">{{ label('clear') }}</button></div>
        <p v-if="!shown.length" class="console-empty">{{ label(logs.length ? 'consoleNoMatch' : 'consoleEmpty') }}</p>
        <ol v-show="shown.length" ref="consoleOutput" class="console-output" :aria-label="label('consoleMessages')"><li v-for="row in shown" :key="row.id"><strong :class="'log-' + row.level">{{ row.level === 'command' ? '›' : row.level }}</strong> {{ row.text }}</li></ol>
        <form class="console-command" @submit.prevent="executeCommand">
          <span class="console-prompt" aria-hidden="true">›</span>
          <textarea ref="commandInput" v-model="command" rows="2" :disabled="!ready" aria-describedby="console-tip" @keydown="commandKey" @input="historyIndex = -1" :aria-label="label('command')" :placeholder="label('command')" autocomplete="off" spellcheck="false" maxlength="8000" />
          <button class="btn" type="submit" :disabled="!ready || (!consoleReady && (blocked || shared)) || !!queued || !command.trim()">{{ label('executeCommand') }}</button>
        </form>
        <p v-if="queued" role="status" class="console-tip">{{label('queued')}}</p>
        <p id="console-tip" class="console-tip">{{ label('consoleTip') }}</p>
        <div class="actions console-examples"><small>{{label('examplesLabel')}}</small><button v-for="example in consoleExamples" :key="example" type="button" class="btn pill" @click="chooseCommand(example)"><code>{{example}}</code></button></div>
        <span class="sr-only" aria-live="polite">{{ errors.at(-1)?.text }}</span>
        </div>
      </section>
    </div>
  </div>
</template>
<style scoped>
.studio { min-width:0;display:grid;gap:.7rem;border:0;padding:0;margin:0; }
.studio-toolbar,.layout-picker,.pane-heading,.console-title { display:flex;align-items:center;gap:.55rem; }
.studio-toolbar { justify-content:space-between;flex-wrap:wrap; }
.project-actions { margin:.5rem 0; }
.projects-panel { container-type:inline-size;border:1px solid var(--line);border-radius:.65rem;background:var(--surface);padding:.6rem .75rem; }
.projects-panel summary { cursor:pointer;font-weight:650; }
.project-grid,.project-group,.project-buttons { display:flex;align-items:flex-end;flex-wrap:wrap;gap:.55rem; }
.project-grid { margin-top:.65rem;column-gap:1rem; }
.project-grid label { flex:1 1 10rem;min-width:0; }
.project-group { flex:0 1 auto;max-width:100%; }
.project-grid .btn,.project-grid select { min-height:2.45rem; }
.project-grid select { max-width:100%; }
@container (min-width: 60rem) {
  .project-grid { display:grid;grid-template-columns:minmax(9rem,1fr) max-content minmax(10rem,1fr) max-content max-content;gap:.7rem; }
  .project-group { display:contents; }
  .project-buttons { flex-wrap:nowrap; }
}
@container (max-width: 31rem) {
  .project-group { width:100%; }
  .project-grid label { flex-basis:100%; }
}
.format-status { margin:0;font-size:.85rem;color:var(--muted); }
.layout-picker { flex-wrap:wrap; }
.layout-picker strong { margin-right:.3rem;font-size:.85rem; }
.layout-picker .btn[aria-pressed=true],.language-tabs .btn[aria-pressed=true] { background:var(--accent);color:var(--accent-ink); }
.play-area { display:grid;gap:4px;padding:4px;overflow:hidden;min-width:0;height:clamp(420px,59vh,800px);background:#34463b;border-radius:12px; }
.editors,.code-pane,.result { min-width:0;min-height:0; }
.editors { display:flex;gap:4px; }
.code-pane,.result { display:flex;flex-direction:column;overflow:hidden; }
.code-pane { flex:1;background:var(--code-background);color:var(--code-foreground); }
.pane-bar { flex:none;display:flex;min-height:35px;background:var(--code-gutter);color:var(--code-foreground);border-block-end:1px solid var(--code-line); }
.pane-format { flex:none;width:2.2rem;display:grid;place-items:center;color:inherit; }
.pane-format:hover:not(:disabled) { background:var(--code-selection); }
.pane-bar button:focus-visible { outline:2px solid var(--code-focus);outline-offset:-2px; }
.pane-heading,.result h3,.console-title { flex:none;min-height:35px;padding:.42rem .72rem;font-size:.79rem;font-weight:700; }
.pane-heading { flex:1;min-width:0;text-align:left;background:transparent;color:inherit; }
.pane-heading svg,.console-title svg:last-child { margin-left:auto; }
.pane-heading[aria-expanded=false] svg,.console-title[aria-expanded=false] svg:last-child { transform:rotate(-90deg); }
.language-dot { width:8px;height:8px;border-radius:2px; }
.dot-html { background:#f7aa82; }.dot-css { background:#91baff; }.dot-js { background:#eed76b; }
.result { background:white; }.result h3 { background:#e1eee2;color:#244a35; }
.result iframe { flex:1;min-height:0;width:100%;border:0;background:white; }
.play-quad { grid-template-columns:var(--editor-widths);grid-template-rows:1fr 1fr;column-gap:0; }
.play-quad [data-language=html] { grid-area:1 / 1; }
.play-quad [data-language=css] { grid-area:1 / 3; }
.play-quad [data-language=js] { grid-area:2 / 1; }
.play-quad .editor-divider { grid-area:1 / 2 / 3; }
.play-quad .result { grid-area:2 / 3; }
.play-quad.first-folded { grid-template-rows:auto 1fr; }
.play-quad .editors { display:contents; }
.play-quad .code-pane.is-folded { align-self:start;width:100%; }
.play-side,.play-left { grid-template-columns:minmax(0,var(--split)) 12px minmax(0,1fr);gap:0; }
.play-left { grid-template-columns:minmax(0,1fr) 12px minmax(0,var(--split)); }
.play-left .result { order:-2; }.play-left .divider { order:-1; }
.play-side .editors,.play-left .editors { flex-direction:column; }
.play-side .is-folded,.play-left .is-folded { flex:0 0 auto; }
.divider { cursor:ew-resize;touch-action:none;background:linear-gradient(to right,transparent 4px,#96a99a 4px 7px,transparent 7px); }
.play-columns,.play-bottom,.play-tabs { grid-template-rows:1fr 1fr; }
.play-columns.all-folded { grid-template-rows:auto 1fr; }.play-bottom.all-folded { grid-template-rows:1fr auto; }
.play-bottom .result { order:-1; }
.play-columns .editors,.play-bottom .editors { display:grid;grid-template-columns:var(--editor-widths);gap:0; }
.play-area:not(.all-folded):is(.play-columns,.play-bottom) .is-folded .pane-bar { flex:1; }
.play-area:not(.all-folded):is(.play-columns,.play-bottom) .is-folded .pane-heading {
  flex-direction:column;justify-content:center;padding:.45rem .2rem;gap:.65rem;
}
.play-area:not(.all-folded):is(.play-columns,.play-bottom) .is-folded .pane-label { writing-mode:vertical-rl;transform:rotate(180deg); }
.play-area:not(.all-folded):is(.play-columns,.play-bottom) .is-folded .pane-heading svg { margin:0;transform:rotate(-90deg); }
.editor-divider:focus-visible { outline:2px solid #dbe7e1;outline-offset:-2px; }
.play-tabs.active-folded { grid-template-rows:auto 1fr; }
.console-pane { min-width:0;border:1px solid var(--line);border-radius:10px;padding:.25rem .65rem;background:var(--surface); }
.console-title { width:100%;padding-inline:0; }
.console-title { flex-wrap:wrap; }
.console-title small,.console-tip { font-weight:400;color:var(--muted);font-size:.74rem; }
.console-state { background:var(--sidebar);color:var(--muted);padding:.14rem .38rem;border-radius:.38rem;font-size:.7rem; }
.console-state.connected { color:var(--accent);background:var(--accent-soft); }
.console-tools { padding:.45rem 0; }
.console-empty { background:var(--sidebar);padding:.75rem;border-radius:.55rem;color:var(--muted);font-size:.82rem; }
.console-examples { margin:.4rem 0 .55rem; }
.console-examples button { max-width:100%;overflow-wrap:anywhere;text-align:left; }
.console-prompt { color:var(--accent);font:700 1.4rem/1.7 monospace; }
.console-output { min-height:2rem;max-height:12rem;overflow:auto;font:.85rem/1.55 ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap; }
.console-command { display:flex;gap:.5rem;padding:.5rem 0; }
.console-command { align-items:center;border:1px solid var(--line);border-radius:.6rem;background:var(--surface);padding:.35rem .55rem; }
.console-command:focus-within { outline:2px solid var(--accent);outline-offset:1px; }
.console-command textarea { flex:1;min-width:0;resize:vertical;min-height:2.4rem;font:.9rem/1.5 ui-monospace,monospace;border:0;background:transparent;color:inherit;padding:.2rem; }
.console-command textarea:focus { outline:none; }
.console-pane { overflow:hidden;padding:0;background:var(--sidebar); }
.console-title { padding:.65rem .8rem;border-bottom:1px solid var(--line);background:var(--surface); }
#play-console { padding:.45rem .75rem .65rem;display:grid;gap:.4rem; }
.console-output,.console-empty { margin:0;min-height:5rem;background:var(--surface);border-radius:.45rem;border:1px solid var(--line);padding:.45rem .65rem; }
.console-output { list-style:none; }.console-output strong { display:inline-block;min-width:3rem; }
.console-examples small { color:var(--muted); }.console-tip { margin:0; }
.console-tools input[type=search] { flex:1;min-width:8rem; }.console-tools { flex-wrap:wrap; }
.console-output li { border-bottom:1px solid var(--line);padding:.22rem .4rem; }
.console-output strong { color:var(--accent); }.console-output .log-error { color:var(--danger); }
:is(.studio:fullscreen,.studio.is-immersive) { display:flex;flex-direction:column;overflow:auto;overscroll-behavior:contain;background:var(--page);color:var(--text);width:100%;height:100%;padding:clamp(.6rem,2vw,1.5rem);box-sizing:border-box; }
.studio.is-immersive { position:fixed;inset:0;z-index:1000;height:100dvh; }
:is(.studio:fullscreen,.studio.is-immersive) .studio-toolbar { position:sticky;top:0;z-index:4;background:var(--page);padding:.25rem 0; }
:is(.studio:fullscreen,.studio.is-immersive) .play-area { flex:1 0 370px;height:auto;min-height:370px; }
@media(max-width:700px){.play-area{height:60dvh;min-height:370px}.studio-toolbar .actions{gap:.25rem}}
</style>
