<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { editorFonts } from '../../stores/settings'
import { sourceLimit } from './project'
import { emmetCompletion, suggestions, type Completion, type Language } from './completions'

const props = defineProps<{
  language: Language
  value: string
  wrap: boolean
  fontSize: number
  tabSize: number
  disabled: boolean
  lineNumbers: boolean
  fontFamily: typeof editorFonts[number]
}>()
const { t } = useI18n()
const hintId = 'emmet-hint-' + props.language
const emit = defineEmits<{ change: [value: string]; format: [] }>()
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
const grammars = { html: 'xml', css: 'css', js: 'javascript' }
const fonts = {
  system: 'ui-monospace, Consolas, monospace',
  consolas: 'Consolas, ui-monospace, monospace',
  courier: '"Courier New", Courier, monospace',
}
const input = ref<HTMLTextAreaElement>()
const mirror = ref<HTMLDivElement>()
const gutter = ref<HTMLDivElement>()
const heights = ref<number[]>([])
let observer: ResizeObserver | undefined
const listId = 'suggestions-' + props.language
const completions = ref<Completion[]>([])
const active = ref(0)
const choice = computed(() => completions.value[active.value])

// Split after highlighting so that multiline comments and strings retain their colour.
const lines = computed(() => {
  const html = hljs.highlight(props.value, { language: grammars[props.language] }).value
  const body = new DOMParser().parseFromString('<body><span>' + html + '</span></body>', 'text/html').body
  const rows: { text: string; classes: string }[][] = [[]]
  function visit(node: Node, classes: string) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = (node.textContent ?? '').split('\n')
      parts.forEach((part, i) => {
        if (i) rows.push([])
        if (part) rows[rows.length - 1].push({ text: part, classes })
      })
    } else if (node instanceof Element) {
      for (const child of node.childNodes) visit(child, (classes + ' ' + node.className).trim())
    }
  }
  visit(body, '')
  return rows
})
function align() {
  if (!input.value || !mirror.value) return
  mirror.value.scrollTop = input.value.scrollTop
  mirror.value.scrollLeft = input.value.scrollLeft
  if (gutter.value) gutter.value.style.transform = 'translateY(' + -input.value.scrollTop + 'px)'
}
function measure() {
  if (!input.value || !mirror.value) return
  mirror.value.style.width = input.value.clientWidth + 'px'
  mirror.value.style.height = input.value.clientHeight + 'px'
  heights.value = props.wrap ? Array.from(mirror.value.children, line => line.getBoundingClientRect().height) : []
  align()
}
function closeSuggestions() {
  completions.value = []
  active.value = 0
}
function refreshSuggestions() {
  const editor = input.value
  if (!editor || editor.selectionStart !== editor.selectionEnd) {
    closeSuggestions()
    return
  }
  completions.value = suggestions(props.language, editor.value, editor.selectionStart, props.tabSize)
  active.value = 0
}
function applyCompletion(completion: Completion) {
  const editor = input.value
  if (!editor) return
  const end = editor.selectionStart
  if (editor.value.length - (end - completion.start) + completion.text.length > editor.maxLength) return
  editor.setRangeText(completion.text, completion.start, end, 'end')
  if (completion.field) {
    const start = completion.start + completion.field.offset
    editor.setSelectionRange(start, start + completion.field.length)
  }
  closeSuggestions()
  emit('change', editor.value)
}
function editing(event: Event) {
  if (!input.value) return
  emit('change', input.value.value)
  if (!(event as InputEvent).isComposing) refreshSuggestions()
}
function handleKey(event: KeyboardEvent) {
  const editor = input.value
  if (!editor || event.isComposing) return
  if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyF') {
    event.preventDefault()
    closeSuggestions()
    emit('format')
    return
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'Space') {
    event.preventDefault()
    refreshSuggestions()
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  if (choice.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault()
    active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + completions.value.length) % completions.value.length
    void nextTick(() => document.getElementById(listId + '-' + active.value)?.scrollIntoView({ block: 'nearest' }))
    return
  }
  if (event.key === 'Tab' || event.key === 'Enter') {
    const completion = choice.value ?? (event.key === 'Tab' && editor.selectionStart === editor.selectionEnd
      ? emmetCompletion(props.language, editor.value, editor.selectionStart, props.tabSize) : undefined)
    if (completion) {
      event.preventDefault()
      applyCompletion(completion)
      return
    }
  }
  if (['Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
    if (event.key === 'Escape' && choice.value) event.stopPropagation()
    closeSuggestions()
  }
}
watch(() => [props.value, props.wrap, props.fontSize, props.tabSize, props.lineNumbers, props.fontFamily], () => nextTick(measure), { flush: 'post' })
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (input.value) observer.observe(input.value)
  measure()
})
onUnmounted(() => observer?.disconnect())
</script>
<template>
  <div class="source" :style="{fontSize:fontSize+'px', fontFamily:fonts[fontFamily], tabSize, '--gutter': lineNumbers ? Math.max(3, String(lines.length).length + 2) + 'ch' : '0px'}">
    <div class="numbers" :hidden="!lineNumbers" aria-hidden="true"><div ref="gutter"><div v-for="(_, i) in lines" :key="i" :style="{height: heights[i] ? heights[i] + 'px' : undefined}">{{ i + 1 }}</div></div></div>
    <div class="layers">
      <span :id="hintId" class="sr-only">{{ t(language === 'js' ? 'detail.playground.suggestHint' : 'detail.playground.emmetHint') }}</span>
      <div ref="mirror" class="paint" aria-hidden="true" :class="{wrap}"><div v-for="(row,i) in lines" :key="i" class="line"><span v-for="(token,j) in row" :key="j" :class="token.classes">{{ token.text }}</span><template v-if="!row.length">{{ '\u200b' }}</template></div></div>
      <textarea ref="input" :disabled="disabled" :aria-label="language.toUpperCase()" :value="value" :aria-describedby="hintId" aria-autocomplete="list" :aria-controls="choice ? listId : undefined" :aria-activedescendant="choice ? listId + '-' + active : undefined" :wrap="wrap ? 'soft' : 'off'" spellcheck="false" autocapitalize="off" autocomplete="off" :maxlength="sourceLimit" @scroll="align" @keydown="handleKey" @input="editing" @compositionend="refreshSuggestions" @blur="closeSuggestions" @click="closeSuggestions" />
      <div v-if="choice" class="suggestions">
        <ul :id="listId" role="listbox" :aria-label="t('detail.playground.suggestions')">
          <li v-for="(item, index) in completions" :id="listId + '-' + index" :key="item.kind + item.label" role="option" :aria-selected="index === active"
            @pointerdown.prevent @click="applyCompletion(item)"><span>{{ item.label }}</span><small>{{ t('detail.playground.kinds.' + item.kind) }}</small></li>
        </ul>
        <pre v-if="choice.kind === 'emmet'" class="suggestion-preview">{{ choice.text.slice(0, 500) }}</pre>
      </div>
    </div>
  </div>
