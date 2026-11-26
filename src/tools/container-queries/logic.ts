import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { hexColor, numberBetween } from '../../lib/schema'
import { property } from '../../lib/tailwind'

export const types=['inline-size','size','normal'] as const
export const directions=['row','column'] as const
export const testKinds=['min','max','range','style'] as const
const n=(min:number,max:number)=>v.pipe(numberBetween(min,max),v.integer())
const selector=v.pipe(v.string(),v.maxLength(160),v.regex(/^[^{}<>;@]*$/))
const rule=v.strictObject({kind:v.picklist(testKinds),min:n(0,1200),max:n(0,1200),color:hexColor,dir:v.picklist(directions)})
const scope=v.strictObject({root:selector,limit:selector,selector,color:hexColor})
const schema=v.strictObject({
  mode:v.picklist(['query','scope']), name:v.pipe(v.string(),v.regex(/^(?:[a-z][\w-]{0,31})?$/)),
  type:v.picklist(types), width:n(220,1100),height:n(180,480),style:v.boolean(),
  rules:v.pipe(v.array(rule),v.minLength(1),v.maxLength(6)),scopes:v.pipe(v.array(scope),v.minLength(1),v.maxLength(4)),
  markup:v.pipe(v.string(),v.maxLength(4000)),
})
export type State=v.InferOutput<typeof schema>
type Rule=State['rules'][number]
export const baseRule=():Rule=>({kind:'min',min:460,max:760,color:'#b2e2cb',dir:'row'})
export const defaults=():State=>({
  mode:'query',name:'card',type:'inline-size',width:480,height:250,style:true,rules:[baseRule()],
  scopes:[{root:'.panel-demo',limit:'.limit',selector:':scope .title',color:'#176442'},{root:'.inner',limit:'',selector:'.title',color:'#61396b'}],
  markup:'<section class="panel-demo"><h2 class="title">Título exterior</h2><div class="inner"><p class="title">Ámbito interior</p></div><aside class="limit"><p class="title">Fuera del primer ámbito</p></aside></section>',
})
export const presets=['Tarjeta','Barra lateral','Rejilla','Navegación'] as const
export function preset(id:typeof presets[number]) {
  const s=defaults()
  if(id==='Barra lateral'){s.name='sidebar';s.rules=[{...baseRule(),kind:'max',dir:'column',max:520}]}
  if(id==='Rejilla'){s.name='grid';s.rules=[{...baseRule(),min:350},{...baseRule(),kind:'range',min:520,max:800,color:'#c8dcf2'}]}
  if(id==='Navegación'){s.name='navbar';s.rules=[{...baseRule(),min:630,color:'#f1d9af'}]}
  return s
}
export function condition(r:Rule) {
  if(r.kind==='style')return 'style(--dense: on)'
  if(r.kind==='min')return '(min-width: '+r.min+'px)'
  if(r.kind==='max')return '(max-width: '+r.max+'px)'
  return '('+Math.min(r.min,r.max)+'px <= width <= '+Math.max(r.min,r.max)+'px)'
}
export function active(s:State,r:Rule,width=s.width) {
  if(r.kind==='style')return s.style
  if(s.type==='normal')return false
  return r.kind==='min'?width>=r.min:r.kind==='max'?width<=r.max:width>=Math.min(r.min,r.max)&&width<=Math.max(r.min,r.max)
}
export function cqUnits(width:number,height:number) {
  return {cqw:width/100,cqh:height/100,cqi:width/100,cqb:height/100,cqmin:Math.min(width,height)/100,cqmax:Math.max(width,height)/100}
}
export function css(s:State) {
  if(s.mode==='scope') return s.scopes.filter(item=>item.root.trim()&&item.selector.trim()).map(item=>
    '@scope ('+item.root+')'+(item.limit?' to ('+item.limit+')':'')+' { '+item.selector+' { color: '+item.color+'; } }').join('\n')
  const container=s.name?'container: '+s.name+' / '+s.type+';':'container-type: '+s.type+';'
  const base='.demo-container { '+container+(s.style?' --dense: on;':'')+' }\n.query-card { display: flex; flex-direction: column; gap: .6rem; }\n'
  return base+s.rules.map(r=>'@container '+(s.name?s.name+' ':'')+condition(r)+' { .query-card { flex-direction: '+r.dir+'; background-color: '+r.color+'; } }').join('\n')
}
export function tailwind(s:State) {
  if(s.mode==='scope')return css(s)
  const name=s.name?'/'+s.name:''
  return ['Contenedor: '+(s.type==='normal'?'[container-type:normal]': (s.type==='size'?'@container-size':'@container')+name),
    ...s.rules.flatMap(r=>{
      if(r.kind==='style')return ['Estilo de contenedor · '+condition(r)]
      const variant=(type:string, number:number)=>'@'+type+'-['+number+'px]'+name+':'
      const prefix=r.kind==='min'?variant('min',r.min):r.kind==='max'?variant('max',r.max):
        variant('min',Math.min(r.min,r.max))+variant('max',Math.max(r.min,r.max))
      return [prefix+'flex-'+(r.dir==='row'?'row':'col')+' '+prefix+property('background-color',r.color)]
    })].join('\n')
}
export const logic=defineTool<State>({id:'container-queries',schema,defaultState:defaults,outputs:{css,tailwind},
  presets:presets.map((id,index)=>({id:'preset-'+index,name:id,builtin:true,state:preset(id)}))})
