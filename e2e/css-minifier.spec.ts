
import { expect, test } from '@playwright/test'

test('minifica en un worker y permite saltar a un error', async ({ page }) => {
  await page.goto('./tools/css-minifier')
  const input = page.getByRole('textbox', { name: 'CSS de entrada' })
  await input.fill('.card { color: red; }')
  await expect(page.locator('pre')).toContainText('.card{color:red}')
  await input.fill('.card { color: red;')
  const error = page.getByRole('button', { name: /Ir a línea y columna/ })
  await expect(error).toBeVisible()
  await error.click()
  await expect(input).toBeFocused()
})

test('devuelve CSS grande sin crear un nodo por cada token', async ({ page }) => {
  await page.goto('./tools/css-minifier')
  await page.locator('input[type=file]').setInputFiles({
    name: 'volumen.css', mimeType: 'text/css', buffer: Buffer.from('.sample { color: red; }\n'.repeat(6000)),
  })
  await expect.poll(() => page.locator('pre code').evaluate(el => el.textContent?.length ?? 0)).toBeGreaterThan(100000)
  await expect(page.locator('pre code span')).toHaveCount(1)
})