</template>
<style scoped>
.source { display:grid;grid-template-columns:var(--gutter) minmax(0,1fr);min-height:0;flex:1;color:var(--code-foreground);background:var(--code-background);font-family:ui-monospace,Consolas,monospace;line-height:1.55;font-variant-ligatures:none; }
.layers { grid-column:2; }
.layers,.numbers { position:relative;min-width:0;min-height:0;overflow:hidden; }
.numbers { background:var(--code-gutter);color:var(--code-muted);text-align:right;border-right:1px solid var(--code-line);user-select:none; }
.numbers>div { padding:.65rem .45ch; }
.paint,textarea { position:absolute;inset:0;margin:0;padding:.65rem .7rem;box-sizing:border-box;border:0;font:inherit;letter-spacing:normal;tab-size:inherit; }
.paint { overflow:hidden;pointer-events:none; }
.line { white-space:pre;min-height:1lh; }
.wrap .line { white-space:pre-wrap;overflow-wrap:break-word; }
textarea { width:100%;height:100%;background:transparent;color:transparent;caret-color:var(--code-foreground);resize:none;-webkit-text-fill-color:transparent; }
textarea:focus-visible { outline:2px solid var(--code-focus);outline-offset:-2px; }
textarea::selection { background:var(--code-selection); }
@media (forced-colors:active) { textarea { color:CanvasText;-webkit-text-fill-color:CanvasText;background:Canvas;caret-color:CanvasText; } }

.suggestions { position:absolute;z-index:2;bottom:.5rem;left:.6rem;right:.6rem;max-width:26rem;background:var(--code-gutter);border:1px solid var(--code-line);border-radius:6px;color:var(--code-foreground);box-shadow:0 4px 16px #0008;font-size:.85em; }
.suggestions ul { list-style:none;padding:0;margin:0;max-height:6.7rem;overflow:auto; }
.suggestions li { display:flex;justify-content:space-between;gap:.5rem;padding:.18rem .55rem;cursor:pointer; }
.suggestions li[aria-selected=true] { background:var(--code-selection); }
.suggestions small { color:var(--code-muted); }
.suggestion-preview { white-space:pre-wrap;overflow-wrap:anywhere;max-height:3.7rem;overflow:auto;margin:0;padding:.24rem .55rem;border-top:1px solid var(--code-line); }
</style>
