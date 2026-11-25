import { expect, test } from '@playwright/test'

test('ejecución, consola y persistencia del playground @smoke', async ({ page }) => {
  await page.goto('./tools/playground')
  await page.getByRole('button', { name: 'JS', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'JS', exact: true })
  await editor.fill('console.log("prueba", 42)')
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
  await expect(page.locator('.console-output')).toContainText('Bucle posiblemente infinito detectado')
})

test('actualiza los tres lenguajes y conserva la vista al reorganizar los paneles', async ({ page }) => {
  await page.goto('./tools/playground')
  const editor = (name: string) => page.getByRole('textbox', { name, exact: true })
  const preview = page.frameLocator('.result iframe')
  await editor('HTML').fill('\n<h2>Inicial</h2>')
  await expect(preview.locator('h2')).toHaveText('Inicial')
  await expect(page.locator('#source-html .numbers > div > div')).toHaveText(['1', '2'])
  await expect(page.locator('#source-html .hljs-name').first()).toHaveText('h2')
  await page.getByRole('button', { name: 'CSS', exact: true }).click()
  await editor('CSS').fill('h2 { color: rgb(10, 20, 30); }')
  await expect(preview.locator('h2')).toHaveCSS('color', 'rgb(10, 20, 30)')
  await page.getByRole('button', { name: 'JS', exact: true }).click()
  await editor('JS').fill("const title = document.querySelector('h2'); title.textContent = 'Actualizado'")
  await expect(preview.locator('h2')).toHaveText('Actualizado')
  await expect(page.locator('#source-js .hljs-keyword').first()).toHaveText('const')
  await preview.locator('h2').evaluate(el => { el.textContent = 'Sesión activa' })
  await page.getByRole('group', { name: 'Disposición' }).getByRole('button', { name: 'Cuadrícula' }).click()
  for (const lang of ['HTML', 'CSS', 'JS']) {
    await page.getByRole('button', { name: 'Plegar ' + lang, exact: true }).click()
    await expect(editor(lang)).toBeHidden()
    await page.getByRole('button', { name: 'Desplegar ' + lang, exact: true }).click()
    await expect(editor(lang)).toBeVisible()
  }
  const options = page.getByRole('group', { name: 'Disposición' }).getByRole('button')
  await expect(options).toHaveCount(6)
  for (const option of await options.all()) {
    await option.click()
    await expect(option).toHaveAttribute('aria-pressed', 'true')
  }
  await page.setViewportSize({width: 390, height: 844})
  await page.getByRole('button', { name: 'CSS', exact: true }).click()
  await expect(editor('CSS')).toBeVisible()
  await expect(editor('HTML')).toBeHidden()
  await expect(preview.locator('h2')).toHaveText('Sesión activa')
})
