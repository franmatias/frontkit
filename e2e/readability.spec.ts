
import { expect, test } from '@playwright/test'

test('mide líneas en el navegador y simula espaciado sin modificar el CSS exportado', async ({ page }) => {
  await page.goto('./tools/readability')
  const textarea = page.getByRole('textbox', { name: 'Texto para medir' })
  await textarea.fill('Una frase más larga permite comprobar en cuántas líneas se reparte una muestra de texto.')
  await expect(page.getByTestId('line-average')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Simular el espaciado de WCAG 1.4.12' }).check()
  await expect(page.locator('.sample')).toHaveCSS('letter-spacing', '2.16px')
  await expect(page.locator('pre.code-box')).toContainText('letter-spacing: 0em')
})
