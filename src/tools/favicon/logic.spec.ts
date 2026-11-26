import { expect,it } from 'vitest'
import { defaults,geometry,ico,manifest,tags } from './logic'
it('writes an ICO directory and keeps maskable artwork in the safe circle',()=>{
  const file=ico([{size:16,bytes:new Uint8Array([10,20,30])},{size:32,bytes:new Uint8Array([40,50,60,70])}])
  const header=new DataView(file.buffer)
  expect([header.getUint16(2,true),header.getUint16(4,true)]).toEqual([1,2])
  expect([header.getUint8(6),header.getUint32(18,true),header.getUint8(22),header.getUint32(34,true)]).toEqual([16,38,32,41])
  expect([...file.slice(38)]).toEqual([10,20,30,40,50,60,70])
  const safe=geometry(512,512,512,0,true)
  expect(Math.hypot(safe.w,safe.h)).toBeCloseTo(512*.8)
  const s={...defaults(),basePath:'/proyecto/',startUrl:'./inicio'}
  const output=JSON.parse(manifest(s))
  expect(output.start_url).toBe('/proyecto/inicio')
  expect(output.icons[2].purpose).toBe('maskable')
  expect(tags(s,true)).toContain('/proyecto/icon.svg')
})
