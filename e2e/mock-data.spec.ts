
import { expect, test } from '@playwright/test'

test('genera datos reproducibles en un worker y prepara el envío a tablas', async ({ page }) => {
  await page.goto('./tools/mock-data')
  const generate = page.getByRole('button', { name: 'Generar datos', exact: true })
  await generate.click()
  const output = page.locator('pre.code-box')
  await expect(output).toContainText('@example.test')
  const previous = await output.textContent()
  await generate.click()
  await expect(output).toHaveText(previous!)
  await page.getByRole('button', { name: 'Enviar al constructor de tablas' }).click()
  await expect(page.getByText('Se ha preparado un esquema con 10 filas para el constructor de tablas.')).toBeVisible()
  await page.getByRole('button', { name: 'Preparar filas enviadas', exact: true }).click()
  await page.getByRole('button', { name: 'Importar 10 filas', exact: true }).click()
  const imported = page.frameLocator('iframe[title="Tabla HTML generada"]')
  await expect(imported.locator('tbody tr')).toHaveCount(10)
  await expect(imported.locator('tbody')).toContainText('@example.test')
})
