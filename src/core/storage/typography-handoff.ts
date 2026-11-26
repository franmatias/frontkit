import * as v from 'valibot'
import { read, write } from './db'

export const tokenSteps = v.pipe(v.array(v.strictObject({
  name: v.pipe(v.string(), v.regex(/^[a-z\d-]{1,25}$/)),
  value: v.pipe(v.string(), v.maxLength(128), v.regex(/^[\d.a-z (),+-]+$/)),
  lineHeight: v.pipe(v.number(), v.minValue(1), v.maxValue(2.5)),
})), v.minLength(1), v.maxLength(14), v.check(steps => new Set(steps.map(step => step.name)).size === steps.length))
const data = v.strictObject({
  base: v.pipe(v.number(), v.minValue(8), v.maxValue(40)), ratio: v.pipe(v.number(), v.minValue(1), v.maxValue(2)),
  font: v.picklist(['sans','serif','mono']), scale: tokenSteps,
})
type Payload = v.InferOutput<typeof data>
const schema = v.strictObject({ from: v.literal('type-scale'), to: v.literal('tokens'), kind: v.literal('typography'), createdAt: v.number(), payload: data })
export async function sendTypography(payload: Payload) {
  const id = crypto.randomUUID()
  await write('handoff', 'inbox:' + id, v.parse(schema, { from: 'type-scale', to: 'tokens', kind: 'typography', createdAt: Date.now(), payload }))
  return id
}
export async function receiveTypography(id: unknown) {
  if (typeof id !== 'string' || !/^[\da-f-]{36}$/.test(id)) return undefined
  const result = v.safeParse(schema, (await read('handoff', 'inbox:' + id))?.state)
  if (result.success && Date.now() - result.output.createdAt < 86_400_000) return result.output.payload
  return undefined
}
