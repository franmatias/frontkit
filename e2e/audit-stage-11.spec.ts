import { expect,test } from '@playwright/test'

test('audits real HTML in a sandbox without running input scripts or requesting remote resources',async({page})=>{
  const requests:string[]=[]
  await page.route('https://example.invalid/**',route=>{requests.push(route.request().url());return route.abort()})
  await page.goto('tools/a11y-audit')
  await page.getByLabel('HTML que se va a auditar').fill('<main><h1>Ejemplo</h1><img id="photo" src="https://example.invalid/photo.png"><input type="text"><script>document.body.textContent="Script ejecutado"</script></main>')
  const css = page.getByRole('textbox', { name: 'CSS opcional' })
  await css.fill('main { padding: 1rem }')
  const toggle = page.getByRole('button', { name: 'CSS opcional', exact: true })
  await toggle.click()
  await expect(css).toBeHidden()
  await toggle.click()
  await expect(css).toHaveValue('main { padding: 1rem }')
  await page.getByRole('button', { name: 'Opciones de auditoría' }).click()
  await page.getByRole('button',{name:'Auditar HTML',exact:true}).click()
  await expect(page.locator('summary').filter({hasText:'image-alt'})).toBeVisible({timeout:17000})
  await expect(page.locator('summary code').getByText('label',{exact:true})).toBeVisible()
  const scene=page.frameLocator('iframe')
  await expect(scene.getByText('Script ejecutado')).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveAttribute('sandbox','allow-scripts')
  expect(requests).toEqual([])
  await page.locator('summary').filter({hasText:'image-alt'}).click()
  await page.getByRole('button',{name:'Resaltar elemento'}).first().click()
  await expect(scene.locator('#photo')).toHaveAttribute('data-frontkit-audit','')
})

test('passes the layout markup by handoff for explicit import',async({page})=>{
  await page.goto('tools/layout')
  await page.getByRole('button',{name:'Auditar HTML',exact:true}).click()
  await expect(page).toHaveURL(/\/tools\/a11y-audit\?handoff=/)
  await page.getByRole('button',{name:'Importar código enviado'}).click()
  await expect(page.getByLabel('HTML que se va a auditar')).toHaveValue(/class=/)
})
