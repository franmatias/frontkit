import * as v from 'valibot'
import { radiusSchema, type Radii } from '../../tools/blob/logic'
import { read, write } from './db'
const packet = v.strictObject({ from:v.literal('blob'), to:v.literal('animation'), createdAt:v.number(), start:radiusSchema, end:radiusSchema })
export async function sendBlob(start:Radii,end:Radii){
  const id=crypto.randomUUID()
  await write('handoff','inbox:'+id,v.parse(packet,{from:'blob',to:'animation',createdAt:Date.now(),start,end}))
  return id
}
export async function receiveBlob(id:unknown){
  if(typeof id!=='string'||!/^[\da-f-]{36}$/.test(id))return
  const parsed=v.safeParse(packet,(await read('handoff','inbox:'+id))?.state)
  if(parsed.success&&Date.now()-parsed.output.createdAt<86_400_000)return parsed.output
}
