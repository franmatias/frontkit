<script setup lang="ts">
import { ArrowUpRight, Search } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { findTool, tools } from '../../core/registry'
import { createBackup } from '../../core/storage/backup'
import { download } from '../../lib/download'
import { useSettingsStore } from '../../stores/settings'
import { normalize, useToolsStore } from '../../stores/tools'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const settings = useSettingsStore()
const store = useToolsStore()
const dialog = ref<HTMLDialogElement>()
const input = ref<HTMLInputElement>()
const query = ref('')
const active = ref(0)
let previous: HTMLElement | null = null

type Option = { id: string; label: string; group: string; run: () => void }
const results = computed<Option[]>(() => {
  const q = normalize(query.value)
  const options = tools.map(tool => ({
    id: tool.id, label: t('tools.' + tool.id + '.name'), group: 'app.tools',
    run: () => { void router.push({ name: tool.id }) },
  }))
  const recent = q ? [] : store.recentTools.flatMap(id => {
    const original = options.find(item => item.id === id)
    return original ? [{ ...original, id: 'recent-' + id, group: 'app.recent' }] : []
  })
  const actions = [
    { id: 'theme', label: t('app.changeTheme'), run: settings.cycleTheme },
    { id: 'settings', label: t('app.openSettings'), run: () => { void router.push('/settings') } },
    { id: 'backup', label: t('settings.export'), run: async () => {
      const backup = await createBackup()
      download('frontkit-backup-' + backup.exportedAt.slice(0, 10) + '.json', JSON.stringify(backup, null, 2), 'application/json')
    } },
  ]
  const tool = findTool(route.meta.toolId)
  if (tool && tool.status !== 'coming-soon') {
    for (const [id, key] of [['reset', 'app.reset'], ['copy', 'tool.copy'], ['share', 'tool.share']]) {
      actions.push({ id, label: t(key), run: () => { window.dispatchEvent(new CustomEvent('frontkit:tool-action', { detail: id })) } })
    }
  }
  const groupedActions = actions.map(item => ({ ...item, group: 'app.actions' }))
  return [...recent, ...options, ...groupedActions].filter(item => normalize(item.label + ' ' + item.id).includes(q))
})

watch(query, () => { active.value = 0 })
watch(active, index => {
  const option = results.value[index]
  if (option) document.getElementById('command-' + option.id)?.scrollIntoView({ block: 'nearest' })
})
async function show() {
  if (dialog.value?.open) return
  previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  query.value = ''
  active.value = 0
  dialog.value?.showModal()
  await nextTick()
  input.value?.focus()
}
function choose(option: Option | undefined) {
  if (!option) return
  dialog.value?.close()
  option.run()
}
function restoreFocus() {
  previous?.focus()
}
function navigate(event: KeyboardEvent) {
  const length = results.value.length
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
  event.preventDefault()
  if (!length) return
  if (event.key === 'Enter') choose(results.value[active.value])
  else active.value = (active.value + (event.key === 'ArrowDown' ? 1 : length - 1)) % length
}
function hotkey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    void show()
  }
}
onMounted(() => window.addEventListener('keydown', hotkey))
onUnmounted(() => window.removeEventListener('keydown', hotkey))
defineExpose({ show })
</script>

<template>
  <dialog ref="dialog" class="command" :aria-label="t('app.command')" @close="restoreFocus">
    <div class="command-search">
      <Search :size="20" />
      <input ref="input" v-model="query" role="combobox" aria-autocomplete="list" aria-expanded="true"
        aria-controls="command-results" :aria-activedescendant="results[active] ? 'command-' + results[active].id : undefined"
        :aria-label="t('app.command')" :placeholder="t('app.command')" @keydown="navigate" />
      <button type="button" class="btn" @click="dialog?.close()">{{ t('app.close') }}</button>
    </div>
    <ul id="command-results" role="listbox" :aria-label="t('app.tools')">
      <li v-for="(option, index) in results" :id="'command-' + option.id" :key="option.id" role="option"
        :aria-selected="index === active" @click="choose(option)">
        <span>{{ option.label }} <small>{{ t(option.group) }}</small></span><ArrowUpRight :size="16" />
      </li>
    </ul>
    <p v-if="!results.length" class="empty">{{ t('app.empty') }}</p>
  </dialog>
</template>
