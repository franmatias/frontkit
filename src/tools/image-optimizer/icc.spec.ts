import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect,it } from 'vitest'
import { attachProfile,readProfile,stripProfile } from './icc'
const jpegUrl=resolve('e2e/fixtures/icc-oriented.jpg')
it('round trips a segmented JPEG ICC profile and leaves the EXIF segment intact',async()=>{
  const jpeg=new Uint8Array(await readFile(jpegUrl))
  const original=(await readProfile(jpeg,'jpeg'))!
  expect(original).toHaveLength(588)
  const large=new Uint8Array(140_000)
  large.set(original)
  new DataView(large.buffer).setUint32(0,large.length)
  const output=(await attachProfile(jpeg,'jpeg',large,{width:64,height:32}))!
  expect(await readProfile(output,'jpeg')).toEqual(large)
  const clean=await stripProfile(output,'jpeg')
  expect(await readProfile(clean,'jpeg')).toBeUndefined()
  expect(new TextDecoder().decode(clean)).toContain('Exif\0\0')
})
