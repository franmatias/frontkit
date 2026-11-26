import { optimize, type Config, type PluginConfig, type XastElement } from 'svgo/browser'
import { defaultSvgOptions, iconName, isPaint, type Icon, type SvgOptions, type SvgRequest, type SvgResult } from './model'

const paints = new Set(['fill','stroke','stop-color','flood-color','lighting-color','color'])
const cssKeys=new Set([...paints,'stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','fill-opacity','stroke-opacity',
  'fill-rule','clip-rule','clip-path','mask','filter','display','visibility','font-family','font-size','font-weight','text-anchor','dominant-baseline','transform'])
const allowed=new Set(('svg g path rect circle ellipse line polyline polygon image title desc defs symbol use clipPath mask pattern linearGradient radialGradient stop text tspan textPath metadata style marker filter switch feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence').split(' '))
const safeId = /^#[a-z_][\w.-]*$/i
const localReference = /^url\(\s*["']?(#[a-z_][\w.-]*)["']?\s*\)$/i
const embedded = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[\dA-Za-z+/=]+$/
const safeAttributeName=/^(?:[A-Za-z_][\w-]*|xlink:href|xmlns:xlink|xml:space|xml:lang)$/
const dimension=/^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/i
const viewBoxPattern=/^\s*[-+]?\d*\.?\d+(?:e[-+]?\d+)?(?:[,\s]+[-+]?\d*\.?\d+(?:e[-+]?\d+)?){3}\s*$/i
const encode=(value:string)=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const byte=(raw:string)=>new TextEncoder().encode(raw).length
const writeAttrs=(attrs:Record<string,string>)=>Object.entries(attrs).map(([key,value])=>' '+key+'="'+encode(value)+'"').join('')
const rootSvg = (svg:string) => svg.match(/<svg\b[^>]*>/)?.[0]
function canonicalId(name:string){return name.trim().startsWith('#')?name.trim().toLowerCase():name.trim()}
function sanitize(options:SvgOptions, inspect:(node:XastElement)=>void):PluginConfig {
  return {name:'frontkit-sanitize',fn:()=>({element:{enter(node,parent){
    if(!allowed.has(node.name)||node.name==='style'||(node.name==='metadata'&&options.removeMetadata)){
      parent.children=parent.children.filter(child=>child!==node)
      return
    }
    // Keep editor namespaces only when the caller requests them. Their elements are removed by the rendering policy above.
    if(node.name==='svg') node.attributes.xmlns='http://www.w3.org/2000/svg'
    for(const [key,value] of Object.entries(node.attributes)){
      const lower=key.toLowerCase(),raw=value.trim()
      if((key.startsWith('xmlns:')&&key!=='xmlns:xlink'&&!options.removeEditors))continue
      if(!safeAttributeName.test(key)||lower.startsWith('on')||['src','srcset','tabindex','autofocus'].includes(lower)||key==='xml:lang'&&raw.length>40){
        delete node.attributes[key];continue
      }
      if(lower==='href'||lower==='xlink:href'){
        if(!safeId.test(raw)&&!(node.name==='image'&&embedded.test(raw)))delete node.attributes[key]
        continue
      }
      if(key==='style'){
        for(const declaration of raw.split(';')){
          const index=declaration.indexOf(':')
          if(index<1)continue
          const prop=declaration.slice(0,index).trim().toLowerCase(), val=declaration.slice(index+1).trim()
          if(cssKeys.has(prop)&&(!/[\\@]/.test(val))&&(!/url\s*\(/i.test(val)||localReference.test(val)))node.attributes[prop]=val
        }
        delete node.attributes.style;continue
      }
      if((cssKeys.has(lower)&&/[\\@]/.test(raw))||(/url\s*\(/i.test(raw)&&!localReference.test(raw))){delete node.attributes[key];continue}
      if(key==='xmlns:xlink')node.attributes[key]='http://www.w3.org/1999/xlink'
    }
    for(const [key,value] of Object.entries(node.attributes)){
      if(!paints.has(key)||!isPaint(value))continue
      const replace=options.changes[canonicalId(value)]
      if(replace&&isPaint(replace))node.attributes[key]=replace
      if(options.currentColor&&(key==='fill'||key==='stroke'||key==='stop-color'))node.attributes[key]='currentColor'
    }
    inspect(node)
  }}})}
}
function processSvg(raw:string, option:SvgOptions, prefix=''){
  if(byte(raw)>2_000_000)throw new Error('El archivo supera 2 MB.')
  const stripped=raw.replace(/^\uFEFF/,'').replace(/<!DOCTYPE\s+svg\s+(?:PUBLIC\s+["'][^"'<>]*["']\s+|SYSTEM\s+)["'][^"'<>]*["']\s*>/i,'')
  if(/<!DOCTYPE|<!ENTITY/i.test(stripped))throw new Error('El documento contiene declaraciones XML no admitidas.')
  let viewBox='',derived=false
  const colors:Record<string,number>=Object.create(null)
  const keep=(node:XastElement)=>{
    if(node.name==='svg'&&!viewBox){
      const box=node.attributes.viewBox
      if(box&&viewBoxPattern.test(box)&&box.trim().split(/[\s,]+/).slice(2).every(n=>Number.isFinite(Number(n))&&Number(n)>0))viewBox=box.trim()
      else if(box)delete node.attributes.viewBox
      if(!viewBox){
        const width=Number(node.attributes.width?.match(dimension)?.[1]),height=Number(node.attributes.height?.match(dimension)?.[1])
        viewBox='0 0 '+(width>0?width:24)+' '+(height>0?height:24);derived=true
      }
      node.attributes.viewBox=viewBox
    }
    for(const [key,value] of Object.entries(node.attributes)){
      if(paints.has(key)&&isPaint(value)){
        const name=canonicalId(value)
        colors[name]=(colors[name]??0)+1
      }
    }
  }
  // Sanitize and collect the original colour counts before normalized optimization.
  const pre=optimize(stripped,{plugins:[sanitize({...option,changes:{},currentColor:false},keep),'removeXMLProcInst']})
  if(!/^\s*(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/.test(pre.data) || !viewBox)throw new Error('Se requiere un documento con raíz <svg>.')
  const plugins:Config['plugins']=[
    sanitize(option,()=>{}),
    {name:'preset-default',params:{overrides:{removeMetadata:option.removeMetadata?undefined:false,removeComments:option.removeComments?undefined:false,
      removeEditorsNSData:option.removeEditors?undefined:false,cleanupIds:option.cleanupIds?undefined:false,removeDesc:false,convertColors:false,
      inlineStyles:false,minifyStyles:false,removeHiddenElems:false}}},
    ...(option.removeTitle?['removeTitle' as const]:[]),...(option.removeDesc?['removeDesc' as const]:[]),
    ...(option.removeDimensions?['removeDimensions' as const]:[]),
  ]
  let svg=optimize(pre.data,{plugins,floatPrecision: Math.min(6, Math.max(0, Number(option.precision) || 0)),multipass:option.multipass}).data
  if(prefix)svg=optimize(svg,{plugins:[{name:'prefixIds',params:{prefix,delim:'-',prefixClassNames:false}}]}).data
  const header=rootSvg(svg)
  if(header){
    if(!/\bxmlns=/.test(header))svg=svg.replace(header,header.replace(/^<svg/,'<svg xmlns="http://www.w3.org/2000/svg"'))
    const adjusted=rootSvg(svg)!
    if(!/\bviewBox=/.test(adjusted))svg=svg.replace(adjusted,adjusted.replace(/^<svg/,'<svg viewBox="'+encode(viewBox)+'"'))
    svg=svg.replace(/^[\s\S]*?(?=<svg\b)/,'')
  }
  return {svg, original:pre.data, viewBox, derived, colors}
}
export function sanitizedSvg(raw:string){ return processSvg(raw,{...defaultSvgOptions(),cleanupIds:false,multipass:false}).svg }

function makeSymbol(svg:string,id:string,viewBox:string){
  const header=rootSvg(svg)
  if(!header)return '<symbol id="'+id+'" viewBox="'+viewBox+'"></symbol>'
  const attrs:Record<string,string>={}
  for(const item of header.matchAll(/\s+([\w:-]+)="([^"]*)"/g)){
    if(item[1]&&item[2]!==undefined&&!['xmlns','xmlns:xlink','viewBox','width','height','id'].includes(item[1]))attrs[item[1]]=item[2].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&')
  }
  const inner=header.endsWith('/>')?'':svg.slice(svg.indexOf(header)+header.length,svg.lastIndexOf('</svg>'))
  return '<symbol id="'+id+'" viewBox="'+encode(viewBox)+'"'+writeAttrs(attrs)+'>'+inner+'</symbol>'
}
export function processBatch(request:SvgRequest,progress:(value:number)=>void=()=>{}):SvgResult{
  const result:SvgResult={entries:[],icons:[],warnings:[]}
  const names=new Set<string>(), seen=new Set<string>()
  const recolor=new Set(request.recolor)
  for(const [index,source] of request.sources.entries()){
    try{
      const candidate=iconName(source.name),stem=candidate.length>64?candidate.slice(0,64).replace(/-$/,''):candidate
      let id=stem, suffix=2
      while(names.has(id))id=stem+'-'+suffix++
      const sprite=request.kind==='sprite'
      const option={...request.options,currentColor:request.options.currentColor||recolor.has(source.name),removeDimensions:sprite||request.options.removeDimensions}
      const entry=processSvg(source.text,option,!sprite&&option.prefix?id:'')
      if(entry.derived)result.warnings.push(source.name+' · viewBox deducido de las dimensiones o de 24 × 24.')
      if(sprite){
        if(seen.has(entry.svg)){result.warnings.push(source.name+' · duplicado omitido.');continue}
        names.add(id);seen.add(entry.svg)
        const prefixed=optimize(entry.svg,{plugins:[{name:'prefixIds',params:{prefix:id,delim:'-',prefixClassNames:false}}]}).data
        const value:Icon={id,name:source.name,svg:entry.svg,symbol:makeSymbol(prefixed,id,entry.viewBox)}
        result.icons.push(value)
      }else{
        result.entries.push({name:source.name,before:byte(source.text),...entry})
      }
    }catch(e){result.warnings.push(source.name+' · '+(e instanceof Error? e.message:'No se pudo procesar.'))}
    finally{progress(Math.round((index+1)/request.sources.length*100))}
  }
  return result
}

export function prepareVector(source:string) {
  const svg=sanitizedSvg(source)
  const viewBox=svg.match(/\bviewBox="([^"]+)"/)?.[1]?.split(/[\s,]+/).map(Number)
  if(!viewBox||viewBox.length!==4)throw new Error('SVG sin dimensiones de vista válidas.')
  const [, , rawWidth, rawHeight]=viewBox as [number,number,number,number]
  const factor=Math.min(1536/Math.max(rawWidth,rawHeight),1024/Math.min(rawWidth,rawHeight))
  const width=Math.max(1,Math.round(factor*rawWidth)),height=Math.max(1,Math.round(factor*rawHeight))
  return {width:rawWidth,height:rawHeight,svg,raster:svg.replace(/^<svg[\s\S]*?>/,header=>header.replace(/\s(?:width|height)="[^"]*"/g,'').replace(/^<svg/,'<svg width="'+width+'" height="'+height+'"'))}
}
