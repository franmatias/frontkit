import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { numberBetween } from '../../lib/schema'
import { property } from '../../lib/tailwind'
const unit = numberBetween(0, 300)
const point = v.strictObject({ x: unit, y: unit })
export const shapes = ['polygon', 'inset', 'circle', 'ellipse'] as const
export const mirrors = ['none', 'h', 'v', 'both'] as const
const schema = v.strictObject({
  shape: v.picklist(shapes), unit: v.picklist(['%', 'px']), snap: v.picklist([0, 1, 5, 10]), mirror: v.picklist(mirrors),
  grid: v.boolean(), points: v.pipe(v.array(point), v.minLength(3), v.maxLength(32)),
  top: unit, right: unit, bottom: unit, left: unit, radius: unit, x: unit, y: unit, rx: unit, ry: unit,
})
export type State = v.InferOutput<typeof schema>
export const templates = {
  Triángulo: [[50,0],[100,100],[0,100]], Trapecio: [[20,0],[80,0],[100,100],[0,100]], Paralelogramo: [[20,0],[100,0],[80,100],[0,100]],
  Rombo: [[50,0],[100,50],[50,100],[0,50]], Pentágono: [[50,0],[100,38],[81,100],[19,100],[0,38]],
  Hexágono: [[25,0],[75,0],[100,50],[75,100],[25,100],[0,50]], Octógono: [[30,0],[70,0],[100,30],[100,70],[70,100],[30,100],[0,70],[0,30]],
  Estrella: [[50,0],[62,36],[100,37],[69,61],[80,100],[50,75],[20,100],[31,61],[0,37],[38,36]],
  Flecha: [[0,30],[58,30],[58,5],[100,50],[58,95],[58,70],[0,70]], Chevron: [[0,0],[56,0],[100,50],[56,100],[0,100],[44,50]],
  Burbuja: [[0,0],[100,0],[100,78],[36,78],[16,100],[16,78],[0,78]], Cruz: [[33,0],[67,0],[67,33],[100,33],[100,67],[67,67],[67,100],[33,100],[33,67],[0,67],[0,33],[33,33]],
  Diagonal: [[0,0],[100,0],[100,70],[0,100]],
}
export function template(name: keyof typeof templates, unit: State['unit']) {
  const scale = unit === 'px' ? 3 : 1
  return templates[name].map(([x,y]) => ({ x: x! * scale, y: y! * scale }))
}
export const defaults = (): State => ({ shape:'polygon', unit:'%', snap:0, mirror:'none', grid:true, points:template('Estrella','%'), top:12, right:12, bottom:12, left:12, radius:16, x:50, y:50, rx:40, ry:30 })
const limit = (s: State) => s.unit === '%' ? 100 : 300
export function moved(s: State, value: number) {
  const rounded = s.snap ? Math.round(value / s.snap) * s.snap : Math.round(value * 10) / 10
  return Math.max(0, Math.min(limit(s), rounded))
}
const polygon = (s: State) => s.points.map(({x,y}) => ({ x:s.mirror === 'h' || s.mirror === 'both' ? limit(s) - x : x, y:s.mirror === 'v' || s.mirror === 'both' ? limit(s) - y : y }))
const format = (value: number) => Number(value.toFixed(3))
export function clip(s: State) {
  const f = (n: number) => format(Math.max(0, Math.min(limit(s),n))) + s.unit
  switch (s.shape) {
    case 'inset': return 'inset(' + [s.top,s.right,s.bottom,s.left].map(f).join(' ') + ' round ' + f(s.radius) + ')'
    case 'circle': return 'circle(' + f(s.rx) + ' at ' + f(s.x) + ' ' + f(s.y) + ')'
    case 'ellipse': return 'ellipse(' + f(s.rx) + ' ' + f(s.ry) + ' at ' + f(s.x) + ' ' + f(s.y) + ')'
    default: return 'polygon(' + polygon(s).map(p => f(p.x) + ' ' + f(p.y)).join(', ') + ')'
  }
}
export function svg(s: State) {
  const f = (n:number) => format(Math.max(0, Math.min(limit(s), n)) / limit(s))
  const horizontal = Math.max(1,(s.left+s.right)/limit(s))
  const vertical = Math.max(1,(s.top+s.bottom)/limit(s))
  const inner = s.shape === 'polygon' ? '<polygon points="' + polygon(s).map(p => f(p.x) + ',' + f(p.y)).join(' ') + '"/>'
    : s.shape === 'inset' ? '<rect x="' + f(s.left/horizontal) + '" y="' + f(s.top/vertical) + '" width="' + f(limit(s)-(s.left+s.right)/horizontal) + '" height="' + f(limit(s)-(s.top+s.bottom)/vertical) + '" rx="' + f(s.radius) + '"/>'
    : '<ellipse cx="' + f(s.x) + '" cy="' + f(s.y) + '" rx="' + f(s.rx) + '" ry="' + f(s.shape === 'circle' ? s.rx : s.ry) + '"/>'
  return '<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="recorte" clipPathUnits="objectBoundingBox">' + inner + '</clipPath></defs></svg>'
}
export function addEdge(s: State, point: State['points'][number]) {
  if (s.points.length >= 32) return
  let best = { distance: Infinity, index: 0, x:point.x, y:point.y }
  for (const [i,a] of s.points.entries()) {
    const b = s.points[(i + 1) % s.points.length]!
    const dx=b.x-a.x, dy=b.y-a.y
    const t = Math.max(0,Math.min(1,((point.x-a.x)*dx + (point.y-a.y)*dy) / (dx*dx + dy*dy || 1)))
    const x=a.x+t*dx, y=a.y+t*dy, distance=Math.hypot(x-point.x,y-point.y)
    if(distance<best.distance) best={ distance,index:i,x,y }
  }
  if(best.distance <= limit(s)*0.04) s.points.splice(best.index+1,0,{x:moved(s,best.x),y:moved(s,best.y)})
}
export const logic = defineTool<State>({id:'clip-path',schema,defaultState:defaults,outputs:{
  css:s=>'clip-path: '+clip(s)+';',tailwind:s=>property('clip-path',clip(s)),svg,
},presets:Object.keys(templates).map(name=>({id:name,name,builtin:true,state:{...defaults(),points:template(name as keyof typeof templates,'%')}}))})
