<script setup lang="ts" generic="S extends object">
import { Link2, Redo2, RotateCcw, Shuffle, Star, Undo2 } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '../../composables/useClipboard'
import { useToolState } from '../../composables/useToolState'
import { findTool } from '../../core/registry'
import { onExternalChange, remove, snapshot, write } from '../../core/storage/db'
import { projectToolState, type Preset, type ToolLogic } from '../../core/tool'
import { download } from '../../lib/download'
import { useNotificationsStore } from '../../stores/notifications'
import { useToolsStore } from '../../stores/tools'
import CodeOutputPanel from './CodeOutputPanel.vue'

const props = defineProps<{ logic: ToolLogic<S>; supported?: (state: S) => boolean; previewBackground?: boolean }>()
defineSlots<{
  controls(props: { state: S; update: (apply: (draft: S) => void, group?: string) => void }): unknown
  preview(props: { state: S; update: (apply: (draft: S) => void, group?: string) => void }): unknown
}>()
const { t } = useI18n()
const { state, ready, shared, canUndo, canRedo, update, replace, changeHistory, persist, discard, url } = useToolState(props.logic)
const tools = useToolsStore()
const notifications = useNotificationsStore()
const copy = useClipboard()
const id = props.logic.id
const tool = findTool(id)
const background = ref('default')
const customBackground = ref('#e6e9df')
const personal = shallowRef<Preset<S>[]>([])
const presets = ref<HTMLDialogElement>()
const output = ref<InstanceType<typeof CodeOutputPanel>>()
const name = ref('')
const renameId = ref('')
const outputs = computed(() => Object.fromEntries(Object.entries(props.logic.outputs).map(([key, format]) => [key, format(state.value)])))
const previewStyle = computed(() => background.value === 'custom' ? { background: customBackground.value } : undefined)

async function refreshPresets() {
  try {
    const entries = Object.entries((await snapshot()).userPresets)
    personal.value = entries.flatMap(([key, entry]) => {
      if (!key.startsWith(id + ':') || !entry.state || typeof entry.state !== 'object') return []
      const data = entry.state as { name?: unknown; state?: unknown }
      if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80) return []
      try {
        return [{ id: key.slice(id.length + 1), name: data.name, state: props.logic.migrate(data.state, entry.schemaVersion), builtin: false }]
      } catch { return [] }
    })
  } catch { notifications.push('tool.storageError') }
}
function openPresets() {
  name.value = ''
  renameId.value = ''
  presets.value?.showModal()
}
function selectPreset(item: Preset<S>) {
  replace(item.state)
  presets.value?.close()
}
async function savePreset() {
  const label = name.value.trim()
  if (!label || label.length > 80) return
  const editing = personal.value.find(item => item.id === renameId.value)
  try {
    await write('userPresets', id + ':' + (editing?.id ?? crypto.randomUUID()),
      { name: label, state: projectToolState(props.logic, editing?.state ?? state.value, 'store') }, props.logic.schemaVersion)
    name.value = ''
    renameId.value = ''
    await refreshPresets()
  } catch { /* Storage announces write failures. */ }
}
async function deletePreset(item: Preset<S>) {
  try {
    await remove('userPresets', id + ':' + item.id)
    if (renameId.value === item.id) {
      name.value = ''
      renameId.value = ''
    }
    await refreshPresets()
  } catch { /* Storage announces write failures. */ }
}
function reset() {
  if (confirm(t('tool.confirmReset'))) replace(props.logic.defaultState())
}
function random() {
  if (props.logic.random) replace(props.logic.random())
}
async function share() {
  try { await copy(url()) }
  catch { notifications.push('tool.shareError') }
}
function keyboard(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z') return
  if (event.target instanceof HTMLElement && event.target.closest('input:not([type=range]), textarea, [contenteditable=true]')) return
  event.preventDefault()
  changeHistory(!event.shiftKey)
}
function action(event: Event) {
  if (!(event instanceof CustomEvent)) return
  if (event.detail === 'reset') reset()
  if (event.detail === 'copy') void output.value?.copyCode()
  if (event.detail === 'share') void share()
}
const stop = onExternalChange(() => { void refreshPresets() })
onMounted(() => {
  void refreshPresets()
  window.addEventListener('frontkit:tool-action', action)
})
onUnmounted(() => {
  stop()
  window.removeEventListener('frontkit:tool-action', action)
})
</script>

