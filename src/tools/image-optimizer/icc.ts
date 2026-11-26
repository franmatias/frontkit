type Bytes = Uint8Array<ArrayBuffer>
export type ProfileFormat = 'jpeg' | 'png' | 'webp'
const encoder = new TextEncoder()
const maxProfile = 4 * 1024 * 1024
const marker = encoder.encode('ICC_PROFILE\0')
const pngSignature = Uint8Array.of(137,80,78,71,13,10,26,10)
const view = (bytes: Bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const ascii = (bytes: Bytes, from: number, length: number) => String.fromCharCode(...bytes.subarray(from,from+length))
function starts(bytes: Bytes, sequence: Bytes, offset = 0) {
  return sequence.every((value,i) => bytes[offset+i] === value)
}
function join(parts: Bytes[]): Bytes {
  const bytes = new Uint8Array(parts.reduce((size,part) => size+part.length,0))
  let offset = 0
  for (const part of parts) { bytes.set(part,offset); offset += part.length }
  return bytes
}
function validate(profile: Bytes | undefined) {
  if (!profile || profile.length < 132 || profile.length > maxProfile) return undefined
  const header = view(profile)
  if (header.getUint32(0) !== profile.length || ascii(profile,36,4) !== 'acsp' || ascii(profile,16,4) !== 'RGB ') return undefined
  if (!['scnr','mntr','prtr','spac'].includes(ascii(profile,12,4))) return undefined
  const count = header.getUint32(128)
  if (!count || count > Math.floor((profile.length-132)/12)) return undefined
  for (let i=0;i<count;i++) {
    const offset = header.getUint32(136+i*12), size = header.getUint32(140+i*12)
    if (offset < 132+count*12 || size > profile.length-offset) return undefined
  }
  return profile
}

function jpegParts(bytes: Bytes) {
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('JPEG no válido.')
  const parts: { marker:number; offset:number; data:Bytes; raw:Bytes; icc:boolean }[] = []
  let offset=2
  const data=view(bytes)
  while (offset+1<bytes.length && bytes[offset]===255) {
    const start=offset++
    while (bytes[offset]===255) offset++
    const code=bytes[offset++]!
    if (code===218 || code===217) return {parts, end:start}
    if (code===1 || (code>=208&&code<=215)) continue
    if (offset+2>bytes.length) break
    const size=data.getUint16(offset)
    if (size<2 || offset+size>bytes.length) break
    const payload=bytes.subarray(offset+2,offset+size)
    offset+=size
    parts.push({marker:code,offset:start,data:payload,raw:bytes.subarray(start,offset),icc:code===226&&starts(payload,marker)})
  }
  throw new Error('Marcadores JPEG incompletos.')
}
function jpegProfile(parts: ReturnType<typeof jpegParts>['parts']) {
  const chunks=parts.filter(part=>part.icc).map(part=>part.data)
  if (!chunks.length || chunks.length>255) return undefined
  const count=chunks[0]?.[13]
  if (chunks.length!==count || chunks.some(chunk=>chunk.length<14||chunk[13]!==count || !chunk[12] || chunk[12]!>count!)) return undefined
  const bySequence=new Map(chunks.map(chunk=>[chunk[12],chunk.subarray(14)]))
  if (bySequence.size!==count || chunks.reduce((size,chunk)=>size+chunk.length-14,0)>maxProfile) return undefined
  return join([...bySequence.entries()].sort(([a],[b])=>a!-b!).map(([,chunk])=>chunk))
}
function jpegWith(bytes: Bytes, profile?: Bytes) {
  const {parts,end}=jpegParts(bytes)
  const app2: Bytes[]=[]
  const limit=65535-2-14
  const count=profile?Math.ceil(profile.length/limit):0
  for (let i=0;profile&&i<count;i++) {
    const icc=profile.subarray(i*limit,(i+1)*limit)
    const chunk=new Uint8Array(18+icc.length)
    chunk.set([255,226])
    view(chunk).setUint16(2,chunk.length-2)
    chunk.set(marker,4)
    chunk[16]=i+1;chunk[17]=count
    chunk.set(icc,18);app2.push(chunk)
  }
  const first=parts[0]?.marker===224?1:0
  const chunks=parts.slice(first).filter(part=>!part.icc).map(part=>part.raw)
  return join([bytes.subarray(0,first===1 ? parts[1]?.offset ?? end : 2),...app2,...chunks,bytes.subarray(end)])
}

function pngParts(bytes: Bytes) {
  if (!starts(bytes,pngSignature)) throw new Error('PNG no válido.')
  const parts:{ tag:string; data:Bytes; raw:Bytes }[]=[]
  const reader=view(bytes)
  for (let offset=8;offset+12<=bytes.length;) {
    const size=reader.getUint32(offset),end=offset+12+size
    if (end>bytes.length) break
    const tag=ascii(bytes,offset+4,4)
    parts.push({tag,data:bytes.subarray(offset+8,end-4),raw:bytes.subarray(offset,end)})
    offset=end
    if (tag==='IEND'&&parts[0]?.tag==='IHDR'&&parts[0].data.length===13) return parts
  }
  throw new Error('Chunks PNG incompletos.')
}
const colourChunks=new Set(['iCCP','sRGB','cICP','gAMA','cHRM'])
const crcTable=Uint32Array.from({length:256},(_,value)=>{
  let row=value
  for (let bit=0;bit<8;bit++) row=(row>>>1)^((row&1)?0xedb88320:0)
  return row
})
function pngChunk(tag:string, payload:Bytes) {
  const bytes=new Uint8Array(payload.length+12),data=view(bytes)
  data.setUint32(0,payload.length)
  bytes.set(encoder.encode(tag),4);bytes.set(payload,8)
  let crc=0xffffffff
  for (const b of bytes.subarray(4,bytes.length-4)) crc=crcTable[(crc^b)&255]!^(crc>>>8)
  data.setUint32(bytes.length-4,(crc^0xffffffff)>>>0)
  return bytes
}
async function pngProfile(parts: ReturnType<typeof pngParts>) {
  const chunk=parts.find(part=>part.tag==='iCCP')?.data
  if (!chunk) return undefined
  const stop=chunk.indexOf(0)
  if (stop<1||stop>79||chunk[stop+1]!==0||chunk.length-stop-2>maxProfile) return undefined
  const reader=new Blob([chunk.subarray(stop+2)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
  const chunks:Bytes[]=[]
  let total=0
  try {
    for (;;) {
      const {done,value}=await reader.read()
      if (done) break
      total+=value.byteLength
      if (total>maxProfile) {
        await reader.cancel()
        return undefined
      }
      chunks.push(new Uint8Array(value))
    }
  } finally { reader.releaseLock() }
  return join(chunks)
}
async function pngWith(bytes: Bytes, profile?: Bytes) {
  const [header,...parts]=pngParts(bytes)
  const icc:Bytes[]=[]
  if (profile) {
    if ([0,4].includes(header!.data[9]!)) return undefined
    const compressed=new Uint8Array(await new Response(new Blob([profile]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())
    icc.push(pngChunk('iCCP',join([encoder.encode('ICC profile\0\0'),compressed])))
  }
  return join([pngSignature,header!.raw,...icc,...parts.filter(part=>!colourChunks.has(part.tag)).map(part=>part.raw)])
}
function webpParts(bytes: Bytes) {
  if (ascii(bytes,0,4)!=='RIFF'||ascii(bytes,8,4)!=='WEBP') throw new Error('WebP no válido.')
  const data=view(bytes),end=data.getUint32(4,true)+8
  if (end>bytes.length || end<12) throw new Error('Contenedor WebP incompleto.')
  const parts:{ tag:string; data:Bytes; raw:Bytes }[]=[]
  for (let offset=12;offset<end;) {
    if (offset+8>end) throw new Error('Chunk WebP incompleto.')
    const size=data.getUint32(offset+4,true)
    const next=offset+8+size+(size%2)
    if (next>end) throw new Error('Chunk WebP incompleto.')
    parts.push({tag:ascii(bytes,offset,4),data:bytes.subarray(offset+8,next-size%2),raw:bytes.subarray(offset,next)})
    offset=next
  }
  return parts
}
function riffChunk(tag:string,payload:Bytes) {
  const bytes=new Uint8Array(8+payload.length+payload.length%2)
  bytes.set(encoder.encode(tag));view(bytes).setUint32(4,payload.length,true);bytes.set(payload,8)
  return bytes
}
function webpWith(bytes: Bytes, profile: Bytes | undefined, dimensions?: { width:number; height:number }) {
  const parts=webpParts(bytes),extended=parts.find(part=>part.tag==='VP8X')?.data.slice()
  const payload=parts.filter(part=>!['VP8X','ICCP'].includes(part.tag)).map(part=>part.raw)
  const head: Bytes[]=[]
  if (extended?.length===10) {
    extended[0]=profile?(extended[0]!|32):(extended[0]!&~32)
    head.push(riffChunk('VP8X',extended))
  } else if (profile&&dimensions) {
    const chip=new Uint8Array(10)
    const lossless=parts.find(part=>part.tag==='VP8L')
    chip[0]=32|(parts.some(part=>part.tag==='ALPH')||Boolean(lossless&&lossless.data[4]!&16)?16:0)
    const set24=(offset:number,n:number)=>chip.set([n&255,(n>>>8)&255,(n>>>16)&255],offset)
    set24(4,dimensions.width-1);set24(7,dimensions.height-1)
    head.push(riffChunk('VP8X',chip))
  }
  if (profile&&head.length) head.push(riffChunk('ICCP',profile))
  const header=encoder.encode('RIFF0000WEBP')
  view(header).setUint32(4,4+[...head,...payload].reduce((size,part)=>size+part.length,0),true)
  return join([header,...head,...payload])
}

export async function readProfile(bytes: Bytes, format: ProfileFormat) {
  const profile = format==='jpeg' ? jpegProfile(jpegParts(bytes).parts)
    : format==='webp' ? webpParts(bytes).find(part=>part.tag==='ICCP')?.data
    : await pngProfile(pngParts(bytes))
  return validate(profile)
}
export async function stripProfile(bytes:Bytes,format:ProfileFormat) {
  if (format==='jpeg') return jpegWith(bytes)
  if (format==='webp') return webpWith(bytes,undefined)
  return (await pngWith(bytes))!
}
export async function attachProfile(bytes: Bytes, format: ProfileFormat, profile: Bytes, dimensions: {width:number;height:number}) {
  if (format==='jpeg') return jpegWith(bytes,profile)
  if (format==='webp') return webpWith(bytes,profile,dimensions)
  return pngWith(bytes,profile)
}
export function profileFormat(mime: string): ProfileFormat | undefined {
  if (mime==='image/jpeg') return 'jpeg'
  if (mime==='image/png') return 'png'
  if (mime==='image/webp') return 'webp'
}
