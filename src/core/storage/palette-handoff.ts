import * as v from 'valibot'
import { hexColor } from '../../lib/schema'
import { read, write } from './db'

const schema = v.strictObject({
  from: v.literal('palette'), to: v.picklist(['gradient', 'tokens']), kind: v.literal('colors'),
  createdAt: v.number(),
  payload: v.pipe(v.array(v.strictObject({
    name: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/)), color: hexColor,
  })), v.minLength(3), v.maxLength(11)),
})
type Handoff = v.InferOutput<typeof schema>
export async function sendPalette(to: Handoff['to'], payload: Handoff['payload']) {
  const id = crypto.randomUUID()
  const data = v.parse(schema, { from: 'palette', to, kind: 'colors', payload, createdAt: Date.now() })
  await write('handoff', 'inbox:' + id, data)
  return id
}
export async function receivePalette(to: Handoff['to'], id: unknown) {
  if (typeof id !== 'string' || !/^[\da-f-]{36}$/.test(id)) return
  const result = v.safeParse(schema, (await read('handoff', 'inbox:' + id))?.state)
  if (!result.success || result.output.to !== to || Date.now() - result.output.createdAt >= 86_400_000) return
  return result.output.payload
}
