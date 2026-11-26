import { expect, test } from '@playwright/test'
import { wcagContrast } from '../src/lib/color'

test('opens settings from the header on mobile and saves usable appearance and editor preferences', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 })
  await page.goto('./')
  const settings = page.locator('header .header-actions').getByRole('link', { name: 'Configuración', exact: true })
  await expect(settings).toBeVisible()
  await settings.click()
  await expect(page.getByRole('heading', { name: 'Apariencia', exact: true })).toBeVisible()
  const root = page.locator('html')
  await page.locator('.appearance-card').filter({ hasText: 'Oscuro' }).click()
  await expect(root).toHaveClass(/dark/)
  await page.locator('.accent-option').filter({ hasText: 'Océano' }).click()
  await expect(root).toHaveAttribute('data-accent', 'ocean')
  await expect(page.locator('.settings-shortcut')).toHaveCSS('color', 'rgb(157, 219, 245)')
  await page.getByRole('combobox', { name: 'Densidad de la interfaz' }).selectOption('compact')
  await expect(root).toHaveAttribute('data-density', 'compact')
  await expect(page.locator('header.top')).toHaveCSS('padding-top', '7.2px')
  await page.getByRole('checkbox', { name: 'Reducir las animaciones de la interfaz' }).check()
  await expect(root).toHaveClass(/reduce-interface-motion/)
  await page.getByRole('checkbox', { name: 'Mostrar números de línea' }).uncheck()
  await page.getByRole('combobox', { name: 'Fuente del editor' }).selectOption('courier')
  await page.reload()
  await expect(root).toHaveClass(/dark/)
  await expect(root).toHaveAttribute('data-accent', 'ocean')
  await expect(root).toHaveAttribute('data-density', 'compact')
  await expect(page.getByRole('checkbox', { name: 'Mostrar números de línea' })).not.toBeChecked()
  await page.goto('tools/playground')
  await expect(page.locator('#source-html .numbers')).toBeHidden()
  await expect(page.locator('#source-html .layers')).toBeVisible()
  await expect(page.locator('#source-html')).toHaveCSS('font-family', /Courier New/)
})

test('applies every syntax theme with readable colours in the Playground', async ({ page }) => {
  await page.goto('settings')
  const selector = page.getByRole('combobox', { name: 'Tema de resaltado de sintaxis' })
  await expect(selector.locator('option')).toHaveCount(10)
  const variants = await selector.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))
  const backgrounds = new Set<string>()
  for (const theme of variants) {
    await selector.selectOption(theme)
    const sample = page.locator('.code-theme-sample')
    await expect(sample).toHaveAttribute('data-code-theme', theme)
    const style = await sample.evaluate(element => {
      const css = getComputedStyle(element)
      const token = (className: string) => getComputedStyle(element.querySelector('.hljs-' + className)!).color
      return { background: css.backgroundColor, text: css.color, colors: ['keyword', 'string', 'number', 'title'].map(token) }
    })
    backgrounds.add(style.background)
    for (const color of [style.text, ...style.colors]) expect(wcagContrast(color, style.background)).toBeGreaterThanOrEqual(4.5)
    await page.goto('tools/playground')
    await expect(page.locator('.studio')).toHaveAttribute('data-code-theme', theme)
    await expect(page.locator('#source-html')).toHaveCSS('background-color', style.background)
    await expect(page.locator('#source-html .hljs-name').first()).toHaveCSS('color', style.colors[0]!)
    await page.goto('settings')
  }
  expect(backgrounds.size).toBe(10)
})

test('applies palette samples to a UI scene and previews light, dark and simulated colour', async ({ page }) => {
  await page.goto('tools/palette')
  const swatches = page.locator('.swatch')
  const activeColor = (await swatches.nth(1).locator('code').textContent())!
  await swatches.nth(1).locator('.sample').click()
  const scene = page.locator('.interface-scene')
  const action = page.locator('.interface-action')
  await expect(scene).toHaveCSS('--main-color', activeColor)
  const supportName = (await swatches.nth(3).locator('strong').textContent())!
  const supportColor = (await swatches.nth(3).locator('code').textContent())!
  await page.getByRole('combobox', { name: 'Secundario' }).selectOption({ label: supportName })
  await expect(scene).toHaveCSS('--secondary-color', supportColor)
  await page.getByRole('group', { name: 'Tema de la vista de paleta' }).getByRole('button', { name: 'Oscuro' }).click()
  await expect(scene).toHaveAttribute('data-mode', 'dark')
  await page.getByRole('combobox', { name: 'Simular percepción del color' }).selectOption('achromatopsia')
  const rendered = await action.evaluate(element => {
    const css = getComputedStyle(element)
    return { color: css.color, background: css.backgroundColor }
  })
  const channels = rendered.background.match(/\d+/g)
  expect(new Set(channels).size).toBe(1)
  expect(wcagContrast(rendered.color, rendered.background)).toBeGreaterThanOrEqual(4.5)
  await expect(page.getByText(/Contraste de la acción/)).toBeVisible()
  await page.setViewportSize({ width: 390, height: 840 })
  await expect.poll(() => scene.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThan(2)
})
