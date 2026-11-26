<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CodeOutputPanel from './CodeOutputPanel.vue'

defineProps<{ id: string; outputs?: Record<string, string>; extensions?: Record<string, string> }>()
const { t } = useI18n()
</script>

<template>
  <div class="workspace">
    <header class="tool-heading">
      <div><h1>{{ t('tools.' + id + '.name') }}</h1><p>{{ t('tools.' + id + '.description') }}</p></div>
    </header>
    <div class="workspace-grid">
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
