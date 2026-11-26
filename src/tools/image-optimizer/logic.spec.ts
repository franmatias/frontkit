import { expect,it } from 'vitest'
import { defaults, geometry, picture, responsiveWidths } from './logic'
it('keeps exact geometry without enlarging the source',()=>{
  const state=defaults()
  expect(geometry(1600,800,{...state,width:640})).toMatchObject({width:640,height:320})
  expect(geometry(320,240,{...state,width:1280,height:960})).toMatchObject({width:320,height:240})
  expect(responsiveWidths('320, 640, 1200, 640, -2, invalido',800)).toEqual([320,640,800])
})
it('escapes picture markup and supplies dimensions',()=>{
  const state={...defaults(),alt:'Un "ejemplo" & dibujo'}
  const img={file:'demo-480.jpg',format:'jpeg' as const,width:480,height:240,blob:new Blob()}
  expect(picture({original:{width:960,height:480},variants:[{...img,format:'webp',file:'demo-480.webp'},img],placeholder:'#aabbcc'},state)).toContain('width="480" height="240"')
  expect(picture({original:{width:960,height:480},variants:[img],placeholder:''},state)).toContain('alt="Un &quot;ejemplo&quot; &amp; dibujo"')
})
