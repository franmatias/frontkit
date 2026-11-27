import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('limpia HTML, convierte formatos y aísla la vista previa @smoke', async ({
  page,
}) => {
  let remoteRequests = 0
  await page.route('https://media.example.invalid/**', (route) => {
    remoteRequests += 1
    return route.fulfill({ body: '', contentType: 'image/png' })
  })
  await page.goto('tools/html-cleaner')
  await page
    .getByRole('textbox', { name: 'HTML original' })
    .fill(
      '<article><h1>Guía de clase</h1><p><b>Ejemplo</b> con <a href="/curso?utm_source=docencia">enlace</a>.</p><img src="https://media.example.invalid/cover.png" alt="Portada"><script>document.title="Prueba"</script></article>',
    )
  const output = page.locator('.cleaner .code-box')
  await expect(output).toContainText('<h1>Guía de clase</h1>')
  await expect(output).not.toContainText('<script')
  await expect(output).not.toContainText('utm_source')
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await expect(output).toContainText('# Guía de clase')
  await expect(output).toContainText('[enlace](/curso)')
  await page.getByRole('button', { name: 'Texto plano', exact: true }).click()
  await expect(output).toContainText('Ejemplo con enlace')
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
  const preview = page.frameLocator('iframe[title="Vista previa"]')
  await expect(
    preview.getByRole('heading', { name: 'Guía de clase' }),
  ).toBeVisible()
  await expect(page.locator('iframe[title="Vista previa"]')).toHaveAttribute(
    'sandbox',
    '',
  )
  expect(remoteRequests).toBe(0)
  await page
    .getByRole('checkbox', {
      name: 'Cargar imágenes remotas en la vista previa',
    })
    .check()
  await expect.poll(() => remoteRequests).toBe(1)
})

test('solo descarga al confirmar y resuelve enlaces relativos', async ({
  page,
}) => {
  let requests = 0
  await page.route('https://article.example.invalid/**', async (route) => {
    requests += 1
    expect(route.request().headers()['cookie']).toBeUndefined()
    await route.fulfill({
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
      },
      body: '<html><head><title>Entrada de ejemplo</title></head><body><nav>Menú viejuno</nav><article><h1>Artículo recuperado</h1><p><a href="./guia?utm_medium=feed">Guía</a></p></article></body></html>',
    })
  })
  await page.goto('tools/html-cleaner')
  await page
    .getByRole('checkbox', { name: 'Extraer el contenido principal' })
    .check()
  await page
    .getByRole('textbox', { name: 'URL del documento' })
    .fill('https://article.example.invalid/post/index.html')
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Extraer HTML', exact: true }).click()
  const output = page.locator('.cleaner .code-box')
  await expect(output).toContainText('Artículo recuperado')
  await expect(output).toContainText(
    'https://article.example.invalid/post/guia',
  )
  await expect(output).not.toContainText('Menú viejuno')
  expect(requests).toBe(1)
})

test('usa el proxy configurado por el usuario y permite enviar la tabla al constructor', async ({
  page,
}) => {
  const address = 'https://blog.example.invalid/entrada?tema=html'
  await page.route('https://proxy.example.invalid/**', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('url')).toBe(address)
    await route.fulfill({
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
      },
      body: '<table><tr><th>Asignatura</th></tr><tr><td>Lenguajes de marcas</td></tr></table>',
    })
  })
  await page.goto('tools/html-cleaner')
  await page.getByRole('textbox', { name: 'URL del documento' }).fill(address)
  await page.getByLabel('Conexión para extraer HTML').selectOption('custom')
  await page
    .getByRole('textbox', { name: 'Proxy HTTPS propio (opcional)' })
    .fill('https://proxy.example.invalid/html')
  await page.getByRole('button', { name: 'Extraer HTML', exact: true }).click()
  await expect(page.locator('.cleaner .code-box')).toContainText(
    'Lenguajes de marcas',
  )
  await page.getByRole('button', { name: 'Importar tabla' }).click()
  await expect(page).toHaveURL(/table-builder/)
  await page.getByRole('button', { name: 'Importar 1 filas' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Fila 1, Asignatura' }),
  ).toHaveValue('Lenguajes de marcas')
})

test('lee archivos Windows-1252 y descarga el Markdown con el nombre original', async ({
  page,
}) => {
  await page.goto('tools/html-cleaner')
  await page.locator('input[type=file]').setInputFiles({
    name: 'clase.html',
    mimeType: 'text/html',
    buffer: Buffer.from(
      '<meta charset="windows-1252"><h1>Guía de clase</h1>',
      'latin1',
    ),
  })
  const output = page.locator('.cleaner .code-box')
  await expect(output).toContainText('Guía de clase')
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  expect((await pending).suggestedFilename()).toBe('clase.md')
})

test('el preajuste mínimo permite revisar HTML saneado antes de convertir', async ({
  page,
}) => {
  await page.goto('tools/html-cleaner')
  await page
    .getByRole('combobox', { name: 'Preajuste' })
    .selectOption('minimal')
  await page
    .getByRole('textbox', { name: 'HTML original' })
    .fill('<p>Prueba <b>en negrita</b></p>')
  await expect(page.locator('.cleaner .code-box')).toContainText(
    '<b>en negrita</b>',
  )
  await expect(
    page.locator('.cleaner .code-box .hljs-tag').first(),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Markdown', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Detener tras la fase' })
    .selectOption('serialize')
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await expect(page.locator('.cleaner .code-box')).toContainText(
    '**en negrita**',
  )
})

