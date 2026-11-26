<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeOutputPanel from '../../components/shared/CodeOutputPanel.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { encodeShare } from '../../composables/share'
import { useLocalFont } from '../../composables/useLocalFont'
import { useClipboard } from '../../composables/useClipboard'
import { useToolState } from '../../composables/useToolState'
import { read, remove, writeRememberedInput } from '../../core/storage/db'
import { measureLines, textMetrics } from '../../lib/text/readability'
import { useNotificationsStore } from '../../stores/notifications'
import { useSettingsStore } from '../../stores/settings'
import { fonts, logic, minimums, options, style, type State } from './logic'

const { t } = useI18n()
const label = (key: string) => t('detail.readability.' + key)
const { state, ready, update, shared, persist, discard } = useToolState(logic)
const settings = useSettingsStore()
const notices = useNotificationsStore()
const copy = useClipboard()
const initial = 'El diseño de una página también depende del espacio entre sus letras, palabras y párrafos. Cambia el ancho de esta muestra para observar cómo se reorganiza el texto.\n\nUna línea muy larga puede complicar el salto de la mirada a la siguiente. Los caracteres por línea se miden sobre el texto tal como lo dibuja tu navegador.'
const text = ref(initial)
const pane = ref<HTMLElement>()
const dimensions = ref<ReturnType<typeof measureLines>>()
const { fontName, fontError, localFont, clearLocal } = useLocalFont('FrontKitReadability')
const simulate = ref(false)
const include = ref(false)
const bytes = new TextEncoder()
const paragraphs = computed(() => text.value.slice(0, 12000).split(/\n\s*\n/))
const metrics = computed(() => textMetrics(text.value))
const display = computed(() => ({
  ...style(state.value, simulate.value),
  ...(fontName.value ? { fontFamily: 'FrontKitReadability, ' + fonts[state.value.font] } : {}),
}))
const flags = Object.keys(minimums) as (keyof typeof minimums)[]
const outputs = computed(() => ({ css: logic.outputs.css(state.value), tailwind: logic.outputs.tailwind(state.value) }))
const value = (event: Event) => (event.target as HTMLInputElement).value
let resize: ResizeObserver | undefined
let measureTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let previous = initial
let touched = false
function measureSoon() {
  clearTimeout(measureTimer)
  measureTimer = setTimeout(() => { dimensions.value = pane.value && measureLines(pane.value) }, 70)
}
function save() {
  clearTimeout(saveTimer)
  if (!touched || !settings.data.preferences.rememberInput || shared.value) return
  if (bytes.encode(text.value).length <= 100 * 1024) void writeRememberedInput('readability:text', text.value).catch(() => {})
  else void remove('kv', 'readability:text').catch(() => {})
}
function changeText(event: Event) {
  const input = event.target as HTMLTextAreaElement
  if (bytes.encode(input.value).length > 100 * 1024) {
    input.value = text.value
    notices.push('detail.readability.textSize')
    return
  }
  text.value = input.value
  touched = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 300)
}
onMounted(async () => {
  resize = new ResizeObserver(measureSoon)
  if (pane.value) resize.observe(pane.value)
  measureSoon()
  if (!settings.data.preferences.rememberInput) return
  const saved = (await read('kv', 'readability:text').catch(() => undefined))?.state
  if (typeof saved === 'string' && bytes.encode(saved).length <= 100 * 1024 && !touched) {
    if (shared.value) previous = saved
    else text.value = saved
  }
})
onUnmounted(() => {
  resize?.disconnect()
  clearTimeout(measureTimer)
  clearTimeout(saveTimer)
  if (touched && !shared.value) save()
})
watch([text, display], () => { void nextTick(measureSoon) }, { flush: 'post' })
watch(shared, (active, wasActive) => {
  if (active && !wasActive) {
    previous = text.value
    text.value = state.value.sharedText ?? text.value
  }
})
function reject() {
  discard()
  text.value = previous
  touched = false
}
function keep() {
  persist()
  touched = true
  if (!shared.value) save()
}
async function share() {
  try {
    const locationUrl = new URL(location.href)
    const valid = include.value && text.value.length <= 1000
    locationUrl.hash = encodeShare(logic, { ...state.value, sharedText: valid ? text.value : undefined })
    await copy(locationUrl.href)
  } catch { notices.push('tool.shareError') }
}
const format = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
</script>

