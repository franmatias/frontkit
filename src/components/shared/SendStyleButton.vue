<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { sendStyle } from '../../core/storage/style-handoff'
import { useNotificationsStore } from '../../stores/notifications'

const props = defineProps<{ from: 'shadow' | 'border'; value: string }>()
const router = useRouter()
const { t } = useI18n()
const notifications = useNotificationsStore()
const sending = ref(false)
async function send() {
  sending.value = true
  try {
    const handoff = await sendStyle(props.from, props.value)
    await router.push({ name: 'tokens', query: { handoff } })
  } catch { notifications.push('tool.storageError') }
  finally { sending.value = false }
}
</script>
<template>
  <button type="button" class="btn" :disabled="sending" @click="send">{{ t('tool.sendTokens') }}</button>
</template>
