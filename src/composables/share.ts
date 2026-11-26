import lzString from 'lz-string'
import * as v from 'valibot'
import { safeJson } from '../core/storage/backup'
import type { ToolLogic } from '../core/tool'

const payload = v.strictObject({
  v: v.pipe(v.number(), v.integer(), v.minValue(1)),
  t: v.string(),
  s: v.unknown(),
})

export const shareLimit = 8000

export function encodeShare<S>(tool: ToolLogic<S>, state: S) {
  const shared = tool.shareExclude?.length ? { ...state } : state
  for (const key of tool.shareExclude ?? []) delete shared[key]
  const encoded = lzString.compressToEncodedURIComponent(JSON.stringify({ v: tool.schemaVersion, t: tool.id, s: shared }))
  if (encoded.length > shareLimit) throw new Error('Share limit')
  return '#s=' + encoded
}

export function decodeShare<S>(tool: ToolLogic<S>, hash: string): S {
  const encoded = hash.slice(3)
  if (!hash.startsWith('#s=') || !/^[\w+$-]+$/.test(encoded) || encoded.length > shareLimit) {
    throw new Error('Invalid share fragment')
  }
  const decoded = lzString.decompressFromEncodedURIComponent(encoded)
  if (!decoded || decoded.length > 500_000) throw new Error('Invalid share payload')
  const data = v.parse(payload, safeJson(decoded))
  if (data.t !== tool.id) throw new Error('Invalid tool ID')
  return tool.migrate(data.s, data.v)
}
