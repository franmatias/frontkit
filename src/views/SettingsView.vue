<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { countEntries, createBackup, parseBackup } from '../core/storage/backup'
import { clearToolStates, resetStorage, restore, type Snapshot } from '../core/storage/db'
import { download } from '../lib/download'
import { useNotificationsStore } from '../stores/notifications'
import { useSettingsStore } from '../stores/settings'
import { useToolsStore } from '../stores/tools'

const { t, n } = useI18n()
const store = useSettingsStore()
const tools = useToolsStore()
const notifications = useNotificationsStore()
const candidate = shallowRef<Snapshot>()
const storage = ref<StorageEstimate>()
const editorFlags = ['wordWrap', 'minimap', 'loopProtection'] as const
const prefsFlags = ['rememberInput', 'autoCopyOnClick', 'showTailwindByDefault'] as const
const editorNumbers = [
  { id: 'fontSize', min: 10, max: 32, step: 1 },
  { id: 'tabSize', min: 1, max: 8, step: 1 },
  { id: 'autoRunDelayMs', min: 100, max: 5000, step: 100 },
] as const
const change = (event: Event) => {
  if ((event.target as HTMLInputElement).checkValidity()) store.save()
}
async function estimate() {
  storage.value = await navigator.storage?.estimate?.().catch(() => undefined)
}
onMounted(estimate)
async function exportBackup() {
  try {
    const backup = await createBackup()
    download('frontkit-backup-' + backup.exportedAt.slice(0, 10) + '.json', JSON.stringify(backup, null, 2), 'application/json')
  } catch { notifications.push('tool.storageError') }
}
async function selectBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  candidate.value = undefined
  if (!file) return
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('File too large')
    candidate.value = parseBackup(await file.text())
  } catch { notifications.push('settings.invalid') }
}
async function apply(operation: () => Promise<void>) {
  try {
    await operation()
    await Promise.all([store.hydrate(), tools.hydrate(), estimate()])
    candidate.value = undefined
    notifications.push('settings.done')
  } catch { notifications.push('tool.storageError') }
}
function importBackup(replace: boolean) {
  const backup = candidate.value
  if (backup) void apply(() => restore(backup, replace))
}
function clear(factory: boolean) {
  if (confirm(t(factory ? 'settings.confirmFactory' : 'settings.confirmClear'))) {
    void apply(factory ? resetStorage : clearToolStates)
  }
}
</script>

<template>
  <div class="settings-grid">
    <h1>{{ t('app.settings') }}</h1>
    <section class="panel field-grid">
      <h2>{{ t('settings.appearance') }}</h2>
      <label>{{ t('app.theme') }}
        <select v-model="store.data.theme" @change="store.save()">
          <option v-for="theme in ['light', 'dark', 'system']" :key="theme" :value="theme">{{ t('settings.' + theme) }}</option>
        </select>
      </label>
      <label>{{ t('settings.language') }}<select disabled><option>{{ t('settings.spanish') }}</option></select></label>
    </section>
    <section class="panel field-grid">
      <h2>{{ t('settings.editor') }}</h2>
      <label v-for="field in editorNumbers" :key="field.id">{{ t('settings.' + field.id) }}
        <input v-model.number="store.data.editor[field.id]" type="number" :min="field.min" :max="field.max" :step="field.step" required @change="change" />
      </label>
      <label v-for="field in editorFlags" :key="field" class="check">
        <input v-model="store.data.editor[field]" type="checkbox" @change="store.save()" />{{ t('settings.' + field) }}
      </label>
    </section>
    <section class="panel field-grid">
      <h2>{{ t('settings.preferences') }}</h2>
      <label>{{ t('settings.defaultColorFormat') }}<select v-model="store.data.preferences.defaultColorFormat" @change="store.save()"><option v-for="value in ['hex', 'rgb', 'hsl', 'oklch']" :key="value">{{ value }}</option></select></label>
      <label>{{ t('settings.defaultUnit') }}<select v-model="store.data.preferences.defaultUnit" @change="store.save()"><option v-for="value in ['px', '%', 'rem']" :key="value">{{ value }}</option></select></label>
      <label>{{ t('settings.colorContrastMethod') }}<select v-model="store.data.preferences.colorContrastMethod" @change="store.save()"><option v-for="value in ['wcag', 'apca']" :key="value" :value="value">{{ value.toUpperCase() }}</option></select></label>
      <label v-for="field in prefsFlags" :key="field" class="check">
        <input v-model="store.data.preferences[field]" type="checkbox" @change="store.save()" />{{ t('settings.' + field) }}
      </label>
    </section>
    <section class="panel storage-panel">
      <h2>{{ t('settings.storage') }}</h2>
      <p>{{ t('settings.storageHelp') }}</p>
      <div v-if="storage?.quota" class="usage">
        <label for="storage-usage">{{ t('settings.estimate') }} · {{ n((storage.usage ?? 0) / 1024) }} KiB</label>
        <progress id="storage-usage" :value="storage.usage ?? 0" :max="storage.quota" />
      </div>
      <div class="actions">
        <button class="btn" type="button" @click="exportBackup">{{ t('settings.export') }}</button>
        <label class="upload">{{ t('settings.import') }} <input type="file" accept=".json,application/json" @change="selectBackup" /></label>
      </div>
      <div v-if="candidate" class="notice">
        <p>{{ t('settings.records') }} · {{ countEntries(candidate) }}</p>
        <div class="actions">
          <button type="button" class="btn primary" @click="importBackup(false)">{{ t('settings.merge') }}</button>
          <button type="button" class="btn" @click="importBackup(true)">{{ t('settings.replace') }}</button>
          <button type="button" class="btn" @click="candidate = undefined">{{ t('app.cancel') }}</button>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="btn" @click="clear(false)">{{ t('settings.clear') }}</button>
        <button type="button" class="btn danger" @click="clear(true)">{{ t('settings.factory') }}</button>
      </div>
    </section>
  </div>
</template>
