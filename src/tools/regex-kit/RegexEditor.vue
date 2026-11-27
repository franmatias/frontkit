<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { captureHue, type Span } from './highlights'

const props = defineProps<{ label: string; parts: Span[]; maxLength: number; pattern?: boolean; hideLabel?: boolean }>()
const value = defineModel<string>({ required: true })
const id = useId()
const input = ref<HTMLTextAreaElement>()
const mirror = ref<HTMLElement>()

function syncScroll() {
  if (!input.value || !mirror.value) return
  mirror.value.scrollTop = input.value.scrollTop
  mirror.value.scrollLeft = input.value.scrollLeft
}
watch(() => props.parts, () => { void nextTick(syncScroll) })
</script>

<template>
  <div class="regex-editor" :class="{ pattern }">
    <label :for="id" :class="{ 'sr-only': hideLabel }">{{ label }}</label>
    <div class="editor-surface">
      <pre ref="mirror" aria-hidden="true"><template v-for="(part, i) in parts" :key="i"><mark v-if="part.kind?.startsWith('match-')" :class="part.kind" :style="part.kind === 'match-0' ? undefined : { '--capture-hue': captureHue(Number(part.kind.slice(6))) }">{{ part.text }}</mark><span v-else :class="part.kind">{{ part.text }}</span></template>{{ value.endsWith('\n') ? ' ' : '' }}</pre>
      <textarea :id="id" ref="input" v-model="value" :rows="pattern ? 2 : 8" :maxlength="maxLength"
        spellcheck="false" autocorrect="off" autocapitalize="off" @scroll="syncScroll"></textarea>
    </div>
  </div>
</template>

<style scoped>
.regex-editor { display:grid;gap:.4rem;min-width:0 }
.regex-editor label { font-weight:650 }
.editor-surface { position:relative;border:1px solid var(--line);border-radius:.65rem;background:var(--surface) }
.editor-surface:focus-within { outline:2px solid var(--focus);outline-offset:2px }
textarea,pre { display:block;box-sizing:border-box;width:100%;margin:0;padding:.85rem;border:0;border-radius:inherit;
  font:.9rem/1.6 ui-monospace,Consolas,monospace;letter-spacing:normal;tab-size:4;text-align:start;
  white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;scrollbar-gutter:stable }
pre { position:absolute;inset:0;pointer-events:none;scrollbar-color:transparent transparent;color:transparent }
textarea { position:relative;resize:vertical;min-height:4rem;outline:none;background:transparent;color:var(--text);caret-color:var(--text) }
.pattern textarea { color:transparent }
.pattern pre { color:var(--text) }
.group { color:var(--accent) }
.escape { color:var(--regex-escape) }
.quantifier { color:var(--regex-quantifier);text-decoration:underline dotted }
.set,.operator { color:var(--regex-set) }
mark { color:transparent;background:color-mix(in srgb,hsl(var(--capture-hue) 75% 64%) 30%,var(--surface)) }
mark.match-0 { background:var(--regex-mark) }
@media (forced-colors:active) {
  .pattern textarea { color:CanvasText }
  pre { visibility:hidden }
}
</style>
