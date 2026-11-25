<script setup lang="ts">
import { Braces, Command, Github, Menu, PanelLeftClose, Sun } from 'lucide-vue-next'
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { categories, findTool, tools } from '../../core/registry'
import { useNotificationsStore } from '../../stores/notifications'
import { useSettingsStore } from '../../stores/settings'
import { useToolsStore } from '../../stores/tools'
import ToolErrorBoundary from '../shared/ToolErrorBoundary.vue'
import CommandPalette from './CommandPalette.vue'

const route = useRoute()
const { t } = useI18n()
const settings = useSettingsStore()
const store = useToolsStore()
const notifications = useNotificationsStore()
const storageAvailable = inject('storageAvailable', true)
const collapsed = ref(false)
const drawer = ref<HTMLDialogElement>()
const palette = ref<InstanceType<typeof CommandPalette>>()
const current = computed(() => findTool(route.meta.toolId))
</script>

<template>
  <a class="skip-link" href="#main">{{ t('app.skip') }}</a>
  <div class="shell" :class="{ 'shell-collapsed': collapsed }">
    <aside v-if="!collapsed" class="sidebar">
      <RouterLink to="/" class="brand"><span class="brand-icon"><Braces :size="20" /></span> FrontKit</RouterLink>
      <nav :aria-label="t('app.menu')">
        <RouterLink to="/">{{ t('app.catalog') }}</RouterLink>
        <RouterLink to="/settings">{{ t('app.settings') }}</RouterLink>
        <RouterLink to="/about">{{ t('app.about') }}</RouterLink>
        <template v-if="store.favoriteTools.length">
          <p class="nav-label">{{ t('app.favorites') }}</p>
          <RouterLink v-for="tool in store.favoriteTools" :key="tool.id" :to="{ name: tool.id }">
            <component :is="tool.icon" :size="15" /> {{ t('tools.' + tool.id + '.name') }}
          </RouterLink>
        </template>
        <template v-for="category in categories" :key="category">
          <p class="nav-label">{{ t('category.' + category) }}</p>
          <RouterLink v-for="tool in tools.filter(item => item.category === category)" :key="tool.id" :to="{ name: tool.id }">
            <component :is="tool.icon" :size="15" /> {{ t('tools.' + tool.id + '.name') }}
          </RouterLink>
        </template>
      </nav>
    </aside>

    <section class="shell-main">
      <header class="top">
        <div class="header-left">
          <button class="icon-btn desktop-menu" type="button" :aria-label="t(collapsed ? 'app.expand' : 'app.collapse')" @click="collapsed = !collapsed"><PanelLeftClose :size="19" /></button>
          <button class="icon-btn mobile-menu" type="button" :aria-label="t('app.menu')" @click="drawer?.showModal()"><Menu :size="20" /></button>
          <span class="crumb">{{ current ? t('category.' + current.category) + ' / ' : '' }}{{ t(String(route.meta.title ?? 'app.catalog')) }}</span>
        </div>
        <div class="header-actions">
          <button class="btn search-trigger" type="button" :aria-label="t('app.search')" @click="palette?.show()"><Command :size="16" /> <span>{{ t('app.search') }}</span><kbd>Ctrl K</kbd></button>
          <button class="icon-btn" type="button" :aria-label="t('app.changeTheme')" @click="settings.cycleTheme()"><Sun :size="19" /></button>
          <a class="icon-btn" href="https://github.com/franmatias/frontkit" :aria-label="t('app.github')"><Github :size="19" /></a>
        </div>
      </header>
      <main id="main" class="main" tabindex="-1">
        <p v-if="!storageAvailable" class="notice" role="status">{{ t('tool.memory') }}</p>
        <RouterView v-slot="{ Component }">
          <ToolErrorBoundary :key="route.name?.toString()" :tool-id="current?.id">
            <component :is="Component" />
          </ToolErrorBoundary>
        </RouterView>
      </main>
    </section>
  </div>

  <dialog ref="drawer" class="drawer" :aria-label="t('app.menu')">
    <button class="btn" type="button" @click="drawer?.close()">{{ t('app.close') }}</button>
    <nav :aria-label="t('app.menu')">
      <RouterLink to="/" @click="drawer?.close()">{{ t('app.catalog') }}</RouterLink>
      <RouterLink to="/settings" @click="drawer?.close()">{{ t('app.settings') }}</RouterLink>
      <RouterLink to="/about" @click="drawer?.close()">{{ t('app.about') }}</RouterLink>
      <RouterLink v-for="tool in tools" :key="tool.id" :to="{ name: tool.id }" @click="drawer?.close()">
        <component :is="tool.icon" :size="17" /> {{ t('tools.' + tool.id + '.name') }}
      </RouterLink>
    </nav>
  </dialog>
  <CommandPalette ref="palette" />
  <div class="toast-stack" aria-live="polite" aria-atomic="false">
    <div v-for="item in notifications.items" :key="item.id" class="toast">{{ t(item.key) }}</div>
  </div>
</template>
