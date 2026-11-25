import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { findTool, type ToolCategory, tools } from '../core/registry'
import { read, write } from '../core/storage/db'
import { i18n } from '../i18n'

export function normalize(search: string) {
  return search.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
function toolIds(raw: unknown) {
  return Array.isArray(raw)
    ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && Boolean(findTool(id))))]
    : []
}

export const useToolsStore = defineStore('tools', () => {
  const favorites = ref<string[]>([])
  const recentTools = ref<string[]>([])
  const searchQuery = ref('')
  const activeCategory = ref<ToolCategory | ''>('')
  const onlyFavorites = ref(false)
  const onlyTailwind = ref(false)
  const favoriteTools = computed(() => tools.filter(tool => favorites.value.includes(tool.id)))
  const featuredTools = computed(() => tools.filter(tool => tool.featured))
  const availableTools = computed(() => tools.filter(tool => tool.status !== 'coming-soon'))
  const filteredTools = computed(() => tools.filter(tool => {
    const query = normalize(searchQuery.value)
    const translate = i18n.global.t
    const haystack = normalize([
      translate('tools.' + tool.id + '.name'), translate('tools.' + tool.id + '.description'),
      translate('category.' + tool.category), ...tool.tags.map(key => translate(key)), tool.id,
    ].join(' '))
    return (!query || query.split(/\s+/).every(word => haystack.includes(word)))
      && (!activeCategory.value || tool.category === activeCategory.value)
      && (!onlyFavorites.value || favorites.value.includes(tool.id))
      && (!onlyTailwind.value || tool.supportsTailwind)
  }))
  async function hydrate() {
    const [savedFavorites, savedRecent] = await Promise.all([read('kv', 'favorites'), read('kv', 'recent')])
    favorites.value = toolIds(savedFavorites?.state)
    recentTools.value = toolIds(savedRecent?.state).slice(0, 8)
  }
  function toggleFavorite(id: string) {
    favorites.value = favorites.value.includes(id) ? favorites.value.filter(item => item !== id) : [...favorites.value, id]
    void write('kv', 'favorites', [...favorites.value]).catch(() => {})
  }
  function visit(id: string) {
    if (recentTools.value[0] === id) return
    recentTools.value = [id, ...recentTools.value.filter(item => item !== id)].slice(0, 8)
    void write('kv', 'recent', [...recentTools.value]).catch(() => {})
  }
  return { favorites, recentTools, searchQuery, activeCategory, onlyFavorites, onlyTailwind,
    filteredTools, favoriteTools, featuredTools, availableTools, hydrate, toggleFavorite, visit }
})
