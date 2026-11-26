import { expect, test } from '@playwright/test'

test('genera relleno y limpia invisibles del texto pegado', async ({ page }) => {
  await page.goto('./tools/lorem')
  await page.getByRole('textbox', { name: 'Pega texto o HTML' }).fill('hola\u200bmundo')
  await expect(page.getByText(/Invisibles detectados 1/)).toBeVisible()
  await expect(page.locator('.clean-result').first()).toHaveText('holamundo')
  await page.getByRole('button', { name: 'Tailwind', exact: true }).click()
  await expect(page.locator('pre.code-box')).toContainText('line-clamp-2')
})
