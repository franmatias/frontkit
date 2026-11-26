import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { encoderPrivateFields } from '../../core/tool'

export const modes = ['base64','url','html','hash','ids','time','regex','escape'] as const
const short = v.pipe(v.string(), v.maxLength(100_000))
const schema = v.strictObject({
  mode: v.picklist(modes), reverse: v.boolean(), variant: v.pipe(v.string(),v.maxLength(80)),
  input: v.optional(short), hmacKey: v.optional(short), hashInput: v.optional(short),
})
export type State = v.InferOutput<typeof schema>
const baseLogic = defineTool<State>({
  id:'encoders',schema, defaultState:()=>({mode:'base64', reverse:false, variant:'standard', input:'',hmacKey:'',hashInput:''}),
  neverPersist: [...encoderPrivateFields], shareExclude:['input'], outputs:{},presets:[],
})
export const logic = { ...baseLogic, migrate(raw: unknown, version: number) {
  return { ...baseLogic.defaultState(), ...baseLogic.migrate(raw, version) }
} }
export function base64(input: string, reverse: boolean, url = false) {
  if (!reverse) {
    const bytes = new TextEncoder().encode(input)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192))
    const value = btoa(binary)
    return url ? value.replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'') : value
  }
  const compact = input.replace(/\s+/g,'')
  const valid = url ? /^[A-Za-z0-9_-]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/
  if (!valid.test(compact) || compact.length % 4 === 1 || compact.includes('=') && compact.length % 4 !== 0) throw new Error('Base64 inválido.')
  const bytes = Uint8Array.from(atob(compact.replaceAll('-','+').replaceAll('_','/')), ch => ch.charCodeAt(0))
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
}
export function urlCode(input: string, reverse: boolean, variant: string) {
  if (variant === 'form') return reverse ? decodeURIComponent(input.replaceAll('+',' ')) : new URLSearchParams([['',input]]).toString().slice(1)
  if (variant === 'uri') return reverse ? decodeURI(input) : encodeURI(input)
  return reverse ? decodeURIComponent(input) : encodeURIComponent(input)
}
const entities: Record<string,string> = {'&':'amp','<':'lt','>':'gt','"':'quot',"'":'apos','©':'copy','®':'reg','€':'euro',' ':'nbsp'}
export function htmlCode(input:string, reverse:boolean, mode:string) {
  if (reverse) {
    const template = document.createElement('template')
    return input.replace(/&(?:#[\dxA-Fa-f]+|[A-Za-z]\w*);/g, token => {
      template.innerHTML = token
      return template.content.textContent ?? token
    })
  }
  return [...input].map(item => {
    const code = item.codePointAt(0) ?? 0
    const minimal = Object.hasOwn(entities,item) && /[&<>"']/.test(item)
    if (mode === 'minimal' && !minimal || mode !== 'minimal' && !minimal && code < 127) return item
    return mode !== 'numeric' && Object.hasOwn(entities,item) ? '&' + entities[item] + ';' : '&#' + code + ';'
  }).join('')
}
const algorithms = ['SHA-1','SHA-256','SHA-384','SHA-512'] as const
export type Algorithm = typeof algorithms[number]
export { algorithms }
export async function hash(data: Uint8Array<ArrayBuffer>, algorithm: Algorithm, secret?: string) {
  const key = secret === undefined ? undefined : await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:algorithm},false,['sign'])
  const bytes = new Uint8Array(await (key ? crypto.subtle.sign('HMAC',key,data) : crypto.subtle.digest(algorithm,data)))
  return [...bytes].map(item=>item.toString(16).padStart(2,'0')).join('')
}
let last = -1
let sequence = 0
export function uuid7(now = Date.now()) {
  if (now > last) { last = now; sequence = 0 }
  else if (++sequence > 4095) { last++; sequence = 0 }
  const entropy = crypto.getRandomValues(new Uint8Array(8))
  entropy[0] = 0x80 | (entropy[0] & 0x3f)
  const time = last.toString(16).padStart(12,'0')
  const hex = [...entropy].map(ch=>ch.toString(16).padStart(2,'0')).join('')
  return time.slice(0,8)+'-'+time.slice(8)+'-7'+sequence.toString(16).padStart(3,'0')+'-'+hex.slice(0,4)+'-'+hex.slice(4)
}
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export function ulid(now = Date.now()) {
  let value = BigInt(now)
  for (const byte of crypto.getRandomValues(new Uint8Array(10))) value = (value << 8n) | BigInt(byte)
  let result = ''
  for (let i=0;i<26;i++) { result = alphabet[Number(value & 31n)] + result; value >>= 5n }
  return result
}
export function timestamp(value:string, zone:string, now = Date.now()) {
  const input = value.trim()
  const parsed = !input ? now : /^-?\d{1,13}$/.test(input)
    ? Number(input) * (input.replace('-','').length < 13 ? 1000 : 1) : Date.parse(input)
  const date = new Date(parsed)
  if (!Number.isFinite(date.getTime())) throw new Error('Fecha o timestamp inválido.')
  const local = new Intl.DateTimeFormat('es-ES',{dateStyle:'full',timeStyle:'long',timeZone:zone}).format(date)
  const delta = Math.round((parsed-now)/1000)
  const unit = Math.abs(delta) >= 86400 ? 'day' : Math.abs(delta) >= 3600 ? 'hour' : Math.abs(delta) >= 60 ? 'minute' : 'second'
  const divisor = {day:86400,hour:3600,minute:60,second:1}[unit]
  const relative = new Intl.RelativeTimeFormat('es',{numeric:'auto'}).format(Math.round(delta/divisor),unit)
  return [date.toISOString(),date.toUTCString(),local,String(Math.floor(parsed/1000))+' s',String(parsed)+' ms',relative].join('\n')
}
export function escapes(input:string, reverse:boolean, unicode:boolean) {
  if (!unicode) {
    if (!reverse) return JSON.stringify(input)
    const value: unknown = JSON.parse(input)
    if (typeof value !== 'string') throw new Error('Se esperaba una cadena JSON.')
    return value
  }
  if (!reverse) return Array.from({length:input.length},(_,i)=>'\\u'+input.charCodeAt(i).toString(16).padStart(4,'0')).join('')
  return input.replace(/\\u(?:\{([\da-f]{1,6})\}|([\da-f]{4}))/gi,(_,point,unit)=>String.fromCodePoint(Number.parseInt(point ?? unit,16)))
}
