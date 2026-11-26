import { expect, it } from 'vitest'
import { i18n, loadLocale, loadToolLocale } from './index'

it('combina traducciones de ruta y usa es-ES como respaldo en una sesión de prueba en inglés', async () => {
  await loadLocale('es-ES')
  await loadToolLocale('tokens', 'es-ES')
  i18n.global.setLocaleMessage('en', {
    app: { updateReady: 'New version available' },
    detail: { tokens: { colors: 'Colors' } },
  })
  const english = { locale: 'en', missingWarn: false, fallbackWarn: false } as const
  expect(i18n.global.t('app.updateReady', {}, english)).toBe('New version available')
  expect(i18n.global.t('detail.tokens.colors', {}, english)).toBe('Colors')
  expect(i18n.global.t('detail.tokens.typography', {}, english)).toBe('Tipografía')
})
