import { expect,test } from '@playwright/test'

test('uses local font fallbacks until consent and lets the user revoke it',async({page})=>{
  const requests:string[]=[]
  await page.route('https://fonts.googleapis.com/**',route=>{ requests.push(route.request().url()); return route.fulfill({contentType:'text/css',body:''}) })
  await page.goto('tools/font-pairing')
  await expect(page.getByText('Vista con fuentes del sistema')).toBeVisible()
  await page.getByLabel('Peso titular').selectOption('800')
  expect(requests).toEqual([])
  await page.getByRole('button',{name:'Permitir Google Fonts',exact:true}).click()
  await expect.poll(()=>requests.length).toBe(1)
  expect(new URL(requests[0]!).searchParams.getAll('family')).toContain('Playfair Display:wght@800')
  await page.goto('settings')
  await page.getByLabel('Permitir Google Fonts en las vistas previas').uncheck()
  await page.goto('tools/font-pairing')
  await expect(page.getByText('Vista con fuentes del sistema')).toBeVisible()
  await expect(page.locator('head link[href*="fonts.googleapis.com"]')).toHaveCount(0)
})

test('edits a blob by keyboard and transfers its morph to Animations',async({page})=>{
  await page.goto('tools/blob')
  await page.getByRole('slider',{name:'Radio horizontal superior izquierda',exact:true}).press('ArrowRight')
  await expect(page.getByRole('slider',{name:'Radio horizontal superior izquierda',exact:true})).toHaveAttribute('aria-valuenow','71')
  await page.getByRole('button',{name:'Enviar a Animaciones CSS',exact:true}).click()
  await expect(page).toHaveURL(/tools\/animation\?handoff=/)
  await page.getByRole('button',{name:'Importar morph de forma orgánica'}).click()
  await expect(page.locator('.code-box').first()).toContainText('border-radius: 71% 30% 62% 38%')
})

test('inserts a clip-path vertex and opens an SVG pattern preview',async({page})=>{
  await page.goto('tools/clip-path')
  await page.getByLabel('Plantilla').selectOption('Triángulo')
  const shape=page.getByRole('group',{name:'Lienzo de recorte',exact:true})
  const rect=await shape.boundingBox()
  await shape.click({position:{x:rect!.width/2, y:rect!.height-3}})
  await expect(shape.getByRole('slider')).toHaveCount(4)
  await page.goto('tools/backgrounds')
  await page.getByLabel('Modo').selectOption('pattern')
  await page.getByRole('combobox',{name:/^Patr/}).selectOption('waves')
  await expect(page.locator('.surface')).toHaveCSS('background-image',/data:image\/svg\+xml/)
})
