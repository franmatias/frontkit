import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { hexColor, percentage, numberBetween } from '../../lib/schema'
import { arbitrary } from '../../lib/tailwind'
export const quad = v.tuple([percentage,percentage,percentage,percentage])
export const radiusSchema = v.strictObject({ horizontal:quad, vertical:quad })
export type Radii = v.InferOutput<typeof radiusSchema>
export type Quad = Radii['horizontal']
export const symmetry = ['none','horizontal','vertical','both'] as const
const schema = v.strictObject({ radii:radiusSchema, target:radiusSchema, symmetry:v.picklist(symmetry),
  seed:v.pipe(v.string(),v.maxLength(50)), complexity:percentage, size:numberBetween(120,320), color:hexColor, second:hexColor,
  fill:v.picklist(['color','gradient','image']), animate:v.boolean() })
export type State = v.InferOutput<typeof schema>
const pair=(horizontal:Quad,vertical:Quad):Radii=>({horizontal,vertical})
const examples = [
  ['Gota',pair([70,30,62,38],[66,30,70,34])], ['Huevo',pair([49,49,50,50],[65,65,35,35])],
  ['Nube',pair([65,45,65,45],[36,75,35,70])], ['Guijarro',pair([65,42,59,44],[37,72,48,66])],
  ['Pétalo',pair([82,15,70,29],[75,37,62,22])],
] as const
export const defaults=():State=>({radii:structuredClone(examples[0][1]),target:structuredClone(examples[4][1]),symmetry:'none',seed:'frontkit',complexity:64,size:260,color:'#146b59',second:'#f0b94b',fill:'gradient',animate:false})
export function factor(radii:Radii){
  const [a,b,c,d]=radii.horizontal, [e,f,g,h]=radii.vertical
  return 100 / Math.max(100,a+b,c+d,e+h,f+g)
}
export const format=(n:number)=>Number(n.toFixed(4))
export const radius=(r:Radii)=>[r.horizontal,r.vertical].map(row=>row.map(n=>format(n)+'%').join(' ')).join(' / ')
export function normalised(r:Radii):Radii {
  const f=factor(r)
  return pair(r.horizontal.map(n=>n*f) as Quad,r.vertical.map(n=>n*f) as Quad)
}
export function changeRadius(r:Radii,axis:keyof Radii,index:number,value:number,mode:State['symmetry']){
  const row=r[axis]
  row[index]=value
  if(mode==='horizontal'||mode==='both')row[[1,0,3,2][index]!]=value
  if(mode==='vertical'||mode==='both')row[[3,2,1,0][index]!]=value
  if(mode==='both')row[[2,3,0,1][index]!]=value
}
export function randomRadii(seed:string,complexity:number,mode:State['symmetry']){
  let n=2166136261
  for(const char of seed)n=Math.imul(n ^ char.charCodeAt(0),16777619)
  const value=()=>{ n^=n<<13; n^=n>>>17; n^=n<<5; return Math.round(50+((n>>>0)/4294967296-.5)*complexity) }
  const r=pair([50,50,50,50],[50,50,50,50])
  for(const axis of ['horizontal','vertical'] as const)for(let i=0;i<4;i++)changeRadius(r,axis,i,value(),mode)
  return r
}
export function path(r:Radii, size:number){
  const points=normalised(r)
  const dim=(row:Quad)=>row.map(n=>n*size/100) as Quad
  const [a,b,c,d]=dim(points.horizontal), [e,f,g,h]=dim(points.vertical)
  const k=.5522847498
  const p=(...values:number[])=>values.map(format).join(' ')
  return 'M '+p(a,0)+' H '+p(size-b)+' C '+p(size-b+k*b,0,size,f-k*f,size,f)+' V '+p(size-g)+
    ' C '+p(size,size-g+k*g,size-c+k*c,size,size-c,size)+' H '+p(d)+' C '+p(d-k*d,size,0,size-h+k*h,0,size-h)+
    ' V '+p(e)+' C '+p(0,e-k*e,a-k*a,0,a,0)+' Z'
}
export const morphed=(s:State)=>'@keyframes blob-morph {\n  from { border-radius: '+radius(s.radii)+'; }\n  to { border-radius: '+radius(s.target)+'; }\n}'
export function fill(s:State){return s.fill==='gradient'?'linear-gradient(140deg, '+s.color+', '+s.second+')':s.color}
export const logic=defineTool<State>({id:'blob',schema,defaultState:defaults,outputs:{
  css:s=>'border-radius: '+radius(s.radii)+';\nbackground: '+fill(s)+';'+(s.animate?'\n\n'+morphed(s)+'\n\n.blob { animation: blob-morph 2.4s ease-in-out infinite alternate; }\n@media (prefers-reduced-motion: reduce) { .blob { animation: none; } }':''),
  tailwind:s=>arbitrary('rounded',radius(s.radii)), cssPath:s=>"clip-path: path('"+path(s.radii,s.size)+"');",
  svg:s=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+s.size+' '+s.size+'"><defs><linearGradient id="fill" x2="1" y2="1"><stop stop-color="'+s.color+'"/><stop offset="1" stop-color="'+s.second+'"/></linearGradient></defs><path fill="'+(s.fill==='gradient'?'url(#fill)':s.color)+'" d="'+path(s.radii,s.size)+'"/></svg>',
},presets:examples.map(([name,radii])=>({id:name,name,builtin:true,state:{...defaults(),radii}})),random:()=>{const s=defaults();s.seed=String(Date.now());s.radii=randomRadii(s.seed,s.complexity,s.symmetry);return s}})
