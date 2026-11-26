import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { hexColor, numberBetween } from '../../lib/schema'
import { htmlText } from '../../lib/html-sandbox'
const text=(max:number)=>v.pipe(v.string(),v.maxLength(max))
const schema=v.strictObject({title:text(180),description:text(420),url:text(600),siteName:text(90),locale:text(15),type:v.picklist(['website','article']),
  image:text(600),imageAlt:text(180),width:numberBetween(0,16384),height:numberBetween(0,16384),
  card:v.picklist(['summary_large_image','summary']),site:text(80),creator:text(80),themeColor:hexColor,
  robots:v.picklist(['index, follow','noindex, follow','noindex, nofollow','index, nofollow']),published:text(32),author:text(150)})
export type State=v.InferOutput<typeof schema>
export const defaults=():State=>({title:'Cuaderno de FrontKit',description:'Ideas y ejemplos para aprender HTML y CSS con herramientas que funcionan en tu navegador.',url:'https://ejemplo.es/cuaderno',siteName:'FrontKit',locale:'es_ES',type:'website',image:'',imageAlt:'',width:0,height:0,card:'summary_large_image',site:'',creator:'',themeColor:'#26644d',robots:'index, follow',published:'',author:''})
export function httpUrl(input:string){
  try{
    const url=new URL(input)
    if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)return url.href
  }catch{/* Incomplete URL. */}
  return ''
}
const tag=(name:string,value:string)=>value?'<meta '+(name.startsWith('og:')||name.startsWith('article:')?'property':'name')+'="'+name+'" content="'+htmlText(value)+'">':''
export function head(s:State){
  const image=httpUrl(s.image),url=httpUrl(s.url)
  const lines=['<meta charset="utf-8">','<meta name="viewport" content="width=device-width, initial-scale=1">']
  if(s.title)lines.push('<title>'+htmlText(s.title)+'</title>')
  if(url)lines.push('<link rel="canonical" href="'+htmlText(url)+'">')
  const meta:Record<string,string>={
    description:s.description,'theme-color':s.themeColor,robots:s.robots,'og:title':s.title,'og:description':s.description,'og:url':url,'og:site_name':s.siteName,'og:type':s.type,'og:locale':s.locale,
    'twitter:card':s.card,'twitter:title':s.title,'twitter:description':s.description,'twitter:site':s.site,'twitter:creator':s.creator,
  }
  if(image)Object.assign(meta,{'og:image':image,'og:image:alt':s.imageAlt,'twitter:image':image,'twitter:image:alt':s.imageAlt,
    'og:image:width':s.width?String(s.width):'','og:image:height':s.height?String(s.height):''})
  if(s.type==='article')Object.assign(meta,{'article:published_time':s.published,'article:author':s.author})
  return '<head>\n  '+[...lines,...Object.entries(meta).map(([name,value])=>tag(name,value)).filter(Boolean)].join('\n  ')+'\n</head>'
}
export type Rule={ platform:string; text:string; level:'correcto'|'aviso'|'error' }
export function checks(s:State,bytes=0):Rule[]{
  const record = (platform:string,text:string,passed:boolean,error=false):Rule => ({platform,text,level:passed?'correcto':error?'error':'aviso'})
  return [
    record('Buscadores','Título presente y de hasta 60 caracteres',s.title.trim().length>0&&s.title.length<=60),
    record('Buscadores','Descripción presente y de hasta 155 caracteres',s.description.trim().length>0&&s.description.length<=155),
    record('Buscadores','URL canónica HTTP o HTTPS absoluta',!!httpUrl(s.url),true),
    record('Redes sociales','Imagen Open Graph con URL absoluta',!!httpUrl(s.image),true),
    record('Redes sociales','Texto alternativo para la imagen',!!s.imageAlt.trim()),
    record('Open Graph','Relación aproximada 1,91:1',s.height>0&&Math.abs(s.width/s.height-1.91)<.15),
    record('Open Graph','Imagen de 1200 × 630 px o equivalente',s.width>=1200&&s.height>=630),
    ...(bytes?[record('Redes sociales','Imagen local de hasta 1 MB',bytes<=1_000_000)]:[]),
  ]
}
export const logic=defineTool<State>({id:'meta-tags',schema,defaultState:defaults,outputs:{html:head},presets:[]})
