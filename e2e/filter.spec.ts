
import { expect, test } from '@playwright/test'

test('compara ambos lados y exporta solo el filtro activo', async ({ page }) => {
  await page.goto('./tools/filter')
  const blur = page.getByRole('spinbutton', {name:'Desenfoque (px)'})
  await blur.fill('12')
  await blur.blur()
  await expect(page.locator('pre')).toContainText('filter: blur(12px);')
  const slider = page.getByRole('slider', {name:'Divisor antes y después'})
  await slider.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', '51')
  await page.getByRole('combobox', {name:'Aplicar a'}).selectOption('backdrop-filter')
  await expect(page.locator('pre')).toContainText('backdrop-filter: blur(12px);')
})
