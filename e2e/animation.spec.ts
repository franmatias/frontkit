
import { expect, test } from '@playwright/test'

test('crea fotogramas y exporta pasos con reducción de movimiento', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./tools/animation')
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Añadir fotograma' }).click()
  const frame = page.getByRole('button', { name: 'Fotograma 1 %' })
  await expect(frame).toBeVisible()
  await frame.press('ArrowRight')
  await expect(page.getByRole('button', { name: 'Fotograma 2 %' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Tipo de curva' }).selectOption('steps')
  await expect(page.locator('pre')).toContainText('steps(4, jump-end)')
  await expect(page.locator('pre')).toContainText('prefers-reduced-motion')
})
