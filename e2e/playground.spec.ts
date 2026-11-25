import { expect, test } from '@playwright/test'

test('ejecución, consola y persistencia del playground @smoke', async ({ page }) => {
  await page.goto('./tools/playground')
  await page.getByRole('button', { name: 'JS', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'JS', exact: true })
  await editor.fill('console.log("prueba", 42)')
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click()
  await expect(page.locator('.console-output').getByText('prueba 42', { exact: false })).toBeVisible()
  await page.keyboard.press('Control+s')
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('frontkit')
      request.onsuccess = () => resolve(request.result)
    })
    return new Promise<boolean>(resolve => {
      const query = db.transaction('projects').objectStore('projects').getAll()
      query.onsuccess = () => { db.close(); resolve(query.result.some(record => record.state.js.includes('prueba'))) }
    })
  })).toBe(true)
  await page.reload()
  await page.getByRole('button', { name: 'JS', exact: true }).click()
  await expect(editor).toHaveValue('console.log("prueba", 42)')
})
test('detiene un bucle y recupera la vista previa', async ({ page }) => {
  await page.goto('./tools/playground')
  await page.getByRole('button', { name: 'JS', exact: true }).click()
  await page.getByRole('textbox', { name: 'JS', exact: true }).fill('while (true) {}')
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click()
  await expect(page.locator('.console-output')).toContainText('Bucle posiblemente infinito detectado')
})
