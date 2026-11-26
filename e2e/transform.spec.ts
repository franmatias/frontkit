
import { expect, test } from '@playwright/test'

test('reordena funciones y exporta la secuencia exacta', async ({ page }) => {
  await page.goto('./tools/transform')
  const translate = page.getByRole('spinbutton', { name: 'translateX', exact: true })
  await translate.fill('35')
  await translate.blur()
  await expect(page.locator('pre')).toContainText('translateX(35px) rotate(16deg)')
  await page.getByRole('button', { name: 'Subir rotate', exact: true }).click()
  await expect(page.locator('pre')).toContainText('rotate(16deg) translateX(35px)')
})
