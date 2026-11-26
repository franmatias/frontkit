import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { numberBetween } from '../../lib/schema'
import { htmlText } from '../../lib/html-sandbox'
import catalog from './catalog.json'
export const local = [
  {family:'Sistema Sans',category:'sans-serif',files:'system-ui'},
  {family:'Sistema Serif',category:'serif',files:'Georgia'},
  {family:'Sistema Mono',category:'monospace',files:'ui-monospace'},
]
export const families=[...local.map(row=>({...row,weights:[300,400,500,600,700,800,900],italic:true,axes:[],subsets:['latin','latin-ext']})),...catalog.map(row=>({...row,files:''}))]
const face=v.strictObject({family:v.pipe(v.string(),v.check(name=>families.some(f=>f.family===name))),weight:numberBetween(100,900),italic:v.boolean()})
const schema=v.strictObject({heading:face,body:face,headingSize:numberBetween(12,72),bodySize:numberBetween(10,36),lineHeight:numberBetween(1,2.5),
  scene:v.picklist(['product-card','login','nav','article']),dark:v.boolean(),lockHeading:v.boolean(),lockBody:v.boolean()})
export type State=v.InferOutput<typeof schema>
export type Face=State['heading']
export const lookup=(name:string)=>families.find(f=>f.family===name)??families[0]!
export const defaults=():State=>({heading:{family:'Playfair Display',weight:700,italic:false},body:{family:'Inter',weight:400,italic:false},
  headingSize:37,bodySize:16,lineHeight:1.55,scene:'product-card',dark:false,lockHeading:false,lockBody:false})
export function select(family:string,previous:Face):Face {
  const row=lookup(family)
  return {family,weight:row.weights.reduce((best,n)=>Math.abs(n-previous.weight)<Math.abs(best-previous.weight)?n:best, row.weights[0]??400),italic:row.italic&&previous.italic}
}
export function stack(family:string,active=true) {
  const row=lookup(family)
  const category=['serif','monospace'].includes(row.category)?row.category:'sans-serif'
  const fallback=local.find(f=>f.category===category)?.files??'system-ui'
  return (row.files||!active?'':JSON.stringify(row.family)+', ')+fallback+', '+category
}
export function googleUrl(faces:Face[]) {
  const grouped=new Map<string,Set<string>>()
  for(const face of faces){
    const row=lookup(face.family)
    if(row.files)continue
    const actual=select(face.family,face)
    if(!grouped.has(actual.family))grouped.set(actual.family,new Set())
    grouped.get(actual.family)?.add((actual.italic?'1,':'0,')+actual.weight)
  }
  if(!grouped.size)return ''
  const url=new URL('https://fonts.googleapis.com/css2')
  for(const [name,variants] of [...grouped.entries()].sort(([a],[b])=>a.localeCompare(b))) {
    const italic=[...variants].some(value=>value.startsWith('1'))
    const tuples=[...variants].sort((a,b)=>a.localeCompare(b,'en',{numeric:true}))
    url.searchParams.append('family',name+(italic?':ital,wght@'+tuples.join(';'):':wght@'+tuples.map(value=>value.slice(2)).join(';')))
  }
  url.searchParams.set('display','swap')
  return url.href
}
function html(s:State){
  const url=googleUrl([s.heading,s.body])
  return url?'<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="'+htmlText(url)+'">':''
}
const variables=(s:State)=>'  --font-heading: '+stack(s.heading.family)+';\n  --font-body: '+stack(s.body.family)+';'
function selfHosted(s:State){
  return [...new Set([s.heading.family,s.body.family])].filter(family=>!lookup(family).files).map(family=>{
    const slug=family.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
    const variable=lookup(family).axes.some(axis=>axis.tag==='wght')
    const name=(variable?'@fontsource-variable/':'@fontsource/')+slug
    const chosen=[s.heading,s.body].filter(face=>face.family===family)
    const imports=variable? [...new Set(chosen.map(face=>face.italic?'/wght-italic.css':'/wght.css'))]
      : [...new Set(chosen.map(face=>'/'+face.weight+(face.italic?'-italic':'')+'.css'))]
    return '// pnpm add '+name+'\n'+imports.map(path=>'import "'+name+path+'";').join('\n')
  }).join('\n\n')
}
export const logic=defineTool<State>({id:'font-pairing',schema,defaultState:defaults,outputs:{
  css:s=>{const url=googleUrl([s.heading,s.body]);return (url?'@import url("'+url+'");\n\n':'')+':root {\n'+variables(s)+'\n}'},
  html,tailwind:s=>'@theme {\n'+variables(s)+'\n}',js:selfHosted,
},presets:[]})
