import { createI18n } from 'vue-i18n'

export const defaultLocale = 'es-ES'
export const availableLocales = [defaultLocale] as const

interface Messages { [key: string]: string | Messages }
const common = import.meta.glob<{ default: Messages }>('./locales/*/common.json')
const toolMessages = import.meta.glob<{ default: Messages }>('../tools/*/locales/*.json')
const loaded = new Set<string>()

export const i18n = createI18n({ legacy: false, locale: defaultLocale, fallbackLocale: defaultLocale })

export async function loadLocale(locale: string) {
  const loader = common['./locales/' + locale + '/common.json']
  if (!loader) throw new Error('Unknown locale')
  if (!loaded.has(locale)) {
    i18n.global.setLocaleMessage(locale, (await loader()).default)
    loaded.add(locale)
  }
}

export async function loadToolLocale(id: string, locale: string) {
  const loader = toolMessages['../tools/' + id + '/locales/' + locale + '.json']
  if (loader) i18n.global.mergeLocaleMessage(locale, { detail: { [id]: (await loader()).default } })
}
