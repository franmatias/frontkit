import { expect, test } from '@playwright/test'

test('reviews CSS before output and preserves the cascade in native nesting @smoke', async ({ page, context }) => {
  await page.goto('tools/css-converter')
  const original = '.card{color:red}.card .title{color:green}.title.special{color:blue}.card .title{color:purple}'
  await page.getByLabel('CSS de entrada').fill(original)
  await page.getByRole('button', { name: 'Analizar CSS' }).click()
  await expect(page.getByRole('heading', { name: 'Informe de conversión' })).toBeVisible()
  const code = page.locator('.code-box')
  await expect(code).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirmar y mostrar código' }).click()
  await expect(code).toContainText('& .title')
  const converted = await code.textContent() ?? ''
  const result = await context.newPage()
  async function colors(css: string) {
    await result.setContent('<style>' + css + '</style><div class="card"><p class="title special">A</p><p class="title">B</p></div>')
    return result.locator('.title').evaluateAll(items => items.map(item => getComputedStyle(item).color))
  }
  expect(await colors(converted)).toEqual(await colors(original))
  await result.close()
})

test('confirms the BEM mapping and rewrites unambiguous CSS in a worker', async ({ page }) => {
  await page.goto('tools/bem')
  await page.getByLabel('CSS opcional').fill('.title{color:blue}.card .title{color:red}')
  await page.getByRole('button', { name: 'Analizar HTML' }).click()
  await expect(page.getByRole('heading', { name: 'Revisar propuestas BEM' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar y generar HTML' }).click()
  await expect(page.locator('.code-box')).toContainText('card__title')
  await page.getByRole('button', { name: 'CSS reescrito' }).click()
  await expect(page.locator('.code-box')).toContainText('.card__title{color:blue}')
  await expect(page.getByText(/Selectores complejos pendientes/)).toContainText('.card .title')
})

test('activates the SMACSS catalog entry and exports a reviewed classification', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('searchbox').fill('SMACSS')
  await page.getByRole('main').getByRole('link', { name: /SMACSS/i }).click()
  await page.getByRole('button', { name: 'Clasificar reglas' }).click()
  await page.getByLabel('Categoría para .wrapper', { exact: true }).selectOption('module')
  await page.getByRole('button', { name: 'Confirmar y generar CSS' }).click()
  await expect(page.locator('.code-box')).toContainText('@layer base, layout, module, state, theme')
  await expect(page.locator('.code-box')).toContainText('@layer module')
})

test('matches real sticky bounds and stacking context paint order @smoke', async ({ page }) => {
  await page.goto('tools/stacking')
  const frame = page.frameLocator('iframe[title="Vista previa del escenario"]')
  const viewport = frame.locator('#viewport')
  async function front() {
    return viewport.evaluate(node => node.ownerDocument.elementFromPoint(105, 67)?.closest('[data-box]')?.getAttribute('data-box'))
  }
  await expect.poll(front).toBe('cover')
  await page.getByRole('button', { name: 'Aplicar corrección sugerida' }).click()
  await expect.poll(front).toBe('floating')

  const chooser = page.getByRole('combobox', { name: 'Escenario', exact: true })
  await chooser.selectOption('stack-container')
  await expect.poll(front).toBe('floating')
  await chooser.selectOption('sticky-hidden')
  await expect(page.getByText('Contenedor captura el desplazamiento de sticky por su overflow.')).toBeVisible()
  async function pinTop() {
    await viewport.evaluate(node => { node.scrollTop = 130 })
    return frame.locator('[data-box="pin"]').evaluate(node => node.getBoundingClientRect().top)
  }
  await expect.poll(pinTop).toBeLessThan(-40)
  await page.getByRole('button', { name: 'Aplicar corrección sugerida' }).click()
  await expect.poll(pinTop).toBeGreaterThanOrEqual(0)
})
