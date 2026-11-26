<script setup lang="ts">
import { ref, watch } from 'vue'
import { receiveTableDraft } from '../core/storage/table-handoff'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { findTool } from '../core/registry'
const route = useRoute()
const { t } = useI18n()
const draft = ref<Awaited<ReturnType<typeof receiveTableDraft>>>()
watch(() => route.name === 'table-builder' ? route.query.handoff : undefined, async (id, _, cleanup) => {
  let current = true
  cleanup(() => { current = false })
  const data = await receiveTableDraft(id).catch(() => undefined)
  if (current) draft.value = data
}, { immediate: true })
</script>

<template>
  <section class="panel page-intro">
    <p class="badge">{{ t(findTool(route.meta.toolId)?.todo ? 'status.todo' : 'status.coming-soon') }}</p>
    <h1>{{ t(String(route.meta.title)) }}</h1>
    <p>{{ t('tools.' + route.name?.toString() + '.description') }}</p>
    <p>{{ t('tool.planned') }}</p>
    <div v-if="draft" class="notice">
      <p>{{ t('tool.tableDraft', { count: draft.count }) }}</p>
      <div class="actions"><span v-for="column in draft.columns" :key="column" class="badge">{{ column }}</span></div>
    </div>
    <RouterLink class="btn" to="/">{{ t('tool.back') }}</RouterLink>
  </section>
</template>
