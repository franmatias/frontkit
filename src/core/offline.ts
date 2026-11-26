import { shallowRef } from 'vue'

export const waitingUpdate = shallowRef<ServiceWorker>()
export async function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !isSecureContext) return
  try {
    const base = new URL(import.meta.env.BASE_URL, location.origin)
    const registration = await navigator.serviceWorker.register(new URL('sw.js', base))
    const indicate = () => {
      if (navigator.serviceWorker.controller && registration.waiting) waitingUpdate.value = registration.waiting
    }
    indicate()
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', indicate)
    })
  } catch { /* Offline support is optional in restricted browser contexts. */ }
}
export function activateUpdate() {
  const worker = waitingUpdate.value
  if (!worker) return
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  waitingUpdate.value = undefined
  worker.postMessage('FRONTKIT_ACTIVATE')
}
