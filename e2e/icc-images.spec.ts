import { expect,test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readProfile,type ProfileFormat } from '../src/tools/image-optimizer/icc'

const fixture=new URL('./fixtures/icc-oriented.jpg',import.meta.url)
test('retains an authentic ICC profile in resized JPEG, PNG and WebP without copying EXIF',async({page})=>{
  const original=new Uint8Array(await readFile(fixture))
  const icc=await readProfile(original,'jpeg')
  expect(icc).toBeDefined()
  await page.goto('tools/image-optimizer')
  await page.getByLabel('Archivos de imagen').setInputFiles({name:'orientada.jpg',mimeType:'image/jpeg',buffer:Buffer.from(original)})
  await page.getByLabel('Conservar perfil ICC RGB').check()
  await page.getByLabel('Generar conjunto responsivo').check()
  await page.getByLabel('Anchos separados por comas').fill('24')
  await page.getByRole('checkbox',{name:'png',exact:true}).check()
  await page.getByRole('button',{name:'Optimizar imagen',exact:true}).click()
  await expect(page.getByText('Perfil ICC conservado en 3 de 3 variantes.')).toBeVisible()
  await expect(page.getByText(/Resultado:.*24 × 48/)).toBeVisible()
  for(const [extension,format] of [['jpg','jpeg'],['webp','webp'],['png','png']] as const){
    const event=page.waitForEvent('download')
    await page.getByRole('button',{name:'orientada-24.'+extension,exact:true}).click()
    const bytes=new Uint8Array(await readFile(await (await event).path()))
    expect(await readProfile(bytes,format satisfies ProfileFormat)).toEqual(icc)
    expect(new TextDecoder().decode(bytes)).not.toContain('Exif\0\0')
    const dimensions=await page.evaluate(async ({data,type})=>{
      const pixels=await createImageBitmap(new Blob([new Uint8Array(data)],{type}))
      const result=[pixels.width,pixels.height]
      pixels.close()
      return result
    },{data:[...bytes],type:'image/'+format})
    expect(dimensions).toEqual([24,48])
  }
})
