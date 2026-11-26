import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('catálogo, búsqueda y enlace directo @smoke', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Herramientas para diseñar en la web' })).toBeVisible()
  await page.getByRole('searchbox').fill('maquetacion')
  await expect(page.getByRole('main').getByRole('link', { name: 'Grid y Flexbox' })).toBeVisible()
  const response = await page.goto('./tools/gradient')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Gradientes', exact: true })).toBeVisible()
})

test('guarda cambios en IndexedDB y conserva el estado después de recargar', async ({ page }) => {
  await page.goto('./tools/gradient')
  const angle = page.getByRole('spinbutton', { name: 'Ángulo (°)' })
  await angle.fill('90')
  await angle.blur()
  await expect(page.getByText(/background: linear-gradient\(90deg/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('frontkit')
    request.onsuccess = () => {
      const db = request.result
      const query = db.transaction('toolStates').objectStore('toolStates').get('gradient')
      query.onsuccess = () => { resolve(query.result?.state?.angle); db.close() }
    }
  }))).toBe(90)
  await page.reload()
  await expect(angle).toHaveValue('90')
})

test('enlace compartido en un contexto limpio y fragmento inválido', async ({ browser, page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./tools/gradient')
  const angle = page.getByRole('spinbutton', { name: 'Ángulo (°)' })
  await angle.fill('45')
  await angle.blur()
  await page.getByRole('button', { name: 'Compartir enlace' }).click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  const context = await browser.newContext()
  try {
    const recipient = await context.newPage()
    await recipient.goto(url)
    await expect(recipient.getByRole('spinbutton', { name: 'Ángulo (°)' })).toHaveValue('45')
    await expect(recipient.getByText('Estado cargado desde un enlace')).toBeVisible()
    const invalid = new URL(url)
    invalid.hash = 's=!'
    await recipient.goto(invalid.href)
    await expect(recipient.getByRole('spinbutton', { name: 'Ángulo (°)' })).toHaveValue('135')
  } finally {
    await context.close()
  }
})

for (const id of ['gradient', 'shadow', 'border']) {
  test('accesibilidad de ' + id, async ({ page }) => {
    await page.goto('./tools/' + id)
    await expect(page.getByRole('heading', { name: 'Código generado' })).toBeVisible()
    const result = await new AxeBuilder({ page }).analyze()
    expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([])
  })
  test('distribución adaptable de ' + id, async ({ page }) => {
    await page.goto('./tools/' + id)
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await expect(page.getByRole('heading', { name: 'Vista previa' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
  })
}

for (const id of ['layout', 'palette', 'tokens', 'transform', 'filter', 'animation', 'css-minifier']) {
  test('auditoría de accesibilidad de ' + id, async ({ page }) => {
    await page.goto('./tools/' + id)
    await expect(page.getByRole('heading', { name: 'Código generado' })).toBeVisible()
    const result = await new AxeBuilder({ page }).analyze()
    expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([])
  })
}

test('la segunda ampliación abre sus siete rutas TODO', async ({ page }) => {
  const ids = ['color-converter', 'encoders', 'css-reset', 'transitions', 'container-queries', 'image-optimizer', 'a11y-audit']
  for (const id of ids) {
    await page.goto('./tools/' + id)
    await expect(page.locator('main .page-intro')).toContainText('TODO')
  }
})
