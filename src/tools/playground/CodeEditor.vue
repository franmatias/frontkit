<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { languages } from './project'

const props = defineProps<{
  language: (typeof languages)[number]
  value: string
  wrap: boolean
  fontSize: number
  tabSize: number
}>()
const emit = defineEmits<{ change: [value: string] }>()
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
const grammars = { html: 'xml', css: 'css', js: 'javascript' }
const input = ref<HTMLTextAreaElement>()
const mirror = ref<HTMLDivElement>()
const gutter = ref<HTMLDivElement>()
const heights = ref<number[]>([])
let observer: ResizeObserver | undefined

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
  if (!input.value || !mirror.value || !gutter.value) return
  mirror.value.scrollTop = input.value.scrollTop
  mirror.value.scrollLeft = input.value.scrollLeft
  gutter.value.style.transform = 'translateY(' + -input.value.scrollTop + 'px)'
}
function measure() {
  if (!input.value || !mirror.value) return
  mirror.value.style.width = input.value.clientWidth + 'px'
  mirror.value.style.height = input.value.clientHeight + 'px'
  heights.value = props.wrap ? Array.from(mirror.value.children, line => line.getBoundingClientRect().height) : []
  align()
}
watch(() => [props.value, props.wrap, props.fontSize, props.tabSize], () => nextTick(measure), { flush: 'post' })
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (input.value) observer.observe(input.value)
  measure()
})
onUnmounted(() => observer?.disconnect())
</script>
<template>
  <div class="source" :style="{fontSize:fontSize+'px', tabSize, '--gutter': Math.max(3, String(lines.length).length + 2) + 'ch'}">
    <div class="numbers" aria-hidden="true"><div ref="gutter"><div v-for="(_, i) in lines" :key="i" :style="{height: heights[i] ? heights[i] + 'px' : undefined}">{{ i + 1 }}</div></div></div>
    <div class="layers">
      <div ref="mirror" class="paint" aria-hidden="true" :class="{wrap}"><div v-for="(row,i) in lines" :key="i" class="line"><span v-for="(token,j) in row" :key="j" :class="token.classes">{{ token.text }}</span><template v-if="!row.length">{{ '\u200b' }}</template></div></div>
      <textarea ref="input" :aria-label="language.toUpperCase()" :value="value" :wrap="wrap ? 'soft' : 'off'" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="120000" @scroll="align" @input="emit('change', ($event.target as HTMLTextAreaElement).value)" />
    </div>
  </div>
</template>
<style scoped>
.source { display:grid;grid-template-columns:var(--gutter) minmax(0,1fr);min-height:0;flex:1;color:#dbe7e1;background:#14231e;font-family:ui-monospace,Consolas,monospace;line-height:1.55;font-variant-ligatures:none; }
.layers,.numbers { position:relative;min-width:0;min-height:0;overflow:hidden; }
.numbers { background:#12201b;color:#90a89a;text-align:right;border-right:1px solid #2e4037;user-select:none; }
.numbers>div { padding:.65rem .45ch; }
.paint,textarea { position:absolute;inset:0;margin:0;padding:.65rem .7rem;box-sizing:border-box;border:0;font:inherit;letter-spacing:normal;tab-size:inherit; }
.paint { overflow:hidden;pointer-events:none; }
.line { white-space:pre;min-height:1lh; }
.wrap .line { white-space:pre-wrap;overflow-wrap:break-word; }
textarea { width:100%;height:100%;background:transparent;color:transparent;caret-color:white;resize:none;-webkit-text-fill-color:transparent; }
textarea:focus-visible { outline:2px solid #83ccab;outline-offset:-2px; }
textarea::selection { background:#749cd355; }
.hljs-comment,.hljs-quote { color:#9cad9f; }
.hljs-keyword,.hljs-selector-tag,.hljs-tag,.hljs-name { color:#f19db2; }
.hljs-string,.hljs-attr,.hljs-selector-class { color:#c4dc98; }
.hljs-number,.hljs-literal,.hljs-attribute { color:#f7c38b; }
.hljs-title,.hljs-built_in,.hljs-selector-id { color:#95cdf8; }
@media (forced-colors:active) { textarea { color:CanvasText;-webkit-text-fill-color:CanvasText;background:Canvas;caret-color:CanvasText; } }
</style>
