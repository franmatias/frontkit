<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { findTool } from '../core/registry'
const route = useRoute()
const { t } = useI18n()
</script>

<template>
  <section class="panel page-intro">
    <p class="badge">{{ t(findTool(route.meta.toolId)?.todo ? 'status.todo' : 'status.coming-soon') }}</p>
    <h1>{{ t(String(route.meta.title)) }}</h1>
    <p>{{ t('tools.' + route.name?.toString() + '.description') }}</p>
    <p>{{ t('tool.planned') }}</p>
    <RouterLink class="btn" to="/">{{ t('tool.back') }}</RouterLink>
  </section>
</template>
