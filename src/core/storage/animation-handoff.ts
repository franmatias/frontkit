import * as v from 'valibot'
import { read, write } from './db'

const schema = v.strictObject({ from:v.literal('animation'), to:v.literal('transitions'), createdAt:v.number(),
  name:v.pipe(v.string(),v.regex(/^[a-z][a-z0-9-]{0,31}$/)), css:v.pipe(v.string(),v.maxLength(4400),v.regex(/^[\w\s@#%.:;{}(),-]+$/)) })
export async function sendAnimation(name:string,css:string) {
  const id=crypto.randomUUID()
  const payload=v.parse(schema,{from:'animation',to:'transitions',createdAt:Date.now(),name,css})
  await write('handoff','inbox:'+id,payload)
  return id
}
export async function receiveAnimation(id:unknown) {
  if(typeof id!=='string'||!/^[\da-f-]{36}$/.test(id))return
  const data=v.safeParse(schema,(await read('handoff','inbox:'+id))?.state)
  if(data.success && Date.now()-data.output.createdAt<86_400_000)return data.output
}