<template>
  <div class="workspace" @keydown="keyboard">
    <div class="tool-heading">
      <div>
        <p class="kicker">{{ t('category.' + tool?.category) }}</p>
        <h1>{{ t('tools.' + id + '.name') }}</h1>
        <p>{{ t('tools.' + id + '.description') }}</p>
      </div>
      <button class="icon-btn" type="button" :aria-label="t('app.favorites')" :aria-pressed="tools.favorites.includes(id)" @click="tools.toggleFavorite(id)">
        <Star :size="21" :fill="tools.favorites.includes(id) ? 'currentColor' : 'none'" />
      </button>
    </div>
    <div v-if="shared" class="notice panel-top">
      <span>{{ t('tool.shareLoaded') }}</span>
      <div class="actions"><button class="btn" type="button" @click="persist">{{ t('tool.keep') }}</button><button class="btn" type="button" @click="discard">{{ t('tool.discard') }}</button></div>
    </div>
    <div class="tool-bar" :aria-label="t('tool.controls')">
      <button class="btn" type="button" :disabled="!ready" @click="openPresets">{{ t('tool.presets') }}</button>
      <button v-if="logic.random" class="btn" type="button" :disabled="!ready" @click="random"><Shuffle :size="16" />{{ t('tool.random') }}</button>
      <button class="icon-btn" type="button" :disabled="!canUndo" :aria-label="t('tool.undo')" @click="changeHistory(true)"><Undo2 :size="18" /></button>
      <button class="icon-btn" type="button" :disabled="!canRedo" :aria-label="t('tool.redo')" @click="changeHistory(false)"><Redo2 :size="18" /></button>
      <button class="icon-btn" type="button" :disabled="!ready" :aria-label="t('app.reset')" @click="reset"><RotateCcw :size="17" /></button>
      <button class="btn primary share-button" type="button" :disabled="!ready" @click="share"><Link2 :size="16" />{{ t('tool.share') }}</button>
    </div>
    <div class="workspace-grid">
      <section class="panel tool-controls">
        <h2>{{ t('tool.controls') }}</h2>
        <slot v-if="ready" name="controls" :state="state" :update="update" />
      </section>
      <div class="preview-column">
        <section class="panel preview-panel">
          <div class="panel-top">
            <h2>{{ t('tool.preview') }}</h2>
            <div v-if="previewBackground !== false" class="actions">
              <input v-if="background === 'custom'" v-model="customBackground" type="color" :aria-label="t('tool.background')" />
              <select v-model="background" :aria-label="t('tool.background')">
                <option value="default">{{ t('tool.background') }}</option>
                <option value="white">{{ t('tool.white') }}</option>
                <option value="black">{{ t('tool.black') }}</option>
                <option value="checker">{{ t('tool.checker') }}</option>
                <option value="custom">{{ t('tool.customBackground') }}</option>
              </select>
            </div>
          </div>
          <p v-if="supported && !supported(state)" class="notice" role="status">{{ t('tool.unsupported') }}</p>
          <div class="preview" :class="previewBackground === false ? 'preview-own-background' : 'preview-' + background" :style="previewStyle">
            <slot name="preview" :state="state" :update="update" />
          </div>
        </section>
        <CodeOutputPanel v-if="Object.keys(outputs).length" ref="output" :outputs="outputs" :name="id" />
      </div>
    </div>
  </div>

  <dialog ref="presets" class="dialog-card" :aria-label="t('tool.presets')">
    <div class="panel-top"><h2>{{ t('tool.presets') }}</h2><button class="btn" type="button" @click="presets?.close()">{{ t('app.close') }}</button></div>
    <ul class="preset-list">
      <li v-for="item in logic.presets" :key="item.id"><button class="btn" type="button" @click="selectPreset(item)">{{ t(item.nameKey ?? '') }}</button></li>
      <li v-for="item in personal" :key="item.id" class="actions">
        <button class="btn primary" type="button" @click="selectPreset(item)">{{ item.name }}</button>
        <button class="btn" type="button" @click="renameId = item.id; name = item.name ?? ''">{{ t('app.rename') }}</button>
        <button class="btn" type="button" @click="download(item.id + '.json', JSON.stringify(item, null, 2), 'application/json')">{{ t('tool.exportPreset') }}</button>
        <button class="btn danger" type="button" @click="deletePreset(item)">{{ t('app.remove') }}</button>
      </li>
    </ul>
    <form class="actions" @submit.prevent="savePreset">
      <input v-model="name" required maxlength="80" :aria-label="t('tool.presetName')" :placeholder="t('tool.presetName')" />
      <button class="btn primary" type="submit">{{ t(renameId ? 'app.rename' : 'tool.custom') }}</button>
    </form>
  </dialog>
</template>
