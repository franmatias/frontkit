import { expect,it } from 'vitest'
import { googleUrl,stack } from './logic'
it('sorts and deduplicates Google Fonts tuples with system fallbacks',()=>{
  const url=new URL(googleUrl([
    {family:'Inter',weight:700,italic:true},{family:'Inter',weight:500,italic:false},{family:'Inter',weight:900,italic:true},
    {family:'Inter',weight:500,italic:false},{family:'Sistema Serif',weight:400,italic:false},
  ]))
  expect(url.searchParams.getAll('family')).toEqual(['Inter:ital,wght@0,500;1,700;1,900'])
  expect(url.searchParams.get('display')).toBe('swap')
  expect(stack('Playfair Display',false)).toBe('Georgia, serif')
})
