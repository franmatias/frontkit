import { expect,test } from '@playwright/test'
test('keeps HMAC material out of stored state and stops a slow regular expression',async({page})=>{
  await page.goto('tools/encoders')
  await page.getByLabel('Utilidad').selectOption('hash')
  await page.getByLabel('Calcular HMAC').check()
  await page.getByLabel('Clave HMAC').fill('local-fixture-key')
  await page.getByLabel('Texto para hash').fill('local-fixture-message')
  await page.getByRole('button',{name:'Procesar'}).click()
  await expect(page.locator('.result pre')).toHaveText(/^[\da-f]{64}$/)
  const saved=()=>page.evaluate(()=>new Promise<unknown>(resolve=>{
    const req=indexedDB.open('frontkit')
    req.onsuccess=()=>{
      const db=req.result
      const record=db.transaction('toolStates').objectStore('toolStates').get('encoders')
      record.onsuccess=()=>{db.close();resolve(record.result?.state)}
      record.onerror=()=>{db.close();resolve(undefined)}
    }
    req.onerror=()=>resolve(undefined)
  }))
  await expect.poll(saved).toMatchObject({mode:'hash'})
  expect(JSON.stringify(await saved())).not.toMatch(/local-fixture|hmacKey|hashInput/)
  await page.getByLabel('Utilidad').selectOption('regex')
  await page.getByLabel('Patrón').fill('^(a+)+(?=z)$')
  await page.getByLabel('Texto de entrada').fill('a'.repeat(34)+'!')
  await page.getByRole('button',{name:'Procesar'}).click()
  await expect(page.getByRole('alert').filter({hasText:'500 ms'})).toBeVisible()
})
test('resizes the actual container by keyboard',async({page})=>{
  await page.goto('tools/container-queries')
  const shape=page.frameLocator('iframe[title="Demostración CSS"]').locator('.query-card')
  await expect(shape).toHaveCSS('flex-direction','row')
  const handle=page.getByRole('slider',{name:'Ancho de vista previa'})
  await handle.press('Shift+ArrowLeft')
  await expect(handle).toHaveAttribute('aria-valuenow','430')
  await expect(shape).toHaveCSS('flex-direction','column')
})
test('transfers keyframes from Animation after confirmation',async({page})=>{
  await page.goto('tools/animation')
  await page.getByRole('button',{name:'Usar fotogramas en animaciones por scroll'}).click()
  await page.getByRole('button',{name:'Importar fotogramas desde Animaciones'}).click()
  await expect(page.locator('.code-box')).toContainText('@keyframes fade-in-up')
  await expect(page.locator('.code-box')).toContainText('animation-timeline: view()')
})
