
import { expect, test } from '@playwright/test'

test('propone reparación, conserva la precisión y compara JSON en un worker', async ({ page }) => {
  await page.goto('./tools/json')
  const source = page.getByRole('textbox', { name: 'JSON de entrada', exact: true })
  await source.fill("{id:9007199254740999, nombre:'Ana',}")
  const apply = page.getByRole('button', { name: 'Aplicar reparación' })
  await expect(apply).toBeVisible()
  await expect(source).toHaveValue("{id:9007199254740999, nombre:'Ana',}")
  await apply.click()
  await expect(page.locator('pre.code-box')).toContainText('9007199254740999')
  await page.getByRole('combobox', { name: 'Modo de JSON' }).selectOption('diff')
  await page.getByRole('textbox', { name: 'JSON modificado' }).fill('{"id":9007199254740998,"nombre":"Ana"}')
  await expect(page.locator('pre.code-box')).toContainText('"path":"/id","value":9007199254740998')
})

test('el ajuste de privacidad elimina el JSON recordado', async ({ page }) => {
  await page.goto('./tools/json')
  const source = page.getByRole('textbox', { name: 'JSON de entrada', exact: true })
  const input = '{"muestra":"temporal"}'
  await source.fill(input)
  await expect(page.locator('pre.code-box')).toContainText('temporal')
  await expect.poll(() => page.evaluate(() => new Promise<unknown>(resolve => {
    const open = indexedDB.open('frontkit')
    open.onsuccess = () => {
      const db = open.result
      const query = db.transaction('kv').objectStore('kv').get('json:input')
      query.onsuccess = () => { resolve(query.result?.state?.left); db.close() }
    }
  }))).toBe(input)
  await page.reload()
  await expect(source).toHaveValue(input)
  await page.goto('./settings')
  await page.getByRole('checkbox', { name: 'Recordar el contenido de entrada' }).uncheck()
  await expect.poll(() => page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('frontkit')
    open.onsuccess = () => {
      const db = open.result
      const store = db.transaction('kv').objectStore('kv')
      const setting = store.get('settings')
      const input = store.get('json:input')
      input.onsuccess = () => {
        resolve(setting.result?.state?.preferences?.rememberInput === false && !input.result)
        db.close()
      }
    }
  }))).toBe(true)
  await page.goto('./tools/json')
  await expect(source).toHaveValue('')
})
