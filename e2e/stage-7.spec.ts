import { expect,test } from '@playwright/test'
import { unzipSync } from 'fflate'
import { readFile } from 'node:fs/promises'

test('optimises SVG safely and exports a typed component',async({page})=>{
  await page.goto('tools/svg-optimizer')
  const source=page.getByLabel('Código SVG')
  const original=await source.inputValue()
  await source.fill(original.replace('<circle','<script>document.title="entrada"</script><image href="https://example.invalid/pixel.svg"/><circle onload="document.title=1"'))
  await page.getByRole('button',{name:'Optimizar SVG',exact:true}).click()
  await expect(page.getByAltText('SVG optimizado')).toBeVisible()
  const output=page.locator('.code-box')
  await expect(output).toContainText('viewBox="0 0 120 120"')
  await expect(output).not.toContainText(/onload|example.invalid|<script>/)
  await page.getByRole('button',{name:'React TSX',exact:true}).click()
  await expect(output).toContainText('SVGProps<SVGSVGElement>')
})

test('builds a local sprite with a standalone catalogue and TypeScript names',async({page})=>{
  await page.goto('tools/svg-sprite')
  await page.getByRole('button',{name:'Generar sprite',exact:true}).click()
  await expect(page.frameLocator('iframe').getByText('brujula',{exact:true})).toBeVisible()
  await page.getByLabel('Buscar iconos').fill('hoja')
  await expect(page.frameLocator('iframe').getByText('brujula',{exact:true})).toHaveCount(0)
  await expect(page.frameLocator('iframe').getByText('hoja',{exact:true})).toBeVisible()
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:'Descargar sprite ZIP',exact:true}).click()
  const files=unzipSync(await readFile(await (await download).path()))
  expect(Buffer.from(files['sprite.svg']!).toString()).toContain('<symbol id="hoja"')
  expect(Buffer.from(files['icons.d.ts']!).toString()).toContain('"brujula" | "hoja"')
  expect(Buffer.from(files['catalog.html']!).toString()).toContain('<use href="#hoja"')
})

test('generates a real icon pack including 180 and 512 pixel PNGs',async({page})=>{
  await page.goto('tools/favicon')
  await page.getByRole('button',{name:'Usar SVG de ejemplo',exact:true}).click()
  await page.getByRole('button',{name:'Generar favicons',exact:true}).click()
  const zip=page.getByRole('button',{name:'Descargar paquete ZIP',exact:true})
  await expect(zip).toBeVisible({timeout:12000})
  const download=page.waitForEvent('download')
  await zip.click()
  const files=unzipSync(await readFile(await (await download).path()))
  for(const [name,w] of [['apple-touch-icon.png',180],['icon-512-maskable.png',512]] as const){
    const bytes=Buffer.from(files[name]!)
    expect(bytes.readUInt32BE(16)).toBe(w)
    expect(bytes.readUInt32BE(20)).toBe(w)
  }
  expect(Buffer.from(files['favicon.ico']!).readUInt16LE(4)).toBe(3)
  expect(JSON.parse(Buffer.from(files['manifest.webmanifest']!).toString()).icons[2].purpose).toBe('maskable')
})

test('blocks remote card images until explicitly allowed',async({page})=>{
  const received:string[]=[]
  await page.route('https://example.invalid/**',route=>{received.push(route.request().url());return route.fulfill({status:204,body:''})})
  await page.goto('tools/meta-tags')
  await page.getByLabel('URL de la imagen',{exact:true}).fill('https://example.invalid/meta.png')
  await expect(page.locator('.social img')).toHaveCount(0)
  expect(received).toHaveLength(0)
  await page.getByRole('button',{name:'Permitir vista remota de esta imagen',exact:true}).click()
  await expect.poll(()=>received.length).toBeGreaterThan(0)
  await page.getByRole('button',{name:'Desactivar imagen remota',exact:true}).click()
  await expect(page.locator('.social img')).toHaveCount(0)
})

test('imports a spreadsheet and sorts the responsive semantic table',async({page})=>{
  await page.goto('tools/table-builder')
  await page.getByText('Importar CSV o TSV',{exact:true}).click()
  await page.getByLabel('Datos pegados').fill('Alumno\tNota\nJavier\t8\nAna\t6')
  await page.getByRole('button',{name:'Sustituir datos',exact:true}).click()
  await page.getByRole('combobox',{name:'Diseño estrecho',exact:true}).selectOption('cards')
  await page.getByLabel('Ordenación con JavaScript').check()
  const preview=page.frameLocator('iframe')
  await expect(preview.locator('table')).toHaveAttribute('role','table')
  await preview.locator('thead button').first().evaluate((button: HTMLButtonElement)=>button.click())
  await expect(preview.locator('tbody th').first()).toHaveText('Ana')
  await expect(preview.locator('thead th').first()).toHaveAttribute('aria-sort','ascending')
})
