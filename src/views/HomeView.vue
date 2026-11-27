<script setup lang="ts">
import { ArrowUpRight, Search, Star } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import KitIllustration from '../components/shared/KitIllustration.vue'
import { categories } from '../core/registry'
import { useToolsStore } from '../stores/tools'
const { t } = useI18n()
const store = useToolsStore()
const groups = computed(() => [
  { key: 'home.available', items: store.filteredTools.filter(tool => tool.status !== 'coming-soon') },
  { key: 'home.planned', items: store.filteredTools.filter(tool => tool.status === 'coming-soon') },
].filter(group => group.items.length))
</script>

<template>
  <section class="hero">
    <div class="hero-copy">
      <p>{{ t('home.eyebrow') }}</p>
      <h1>{{ t('home.title') }}</h1>
      <p class="hero-description">{{ t('home.summary') }}</p>
    </div>
    <div class="hero-art" aria-hidden="true"><i /><i /><i /><i /><i /></div>
  </section>

  <section class="catalog-controls" :aria-label="t('app.search')">
    <label class="catalog-search"><Search :size="19" /><input v-model="store.searchQuery" type="search" :aria-label="t('home.search')" :placeholder="t('home.search')" /></label>
    <label class="check"><input v-model="store.onlyFavorites" type="checkbox" />{{ t('home.favorites') }}</label>
    <label class="check"><input v-model="store.onlyTailwind" type="checkbox" />{{ t('home.tailwind') }}</label>
    <div class="filters">
      <button type="button" class="btn pill" :aria-pressed="store.activeCategory === ''" @click="store.activeCategory = ''">{{ t('app.all') }}</button>
      <button v-for="category in categories" :key="category" class="btn pill" type="button" :aria-pressed="store.activeCategory === category" @click="store.activeCategory = category">{{ t('category.' + category) }}</button>
    </div>
  </section>

  <p v-if="!groups.length" class="empty" role="status">{{ t('app.empty') }}</p>
  <section v-for="group in groups" :key="group.key" class="catalog-group">
    <h2>{{ t(group.key) }}</h2>
    <div class="card-grid">
      <article v-for="tool in group.items" :key="tool.id" class="tool-card" :class="{ 'planned-card': tool.status === 'coming-soon' }">
        <RouterLink :to="{ name: tool.id }" class="card-link">
          <span class="card-art">
            <KitIllustration :tool="tool" />
          </span>
          <h3>{{ t('tools.' + tool.id + '.name') }} <ArrowUpRight :size="17" aria-hidden="true" /></h3>
        </RouterLink>
        <div class="card-body">
          <div class="card-meta">
            <span class="tool-icon"><component :is="tool.icon" :size="18" /></span>
            <span>{{ t('category.' + tool.category) }}</span>
            <button type="button" class="icon-btn favorite" :aria-label="t('app.favorites') + ' · ' + t('tools.' + tool.id + '.name')"
              :aria-pressed="store.favorites.includes(tool.id)" @click="store.toggleFavorite(tool.id)">
              <Star :size="17" :fill="store.favorites.includes(tool.id) ? 'currentColor' : 'none'" />
            </button>
          </div>
          <p>{{ t('tools.' + tool.id + '.description') }}</p>
          <div class="badges">
            <span v-if="tool.todo" class="badge">{{ t('status.todo') }}</span>
            <span v-if="tool.supportsTailwind" class="badge">Tailwind</span>
            <span v-if="tool.status === 'beta'" class="badge badge-accent">{{ t('status.beta') }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
