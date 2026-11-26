<script setup lang="ts">
import highlight from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import { Check, Copy, Download } from 'lucide-vue-next'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '../../composables/useClipboard'
import { download } from '../../lib/download'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{ outputs: Record<string, string>; name: string; extensions?: Record<string, string> }>()
const { t, n } = useI18n()
const copy = useClipboard()
const settings = useSettingsStore()
const heading = useId()
const current = ref('')
const keys = computed(() => Object.keys(props.outputs))
const active = computed(() => keys.value.includes(current.value)
  ? current.value
  : settings.data.preferences.showTailwindByDefault && keys.value.includes('tailwind') ? 'tailwind' : keys.value[0])
const code = computed(() => props.outputs[active.value] ?? '')
highlight.registerLanguage('css', css)
type Segment = { text: string; classes: string }
const segments = computed<Segment[]>(() => {
  if (active.value !== 'css' || code.value.length > 100_000) return [{ text: code.value, classes: '' }]
  const rendered = highlight.highlight(code.value, { language: 'css' }).value
  const parsed = new DOMParser().parseFromString(rendered, 'text/html')
  const result: Segment[] = []
  function collect(node: Node, classes = '') {
    if (node.nodeType === Node.TEXT_NODE) result.push({ text: node.textContent ?? '', classes })
    else if (node instanceof Element) {
      const next = [classes, node.className].filter(Boolean).join(' ')
      for (const child of node.childNodes) collect(child, next)
    }
  }
  collect(parsed.body)
  return result
})
const copied = ref(false)
let reset: ReturnType<typeof setTimeout>
async function copyCode() {
  copied.value = await copy(code.value)
  clearTimeout(reset)
  reset = setTimeout(() => { copied.value = false }, 1200)
}
defineExpose({ copyCode })
</script>

<template>
  <section class="panel code-panel" :aria-labelledby="heading">
    <div class="panel-top"><h2 :id="heading">{{ t('tool.output') }}</h2>
      <div class="actions">
        <button class="btn" type="button" @click="copyCode"><Check v-if="copied" :size="16" /><Copy v-else :size="16" /> {{ t('tool.copy') }}</button>
        <button class="btn" type="button" @click="download(name + (extensions?.[active] ?? ((active === 'tailwind' || active === 'plaintext') ? '.txt' : '.' + active)), code, 'text/plain')"><Download :size="16" /> {{ t('tool.download') }}</button>
      </div>
    </div>
    <div class="output-tabs" :aria-label="t('tool.output')">
      <button v-for="key in keys" :key="key" class="btn pill" type="button" :aria-pressed="active === key" @click="current = key">{{ t('tool.' + key) }}</button>
    </div>
    <button v-if="settings.data.preferences.autoCopyOnClick" type="button" class="code-box code-button" :aria-label="t('tool.copy')" @click="copyCode"><code>{{ code }}</code></button>
    <pre v-else class="code-box"><code><span v-for="(segment, index) in segments" :key="index" :class="segment.classes">{{ segment.text }}</span></code></pre>
    <p class="stats">{{ n(code.split('\n').length) }} {{ t('tool.lines') }} · {{ n(code.length) }} {{ t('tool.chars') }}</p>
  </section>
</template>
