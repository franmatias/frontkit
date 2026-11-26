
import { expect, test } from '@playwright/test'

test('el catálogo y una ruta directa funcionan sin conexión después de instalar la caché', async ({ page, context }) => {
  await page.goto('./')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 20000 }).toBe(true)
  await context.setOffline(true)
  await page.goto('./tools/tokens')
  await expect(page.getByRole('heading', { name: 'Tokens de diseño', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Oscuro', exact: true })).toBeVisible()
})
