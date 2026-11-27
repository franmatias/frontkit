<script setup lang="ts">
import { Braces, ChevronDown, CodeXml, ListChecks, SlidersHorizontal } from 'lucide-vue-next'
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ title: string; kind: 'css' | 'html' | 'options' | 'review' }>()
const icons = { css: Braces, html: CodeXml, options: SlidersHorizontal, review: ListChecks }
const open = ref(true)
const bodyId = useId()
const { t } = useI18n()
</script>

<template>
  <section class="refactor-pane" :class="{ folded: !open }">
    <header class="pane-bar">
      <h2><button type="button" class="pane-toggle" :aria-expanded="open" :aria-controls="bodyId"
        :title="t(open ? 'refactor.collapse' : 'refactor.expand', { title })" @click="open = !open">
        <component :is="icons[kind]" :size="17" class="kind" aria-hidden="true" />
        <span>{{ title }}</span><ChevronDown :size="16" class="chevron" aria-hidden="true" />
      </button></h2>
      <slot name="action" />
    </header>
    <div :id="bodyId" v-show="open" class="pane-body"><slot /></div>
  </section>
</template>

<style scoped>
.refactor-pane { min-width:0; border:1px solid var(--line); border-radius:.8rem; background:var(--surface); }
.pane-bar { display:flex; gap:.5rem; align-items:center; justify-content:space-between; padding:.3rem .6rem; background:var(--sidebar); border-radius:.8rem .8rem 0 0; }
.folded .pane-bar { border-radius:inherit; }
.pane-bar h2 { margin:0; flex:1; min-width:0; }
.pane-toggle { display:flex; align-items:center; gap:.55rem; width:100%; padding:.5rem .2rem; color:var(--text); font-size:.92rem; font-weight:650; text-align:start; }
.pane-toggle:hover,.kind { color:var(--accent); }
.chevron { margin-inline-start:auto; flex:none; }
.folded .chevron { transform:rotate(-90deg); }
.pane-body { border-top:1px solid var(--line); }
</style>
