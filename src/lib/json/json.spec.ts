import { describe, expect, it } from 'vitest'
import { parseJson, serialize } from './parse'
import { jsonPatch, structuralDiff, type DiffOptions } from './diff'
import { repairText } from '../../tools/json/processor'

const diff: DiffOptions = { ignoreKeyOrder: true, ignoreArrayOrder: false, arrayKey: 'id', ignorePaths: [], numericEquality: true }
describe('JSON exacto', () => {
  it('mantiene números grandes y protege claves especiales', () => {
    const source = '{"__proto__":{"safe":true},"id":9007199254740999}'
    const result = parseJson(source)
    expect(result.unsafeNumbers).toBe(1)
    expect(serialize(result.root)).toBe(source)
  })
  it('diagnostica claves duplicadas y muestra las reparaciones sin modificar el origen', () => {
    expect(() => parseJson('{\n"x":0,\n"x":1}')).toThrow(expect.objectContaining({ code: 'duplicate', line: 3, column: 1 }))
    const source = "{// inicio\n clave:'abra\\'zo', no:undefined,}"
    const result = parseJson(source, { repair: true })
    expect(result.edits.map(edit => edit.kind)).toEqual(['comments', 'bareKey', 'singleQuotes', 'bareKey', 'nullValue', 'trailingComma'])
    expect(serialize(parseJson(repairText(source, result.edits)).root)).toBe('{"clave":"abra\'zo","no":null}')
  })
  it('distingue movimientos y evita pérdida de precisión en el parche', () => {
    const a = parseJson('{"a/b":[{"id":1},{"id":2}],"n":100.0}').root
    const b = parseJson('{"a/b":[{"id":2},{"id":1}],"n":1e2,"~id":9007199254740999}').root
    const result = structuralDiff(a, b, diff)
    expect(result.counts).toEqual({ added: 1, removed: 0, changed: 0, typeChanged: 0, moved: 2 })
    expect(structuralDiff(a, a, diff).changes).toEqual([])
    const patch = jsonPatch(a, b)
    expect(patch).toContain('"path":"/a~1b"')
    expect(patch).toContain('"path":"/~0id","value":9007199254740999')
    const output: Record<string, unknown> = JSON.parse(serialize(a))
    for (const op of JSON.parse(patch)) {
      const key = op.path.slice(1).replaceAll('~1', '/').replaceAll('~0', '~')
      if (op.op === 'remove') delete output[key]
      else output[key] = op.value
    }
    expect(output).toEqual(JSON.parse(serialize(b)))
  })
})
