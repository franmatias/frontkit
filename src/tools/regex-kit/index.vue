<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RegexKit from './RegexKit.vue'
import { presets, presetState } from './model'

const { t } = useI18n()
const example = presets.find(item => item.id === 'email')!
const draft = ref(presetState(example))
</script>

<template>
  <div class="workspace">
    <header class="tool-heading">
      <h1>{{ t('tools.regex-kit.name') }}</h1>
      <p>{{ t('tools.regex-kit.description') }}</p>
    </header>
    <RegexKit v-model="draft" />
  </div>
</template>