<template>
  <div class="workspace">
    <header class="tool-heading">
      <div><p class="kicker">{{ t('category.typography') }}</p><h1>{{ t('tools.readability.name') }}</h1><p>{{ t('tools.readability.description') }}</p></div>
    </header>
    <div v-if="shared" class="notice actions">
      {{ t('tool.shareLoaded') }}<button class="btn" type="button" @click="keep">{{ t('tool.keep') }}</button>
      <button class="btn" type="button" @click="reject">{{ t('tool.discard') }}</button>
    </div>
    <div class="workspace-grid">
      <section v-if="ready" class="panel controls">
        <h2>{{ t('tool.controls') }}</h2>
        <label>{{ label('sample') }}<textarea :value="text" maxlength="102400" @input="changeText" /></label>
        <label>{{ label('family') }}<select :value="state.font" @change="clearLocal(); update(d => { d.font = value($event) as State['font'] })">
          <option v-for="font in Object.keys(fonts)" :value="font" :key="font">{{ label(font) }}</option>
        </select></label>
        <label>{{ label('fontFile') }}<input type="file" accept=".woff,.woff2,.ttf,.otf" @change="localFont" /></label>
        <p v-if="fontError" role="alert">{{ label('badFont') }}</p>
        <button v-if="fontName" class="btn" type="button" @click="clearLocal">{{ label('clearFont') }} · {{ fontName }}</button>
        <RangeField v-for="(limits, key) in options" :key="key" :label="label(key)" :min="limits[0]" :max="limits[1]" :step="limits[2]"
          :model-value="state[key]" @update:model-value="update(d => { d[key] = $event }, key)" />
        <div class="actions">
          <button class="btn" type="button" @click="share">{{ t('tool.share') }}</button>
          <label class="check"><input v-model="include" type="checkbox" :disabled="text.length > 1000" />{{ label('shareText') }}</label>
        </div>
      </section>
      <div class="preview-column">
        <section class="panel">
          <div class="panel-top"><h2>{{ t('tool.preview') }}</h2><label class="check"><input v-model="simulate" type="checkbox" />{{ label('simulate') }}</label></div>
          <div class="ruler" :style="display">{{ state.width }} ch</div>
          <div ref="pane" class="sample" :style="display"><p v-for="(paragraph,index) in paragraphs" :key="index">{{ paragraph }}</p></div>
          <p v-if="text.length > 12000">{{ label('previewLimit') }}</p>
          <dl v-if="dimensions" class="metrics">
            <div><dt>{{ label('average') }}</dt><dd data-testid="line-average">{{ format.format(dimensions.average) }}</dd></div>
            <div><dt>{{ label('minimum') }}</dt><dd>{{ dimensions.min }}</dd></div>
            <div><dt>{{ label('maximum') }}</dt><dd>{{ dimensions.max }}</dd></div>
            <div><dt>{{ label('lines') }}</dt><dd>{{ dimensions.lines }}</dd></div>
          </dl>
          <p v-if="dimensions && (dimensions.average < 45 || dimensions.average > 75)" class="notice">{{ label('range') }}</p>
          <h3>{{ label('spacing') }}</h3>
          <ul class="checks">
            <li v-for="key in flags" :key="key">{{ label(key) }} · {{ format.format(simulate ? Math.max(state[key], minimums[key]) : state[key]) }}
              <span class="badge">{{ state[key] >= minimums[key] || simulate ? label('threshold') : label('below') }} {{ format.format(minimums[key]) }}</span>
            </li>
          </ul>
          <a href="https://www.w3.org/WAI/WCAG21/Understanding/text-spacing.html" target="_blank" rel="noopener noreferrer">WCAG 1.4.12</a>
        </section>
        <section class="panel">
          <h2>{{ label('metrics') }}</h2>
          <dl class="metrics">
            <div><dt>{{ label('words') }}</dt><dd>{{ metrics.words }}</dd></div>
            <div><dt>{{ label('characters') }}</dt><dd>{{ metrics.characters }}</dd></div>
            <div><dt>{{ label('seconds') }}</dt><dd>{{ metrics.seconds }} s</dd></div>
            <div><dt>INFLESZ</dt><dd>{{ metrics.index === undefined ? '—' : format.format(metrics.index) }}</dd></div>
          </dl>
          <p>{{ label('formula') }}</p>
          <a href="https://inflesz.com/assets/TESIS%20DOCTORAL%20IN%C3%89S%20BARRIO%20Legibilidad%20y%20salud.pdf" target="_blank" rel="noopener noreferrer">{{ label('validation') }}</a>
        </section>
        <CodeOutputPanel name="frontkit-legibilidad" :outputs="outputs" />
      </div>
    </div>
  </div>
</template>
<style scoped>
textarea { width:100%;min-height:9rem;border:1px solid var(--line);padding:.5rem;border-radius:8px;resize:vertical; }
.controls label { margin:.45rem 0; }
.ruler { border-bottom:2px solid var(--accent);border-inline:2px solid var(--accent);color:var(--muted);height:1.6rem;text-align:right; }
.sample { margin:.75rem 0; }
.sample p { margin:0;white-space:pre-wrap;overflow-wrap:anywhere; }
.sample p + p { margin-block-start:var(--paragraph-gap); }
.metrics { display:flex;flex-wrap:wrap;gap:.5rem 1.1rem;margin:.6rem 0; }
.metrics dd { font-weight:700; }
.checks li { margin:.25rem 0; }
</style>
