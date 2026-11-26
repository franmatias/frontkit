
import { expect, test } from '@playwright/test'

test('exporta una escala fluida e importa los tamaños en Tokens tras confirmar', async ({ page }) => {
  await page.goto('./tools/type-scale')
  await page.getByRole('checkbox', { name: 'Activar escala fluida' }).check()
  await expect(page.locator('pre.code-box')).toContainText('--base: clamp(')
  await page.getByRole('button', { name: 'Enviar a Tokens' }).click()
  const accept = page.getByRole('button', { name: 'Importar escala tipográfica' })
  await expect(accept).toBeVisible()
  await accept.click()
  await expect(page.locator('pre.code-box')).toContainText('--text-base: clamp(')
  await expect(page.locator('pre.code-box')).toContainText('--text-base--line-height:')
})
