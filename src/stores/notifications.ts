import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<{ id: number; key: string }[]>([])
  let next = 0
  function push(key: string) {
    const id = next++
    items.value.push({ id, key })
    setTimeout(() => { items.value = items.value.filter(item => item.id !== id) }, 4800)
  }
  return { items, push }
})
