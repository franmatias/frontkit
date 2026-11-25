import { createRouter, createWebHistory } from 'vue-router'
import { tools } from '../core/registry'
import { defaultLocale, i18n, loadToolLocale } from '../i18n'
import { useToolsStore } from '../stores/tools'
import HomeView from '../views/HomeView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: 'app.catalog' } },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'app.settings' } },
    { path: '/about', name: 'about', component: () => import('../views/AboutView.vue'), meta: { title: 'app.about' } },
    ...tools.map(tool => ({
      path: '/tools/' + tool.id, name: tool.id, component: tool.component,
      meta: { title: 'tools.' + tool.id + '.name', toolId: tool.id },
    })),
    { path: '/:pathMatch(.*)*', name: 'missing', component: () => import('../views/NotFoundView.vue'), meta: { title: 'tool.missing' } },
  ],
})
router.beforeEach(async to => {
  if (typeof to.meta.toolId === 'string') await loadToolLocale(to.meta.toolId, defaultLocale)
})
router.afterEach(to => {
  document.title = i18n.global.t(String(to.meta.title)) + ' · FrontKit'
  if (typeof to.meta.toolId === 'string') useToolsStore().visit(to.meta.toolId)
})
