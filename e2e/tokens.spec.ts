
import { expect, test } from '@playwright/test'

test('importa la paleta con confirmación y exporta ambos temas', async ({ page }) => {
  await page.goto('./tools/palette')
  await page.getByRole('button', { name: 'Enviar a Tokens' }).click()
  const accept = page.getByRole('button', { name: 'Importar desde Paleta' })
  await expect(accept).toBeVisible()
  await accept.click()
  await expect(page.getByRole('combobox', { name: 'Token de color' }).locator('option')).toHaveCount(17)
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Oscuro', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'CSS', exact: true }).click()
  await expect(page.locator('pre')).toContainText("[data-theme='dark']")
  await expect(page.locator('pre')).toContainText('--color-color-1')
})
