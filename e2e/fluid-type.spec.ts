
import { expect, test } from '@playwright/test'

test('reproduce el ejemplo de clamp y actualiza la curva al cambiar el viewport', async ({ page }) => {
  await page.goto('./tools/fluid-type')
  await expect(page.locator('pre.code-box')).toContainText('clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)')
  await expect(page.getByText('20 px', {exact:true})).toBeVisible()
  const width = page.getByRole('spinbutton', { name: 'Simulación del ancho de pantalla (px)' })
  await width.fill('1280')
  await width.blur()
  await expect(page.getByText('24 px', {exact:true})).toBeVisible()
})
