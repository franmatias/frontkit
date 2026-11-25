<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { remove } from '../../core/storage/db'

const props = defineProps<{ toolId?: string }>()
const { t } = useI18n()
const failed = ref(false)
onErrorCaptured(() => {
  failed.value = true
  return false
})
async function reset() {
  if (props.toolId) await remove('toolStates', props.toolId).catch(() => {})
  failed.value = false
}
</script>

<template>
  <section v-if="failed" class="panel">
    <h1>{{ t('tool.resetError') }}</h1>
    <div class="actions">
      <button class="btn" type="button" @click="failed = false">{{ t('tool.retry') }}</button>
      <button v-if="toolId" class="btn" type="button" @click="reset">{{ t('app.reset') }}</button>
    </div>
  </section>
  <slot v-else />
</template>
