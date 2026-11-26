import * as v from 'valibot'
import type { VectorSource } from '../../lib/svg/model'
import { defineTool } from '../../core/tool'
import { htmlText } from '../../lib/html-sandbox'
import { hexColor, numberBetween } from '../../lib/schema'
const text=(n:number)=>v.pipe(v.string(),v.maxLength(n))
const schema=v.strictObject({padding:numberBetween(0,40),backgroundColor:hexColor,themeColor:hexColor,maskable:v.boolean(),maskColor:hexColor,
  appName:text(80),shortName:text(30),display:v.picklist(['standalone','fullscreen','minimal-ui','browser']),basePath:text(150),startUrl:text(150),darkSvg:v.boolean(),darkColor:hexColor})
export type State=v.InferOutput<typeof schema>
export const defaults=():State=>({padding:8,backgroundColor:'#e3f4e6',themeColor:'#24684f',maskable:true,maskColor:'#24684f',appName:'Mi aplicación',shortName:'Mi app',display:'standalone',basePath:'/frontkit/',startUrl:'./',darkSvg:false,darkColor:'#1b342b'})
export function basePath(input:string){
  if(!/^\/?(?:[a-z0-9_-]+\/?)*$/i.test(input))return '/'
  const slug=input.replace(/^\/+|\/+$/g,'')
  return slug?'/'+slug+'/':'/'
}
export function start(s:State){
  if(s.startUrl==='.'||s.startUrl==='./')return basePath(s.basePath)
  if(!/^(?:\.\/)?(?:[\w-]+\/)*[\w.-]+\/?$/.test(s.startUrl)||s.startUrl.split('/').some(part=>part==='..'))return basePath(s.basePath)
  return basePath(s.basePath)+s.startUrl.replace(/^\.\//,'')
}
export function manifest(s:State){
  const normal=[192,512].map(size=>({src:basePath(s.basePath)+'icon-'+size+'.png',sizes:size+'x'+size,type:'image/png',purpose:'any'}))
  const icons=s.maskable?[...normal,{src:basePath(s.basePath)+'icon-512-maskable.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]:normal
  return JSON.stringify({name:s.appName.trim()||'Aplicación',short_name:s.shortName.trim()||'App',start_url:start(s),scope:basePath(s.basePath),
    display:s.display,theme_color:s.themeColor,background_color:s.backgroundColor,icons},null,2)
}
export function tags(s:State,hasSvg=false){
  const base=htmlText(basePath(s.basePath))
  return [
    '<link rel="icon" href="'+base+'favicon.ico" sizes="32x32">','<link rel="icon" type="image/png" href="'+base+'icon-32.png" sizes="32x32">',
    ...(hasSvg?['<link rel="icon" type="image/svg+xml" href="'+base+'icon.svg">']:[]),
    '<link rel="apple-touch-icon" href="'+base+'apple-touch-icon.png">','<link rel="manifest" href="'+base+'manifest.webmanifest">',
    '<meta name="theme-color" content="'+htmlText(s.themeColor)+'">',
  ].join('\n')
}
export function ico(parts:{size:number;bytes:Uint8Array}[]){
  const bytes=new Uint8Array(6+16*parts.length+parts.reduce((length,p)=>length+p.bytes.length,0))
  const view=new DataView(bytes.buffer)
  view.setUint16(2,1,true);view.setUint16(4,parts.length,true)
  let offset=6+16*parts.length
  for(const [i,p] of parts.entries()){
    const slot=6+i*16
    view.setUint8(slot,p.size%256);view.setUint8(slot+1,p.size%256)
    view.setUint16(slot+4,1,true);view.setUint16(slot+6,32,true)
    view.setUint32(slot+8,p.bytes.length,true);view.setUint32(slot+12,offset,true)
    bytes.set(p.bytes,offset);offset+=p.bytes.length
  }
  return bytes
}
export function geometry(width:number,height:number,size:number,margin:number,mask:boolean){
  const available=size*(1-2*margin/100)
  const cornerLimit=mask?size*.8/Math.hypot(width,height):Infinity
  const scale=Math.min(available/Math.max(width,height),cornerLimit)
  const w=width*scale,h=height*scale
  return {x:(size-w)/2,y:(size-h)/2,w,h}
}
export type Request={file:Blob;options:State;vector?:VectorSource}
export type Result={files:Record<string,Blob>;width:number;height:number;svg:boolean}
export const logic=defineTool<State>({id:'favicon',schema,defaultState:defaults,outputs:{json:manifest},presets:[]})
