import lzString from 'lz-string'
import { describe, expect, it } from 'vitest'
import { logic } from '../tools/gradient/logic'
import { decodeShare, encodeShare } from './share'

describe('shared state', () => {
  it('round trips with a strict schema and tool id', () => {
    const state = logic.defaultState()
    expect(decodeShare(logic, encodeShare(logic, state))).toEqual(state)
  })
  it('rejects damaged, oversized, unknown and unsafe content', () => {
    const json = JSON.stringify({ v: 2, t: 'gradient', s: logic.defaultState() })
    for (const hash of [
      '#s=!',
      '#s=' + 'a'.repeat(8001),
      '#s=' + lzString.compressToEncodedURIComponent(json),
      '#s=' + lzString.compressToEncodedURIComponent('{"v":1,"t":"gradient","s":{"__proto__":{}}}'),
    ]) expect(() => decodeShare(logic, hash)).toThrow()
  })
})
