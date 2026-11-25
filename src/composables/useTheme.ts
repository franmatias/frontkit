import { watchEffect } from 'vue'
import { useSettingsStore } from '../stores/settings'

export function useTheme() {
  const settings = useSettingsStore()
  const system = matchMedia('(prefers-color-scheme: dark)')
  function apply() {
    const theme = settings.data.theme
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && system.matches))
    try { localStorage.setItem('frontkit:theme', theme) } catch { /* Optional mirror. */ }
  }
  watchEffect(apply)
  system.addEventListener('change', apply)
}
