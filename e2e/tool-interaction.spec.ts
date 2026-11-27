import { expect, test } from '@playwright/test'

test('activa y filtra reglas del reset directamente', async ({ page }) => {
  await page.goto('tools/css-reset')
  const margin = page.getByRole('checkbox', {
    name: 'Eliminar márgenes iniciales',
  })
  await expect(margin).toBeVisible()
  await page
    .getByRole('button', { name: 'Desactivar todas', exact: true })
    .click()
  await expect(margin).not.toBeChecked()
  await page.getByRole('searchbox', { name: 'Buscar reglas' }).fill('márgenes')
  await expect(margin).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: 'Controles con la fuente base' }),
  ).toHaveCount(0)
  await margin.check()
  await expect(margin).toBeChecked()
})

test('rellena un ejemplo de consola y recupera el borrador con el teclado', async ({
  page,
}) => {
  await page.goto('tools/playground')
  const command = page.getByRole('textbox', {
    name: 'Escribe JavaScript en la consola',
  })
  const example = "console.log('Hola', 42)"
  await page.getByRole('button', { name: example, exact: true }).click()
  await expect(command).toHaveValue(example)
  await expect(
    page.getByRole('button', { name: 'Evaluar', exact: true }),
  ).toBeEnabled()
  await command.press('Enter')
  await expect(
    page.locator('.console-output').getByText('log Hola 42', { exact: true }),
  ).toBeVisible()
  await command.fill('1+1')
  await command.press('ArrowUp')
  await expect(command).toHaveValue(example)
  await command.press('ArrowDown')
  await expect(command).toHaveValue('1+1')
})

test('evalúa bloques, expresiones con punto y coma y promesas desde la consola', async ({ page }) => {
  await page.goto('tools/playground')
  const input = page.getByRole('textbox', {name:'Escribe JavaScript en la consola'})
  const log=page.locator('.console-output li').last()
  await input.fill('const numeros = [2, 3];')
  await input.press('Shift+Enter')
  await input.press('End')
  await input.pressSequentially('numeros.map(n => n * 2);')
  await input.press('Enter')
  await expect(log).toHaveText('log [4, 6]')
  await input.fill('await Promise.resolve(numeros.length);')
  await input.press('Enter')
  await expect(log).toHaveText('log 2')
  await input.fill('2 + 4;')
  await input.press('Enter')
  await expect(log).toHaveText('log 6')
  await page.getByLabel('Conservar mensajes al editar').check()
  await page.getByRole('button',{name:'JS',exact:true}).click()
  await page.getByRole('textbox',{name:'JS',exact:true}).fill('console.info("actualizado")')
  await expect(log).toHaveText('info actualizado')
  await expect(page.locator('.console-output')).toContainText('log 6')
})
