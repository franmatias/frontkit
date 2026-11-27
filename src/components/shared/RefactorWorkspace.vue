<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RefactorPane from './RefactorPane.vue'
import CodeOutputPanel from './CodeOutputPanel.vue'

defineProps<{ id: string; optionsTitle?: string; outputs?: Record<string, string>; extensions?: Record<string, string> }>()
const { t } = useI18n()
</script>

<template>
  <div class="workspace">
    <header class="tool-heading">
      <div><h1>{{ t('tools.' + id + '.name') }}</h1><p>{{ t('tools.' + id + '.description') }}</p></div>
    </header>
    <template v-if="$slots.editors">
      <div class="refactor-editors"><div class="refactor-sources"><slot name="editors" /></div></div>
      <RefactorPane kind="options" :title="optionsTitle ?? t('refactor.options')">
        <template #action><slot name="action" /></template>
        <div class="refactor-fields"><slot /></div>
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

<style>
.refactor-editors { container-type:inline-size; min-width:0; }
.refactor-sources { display:flex; gap:.65rem; }
.refactor-sources > .refactor-pane { flex:1 1 0; }
.refactor-sources textarea { display:block; width:100%; min-height:12rem; height:clamp(13rem,31vh,24rem); resize:vertical; border:0; border-radius:0 0 .8rem .8rem; padding:.85rem 1rem; background:var(--surface); color:var(--text); font: .92rem/1.6 ui-monospace,Consolas,monospace; tab-size:2; }
.refactor-sources textarea:focus-visible { outline:2px solid var(--focus); outline-offset:-2px; }
.refactor-fields { padding:.85rem 1rem; display:grid; gap:.75rem 1rem; grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr)); align-items:end; }
.refactor-fields label:not(.check) { display:grid; min-width:0; gap:.28rem; font-size:.86rem; }
.refactor-fields input:not([type=checkbox]),.refactor-fields select,.refactor-fields textarea { width:100%; }
.refactor-fields .refactor-flags { display:flex; flex-wrap:wrap; gap:.25rem 1.2rem; grid-column:1/-1; }
.refactor-fields details { grid-column:1/-1; }
.refactor-fields summary { cursor:pointer; color:var(--accent); }
.refactor-fields details textarea { margin-top:.45rem; }
@container (min-width:38rem) {
  .refactor-sources:has(> :not(.folded)) > .folded { flex:0 0 2.9rem; }
  .refactor-sources:has(> :not(.folded)) .folded .pane-bar { padding:.4rem; height:100%; }
  .refactor-sources:has(> :not(.folded)) .folded .pane-toggle { writing-mode:vertical-rl; margin:auto; width:auto; padding:.25rem 0; }
  .refactor-sources:has(> :not(.folded)) .folded .chevron { margin:0; }
}
@container (max-width:37.99rem) { .refactor-sources { flex-direction:column; } }
</style>
