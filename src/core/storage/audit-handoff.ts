import * as v from 'valibot'
import { read, write } from './db'
export const auditSources=['layout','table-builder','meta-tags'] as const
type Source=typeof auditSources[number]
const content=(max:number)=>v.pipe(v.string(),v.maxLength(max))
const schema=v.strictObject({from:v.picklist(auditSources),to:v.literal('a11y-audit'),createdAt:v.number(),html:content(500_000),css:content(200_000)})
export async function sendAudit(from:Source,html:string,css=''){
  const packet=v.parse(schema,{from,to:'a11y-audit',createdAt:Date.now(),html,css})
  const id=crypto.randomUUID()
  await write('handoff','inbox:'+id,packet)
  return id
}
export async function receiveAudit(id:unknown){
  if(typeof id!=='string'||!/^[\da-f-]{36}$/.test(id))return
  const draft=v.safeParse(schema,(await read('handoff','inbox:'+id))?.state)
  if(draft.success && Date.now()-draft.output.createdAt<86_400_000)return draft.output
}
