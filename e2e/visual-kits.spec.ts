import { expect, test } from '@playwright/test'

test('sincroniza OKLCH y obtiene el color de una imagen reducida con transparencia', async ({ page }) => {
  await page.setViewportSize({ width: 580, height: 850 })
  await page.goto('tools/color-converter')
  const css = page.getByRole('textbox', { name: 'Color CSS', exact: true })
  await css.fill('oklch(50% 0.1 120 / 0.5)')
  const tone = page.getByRole('spinbutton', { name: 'Tono (°)' })
  await expect(tone).toHaveValue('120')
  await tone.fill('180')
  await tone.press('Tab')
  await expect(css).toHaveValue(/180.*0.5/)
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 100
    const context = canvas.getContext('2d')!
    context.fillStyle = 'red'
    context.fillRect(0, 0, 600, 100)
    context.fillStyle = 'rgba(0, 0, 255, 0.5)'
    context.fillRect(600, 0, 600, 100)
    return canvas.toDataURL().split(',')[1]
  })
  await page.getByLabel('Cargar imagen para el cuentagotas').setInputFiles({
    name: 'muestra.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  })
  const target = page.getByRole('button', { name: 'Elegir píxel de la imagen' })
  await expect(target).toBeVisible()
  const box = (await target.boundingBox())!
  expect(box.width).toBeLessThan(1200)
  await target.press('ArrowLeft')
  await target.press('Enter')
  await expect(css).toHaveValue('#ff0000')
  await target.click({ position: { x: box.width * 0.75, y: box.height / 2 } })
  await expect(css).toHaveValue('#0000ff80')
})

test('carga las tres fotografías bitmap y permite seleccionar una muestra ampliada', async ({ page }) => {
  await page.goto('tools/filter')
  for (const sample of ['astronaut', 'galaxies', 'photographer']) {
    await page.getByLabel('Imagen de muestra').selectOption(sample)
    const image = page.locator('img.after')
    await expect(image).toHaveAttribute('src', /\.webp$/)
    await image.evaluate((node: HTMLImageElement) => node.decode())
  }
  await page.goto('tools/palette')
  const swatch = page.locator('.swatches .sample').nth(1)
  await swatch.click()
  await expect(swatch).toHaveAttribute('aria-pressed', 'true')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 850 })
    const geometry = await swatch.evaluate(button => {
      const circle = button.getBoundingClientRect()
      const card = button.parentElement!.getBoundingClientRect()
      return { diameter: circle.width, height: circle.height, visibleWidth: card.width, visibleHeight: card.height }
    })
    expect(geometry.diameter).toBeGreaterThanOrEqual(88)
    expect(geometry.height).toBeCloseTo(geometry.diameter, 0)
    expect(geometry.visibleWidth).toBeGreaterThanOrEqual(geometry.diameter)
    expect(geometry.visibleHeight).toBeGreaterThan(geometry.height)
  }
})

test('optimiza el SVG con los paneles plegados y conserva el código de entrada', async ({ page }) => {
  await page.goto('tools/svg-optimizer')
  const input = page.getByRole('textbox', { name: 'Código SVG' })
  const original = await input.inputValue()
  const toggle = page.getByRole('button', { name: 'Código SVG', exact: true })
  await toggle.click()
  await expect(input).toBeHidden()
  await page.getByRole('button', { name: 'Opciones de optimización', exact: true }).click()
  await page.getByRole('button', { name: 'Optimizar SVG', exact: true }).click()
  await expect(page.getByAltText('SVG optimizado')).toBeVisible()
  await toggle.click()
  await expect(input).toHaveValue(original)
})

test('edita la descripción del ejemplo y la refleja en las tarjetas y el HTML', async ({ page }) => {
  await page.goto('tools/meta-tags')
  await page.getByRole('button', { name: 'Cargar ejemplo de artículo' }).click()
  const field = page.getByRole('textbox', { name: 'Descripción', exact: true })
  await expect(field).toHaveValue(/contraste/)
  await field.fill('Guía de "colores" & contraste.')
  await expect(page.locator('.social article').getByText('Guía de "colores" & contraste.', { exact: true }).first()).toBeVisible()
  const output = page.locator('.code-box')
  for (const key of ['description', 'og:description', 'twitter:description']) {
    await expect(output).toContainText(key + '" content="Guía de &quot;colores&quot; &amp; contraste.')
  }
  await field.fill('')
  await expect(output).not.toContainText('og:description')
})
