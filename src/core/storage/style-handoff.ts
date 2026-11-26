import * as v from 'valibot'
import { read, write } from './db'

const schema = v.strictObject({
  from: v.picklist(['shadow', 'border']), to: v.literal('tokens'), kind: v.picklist(['shadows', 'radii']),
  payload: v.pipe(v.string(), v.maxLength(2400), v.regex(/^[\w\s.,#%/'"()+-]+$/)), createdAt: v.number(),
})
type Handoff = v.InferOutput<typeof schema>
export async function sendStyle(from: Handoff['from'], payload: string) {
  const id = crypto.randomUUID()
  const packet = v.parse(schema, { from, to: 'tokens', kind: from === 'shadow' ? 'shadows' : 'radii', payload, createdAt: Date.now() })
  await write('handoff', 'inbox:' + id, packet)
  return id
}
export async function receiveStyle(id: unknown) {
  if (typeof id !== 'string' || !/^[\da-f-]{36}$/.test(id)) return
  const result = v.safeParse(schema, (await read('handoff', 'inbox:' + id))?.state)
  if (result.success && Date.now() - result.output.createdAt < 86_400_000) return result.output
}
