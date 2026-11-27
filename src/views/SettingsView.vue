<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next'
import { onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { countEntries, createBackup, parseBackup } from '../core/storage/backup'
import { clearToolStates, resetStorage, restore, type Snapshot } from '../core/storage/db'
import { download } from '../lib/download'
import { useNotificationsStore } from '../stores/notifications'
import { accents, editorFonts, syntaxThemes, useSettingsStore } from '../stores/settings'
import { useToolsStore } from '../stores/tools'

const { t, n } = useI18n()
const store = useSettingsStore()
const tools = useToolsStore()
const notifications = useNotificationsStore()
const candidate = shallowRef<Snapshot>()
const storage = ref<StorageEstimate>()
const modes = { light: Sun, dark: Moon, system: Monitor }
const accentColors = { forest: '#146548', ocean: '#125886', iris: '#6940a0', coral: '#a03943' }
const editorFlags = ['lineNumbers', 'wordWrap', 'minimap', 'loopProtection'] as const
const prefsFlags = ['rememberInput', 'rememberHtmlCleaner', 'autoCopyOnClick', 'showTailwindByDefault'] as const
const editorNumbers = [
  { id: 'fontSize', min: 10, max: 32, step: 1 },
  { id: 'tabSize', min: 1, max: 8, step: 1 },
  { id: 'autoRunDelayMs', min: 100, max: 5000, step: 50 },
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
    <section class="panel appearance-panel">
      <h2>{{ t('settings.appearance') }}</h2>
      <fieldset class="appearance-field">
        <legend>{{ t('app.theme') }}</legend>
        <div class="appearance-modes">
          <label v-for="(icon, theme) in modes" :key="theme" class="appearance-card">
            <input v-model="store.data.theme" class="sr-only" type="radio" name="appearance-theme" :value="theme" @change="store.save()" />
            <span class="appearance-mini" :class="'mini-' + theme" aria-hidden="true"><i /><i /><i /><i /></span>
            <span class="appearance-caption"><component :is="icon" :size="16" aria-hidden="true" />{{ t('settings.' + theme) }}</span>
          </label>
        </div>
      </fieldset>
      <div class="appearance-options">
        <fieldset class="appearance-field">
          <legend>{{ t('settings.accent') }}</legend>
          <div class="appearance-accents">
            <label v-for="accent in accents" :key="accent" class="accent-option">
              <input v-model="store.data.appearance.accent" class="sr-only" type="radio" name="appearance-accent" :value="accent" @change="store.save()" />
              <span class="accent-dot" :style="{ background: accentColors[accent] }" aria-hidden="true" />
              {{ t('settings.accents.' + accent) }}
            </label>
          </div>
        </fieldset>
        <label>{{ t('settings.density') }}
          <select v-model="store.data.appearance.density" @change="store.save()">
            <option value="comfortable">{{ t('settings.comfortable') }}</option>
            <option value="compact">{{ t('settings.compact') }}</option>
          </select>
        </label>
        <label class="check"><input v-model="store.data.appearance.reducedMotion" type="checkbox" @change="store.save()" />{{ t('settings.reducedMotion') }}</label>
      </div>
    </section>
    <section class="panel field-grid">
      <h2>{{ t('settings.editor') }}</h2>
      <label>{{ t('settings.syntaxTheme') }}
        <select v-model="store.data.editor.syntaxTheme" @change="store.save()">
          <option v-for="theme in syntaxThemes" :key="theme" :value="theme">{{ t('settings.syntaxThemes.' + theme) }}</option>
        </select>
      </label>
      <pre class="code-theme-sample" :data-code-theme="store.data.editor.syntaxTheme"><code><span class="hljs-keyword">const</span> mensaje = <span class="hljs-string">'Hola'</span>
<span class="hljs-title">console.log</span>(mensaje, <span class="hljs-number">42</span>)</code></pre>
      <label>{{ t('settings.fontFamily') }}
        <select v-model="store.data.editor.fontFamily" @change="store.save()">
          <option v-for="font in editorFonts" :key="font" :value="font">{{ t('settings.editorFonts.' + font) }}</option>
        </select>
      </label>
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
        <input v-model="store.data.preferences[field]" type="checkbox" :disabled="field === 'rememberHtmlCleaner' && !store.data.preferences.rememberInput" @change="store.save()" />{{ t('settings.' + field) }}
      </label>
    </section>
    <section class="panel field-grid">
      <h2>Privacidad</h2>
      <label class="check"><input type="checkbox" :checked="store.googleFonts" @change="store.setGoogleFonts(($event.target as HTMLInputElement).checked)" /> Permitir Google Fonts en las vistas previas</label>
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

<style scoped>
.appearance-panel { grid-column:1 / -1;display:grid;gap:1rem; }
.appearance-field { border:0;padding:0;min-width:0; }
.appearance-field legend { margin-bottom:.4rem;font-size:.84rem;font-weight:650; }
.appearance-modes { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem; }
.appearance-card { cursor:pointer;display:grid;gap:.45rem;min-width:0;padding:.4rem;border:1px solid var(--line);border-radius:.7rem; }
.appearance-card:has(:checked), .accent-option:has(:checked) { border-color:var(--accent);background:var(--accent-soft); }
.appearance-card:has(:focus-visible), .accent-option:has(:focus-visible) { outline:2px solid var(--focus);outline-offset:2px; }
.appearance-mini { display:grid;position:relative;grid-template-columns:22% 1fr 1fr;grid-template-rows:.33fr 1fr;gap:5%;min-height:3.2rem;
  aspect-ratio:3/1;padding:5%;border:1px solid var(--line);border-radius:.45rem;background:#edf0ed;overflow:hidden; }
.appearance-mini i { background:#fff;border-radius:.2rem; }
.appearance-mini i:first-child { grid-row:span 2;background:#d6e1d5; }
.appearance-mini i:nth-child(2) { grid-column:span 2;background:#c9d9cc; }
.appearance-mini i:last-child { border-block-start:solid .35rem var(--accent); }
.mini-dark { background:#26323b; }.mini-dark i { background:#364650; }.mini-dark i:first-child,.mini-dark i:nth-child(2) { background:#43565d; }
.mini-system { background:linear-gradient(105deg,#edf0ed 49%,#26323b 50%); }.mini-system i:last-child { background:#364650; }
.appearance-caption { min-width:0;display:flex;align-items:center;gap:.35rem;padding:.18rem;font-size:.84rem;font-weight:650;overflow-wrap:anywhere; }
.appearance-caption svg { flex:none; }
.appearance-options { display:flex;align-items:flex-end;flex-wrap:wrap;gap:.65rem 1.15rem; }
.appearance-accents { display:flex;flex-wrap:wrap;gap:.38rem; }
.accent-option { display:inline-flex;align-items:center;gap:.35rem;min-height:37px;padding:.35rem .48rem;border:1px solid var(--line);border-radius:.5rem;font-size:.8rem;cursor:pointer; }
.accent-dot { width:.85rem;aspect-ratio:1;border:1px solid #ffffffa0;border-radius:50%; }
.code-theme-sample { grid-column:1 / -1; }
@media (max-width:430px) {
  .appearance-caption { font-size:.72rem;gap:.2rem; }
  .appearance-caption svg { width:13px; }
  .appearance-modes { gap:.35rem; }
}
</style>
