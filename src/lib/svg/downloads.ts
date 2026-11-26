import { strToU8, zipSync } from 'fflate'
import { htmlText } from '../html-sandbox'
import { componentName, iconName, type Icon, type SvgEntry } from './model'
export function zipFiles(files:Record<string,string|Uint8Array>){
  return new Blob([new Uint8Array(zipSync(Object.fromEntries(Object.entries(files).map(([name,content])=>[name,typeof content==='string'?strToU8(content):content])),{level:3}))],{type:'application/zip'})
}
export const dataUrl=(svg:string)=>'data:image/svg+xml,'+encodeURIComponent(svg).replace(/['()]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())
export function sprite(icons:Icon[]){
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true">\n  '+icons.map(icon=>icon.symbol).join('\n  ')+'\n</svg>'
}
export const usage=(id:string,accessible=false,external=false)=>{
  const url=(external?'sprite.svg':'')+'#'+id
  return '<svg class="icon" '+(accessible?'role="img" aria-label="'+htmlText(id.replaceAll('-',' '))+'"':'aria-hidden="true"')+'><use href="'+url+'"/></svg>'
}
const examples=(icons:Icon[])=>icons.map(icon=>'<li>'+usage(icon.id)+'<code>'+icon.id+'</code></li>').join('\n')
export function iconFiles(icons:Icon[]){
  const types='export type IconName = '+(icons.map(icon=>JSON.stringify(icon.id)).join(' | ')||'never')+';\n'
  return {
    'sprite.svg':sprite(icons),
    'catalog.html':'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Catálogo de iconos</title>'+
      '<style>body{font-family:system-ui;margin:2rem}ul{padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(8rem,1fr));gap:1rem;list-style:none}li{border:1px solid #899b95;border-radius:.6rem;padding:1rem;text-align:center}.icon{width:3rem;height:3rem;display:block;margin:0 auto .5rem}</style><h1>Catálogo de iconos</h1>'+
      '<div style="position:absolute;width:0;height:0;overflow:hidden">'+sprite(icons)+'</div><ul>'+examples(icons)+'</ul></html>',
    'icons.d.ts':types,
    'Icon.tsx':'import type { SVGProps } from "react";\nimport type { IconName } from "./icons";\nexport function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {\n  return <svg aria-hidden="true" {...props}><use href={\x60sprite.svg#\x24{name}\x60}/></svg>;\n}',
    'Icon.vue':'<script setup lang="ts">\nimport type { IconName } from "./icons"\ndefineProps<{name: IconName}>()\n<\/script>\n<template><svg aria-hidden="true"><use :href="\'sprite.svg#\' + name" /></svg></template>',
  }
}
const jsxAliases:Record<string,string>={
  class:'className', 'xlink:href':'xlinkHref','xmlns:xlink':'xmlnsXlink','xml:lang':'xmlLang','xml:space':'xmlSpace',tabindex:'tabIndex',
}
const jsxName=(key:string)=>jsxAliases[key]??(key.startsWith('aria-')||key.startsWith('data-')?key:key.replace(/-([a-z])/g,(_,char:string)=>char.toUpperCase()))
function jsx(node:Node,root=false):string{
  if(node.nodeType===3)return node.textContent?'{'+JSON.stringify(node.textContent)+'}':''
  if(node.nodeType!==1)return ''
  const element=node as Element
  const attrs=[...element.attributes].filter(a=>!root||!['width','height'].includes(a.name))
    .map(a=>' '+jsxName(a.name)+'={'+JSON.stringify(a.value)+'}').join('')
  const inner=Array.from(element.childNodes,child=>jsx(child)).join('')
  const extra=root?' width="1em" height="1em" {...props}':''
  return '<'+element.localName+attrs+extra+(inner?'>'+inner+'</'+element.localName+'>':' />')
}
export function optimizedFiles(entry:SvgEntry){
  const name=componentName(entry.name)
  const root=new DOMParser().parseFromString(entry.svg,'image/svg+xml').documentElement
  const react=root.localName==='svg'?jsx(root,true):'<svg {...props} />'
  const svgWithAttrs=entry.svg.replace(/^<svg/,'<svg v-bind="$attrs"')
  const svelte=entry.svg.replace(/^<svg/,'<svg {...props}')
  return { svg:entry.svg, tsx:'import type { SVGProps } from "react";\n\nexport function '+name+'(props: SVGProps<SVGSVGElement>) {\n  return '+react+';\n}\n',
    jsx:'export function '+name+'(props) {\n  return '+react+';\n}\n',vue:'<template>\n  '+svgWithAttrs+'\n</template>',
    svelte:'<script>\n  let props = $props();\n<\/script>\n'+svelte,plaintext:dataUrl(entry.svg) }
}
export function optimizedArchive(entries:SvgEntry[]){
  const used=new Set<string>()
  const files:Record<string,string>={}
  for(const entry of entries){
    const stem=iconName(entry.name)
    let name=stem
    for(let n=2;used.has(name);n++)name=stem+'-'+n
    used.add(name);files[name+'.svg']=entry.svg
  }
  return files
}
