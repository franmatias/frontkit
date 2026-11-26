<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { categories, tools, type ToolCategory } from '../../core/registry'

const emit = defineEmits<{ navigate: [] }>()
const { t } = useI18n()
const id = useId()
const expanded = ref(new Set<ToolCategory>())
const groups = categories.map(category => ({ category, items: tools.filter(tool => tool.category === category) }))
function toggle(category: ToolCategory) {
  if (expanded.value.has(category)) expanded.value.delete(category)
  else expanded.value.add(category)
}
</script>

<template>
  <div v-for="{ category, items } in groups" :key="category" class="nav-category">
    <button type="button" class="category-toggle" :aria-expanded="expanded.has(category)" :aria-controls="id + '-' + category" @click="toggle(category)">
      <span>{{ t('category.' + category) }}</span><ChevronRight :size="14" aria-hidden="true" />
    </button>
    <div v-show="expanded.has(category)" :id="id + '-' + category" class="category-links">
      <RouterLink v-for="tool in items" :key="tool.id" :to="{ name: tool.id }" @click="emit('navigate')">
        <component :is="tool.icon" :size="15" aria-hidden="true" />
        <span>{{ t('tools.' + tool.id + '.name') }}</span><small v-if="tool.todo" class="badge">{{ t('status.todo') }}</small>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.category-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;gap:.45rem;padding:.55rem .68rem;border-radius:8px;text-align:start;font-size:.82rem;font-weight:720;color:var(--text)}
.category-toggle:hover,.category-toggle[aria-expanded="true"]{background:var(--accent-soft);color:var(--accent)}
.category-toggle svg{flex:none;transition:transform .15s}
.category-toggle[aria-expanded="true"] svg{transform:rotate(90deg)}
.category-links{margin:.08rem 0 .22rem .65rem;padding-inline-start:.2rem;border-inline-start:1px solid var(--line)}
.category-links a span{min-width:0;overflow-wrap:anywhere}
.category-links a svg{flex:none}
@media(prefers-reduced-motion:reduce){.category-toggle svg{transition:none}}
</style>
