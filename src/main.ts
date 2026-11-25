import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { initStorage, onExternalChange, onWriteFailure } from './core/storage/db'
import { defaultLocale, i18n, loadLocale } from './i18n'
import { router } from './router'
import { useNotificationsStore } from './stores/notifications'
import { useSettingsStore } from './stores/settings'
import { useToolsStore } from './stores/tools'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const notifications = useNotificationsStore()
const persisted = await initStorage()
const hydrate = () => Promise.all([useSettingsStore().hydrate(), useToolsStore().hydrate()])
await Promise.all([hydrate().catch(() => notifications.push('tool.storageError')), loadLocale(defaultLocale)])
onExternalChange(() => { void hydrate().catch(() => notifications.push('tool.storageError')) })
onWriteFailure(() => notifications.push('tool.storageError'))

let preloadFailed = false
window.addEventListener('vite:preloadError', event => {
  event.preventDefault()
  try {
    if (!sessionStorage.getItem('frontkit:preload-retry')) {
      sessionStorage.setItem('frontkit:preload-retry', 'yes')
      location.reload()
      return
    }
  } catch { /* A blocked session store prevents automatic retries. */ }
  preloadFailed = true
  notifications.push('tool.resetError')
})
router.afterEach((_to, _from, failure) => {
  if (failure || preloadFailed) return
  try { sessionStorage.removeItem('frontkit:preload-retry') } catch { /* Optional guard. */ }
})
app.provide('storageAvailable', persisted)
app.use(i18n)
app.use(router)
app.mount('#app')
