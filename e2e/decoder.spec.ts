
import { expect, test } from '@playwright/test'

test('edita parámetros repetidos, analiza JWT y borra la entrada al recargar', async ({ page }) => {
  await page.goto('./tools/decoder')
  const token = page.getByRole('textbox', { name: 'Token JWT' })
  const data = Buffer.from(JSON.stringify({ exp: 10, sub: 'identificador solo en memoria' })).toString('base64url')
  await token.fill('eyJhbGciOiJub25lIn0.' + data + '.')
  await expect(page.getByText('Caducado', { exact: false })).toBeVisible()
  await expect(page.getByText('identificador solo en memoria', { exact: false })).toBeVisible()
  await page.reload()
  await expect(token).toHaveValue('')
  await page.getByRole('button', { name: 'URL', exact: true }).click()
  await page.getByRole('textbox', { name: 'URL completa' }).fill('https://example.test/?x=uno&x=dos#local')
  await expect(page.getByText('Repetido', { exact: true })).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Valor 2', exact: true }).fill('café')
  await expect(page.locator('pre')).toContainText('x=uno&x=caf%C3%A9#local')
})
