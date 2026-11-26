import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { numberBetween } from '../../lib/schema'
import { arbitrary, property } from '../../lib/tailwind'
import { logic as animation, timingFunction, timingSchema } from '../animation/logic'

export const properties=['opacity','transform','background-color','border-radius','display'] as const
export const triggers=['hover','focus','click','class'] as const
export const demos=['progress','reveal','parallax'] as const
const row=v.strictObject({prop:v.picklist(properties),duration:numberBetween(0,5000),delay:numberBetween(-1000,5000),timing:timingSchema})
const schema=v.strictObject({
  mode:v.picklist(['transition','snap','scroll']), rows:v.pipe(v.array(row),v.minLength(1),v.maxLength(5)),
  trigger:v.picklist(triggers),discrete:v.boolean(),axis:v.picklist(['x','y']),enforce:v.picklist(['mandatory','proximity']),
  align:v.picklist(['start','center','end']), stop:v.picklist(['normal','always']),padding:numberBetween(0,64),margin:numberBetween(0,64),
  gap:numberBetween(0,48),count:numberBetween(2,10),demo:v.picklist(demos),timeline:v.picklist(['scroll','view']),
  start:numberBetween(0,100),end:numberBetween(0,100),custom:v.pipe(v.string(),v.maxLength(4400),v.regex(/^[\w\s@#%.:;{}(),-]*$/)),
  customName:v.pipe(v.string(),v.regex(/^(?:[a-z][a-z0-9-]{0,31})?$/)),
})
export type State=v.InferOutput<typeof schema>
export const newRow=(prop:State['rows'][number]['prop']='opacity')=>({prop,duration:200,delay:0,timing:animation.defaultState().timing})
export const defaults=():State=>({mode:'transition',rows:[newRow(),newRow('transform')],trigger:'hover',discrete:false,axis:'x',enforce:'mandatory',
  align:'start',stop:'normal',padding:16,margin:0,gap:12,count:5,demo:'reveal',timeline:'view',start:0,end:85,custom:'',customName:''})
export function transitionLists(s:State) {
  return { props:s.rows.map(row=>row.prop).join(','), duration:s.rows.map(row=>row.duration+'ms').join(','),
    delay:s.rows.map(row=>row.delay+'ms').join(','), timing:s.rows.map(row=>timingFunction(row)).join(', ') }
}
export function css(s:State) {
  if(s.mode==='transition'){
    const values=s.rows.map(row=>[row.prop,row.duration+'ms',timingFunction(row),row.delay+'ms',s.discrete?'allow-discrete':''].filter(Boolean).join(' '))
    const trigger=s.trigger==='hover'?':hover':s.trigger==='focus'?':focus-visible':'.is-active'
    return '.motion { transition: '+values.join(', ')+'; }\n.motion'+trigger+' { opacity: .65; transform: translateY(-.4rem) scale(1.03); background-color: #b3e3d2; border-radius: 1rem; }\n@media (prefers-reduced-motion: reduce) { .motion { transition: none; } }'
  }
  if(s.mode==='snap')return '.track { display: grid; grid-auto-flow: '+(s.axis==='x'?'column':'row')+'; overflow: auto; scroll-snap-type: '+s.axis+' '+s.enforce+'; scroll-padding: '+s.padding+'px; gap: '+s.gap+'px; }\n.track > * { scroll-snap-align: '+s.align+'; scroll-snap-stop: '+s.stop+'; scroll-margin: '+s.margin+'px; }'
  const animationName=s.customName||'frontkit-scroll'
  const frames=s.custom&&s.customName?s.custom:'@keyframes '+animationName+' { from { '+({
    progress:'transform: scaleX(0)',reveal:'opacity: 0; transform: translateY(2rem)',parallax:'transform: translateY(1.5rem)',
  })[s.demo]+'; } to { opacity: 1; transform: none; } }'
  const range=s.timeline==='scroll'?s.start+'% '+s.end+'%':'entry '+s.start+'% cover '+s.end+'%'
  return '.scroll-effect { opacity: 1; transform: none; transform-origin: left; }\n@supports (animation-timeline: '+s.timeline+'()) {\n'+frames+
    '\n.scroll-effect { animation: '+animationName+' linear both; animation-timeline: '+s.timeline+'(); animation-range: '+range+'; }\n}\n@media (prefers-reduced-motion: reduce) { .scroll-effect { animation: none; } }'
}
export function tailwind(s:State) {
  if(s.mode==='scroll') return css(s)
  if(s.mode==='snap') return [
    'Contenedor: '+['grid',s.axis==='x'?'grid-flow-col':'grid-flow-row','overflow-auto','snap-'+s.axis,'snap-'+s.enforce,
      arbitrary('scroll-p',s.padding+'px'),arbitrary('gap',s.gap+'px')].join(' '),
    'Ítem: '+['snap-'+s.align,'snap-'+s.stop,arbitrary('scroll-m',s.margin+'px')].join(' '),
  ].join('\n')
  const value=transitionLists(s)
  return [arbitrary('transition',value.props),arbitrary('duration',value.duration),arbitrary('delay',value.delay),arbitrary('ease',value.timing),
    s.discrete?property('transition-behavior','allow-discrete'):'','motion-reduce:transition-none'].filter(Boolean).join(' ')
}
export const logic=defineTool<State>({id:'transitions',schema,defaultState:defaults,outputs:{css,tailwind},presets:[]})
