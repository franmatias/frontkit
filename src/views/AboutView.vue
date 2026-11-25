<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import manifest from '../../package.json'
const { t } = useI18n()
const licenses = ref<{ name: string; version: string; license: string; notices: string[] }[]>([])
onMounted(async () => {
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'licenses.json')
    if (response.ok) licenses.value = await response.json()
  } catch { /* A development server may run before the licenses are generated. */ }
})
</script>

<template>
  <section class="panel page-intro">
    <h1>{{ t('app.about') }}</h1>
    <p>{{ t('about.summary') }}</p>
    <p>FrontKit {{ manifest.version }} · <a href="https://github.com/franmatias/frontkit">{{ t('app.github') }}</a></p>
    <h2>{{ t('about.privacy') }}</h2>
    <p>{{ t('about.privacyBody') }}</p>
    <a href="https://github.com/franmatias/frontkit/blob/main/LICENSE">{{ t('about.license') }}</a>
    <h2>{{ t('about.dependencies') }}</h2>
    <p v-if="!licenses.length">{{ t('about.unavailable') }}</p>
    <details v-for="item in licenses" :key="item.name">
      <summary>{{ item.name }} {{ item.version }} · {{ item.license }}</summary>
      <pre v-for="notice in item.notices" :key="notice" class="license">{{ notice }}</pre>
    </details>
  </section>
</template>
