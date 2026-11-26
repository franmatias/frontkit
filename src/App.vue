<script setup lang="ts">
import AppShell from './components/layout/AppShell.vue'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { activateUpdate, registerOffline, waitingUpdate } from './core/offline'
import { useTheme } from './composables/useTheme'
useTheme()
const { t } = useI18n()
onMounted(() => { void registerOffline() })
</script>

<template>
  <AppShell />
  <aside v-if="waitingUpdate" class="offline-update notice actions" aria-live="polite">
    {{ t('app.updateReady') }}<button type="button" class="btn primary" @click="activateUpdate">{{ t('app.updateNow') }}</button>
  </aside>
</template>

<style scoped>
.offline-update { position:fixed;z-index:20;left:1rem;bottom:1rem;max-width:calc(100% - 2rem);border:1px solid var(--line);box-shadow:0 5px 25px #0002; }
</style>
