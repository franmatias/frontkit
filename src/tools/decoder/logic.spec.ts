import { expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { decodeToken, inspectUrl, rebuildUrl, verifyToken } from './logic'

const segment = (json: object) => Buffer.from(JSON.stringify(json)).toString('base64url')
it('lee JWT sin relleno y distingue expiración, fechas futuras y errores', () => {
  const header = segment({ alg: 'none' })
  const expired = decodeToken(header + '.' + segment({ exp: 10 }) + '.', 10000)
  expect(expired).toMatchObject({ token: { status: 'expired', warnings: ['unsigned'] } })
  const early = decodeToken(header + '.' + segment({ nbf: 20, exp: 40 }) + '.', 10000)
  expect(early).toMatchObject({ token: { status: 'early' } })
  expect(decodeToken('not.valid')).toEqual({ error: 'malformed' })
})
it('verifica HS256 y detecta modificaciones', async () => {
  const secret = '12345678901234567890123456789012'
  const input = segment({ alg: 'HS256' }) + '.' + segment({ exp: 40 })
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = Buffer.from(await webcrypto.subtle.sign('HMAC', key, Buffer.from(input))).toString('base64url')
  const result = decodeToken(input + '.' + signature)
  if (!('token' in result)) throw new Error('Test JWT should decode')
  expect(await verifyToken(result.token, secret)).toBe('valid')
  expect(await verifyToken(result.token, 'a different secret')).toBe('invalid')
})
it('edita parámetros repetidos y conserva caracteres Unicode', () => {
  const original = 'https://ejemplo.es:8080/ruta?q=niño&q=dos&tag%5B%5D=uno#p'
  const result = inspectUrl(original)
  expect(result?.params).toEqual([['q','niño'], ['q','dos'], ['tag[]','uno']])
  expect(result?.port).toBe('8080')
  const edited = rebuildUrl(original, [['q','café con leche'],['q','dos']])
  expect(edited).toContain('q=caf%C3%A9+con+leche&q=dos#p')
})
