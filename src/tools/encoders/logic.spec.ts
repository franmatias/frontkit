import { expect,it } from 'vitest'
import { base64, hash, logic, timestamp, ulid, uuid7 } from './logic'
import { decodeShare, encodeShare } from '../../composables/share'
it('handles UTF-8, URL-safe alphabet and malformed data',()=>{
  const encoded=base64('España 🎲',false,true)
  expect(encoded).not.toMatch(/[=+/]/)
  expect(base64(encoded,true,true)).toBe('España 🎲')
  expect(()=>base64('abcde',true)).toThrow()
})
it('matches published SHA-256 and HMAC vectors',async()=>{
  expect(await hash(new TextEncoder().encode('abc'),'SHA-256')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(await hash(new TextEncoder().encode('The quick brown fox jumps over the lazy dog'),'SHA-256','key')).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
})
it('shares options without input, hash text or HMAC keys',()=>{
  const data={...logic.defaultState(),mode:'hash' as const,input:'secret',hashInput:'message',hmacKey:'key'}
  expect(decodeShare(logic,encodeShare(logic,data))).toEqual({...logic.defaultState(),mode:'hash'})
})
it('emits ordered UUIDv7 and checks timestamps in named zones',()=>{
  const id=uuid7(), next=uuid7()
  expect(next>id).toBe(true)
  expect(id).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-7[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/)
  expect(ulid()).toHaveLength(26)
  expect(timestamp('1711848600000','Europe/Madrid')).toContain('3:30:00')
})
