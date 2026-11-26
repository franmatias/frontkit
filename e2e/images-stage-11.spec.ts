import { expect,test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('resizes and exports a real local image without enlarging it',async({page})=>{
  await page.goto('tools/image-optimizer')
  const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180
    const ctx=canvas.getContext('2d')!
    ctx.fillStyle='#2e6955';ctx.fillRect(0,0,320,180)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Archivos de imagen').setInputFiles({name:'ejemplo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
  await page.getByLabel('Ancho máximo').fill('160')
  await page.getByLabel('Ancho máximo').blur()
  await page.getByRole('button',{name:'Optimizar imagen',exact:true}).click()
  await expect(page.getByText(/Resultado:.*160 × 90/)).toBeVisible()
  await expect(page.locator('.code-box')).toContainText('width="160" height="90"')
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:'ejemplo-160.webp',exact:true}).click()
  const bytes=await readFile(await (await download).path())
  expect(bytes.subarray(0,4).toString()).toBe('RIFF')
  expect(bytes.subarray(8,12).toString()).toBe('WEBP')
  await page.getByLabel('Formato de salida').selectOption('avif')
  await expect(page.getByRole('button',{name:'Optimizar imagen',exact:true})).toBeDisabled()
  await page.getByRole('checkbox',{name:'Cargar códec al convertir'}).check()
  await page.getByRole('button',{name:'Optimizar imagen',exact:true}).click()
  await expect(page.getByRole('button',{name:'ejemplo-160.avif',exact:true})).toBeVisible({timeout:20000})
})
