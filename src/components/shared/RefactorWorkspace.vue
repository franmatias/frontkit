<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RefactorPane from './RefactorPane.vue'
import CodeOutputPanel from './CodeOutputPanel.vue'

defineProps<{ id: string; outputs?: Record<string, string>; extensions?: Record<string, string> }>()
const { t } = useI18n()
</script>

<template>
  <div class="workspace">
    <header class="tool-heading">
      <div><h1>{{ t('tools.' + id + '.name') }}</h1><p>{{ t('tools.' + id + '.description') }}</p></div>
    </header>
    <template v-if="$slots.editors">
      <div class="editor-area"><div class="source-panes"><slot name="editors" /></div></div>
      <RefactorPane kind="options" :title="t('refactor.options')">
        <template #action><slot name="action" /></template>
        <div class="option-fields"><slot /></div>
      </RefactorPane>
      <slot name="status" />
      <slot name="review" />
      <CodeOutputPanel v-if="outputs" :outputs="outputs" :name="id" :extensions="extensions" />
    </template>
    <div v-else class="workspace-grid">
      <section class="panel tool-controls">
        <h2>{{ t('tool.controls') }}</h2>
        <slot />
      </section>
      <div class="preview-column">
        <slot name="review" />
        <CodeOutputPanel v-if="outputs && Object.keys(outputs).length" :outputs="outputs" :name="id" :extensions="extensions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-area { container-type:inline-size; min-width:0; }
.source-panes { display:flex; gap:.65rem; }
.source-panes > :deep(.refactor-pane) { flex:1 1 0; }
.source-panes :deep(textarea) { display:block; width:100%; min-height:12rem; height:clamp(13rem,31vh,24rem); resize:vertical; border:0; border-radius:0 0 .8rem .8rem; padding:.85rem 1rem; background:var(--surface); color:var(--text); font: .92rem/1.6 ui-monospace,Consolas,monospace; tab-size:2; }
.source-panes :deep(textarea:focus-visible) { outline:2px solid var(--focus); outline-offset:-2px; }
.option-fields { padding:.85rem 1rem; display:grid; gap:.75rem 1rem; grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr)); align-items:end; }
.option-fields :deep(label:not(.check)) { display:grid; min-width:0; gap:.28rem; font-size:.86rem; }
.option-fields :deep(input:not([type=checkbox])),.option-fields :deep(select),.option-fields :deep(textarea) { width:100%; }
.option-fields :deep(.option-flags) { display:flex; flex-wrap:wrap; gap:.25rem 1.2rem; grid-column:1/-1; }
.option-fields :deep(details) { grid-column:1/-1; }
.option-fields :deep(summary) { cursor:pointer; color:var(--accent); }
.option-fields :deep(details textarea) { margin-top:.45rem; }
@container (min-width:38rem) {
  .source-panes:has(> :not(.folded)) > :deep(.folded) { flex:0 0 2.9rem; }
  .source-panes:has(> :not(.folded)) :deep(.folded .pane-bar) { padding:.4rem; height:100%; }
  .source-panes:has(> :not(.folded)) :deep(.folded .pane-toggle) { writing-mode:vertical-rl; margin:auto; width:auto; padding:.25rem 0; }
  .source-panes:has(> :not(.folded)) :deep(.folded .chevron) { margin:0; }
}
@container (max-width:37.99rem) { .source-panes { flex-direction:column; } }
</style>
