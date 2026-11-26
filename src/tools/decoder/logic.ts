import { parseJson, serialize } from '../../lib/json/parse'

export const maxInput = 100 * 1024
export const numericClaims = ['exp', 'iat', 'nbf'] as const
const algorithms = {
  HS256: { hash: 'SHA-256', bits: 256 }, HS384: { hash: 'SHA-384', bits: 384 }, HS512: { hash: 'SHA-512', bits: 512 },
  RS256: { hash: 'SHA-256', bits: 256 }, RS384: { hash: 'SHA-384', bits: 384 }, RS512: { hash: 'SHA-512', bits: 512 },
  ES256: { hash: 'SHA-256', curve: 'P-256', size: 64 }, ES384: { hash: 'SHA-384', curve: 'P-384', size: 96 },
  ES512: { hash: 'SHA-512', curve: 'P-521', size: 132 },
} as const
type Algorithm = keyof typeof algorithms
export type DateClaim = { name: (typeof numericClaims)[number]; seconds: number }
export type Token = {
  header: string; payload: string; algorithm: string; signingInput: string; signature: Uint8Array<ArrayBuffer>;
  dates: DateClaim[]; status: 'inWindow' | 'expired' | 'early' | 'unknown'; warnings: string[];
}
export type DecodedToken = { token: Token } | { error: 'size' | 'malformed' }
const utf8 = new TextDecoder('utf-8', { fatal: true })
const encoder = new TextEncoder()
const supported = (algorithm: string): algorithm is Algorithm => Object.hasOwn(algorithms, algorithm)
function decodeBase64url(value: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) throw new Error('Invalid base64url')
  const s = value.replaceAll('-', '+').replaceAll('_', '/')
  const decoded = atob(s.padEnd(Math.ceil(s.length / 4) * 4, '='))
  if (btoa(decoded).replace(/=+$/, '') !== s) throw new Error('Non-canonical base64url')
  return Uint8Array.from(decoded, c => c.charCodeAt(0))
}
function objectSegment(part: string) {
  const json = utf8.decode(decodeBase64url(part))
  const tree = parseJson(json).root
  if (tree.type !== 'object') throw new Error('JWT JSON is not an object')
  return { fields: new Map(tree.entries), text: serialize(tree, '  ') }
}
export function decodeToken(input: string, now = Date.now()): DecodedToken {
  if (input.length > maxInput || encoder.encode(input).length > maxInput) return { error: 'size' }
  const parts = input.trim().split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1]) return { error: 'malformed' }
  try {
    const [a, b, c] = parts
    const header = objectSegment(a)
    const payload = objectSegment(b)
    const alg = header.fields.get('alg')
    if (alg?.type !== 'string' || !alg.value) return { error: 'malformed' }
    const algorithm = alg.value
    const signature = decodeBase64url(c)
    const warnings: string[] = []
    if (algorithm === 'none') warnings.push('unsigned')
    else if (!supported(algorithm)) warnings.push('unsupported')
    if ((algorithm === 'none') === Boolean(signature.length)) warnings.push('wrongSignatureShape')
    if (header.fields.has('crit') || header.fields.has('b64')) warnings.push('critical')
    if (!payload.fields.has('exp')) warnings.push('noExpiration')
    const dates = numericClaims.flatMap((name): DateClaim[] => {
      const claim = payload.fields.get(name)
      if (!claim) return []
      const seconds = claim.type === 'number' ? Number(claim.raw) : NaN
      if (!Number.isFinite(seconds) || Math.abs(seconds) > 8.64e12) {
        warnings.push('badDate')
        return []
      }
      return [{ name, seconds }]
    })
    const expiration = dates.find(date => date.name === 'exp')
    const notBefore = dates.find(date => date.name === 'nbf')
    const status = expiration && expiration.seconds <= now / 1000 ? 'expired'
      : notBefore && notBefore.seconds > now / 1000 ? 'early'
      : expiration && !warnings.includes('badDate') ? 'inWindow' : 'unknown'
    return { token: { header: header.text, payload: payload.text, algorithm, signingInput: a + '.' + b, signature, dates, status, warnings } }
  } catch { return { error: 'malformed' } }
}

export function keyKind(algorithm: string) {
  if (!supported(algorithm)) return undefined
  return algorithm.startsWith('HS') ? 'secret' : 'public'
}
export type Verification = 'valid' | 'invalid' | 'keyError' | 'unsupported' | 'weakKey'
export async function verifyToken(token: Token, material: string): Promise<Verification> {
  const name = token.algorithm
  if (!supported(name) || token.warnings.includes('critical') || token.warnings.includes('wrongSignatureShape')) return 'unsupported'
  if (!material || material.length > maxInput) return 'keyError'
  const config = algorithms[name]
  try {
    const payload = encoder.encode(token.signingInput)
    let key: CryptoKey
    let parameters: AlgorithmIdentifier | EcdsaParams
    let weak = false
    if (name.startsWith('HS') && 'bits' in config) {
      const bytes = encoder.encode(material)
      weak = bytes.length * 8 < config.bits
      parameters = 'HMAC'
      key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: config.hash }, false, ['verify'])
    } else {
      const pem = /^-----BEGIN PUBLIC KEY-----\s+([A-Za-z0-9+/=\s]+?)\s+-----END PUBLIC KEY-----$/m.exec(material.trim())
      if (!pem || pem[0] !== material.trim()) return 'keyError'
      const spki = Uint8Array.from(atob(pem[1].replace(/\s+/g, '')), c => c.charCodeAt(0))
      if ('curve' in config) {
        if (token.signature.length !== config.size) return 'invalid'
        key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: config.curve }, false, ['verify'])
        parameters = { name: 'ECDSA', hash: config.hash }
      } else {
        key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: config.hash }, false, ['verify'])
        parameters = 'RSASSA-PKCS1-v1_5'
        weak = (key.algorithm as RsaKeyAlgorithm).modulusLength < 2048
      }
    }
    const valid = await crypto.subtle.verify(parameters, key, token.signature, payload)
    return valid ? weak ? 'weakKey' : 'valid' : 'invalid'
  } catch { return 'keyError' }
}

export function inspectUrl(input: string) {
  if (!input.trim() || input.length > maxInput || encoder.encode(input).length > maxInput) return undefined
  try {
    const url = new URL(input.trim())
    return {
      protocol: url.protocol, host: url.hostname, port: url.port, path: url.pathname,
      query: url.search, hash: url.hash, params: [...url.searchParams.entries()],
    }
  } catch { return undefined }
}
export function rebuildUrl(input: string, params: [string, string][]) {
  try {
    const url = new URL(input)
    url.search = new URLSearchParams(params).toString()
    return url.href
  } catch { return '' }
}
export function possibleEncoding(value: string) {
  if (value.length > maxInput) return undefined
  if (value.split('.').length === 3 && 'token' in decodeToken(value)) return { kind: 'jwt', text: value } as const
  if (/^\s*[\[{]/.test(value)) {
    try { return { kind: 'json', text: serialize(parseJson(value).root, '  ') } as const } catch { return }
  }
  if (value.length < 8 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return undefined
  try {
    const text = utf8.decode(decodeBase64url(value.replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_')))
    if ([...text].some(c => c.charCodeAt(0) < 32 && !'\t\r\n'.includes(c))) return undefined
    return { kind: 'base64', text } as const
  } catch { return undefined }
}
