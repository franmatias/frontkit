<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <section class="panel page-intro">
    <h1>{{ t('tool.missing') }}</h1>
    <RouterLink class="btn" to="/">{{ t('tool.back') }}</RouterLink>
  </section>
</template>
