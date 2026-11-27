export const maxBytes = 2_000_000
export const autoBytes = 200_000
export const sizeOf = (text: string) => new TextEncoder().encode(text).length
export const encodings = [
  'auto',
  'utf-8',
  'windows-1252',
  'iso-8859-15',
  'utf-16le',
  'utf-16be',
] as const
function bom(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return 'utf-8'
}
export function decode(bytes: Uint8Array, encoding = 'auto', declared = '') {
  if (bytes.length > maxBytes) throw new Error('El límite de entrada es 2 MB.')
  const sniffed =
    new TextDecoder('windows-1252')
      .decode(bytes.subarray(0, 2048))
      .match(/<meta\b[^>]*?charset\s*=\s*['"]?([\w-]+)/i)?.[1] ?? ''
  for (const candidate of encoding === 'auto'
    ? [bom(bytes), declared, sniffed, 'utf-8']
    : [encoding]) {
    if (!candidate) continue
    try {
      const decoder = new TextDecoder(candidate)
      return { html: decoder.decode(bytes), encoding: decoder.encoding }
    } catch {
      /* Try the next advertised encoding. */
    }
  }
  throw new Error('Codificación no compatible.')
}
export function webAddress(value: string) {
  try {
    const address = new URL(value.trim())
    if (
      ['http:', 'https:'].includes(address.protocol) &&
      !address.username &&
      !address.password
    )
      return address
  } catch {
    /* Not an absolute web URL. */
  }
  throw new Error('Introduce una URL HTTP o HTTPS absoluta sin credenciales.')
}
export async function fetchHtml(
  address: URL,
  proxy: string,
  signal: AbortSignal,
  method: 'direct' | 'allorigins' | 'jina' | 'custom' = proxy ? 'custom' : 'direct',
) {
  let target = address
  if (method === 'custom' || method === 'allorigins') {
    target = webAddress(method === 'custom' ? proxy : 'https://api.allorigins.win/raw')
    if (target.protocol !== 'https:') throw new Error('El proxy debe usar HTTPS.')
    target.searchParams.set('url', address.href)
  } else if (method === 'jina') {
    target = new URL('https://r.jina.ai/' + address.href)
  }
  const response = await fetch(target.href, {
    headers: method === 'jina' ? { 'X-Respond-With': 'html', Accept: 'text/plain' } : undefined,
    signal,
    credentials: 'omit',
    mode: 'cors',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
  })
  if (!response.ok)
    throw new Error('El servidor respondió con HTTP ' + response.status + '.')
  const type = response.headers.get('content-type') ?? ''
  if (
    type &&
    !/^(?:text\/(?:html|plain)|application\/xhtml\+xml)(?:\s*;|$)/i.test(type)
  )
    throw new Error('La URL no devuelve un documento HTML.')
  if (Number(response.headers.get('content-length')) > maxBytes)
    throw new Error('El documento supera los 2 MB.')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('La URL devolvió una respuesta vacía.')
  const buffer = new Uint8Array(maxBytes)
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (total + value.length > maxBytes) {
        await reader.cancel()
        throw new Error('El documento supera los 2 MB.')
      }
      buffer.set(value, total)
      total += value.length
    }
  } finally {
    reader.releaseLock()
  }
  return {
    ...decode(
      buffer.subarray(0, total),
      'auto',
      type.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1],
    ),
    base: method !== 'direct' ? address.href : response.url || address.href,
  }
}
