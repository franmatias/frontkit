import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { numberBetween } from '../../lib/schema'
import { htmlText } from '../../lib/html-sandbox'

export const formats=['webp','avif','jpeg','png'] as const
export type Format=typeof formats[number]
export const mime=(format:Format)=>'image/'+format
export const extension=(format:Format)=>format==='jpeg'?'jpg':format
const int=(min:number,max:number)=>v.pipe(numberBetween(min,max),v.integer())
const schema=v.strictObject({
  format:v.picklist(formats), webp:int(1,100), avif:int(1,100), jpeg:int(1,100), png:int(0,6),
  width:int(0,8192),height:int(0,8192),lockAspect:v.boolean(),keepIcc:v.optional(v.boolean()),fit:v.picklist(['contain','cover']),optimised:v.boolean(),
  responsive:v.boolean(),widths:v.pipe(v.string(),v.maxLength(80)), formats:v.pipe(v.array(v.picklist(formats)),v.minLength(1),v.maxLength(4)),
  placeholder:v.picklist(['none','dominant','tiny']),alt:v.pipe(v.string(),v.maxLength(200)),sizes:v.pipe(v.string(),v.maxLength(240)),
})
export type State=v.InferOutput<typeof schema>
export const defaults=():State=>({format:'webp',webp:82,avif:65,jpeg:82,png:2,width:0,height:0,lockAspect:true,fit:'contain',optimised:false,keepIcc:false,
  responsive:false,widths:'320, 640, 960, 1280, 1920',formats:['webp','jpeg'],placeholder:'none',alt:'',sizes:'100vw'})
export const logic=defineTool<State>({id:'image-optimizer',schema,defaultState:defaults,presets:[],outputs:{}})
export type Geometry={width:number;height:number;drawWidth:number;drawHeight:number}
export function geometry(width:number,height:number,state:Pick<State,'width'|'height'|'lockAspect'|'fit'>):Geometry {
  const ratio = Math.min(1,state.width?state.width/width:1,state.height?state.height/height:1)
  const proportional = {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))}
  if(state.lockAspect||!state.width||!state.height)return {...proportional,drawWidth:proportional.width,drawHeight:proportional.height}
  const w=Math.min(state.width,width),h=Math.min(state.height,height)
  const fit=state.fit==='cover' ? Math.min(1,Math.max(w/width,h/height)) : Math.min(w/width,h/height)
  return {width:w,height:h,drawWidth:Math.round(width*fit),drawHeight:Math.round(height*fit)}
}
export function responsiveWidths(source:string,maximum:number) {
  return [...new Set(source.split(',').map(it=>Math.min(maximum,Number(it.trim()))).filter(it=>Number.isInteger(it)&&it>0))].sort((a,b)=>a-b).slice(0,10)
}
export type Variant={file:string;format:Format;width:number;height:number;blob:Blob;icc?:boolean}
export type Optimised={original:{width:number;height:number}; variants:Variant[]; placeholder:string; iccRequested?:boolean}
export function picture(result:Optimised,state:State) {
  const first=[...result.variants].sort((a,b)=>b.width-a.width)
  const fallback=first.find(row=>row.format==='jpeg'||row.format==='png')??first[0]
  if(!fallback)return ''
  const sources=[...new Set(result.variants.map(row=>row.format))].filter(format=>format!==fallback.format).map(format=>{
    const set=result.variants.filter(row=>row.format===format).map(row=>row.file+' '+row.width+'w').join(', ')
    return '  <source type="'+mime(format)+'" srcset="'+htmlText(set)+'" sizes="'+htmlText(state.sizes)+'">'
  })
  const set=result.variants.filter(row=>row.format===fallback.format).map(row=>row.file+' '+row.width+'w').join(', ')
  const placeholder=result.placeholder?(result.placeholder.startsWith('#')?'background-color:'+result.placeholder:'background-image:url('+result.placeholder+');background-size:cover'):''
  return ['<picture>',...sources,'  <img src="'+htmlText(fallback.file)+'" srcset="'+htmlText(set)+'" sizes="'+htmlText(state.sizes)+'" alt="'+htmlText(state.alt)+
    '" width="'+fallback.width+'" height="'+fallback.height+'" loading="lazy" decoding="async"'+(placeholder?' style="'+htmlText(placeholder)+'"':'')+'>','</picture>'].join('\n')
}
