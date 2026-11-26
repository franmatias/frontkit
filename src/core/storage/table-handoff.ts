import * as v from 'valibot'
import { read, write } from './db'

const packet = v.strictObject({
  from: v.literal('mock-data'), to: v.literal('table-builder'), kind: v.literal('schema'),
  createdAt: v.number(),
  payload: v.strictObject({
    count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000)),
    columns: v.pipe(v.array(v.pipe(v.string(), v.maxLength(40))), v.minLength(1), v.maxLength(16)),
    recipe: v.unknown(),
  }),
})
type Payload = v.InferOutput<typeof packet>['payload']
export async function sendTableDraft(payload: Payload) {
  const id = crypto.randomUUID()
  const record = v.parse(packet, { from: 'mock-data', to: 'table-builder', kind: 'schema', createdAt: Date.now(), payload })
  await write('handoff', 'inbox:' + id, record)
  return id
}
export async function receiveTableDraft(id: unknown) {
  if (typeof id !== 'string' || !/^[\da-f-]{36}$/.test(id)) return undefined
  const result = v.safeParse(packet, (await read('handoff', 'inbox:' + id))?.state)
  if (result.success && Date.now() - result.output.createdAt < 86400000) return result.output.payload
  return undefined
}
