import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { hexColor, numberBetween, percentage } from '../../lib/schema'
import { property } from '../../lib/tailwind'
export const patterns=['dots','grid','lines','diagonal','checker','waves','zigzag','triangles','hex'] as const
const point=v.strictObject({x:percentage,y:percentage,color:hexColor,size:numberBetween(5,100),opacity:percentage})
const schema=v.strictObject({mode:v.picklist(['mesh','pattern']),base:hexColor,color:hexColor,
  points:v.pipe(v.array(point),v.minLength(1),v.maxLength(12)),grain:percentage,blur:numberBetween(0,32),
  pattern:v.picklist(patterns),scale:numberBetween(8,120),thickness:numberBetween(1,12),opacity:percentage,rotate:numberBetween(0,360),encoding:v.picklist(['url','base64'])})
export type State=v.InferOutput<typeof schema>
export const defaults=():State=>({mode:'mesh',base:'#17334a',color:'#e9bf58',points:[
  {x:18,y:24,color:'#62d7a5',size:65,opacity:95},{x:81,y:20,color:'#dc8dbc',size:72,opacity:94},{x:61,y:89,color:'#e7ad42',size:61,opacity:78},
], grain:0,blur:0,pattern:'dots',scale:32,thickness:3,opacity:80,rotate:0,encoding:'url'})
const alpha=(color:string,opacity:number)=>color+Math.round(opacity*2.55).toString(16).padStart(2,'0')
export function uri(code:string,encoding:State['encoding']){
  return encoding==='base64'?'data:image/svg+xml;base64,'+btoa(String.fromCharCode(...new TextEncoder().encode(code)))
    :'data:image/svg+xml,'+encodeURIComponent(code).replace(/['()]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())
}
const open='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">'
const patternArt:Record<State['pattern'],string>={
  dots:'<circle cx="12" cy="12" r="DOT" fill="currentColor" stroke="none"/>', grid:'<path d="M0 0H24M0 0V24M0 24H24M24 0V24"/>',
  lines:'<path d="M0 12H24"/>', diagonal:'<path d="M-12 12L12-12M-12 36L36-12M12 36L36 12"/>',
  checker:'<path d="M0 0H12V12H0ZM12 12H24V24H12Z" fill="currentColor" stroke="none"/>',
  waves:'<path d="M-12 12Q-6 2 0 12T12 12T24 12T36 12"/>', zigzag:'<path d="M-12 18L-6 6L0 18L6 6L12 18L18 6L24 18L30 6L36 18"/>',
  triangles:'<path d="M0 21L12 3L24 21Z"/>',hex:'<path d="M6 1H18L24 12L18 23H6L0 12Z"/>',
}
export function svg(s:State){
  const base='<rect width="400" height="300" fill="'+s.base+'"/>'
  if(s.mode==='pattern'){
    return open+'<defs><pattern id="tile" width="'+s.scale+'" height="'+s.scale+'" patternUnits="userSpaceOnUse" patternTransform="rotate('+s.rotate+')">'+
      '<g transform="scale('+s.scale/24+')" color="'+s.color+'" stroke="'+s.color+'" fill="none" stroke-width="'+s.thickness*24/s.scale+'" opacity="'+s.opacity/100+'">'+
      patternArt[s.pattern].replace('DOT',String(s.thickness*24/s.scale))+'</g></pattern></defs>'+base+'<rect width="400" height="300" fill="url(#tile)"/></svg>'
  }
  const ramps=s.points.map((p,i)=>'<radialGradient id="p'+i+'" gradientUnits="userSpaceOnUse" cx="'+p.x*4+'" cy="'+p.y*3+'" r="'+p.size*4+'"><stop stop-color="'+p.color+'" stop-opacity="'+p.opacity/100+'"/><stop offset="1" stop-color="'+p.color+'" stop-opacity="0"/></radialGradient>')
  const filter=s.blur?'<filter id="soft" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="'+s.blur+'"/></filter>':''
  const grain=s.grain?'<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="4"/></filter>':''
  const layers=s.points.map((_,i)=>'<rect width="400" height="300" fill="url(#p'+i+')"/>').reverse().join('')
  return open+'<defs>'+ramps.join('')+filter+grain+'</defs>'+base+'<g'+(s.blur?' filter="url(#soft)"':'')+'>'+layers+'</g>'+
    (s.grain?'<rect width="400" height="300" filter="url(#grain)" opacity="'+s.grain/250+'"/>':'')+'</svg>'
}
export function style(s:State):{backgroundColor:string;backgroundImage:string;backgroundSize?:string;backgroundRepeat?:string}{
  const backgroundColor=s.base, color=alpha(s.color,s.opacity), step=s.scale+'px', line=s.thickness+'px'
  if(s.mode==='mesh'&&!s.blur&&!s.grain)return {backgroundColor,backgroundImage:s.points.map(p=>
    'radial-gradient(circle at '+p.x+'% '+p.y+'%, '+alpha(p.color,p.opacity)+' 0, transparent '+p.size+'%)').join(', ')}
  if(s.mode==='pattern'){
    const tile={backgroundColor, backgroundSize:step+' '+step}
    if(s.pattern==='dots')return {...tile,backgroundImage:'radial-gradient(circle, '+color+' '+line+', transparent '+line+')'}
    if(s.pattern==='lines'||s.pattern==='diagonal')return {backgroundColor,backgroundImage:'repeating-linear-gradient('+((s.pattern==='diagonal'?45:0)+s.rotate)+'deg, '+color+' 0 '+line+', transparent '+line+' '+step+')'}
    if(s.pattern==='grid'&&!s.rotate)return {...tile,backgroundImage:[0,90].map(angle=>'linear-gradient('+angle+'deg, '+color+' 0 '+line+', transparent '+line+')').join(', ')}
    if(s.pattern==='checker'&&!s.rotate)return {...tile,backgroundImage:'conic-gradient('+color+' 25%, transparent 0 50%, '+color+' 0 75%, transparent 0)'}
  }
  return {backgroundColor,backgroundImage:'url("'+uri(svg(s),s.encoding)+'")',backgroundSize:'100% 100%',backgroundRepeat:'no-repeat'}
}
export const css=(s:State)=>Object.entries(style(s)).map(([key,value])=>key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+': '+value+';').join('\n')
export const logic=defineTool<State>({id:'backgrounds',schema,defaultState:defaults,outputs:{
  css,svg,tailwind:s=>Object.entries(style(s)).map(([key,value])=>property(key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value)).join(' '),
},presets:patterns.map(pattern=>({id:pattern,name:pattern,state:{...defaults(),mode:'pattern',pattern},builtin:true}))})
