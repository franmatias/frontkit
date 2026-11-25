import { useNotificationsStore } from '../stores/notifications'

export function useClipboard() {
  const notifications = useNotificationsStore()
  return async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      notifications.push('tool.copied')
      return true
    } catch {
      notifications.push('tool.copyError')
      return false
    }
  }
}
