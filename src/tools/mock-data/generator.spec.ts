import { expect, it } from 'vitest'
import { generate } from './generator'
import { logic, newField } from './logic'

it('mantiene semilla, coherencia de identidad y referencias anidadas', () => {
  const state = logic.defaultState()
  state.fields.push({ ...newField('ref', 'copia', 'reference'), text: 'nombre' })
  state.fields.push({ ...newField('address', 'info', 'object'), children: [{ ...newField('nested', 'alias', 'reference'), text: 'copia' }] })
  const result = generate(state)
  expect(result).toEqual(generate(state))
  if (result.kind !== 'result') throw new Error(result.code)
  expect(result.preview[0].copia).toEqual(result.preview[0].nombre)
  expect(result.preview[0].info).toEqual({ alias: result.preview[0].nombre })
  expect(result.preview[0].id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4/)
  expect(result.preview[0].email).toMatch(/@example\.test$/)
})
it('avisa cuando un dominio no admite la unicidad solicitada', () => {
  const state = logic.defaultState()
  state.fields = [{ ...newField('bool', 'activo', 'boolean'), unique: true }]
  state.count = 3
  expect(generate(state)).toEqual({ kind: 'error', code: 'unique', field: 'activo' })
})
it('escapa CSV y genera tipos para fechas Unix y campos anulables', () => {
  const state = logic.defaultState()
  state.fields = [{ ...newField('example', 'texto', 'pattern'), text: '=uno,"dos"' }]
  state.count = 1
  state.format = 'csv'
  expect(generate(state)).toMatchObject({ output: 'texto\r\n"\'=uno,""dos"""' })
  state.fields = [{ ...newField('date', 'fecha', 'date'), epoch: true, nullablePercent: 10 }]
  state.format = 'typescript'
  expect(generate(state)).toMatchObject({ output: expect.stringContaining('export interface Fila { "fecha": number | null; }') })
})