test('muestra el error de CORS en la pestaña de entrada móvil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('https://blocked.example.invalid/**', (route) =>
    route.abort(),
  )
  await page.goto('tools/html-cleaner')
  await page
    .getByRole('textbox', { name: 'URL del documento' })
    .fill('https://blocked.example.invalid/entrada')
  await page.getByRole('button', { name: 'Extraer HTML', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('autoriza CORS')
  await page.getByRole('button', { name: 'Cargar ejemplo' }).click()
  await page.getByRole('button', { name: 'Salida', exact: true }).click()
  await expect(page.locator('.cleaner .code-box')).toContainText(
    'Cuaderno de FrontKit',
  )
})

test('solo recuerda el HTML con permiso explícito y lo borra al revocarlo', async ({
  page,
}) => {
  const html = '<p>Este documento es privado.</p>'
  const input = page.getByRole('textbox', { name: 'HTML original' })
  const flag = page.getByRole('checkbox', {
    name: 'Recordar también el HTML del limpiador en este navegador',
  })
  const saved = () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('frontkit')
        request.onsuccess = () => resolve(request.result)
      })
      return new Promise<string | undefined>((resolve) => {
        const request = db
          .transaction('kv')
          .objectStore('kv')
          .get('html-cleaner:input')
        request.onsuccess = () => {
          db.close()
          resolve(request.result?.state)
        }
      })
    })
  await page.goto('tools/html-cleaner')
  await input.fill(html)
  await expect(page.locator('.cleaner .code-box')).toContainText(
    'Este documento es privado',
  )
  expect(await saved()).toBeUndefined()
  await page.goto('settings')
  await flag.check()
  // Navigate inside the SPA to retain the pending settings transaction.
  await page.getByRole('link',{name:'Catálogo',exact:true}).first().click()
  await page.getByRole('link',{name:/Limpiador y conversor HTML/i}).first().click()

  await input.fill(html)
  await expect.poll(saved).toBe(html)
  await page.reload()
  await expect(input).toHaveValue(html)
  await page.goto('settings')
  await flag.uncheck()
  await expect.poll(saved).toBeUndefined()
})

test('convierte código fuente copiado con resaltado y descarga ambos formatos', async ({ page }) => {
  await page.goto('tools/html-cleaner')
  const source = '<article><h1>Revista</h1><p>Una <strong>prueba</strong>.</p></article>'
  await page.getByRole('textbox', {name:'HTML original'}).evaluate((field, html) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', html)
    clipboardData.setData('text/html', '<pre><span>' + html.replaceAll('<','&lt;') + '</span></pre>')
    field.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles:true, cancelable:true}))
  }, source)
  for (const [name, expected, ext] of [['Markdown','# Revista\n\nUna **prueba**.','md'],['Texto plano','Revista\n\nUna prueba.','txt']] as const) {
    await page.getByRole('button',{name,exact:true}).click()
    await expect(page.locator('.clean-output .code-box')).toHaveText(expected)
    const pending = page.waitForEvent('download')
    await page.getByRole('button',{name:'Descargar',exact:true}).click()
    const download = await pending
    expect(download.suggestedFilename()).toMatch(new RegExp('\\.'+ext+'$'))
    expect(await readFile((await download.path())!,'utf8')).toBe(expected)
  }
})

test('reintenta por Jina, conserva el título del artículo y recupera paneles y ajustes', async ({ page }) => {
  const url='https://public.example.invalid/post?ref=clase&x=2'
  await page.route('https://public.example.invalid/**',route=>route.abort())
  await page.route('https://r.jina.ai/**',route=>{
    expect(route.request().url()).toBe('https://r.jina.ai/'+url)
    expect(route.request().headers()['x-respond-with']).toBe('html')
    return route.fulfill({contentType:'text/plain',body:'<!doctype html><main><article><header><h1>Revista</h1></header><p>Artículo de prueba.</p></article><aside>Suscripción</aside></main>'})
  })
  await page.goto('tools/html-cleaner')
  await page.getByRole('textbox',{name:'URL del documento'}).fill(url)
  await page.getByRole('button',{name:'Extraer HTML',exact:true}).click()
  await page.getByRole('button',{name:/Enviar la URL a Jina/}).click()
  await page.getByRole('button',{name:'Markdown',exact:true}).click()
  await expect(page.locator('.clean-output .code-box')).toHaveText('# Revista\n\nArtículo de prueba.')
  const nav=page.locator('.desktop-panels')
  await nav.getByRole('button',{name:'Entrada'}).click()
  await nav.getByRole('button',{name:'Opciones'}).click()
  await expect(page.locator('#clean-input')).toBeHidden()
  await expect(page.locator('#clean-options')).toBeHidden()
  await expect(page.locator('#clean-output')).toBeVisible()
  await nav.getByRole('button',{name:'Opciones'}).click()
  await page.getByRole('button',{name:'Restablecer ajustes por defecto'}).click()
  await nav.getByRole('button',{name:'Entrada'}).click()
  await expect(page.getByLabel('Conexión para extraer HTML')).toHaveValue('direct')
  await expect(page.getByRole('textbox',{name:'HTML original',exact:true})).toHaveValue(/Artículo de prueba/)
  await expect(page.getByRole('button',{name:'HTML',exact:true})).toHaveAttribute('aria-pressed','true')
})
