import { onScopeDispose, watchEffect } from 'vue'
import { useSettingsStore } from '../stores/settings'

export function useTheme() {
  const settings = useSettingsStore()
  const system = matchMedia('(prefers-color-scheme: dark)')
  function apply() {
    const theme = settings.data.theme
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && system.matches))
    root.dataset.accent = settings.data.appearance.accent
    root.dataset.density = settings.data.appearance.density
    root.classList.toggle('reduce-interface-motion', settings.data.appearance.reducedMotion)
    try { localStorage.setItem('frontkit:theme', theme) } catch { /* Optional mirror. */ }
  }
  watchEffect(apply)
  system.addEventListener('change', apply)
  onScopeDispose(() => system.removeEventListener('change', apply))
}
